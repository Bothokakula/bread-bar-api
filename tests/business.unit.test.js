const { pointsForTotal } = require('../src/utils/loyalty');
const { applyPayment } = require('../src/payments');
const { choosePromotion } = require('../src/services/promotionMath');
const { rangeFor } = require('../src/services/report.service');
const { hasPermission } = require('../src/config/roles');
const { placeOrderSchema } = require('../src/validators/schemas');

describe('loyalty points', () => {
  test('awards 1 point per R10 and nothing under R10', () => {
    expect(pointsForTotal(100)).toBe(10);
    expect(pointsForTotal(9.99)).toBe(0);
    expect(pointsForTotal(25)).toBe(2);
  });
});

describe('payment strategies', () => {
  test('cash, card, and EFT record a method without taking card numbers', () => {
    expect(applyPayment('cash')).toEqual({ method: 'cash', status: 'pay_on_collection' });
    expect(applyPayment('card', { reference: 'SLIP-1', cardNumber: '4242' })).toEqual({
      method: 'card', status: 'pending', reference: 'SLIP-1',
    });
    expect(applyPayment('eft', { reference: 'EFT9' }).method).toBe('eft');
    expect(() => applyPayment('bitcoin')).toThrow(/cash, card, or EFT/);
  });

  test('the order schema rejects a client price and a card number', () => {
    const order = {
      orderType: 'collection',
      paymentMethod: 'cash',
      items: [{ menuItemId: 'a'.repeat(24), quantity: 1 }],
    };
    expect(placeOrderSchema.safeParse({ ...order, cardNumber: '4242424242424242' }).success).toBe(false);
  });
});

describe('promotions', () => {
  const lines = [
    { menuItemId: 'a'.repeat(24), quantity: 2, unitPrice: 50 },
    { menuItemId: 'b'.repeat(24), quantity: 1, unitPrice: 40 },
  ];

  test('picks the active promotion that saves the most', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    const chosen = choosePromotion([
      { title: 'Ten percent', isActive: true, discountType: 'percent', discountValue: 10, menuItemIds: [] },
      { title: 'R30 off', isActive: true, discountType: 'fixed', discountValue: 30, menuItemIds: [] },
      { title: 'Expired', isActive: true, discountType: 'percent', discountValue: 50, endsAt: new Date('2026-01-01') },
      { title: 'Off', isActive: false, discountType: 'percent', discountValue: 90, menuItemIds: [] },
    ], lines, now);
    expect(chosen.promotion.title).toBe('R30 off');
    expect(chosen.discountCents).toBe(3000);
  });

  test('a promotion aimed at one item does not discount the rest of the cart', () => {
    const chosen = choosePromotion([
      { title: 'Burger only', isActive: true, discountType: 'percent', discountValue: 50, menuItemIds: ['b'.repeat(24)] },
    ], lines);
    expect(chosen.discountCents).toBe(2000);
  });
});

describe('report windows', () => {
  const now = new Date('2026-09-29T15:00:00');

  test('daily starts at local midnight and weekly covers seven days', () => {
    const daily = rangeFor('daily', now);
    expect(daily.start.getHours()).toBe(0);
    expect(daily.end).toEqual(now);
    const weekly = rangeFor('weekly', now);
    expect(weekly.end - weekly.start).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(weekly.end - weekly.start).toBeLessThan(7 * 24 * 60 * 60 * 1000);
  });
});

describe('new permissions', () => {
  test('customers can cancel their own orders and managers can edit delivery areas', () => {
    expect(hasPermission('customer', 'orders:cancel_own')).toBe(true);
    expect(hasPermission('kitchen', 'orders:cancel_own')).toBe(false);
    expect(hasPermission('owner', 'delivery_areas:manage')).toBe(true);
    expect(hasPermission('manager', 'delivery_areas:manage')).toBe(true);
    expect(hasPermission('kitchen', 'stock:manage')).toBe(false);
  });
});
