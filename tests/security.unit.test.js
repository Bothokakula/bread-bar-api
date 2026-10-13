const {
  customerRegisterSchema, staffRegisterSchema, staffLoginSchema, placeOrderSchema, isWeakPin,
} = require('../src/validators/schemas');
const { hasPermission, canManageRole } = require('../src/config/roles');
const { requiredPermissionFor } = require('../src/services/orderWorkflow');
const { generateInviteCode, safeEqual } = require('../src/utils/crypto');
const { clean } = require('../src/middleware/sanitize');
const { requirePermission } = require('../src/middleware/authorize');

describe('input validation', () => {
  const validCustomer = { name: 'Sipho Ndlovu', email: 'SIPHO@Example.com ', password: 'Pizza2026' };

  test('accepts a valid customer and normalises the email', () => {
    const r = customerRegisterSchema.safeParse(validCustomer);
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('sipho@example.com');
  });

  test('blocks mass assignment (customer trying to set role)', () => {
    expect(customerRegisterSchema.safeParse({ ...validCustomer, role: 'owner' }).success).toBe(false);
  });

  test('rejects weak passwords', () => {
    expect(customerRegisterSchema.safeParse({ ...validCustomer, password: 'password' }).success).toBe(false);
  });

  test('rejects weak staff PINs', () => {
    for (const pin of ['123456', '000000', '987654']) expect(isWeakPin(pin)).toBe(true);
    expect(isWeakPin('482913')).toBe(false);
  });

  test('staff login requires a PIN', () => {
    expect(staffLoginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(false);
    expect(staffLoginSchema.safeParse({ email: 'a@b.co', password: 'x', pin: '482913' }).success).toBe(true);
  });

  test('staff registration requires a valid invite code and cannot choose a role', () => {
    const base = { name: 'Thabo', email: 't@b.co', password: 'Kitchen2026', pin: '482913' };
    expect(staffRegisterSchema.safeParse({ ...base, inviteCode: generateInviteCode() }).success).toBe(true);
    expect(staffRegisterSchema.safeParse({ ...base, inviteCode: 'letmein' }).success).toBe(false);
    expect(staffRegisterSchema.safeParse({ ...base, inviteCode: generateInviteCode(), role: 'owner' }).success).toBe(false);
  });

  test('orders cannot carry client-side prices', () => {
    const order = {
      orderType: 'collection',
      paymentMethod: 'cash',
      items: [{ menuItemId: 'a'.repeat(24), quantity: 1 }],
    };
    expect(placeOrderSchema.safeParse(order).success).toBe(true);
    expect(placeOrderSchema.safeParse({ ...order, totalAmount: 1 }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, paymentMethod: undefined }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, orderType: 'delivery' }).success).toBe(false); // no address
  });
});

describe('RBAC', () => {
  test('permissions follow the role table', () => {
    expect(hasPermission('customer', 'orders:read')).toBe(false);
    expect(hasPermission('kitchen', 'orders:update_status')).toBe(true);
    expect(hasPermission('kitchen', 'staff:invite')).toBe(false);
    expect(hasPermission('delivery', 'menu:manage')).toBe(false);
    expect(hasPermission('owner', 'audit:read')).toBe(true);
  });

  test('nobody can create or manage an owner; managers only manage kitchen/delivery', () => {
    for (const role of ['manager', 'owner', 'admin']) expect(canManageRole(role, 'owner')).toBe(false);
    expect(canManageRole('manager', 'manager')).toBe(false);
    expect(canManageRole('manager', 'kitchen')).toBe(true);
    expect(canManageRole('kitchen', 'delivery')).toBe(false);
  });

  test('requirePermission middleware returns 403', () => {
    const next = jest.fn();
    requirePermission('staff:invite')({ user: { role: 'kitchen' } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  test('order status transitions follow the state diagram', () => {
    expect(requiredPermissionFor('Received', 'Preparing')).toBe('orders:update_status');
    expect(requiredPermissionFor('Ready', 'OutForDelivery')).toBe('deliveries:assign');
    expect(requiredPermissionFor('Received', 'Completed')).toBeNull();
    expect(requiredPermissionFor('Completed', 'Received')).toBeNull();
  });
});

describe('crypto & sanitising', () => {
  test('invite codes are unique and well-formed', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
    expect(codes.size).toBe(1000);
    for (const c of codes) expect(c).toMatch(/^BB-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  test('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  test('strips NoSQL operators and prototype keys', () => {
    const body = JSON.parse('{"email":{"$gt":""},"a.b":1,"__proto__":{"x":1},"items":[{"$where":"1"}]}');
    clean(body);
    expect(body).toEqual({ email: {}, items: [{}] });
  });
});
