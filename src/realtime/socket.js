const { Server } = require('socket.io');
const env = require('../config/env');
const Customer = require('../models/Customer');
const Staff = require('../models/Staff');
const { verifyAccessToken, peekUserType } = require('../utils/tokens');
const { hasPermission } = require('../config/roles');
const { subscribe } = require('../services/orderEvents');

function attachSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const userType = token && peekUserType(token);
      if (!userType) return next(new Error('AUTH_REQUIRED'));

      const payload = verifyAccessToken(token, userType);
      const Model = userType === 'staff' ? Staff : Customer;
      const user = await Model.findById(payload.sub).select('role tokenVersion isActive').lean();
      const inactiveStaff = userType === 'staff' && user && !user.isActive;
      if (!user || user.tokenVersion !== payload.tv || inactiveStaff) return next(new Error('SESSION_REVOKED'));

      socket.user = { id: String(user._id), role: user.role, type: userType };
      return next();
    } catch (err) {
      return next(new Error(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    if (user.type === 'customer') {
      socket.join(`customer:${user.id}`);
      return;
    }
    if (hasPermission(user.role, 'orders:read')) socket.join('kitchen');
    if (user.role === 'delivery') socket.join(`delivery:${user.id}`);
    if (hasPermission(user.role, 'stock:manage') || hasPermission(user.role, 'reports:read')) {
      socket.join('managers');
    }
  });

  subscribe((event) => {
    if (event.type === 'order:created') {
      io.to('kitchen').emit('order:created', { order: event.order });
    } else if (event.type === 'order:updated') {
      const payload = { order: event.order };
      io.to('kitchen').emit('order:updated', payload);
      io.to(`customer:${event.order.customerId}`).emit('order:updated', payload);
      if (event.order.assignedDriverId) {
        io.to(`delivery:${event.order.assignedDriverId}`).emit('order:updated', payload);
      }
    } else if (event.type === 'stock:low') {
      io.to('managers').emit('stock:low', { items: event.items });
    } else if (event.type === 'menu:updated') {
      io.emit('menu:updated', { resource: event.resource });
    }
  });

  return io;
}

module.exports = { attachSocket };
