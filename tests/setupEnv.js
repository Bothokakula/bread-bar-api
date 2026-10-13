process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/breadbar-test';
process.env.JWT_CUSTOMER_SECRET = 'c'.repeat(64);
process.env.JWT_STAFF_SECRET = 's'.repeat(64);
process.env.BUSINESS_SETUP_KEY = 'test-business-setup-key';
