const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const customerToken = jwt.sign({ role: 'customer', tv: 0 }, process.env.JWT_CUSTOMER_SECRET, {
  subject: 'a'.repeat(24), audience: 'breadbar-customer-app', issuer: 'breadbar-api', expiresIn: '5m',
});

describe('new routes reject anonymous and cross-app tokens', () => {
  test('menu changes require a staff token', async () => {
    const res = await request(app).post('/api/menu').send({ name: 'Pizza', category: 'Pizza', price: 80 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('stock, reports, and orders are closed without a token', async () => {
    expect((await request(app).get('/api/stock')).status).toBe(401);
    expect((await request(app).get('/api/reports/dashboard')).status).toBe(401);
    expect((await request(app).post('/api/orders').send({})).status).toBe(401);
    expect((await request(app).post('/api/reviews').send({})).status).toBe(401);
  });

  test('a customer token cannot open staff stock routes', async () => {
    const res = await request(app).post('/api/stock').set('Authorization', `Bearer ${customerToken}`).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});
