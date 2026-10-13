/**
 * HTTP-level checks that are rejected BEFORE any database access,
 * so they run without MongoDB.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');

mongoose.set('bufferCommands', false); // fail fast if a test accidentally hits the DB

const customerToken = jwt.sign({ role: 'customer', tv: 0 }, process.env.JWT_CUSTOMER_SECRET, {
  subject: 'a'.repeat(24), audience: 'breadbar-customer-app', issuer: 'breadbar-api', expiresIn: '5m',
});

describe('route protection', () => {
  test('staff routes reject requests without a token', async () => {
    const res = await request(app).get('/api/staff');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('a CUSTOMER token cannot be used on STAFF routes', async () => {
    const res = await request(app).get('/api/staff').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('a forged token (customer secret, staff audience) is rejected', async () => {
    const forged = jwt.sign({ role: 'owner', tv: 0 }, process.env.JWT_CUSTOMER_SECRET, {
      subject: 'a'.repeat(24), audience: 'breadbar-business-app', issuer: 'breadbar-api',
    });
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('"alg: none" tokens are rejected', async () => {
    const none = jwt.sign({ role: 'owner', tv: 0 }, null, {
      algorithm: 'none', subject: 'a'.repeat(24), audience: 'breadbar-business-app', issuer: 'breadbar-api',
    });
    const res = await request(app).get('/api/staff').set('Authorization', `Bearer ${none}`);
    expect(res.status).toBe(401);
  });

  test('expired tokens return TOKEN_EXPIRED so the app knows to refresh', async () => {
    const expired = jwt.sign({ role: 'customer', tv: 0, exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_CUSTOMER_SECRET, { subject: 'a'.repeat(24), audience: 'breadbar-customer-app', issuer: 'breadbar-api' });
    const res = await request(app).get('/api/customer/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('validation at the HTTP layer', () => {
  test('staff login without PIN is rejected with field details', async () => {
    const res = await request(app).post('/api/staff/auth/login').send({ email: 'owner@breadbar.co.za', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('pin');
  });

  test('customer cannot register with a role field', async () => {
    const res = await request(app).post('/api/customer/auth/register')
      .send({ name: 'Eve', email: 'eve@x.com', password: 'Pizza2026', role: 'owner' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/Unexpected field/);
  });

  test('NoSQL injection in login is neutralised', async () => {
    const res = await request(app).post('/api/customer/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  test('malformed JSON and oversized bodies get safe errors', async () => {
    const bad = await request(app).post('/api/customer/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(bad.status).toBe(400);
    const big = await request(app).post('/api/customer/auth/login').send({ email: 'a'.repeat(20000) });
    expect(big.status).toBe(413);
  });

  test('security headers are set', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
