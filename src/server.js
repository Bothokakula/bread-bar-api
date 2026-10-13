const http = require('http');
const mongoose = require('mongoose');
const env = require('./config/env');
const app = require('./app');
const { connectDB } = require('./config/db');
const { attachSocket } = require('./realtime/socket');

(async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    attachSocket(server);
    server.listen(env.port, () => {
      console.log(`Bread Bar API listening on port ${env.port} (${env.nodeEnv})`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received - shutting down`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
