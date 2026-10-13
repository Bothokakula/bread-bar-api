const AppError = require('../utils/AppError');
const Customer = require('../models/Customer');
const { hashSecret, compareSecret } = require('../utils/password');
const { isLocked, lockedError, recordFailedAttempt, recordSuccessfulLogin } = require('../utils/lockout');
const { createSession } = require('./session.service');

const INVALID_LOGIN = () => new AppError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS');

async function register({ name, email, phone, password }) {
  if (await Customer.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  }

  let customer;
  try {
    customer = await Customer.create({ name, email, phone, passwordHash: await hashSecret(password) });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    throw err;
  }

  return createSession(customer, 'customer');
}

async function login({ email, password }) {
  const customer = await Customer.findOne({ email }).select('+passwordHash');
  if (isLocked(customer)) throw lockedError();

  // Always runs bcrypt, even for unknown emails, so response time gives nothing away.
  const passwordOk = await compareSecret(password, customer && customer.passwordHash);

  if (!customer || !passwordOk) {
    if (customer) await recordFailedAttempt(Customer, customer._id);
    throw INVALID_LOGIN();
  }

  await recordSuccessfulLogin(Customer, customer._id);
  return createSession(customer, 'customer');
}

async function getProfile(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError(404, 'Account not found', 'NOT_FOUND');
  return customer.toJSON();
}

module.exports = { register, login, getProfile };
