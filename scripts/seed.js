/**
 * Dev seed for the front-end team. Inserts sample rows only when they are missing.
 * Requires the same .env as the API (MONGO_URI and the JWT secrets).
 *
 *   npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const StockItem = require('../src/models/StockItem');
const MenuItem = require('../src/models/MenuItem');
const DeliveryArea = require('../src/models/DeliveryArea');
const Promotion = require('../src/models/Promotion');

async function ensureStock(doc) {
  const existing = await StockItem.findOne({ name: doc.name });
  if (existing) return existing;
  return StockItem.create(doc);
}

async function main() {
  await connectDB();

  const cheese = await ensureStock({ name: 'Mozzarella', unit: 'g', quantityOnHand: 2000, reorderLevel: 400 });
  const bun = await ensureStock({ name: 'Burger bun', unit: 'each', quantityOnHand: 40, reorderLevel: 10 });
  const patty = await ensureStock({ name: 'Beef patty', unit: 'each', quantityOnHand: 30, reorderLevel: 8 });

  if (!(await MenuItem.exists({ name: 'Margherita pizza' }))) {
    await MenuItem.create({
      name: 'Margherita pizza',
      description: 'Tomato, mozzarella, and origanum.',
      category: 'Pizza',
      price: 89,
      isAvailable: true,
      ingredients: [{ stockItemId: cheese._id, quantity: 200 }],
    });
  }

  if (!(await MenuItem.exists({ name: 'Classic burger' }))) {
    await MenuItem.create({
      name: 'Classic burger',
      description: 'Beef patty, bun, and cheese.',
      category: 'Burgers',
      price: 75,
      isAvailable: true,
      ingredients: [
        { stockItemId: bun._id, quantity: 1 },
        { stockItemId: patty._id, quantity: 1 },
        { stockItemId: cheese._id, quantity: 30 },
      ],
    });
  }

  if (!(await DeliveryArea.exists({ suburb: 'eden park' }))) {
    await DeliveryArea.create({ suburb: 'Eden Park', fee: 25, isActive: true });
  }

  if (!(await Promotion.exists({ title: 'Weekday lunch' }))) {
    await Promotion.create({
      title: 'Weekday lunch',
      description: '10% off the food total.',
      discountType: 'percent',
      discountValue: 10,
      isActive: true,
    });
  }

  console.log('Seed data is in place.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
