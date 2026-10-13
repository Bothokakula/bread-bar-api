const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const Customer = require('../src/models/Customer');
const Staff = require('../src/models/Staff');
const Order = require('../src/models/Order');
const StockItem = require('../src/models/StockItem');
const { subscribe } = require('../src/services/orderEvents');
const { awardLoyaltyIfCompleted } = require('../src/services/order.service');

jest.setTimeout(120000);

let mongo;

function tokenFor(user, type) {
  const staff = type === 'staff';
  return jwt.sign({ role: user.role, tv: 0 }, staff ? process.env.JWT_STAFF_SECRET : process.env.JWT_CUSTOMER_SECRET, {
    subject: String(user._id),
    audience: staff ? 'breadbar-business-app' : 'breadbar-customer-app',
    issuer: 'breadbar-api',
    expiresIn: '15m',
  });
}

async function seedPeople() {
  const customer = await Customer.create({
    name: 'Sipho Ndlovu', email: 'sipho@example.com', passwordHash: 'hashed', tokenVersion: 0,
  });
  const owner = await Staff.create({
    name: 'Asha Owner', email: 'owner@breadbar.co.za', role: 'owner',
    passwordHash: 'hashed', pinHash: 'hashed', isActive: true, tokenVersion: 0,
  });
  const kitchen = await Staff.create({
    name: 'Thabo Kitchen', email: 'kitchen@breadbar.co.za', role: 'kitchen',
    passwordHash: 'hashed', pinHash: 'hashed', isActive: true, tokenVersion: 0,
  });
  return {
    customer,
    owner,
    kitchen,
    customerToken: tokenFor(customer, 'customer'),
    ownerToken: tokenFor(owner, 'staff'),
    kitchenToken: tokenFor(kitchen, 'staff'),
  };
}

async function createPizza(ownerToken, { quantityOnHand = 10, reorderLevel = 2, recipeQty = 2, price = 100 } = {}) {
  const stock = await request(app)
    .post('/api/stock')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Mozzarella', unit: 'g', quantityOnHand, reorderLevel });
  expect(stock.status).toBe(201);
  const menu = await request(app)
    .post('/api/menu')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Margherita',
      category: 'Pizza',
      price,
      ingredients: [{ stockItemId: stock.body.item._id, quantity: recipeQty }],
    });
  expect(menu.status).toBe(201);
  return { stockId: stock.body.item._id, menuId: menu.body.item._id };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

describe('ordering, stock, loyalty, reviews, and reports', () => {
  test('the server prices the order, deducts stock, and restores it when the customer cancels', async () => {
    const { customerToken, ownerToken } = await seedPeople();
    const { menuId, stockId } = await createPizza(ownerToken, { quantityOnHand: 5, reorderLevel: 3, recipeQty: 2 });
    const events = [];
    const stop = subscribe((event) => events.push(event.type));

    const rejected = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderType: 'collection',
        paymentMethod: 'cash',
        totalAmount: 1,
        items: [{ menuItemId: menuId, quantity: 1 }],
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');

    const placed = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderType: 'collection', paymentMethod: 'cash', items: [{ menuItemId: menuId, quantity: 1 }] });
    expect(placed.status).toBe(201);
    expect(placed.body.order.totalAmount).toBe(100);
    expect(placed.body.order.payment).toEqual({ method: 'cash', status: 'pay_on_collection' });
    expect(events).toEqual(expect.arrayContaining(['order:created', 'stock:low']));

    let stock = await StockItem.findById(stockId).lean();
    expect(stock.quantityOnHand).toBe(3);

    const cancelled = await request(app)
      .post(`/api/orders/${placed.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.order.status).toBe('Cancelled');
    stock = await StockItem.findById(stockId).lean();
    expect(stock.quantityOnHand).toBe(5);
    stop();
  });

  test('refuses an order when ingredients are short and leaves stock unchanged', async () => {
    const { customerToken, ownerToken } = await seedPeople();
    const { menuId, stockId } = await createPizza(ownerToken, { quantityOnHand: 1, recipeQty: 2 });
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderType: 'collection', paymentMethod: 'card', paymentReference: 'SLIP1', items: [{ menuItemId: menuId, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    const stock = await StockItem.findById(stockId).lean();
    expect(stock.quantityOnHand).toBe(1);
  });

  test('applies a promotion, awards loyalty once when completed, then accepts one review', async () => {
    const people = await seedPeople();
    const { menuId } = await createPizza(people.ownerToken, { quantityOnHand: 20, reorderLevel: 1, recipeQty: 1, price: 100 });
    const promo = await request(app)
      .post('/api/promotions')
      .set('Authorization', `Bearer ${people.ownerToken}`)
      .send({ title: 'Lunch', discountType: 'percent', discountValue: 10, isActive: true });
    expect(promo.status).toBe(201);

    const placed = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${people.customerToken}`)
      .send({ orderType: 'collection', paymentMethod: 'eft', paymentReference: 'EFT1', items: [{ menuItemId: menuId, quantity: 1 }] });
    expect(placed.status).toBe(201);
    expect(placed.body.order.discount).toBe(10);
    expect(placed.body.order.totalAmount).toBe(90);

    const id = placed.body.order._id;
    const earlyReview = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${people.customerToken}`)
      .send({ orderId: id, rating: 5, comment: 'Too soon' });
    expect(earlyReview.status).toBe(409);
    expect(earlyReview.body.error.code).toBe('ORDER_NOT_COMPLETE');

    const started = await request(app)
      .patch(`/api/orders/${id}/status`)
      .set('Authorization', `Bearer ${people.kitchenToken}`)
      .send({ status: 'Preparing' });
    expect(started.status).toBe(200);
    const tooLate = await request(app)
      .post(`/api/orders/${id}/cancel`)
      .set('Authorization', `Bearer ${people.customerToken}`);
    expect(tooLate.status).toBe(409);

    for (const status of ['Ready', 'Collected', 'Completed']) {
      const step = await request(app)
        .patch(`/api/orders/${id}/status`)
        .set('Authorization', `Bearer ${people.kitchenToken}`)
        .send({ status });
      expect(step.status).toBe(200);
    }

    const me = await request(app).get('/api/customer/auth/me').set('Authorization', `Bearer ${people.customerToken}`);
    expect(me.body.user.loyaltyPoints).toBe(9);

    const order = await Order.findById(id);
    await awardLoyaltyIfCompleted(order);
    const again = await Customer.findById(people.customer._id);
    expect(again.loyaltyPoints).toBe(9);

    const review = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${people.customerToken}`)
      .send({ orderId: id, rating: 5, comment: 'Hot and on time' });
    expect(review.status).toBe(201);
    const duplicate = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${people.customerToken}`)
      .send({ orderId: id, rating: 4, comment: 'Again' });
    expect(duplicate.status).toBe(409);

    const dashboard = await request(app).get('/api/reports/dashboard').set('Authorization', `Bearer ${people.ownerToken}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.orderCount).toBe(1);
    expect(dashboard.body.salesTotal).toBe(90);
    expect(dashboard.body.bestSellers[0].name).toBe('Margherita');

    const sales = await request(app)
      .get('/api/reports/sales?period=weekly')
      .set('Authorization', `Bearer ${people.ownerToken}`);
    expect(sales.status).toBe(200);
    expect(sales.body.days.length).toBeGreaterThan(0);

    const kitchenReport = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${people.kitchenToken}`);
    expect(kitchenReport.status).toBe(403);
  });

  test('delivery fee comes from the database and unknown suburbs are rejected', async () => {
    const { customerToken, ownerToken, kitchenToken } = await seedPeople();
    const { menuId } = await createPizza(ownerToken, { quantityOnHand: 10, recipeQty: 1, price: 80 });
    await request(app)
      .post('/api/delivery-areas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ suburb: 'Eden Park', fee: 25 })
      .expect(201);

    const kitchenArea = await request(app)
      .post('/api/delivery-areas')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ suburb: 'Alberton', fee: 40 });
    expect(kitchenArea.status).toBe(403);

    const areas = await request(app).get('/api/delivery-areas');
    expect(areas.body.areas).toEqual([expect.objectContaining({ suburb: 'eden park', fee: 25 })]);

    const outside = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId: menuId, quantity: 1 }],
        deliveryAddress: { line1: '12 Main Road', suburb: 'Sandton' },
      });
    expect(outside.status).toBe(400);
    expect(outside.body.error.code).toBe('OUTSIDE_DELIVERY_AREA');

    const delivered = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId: menuId, quantity: 1 }],
        deliveryAddress: { line1: '12 Main Road', suburb: 'Eden Park' },
      });
    expect(delivered.status).toBe(201);
    expect(delivered.body.order.deliveryFee).toBe(25);
    expect(delivered.body.order.totalAmount).toBe(105);
  });

  test('the public menu hides unavailable items and a used item is archived instead of deleted', async () => {
    const { customerToken, ownerToken } = await seedPeople();
    const { menuId } = await createPizza(ownerToken);
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderType: 'collection', paymentMethod: 'cash', items: [{ menuItemId: menuId, quantity: 1 }] });

    const removed = await request(app).delete(`/api/menu/${menuId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(removed.status).toBe(200);
    expect(removed.body.deleted).toBe(false);

    const menu = await request(app).get('/api/menu');
    expect(menu.body.items).toHaveLength(0);
    const hidden = await request(app).get('/api/menu/manage').set('Authorization', `Bearer ${ownerToken}`);
    expect(hidden.body.items).toHaveLength(1);
    expect(hidden.body.items[0].isAvailable).toBe(false);
  });
});
