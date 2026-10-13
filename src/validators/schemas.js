const { z } = require('zod');
const { ORDER_STATUSES } = require('../services/orderWorkflow');

/*
 * Every schema uses .strict(): unknown fields are REJECTED. This blocks
 * mass-assignment attacks such as sending { "role": "owner" } when registering.
 */

// ---------- reusable field rules ----------
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const name = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be at most 80 characters')
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Name may only contain letters, spaces, apostrophes and hyphens');

const saMobile = z
  .string()
  .trim()
  .regex(/^(\+27|0)[6-8]\d{8}$/, 'Enter a valid South African mobile number');

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long');

const loginPassword = z.string().min(1, 'Password is required').max(72);

function isWeakPin(pin) {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 000000, 111111 ...
  return '0123456789'.includes(pin) || '9876543210'.includes(pin); // 123456, 654321 ...
}

const newPin = z
  .string()
  .regex(/^\d{6}$/, 'PIN must be exactly 6 digits')
  .refine((p) => !isWeakPin(p), 'PIN is too easy to guess - avoid repeated or sequential digits');

const loginPin = z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits');

const inviteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^BB-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, 'Invite code format is invalid');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

// ---------- customer auth ----------
const customerRegisterSchema = z
  .object({ name, email, phone: saMobile.optional(), password: newPassword })
  .strict();

const customerLoginSchema = z.object({ email, password: loginPassword }).strict();

// ---------- staff auth ----------
const ownerSetupSchema = z
  .object({ setupKey: z.string().min(1).max(200), name, email, password: newPassword, pin: newPin })
  .strict();

const staffRegisterSchema = z
  .object({ inviteCode, name, email, password: newPassword, pin: newPin })
  .strict();

const staffLoginSchema = z.object({ email, password: loginPassword, pin: loginPin }).strict();

// ---------- shared ----------
const refreshSchema = z.object({ refreshToken: z.string().min(32).max(128) }).strict();

const idParamSchema = z.object({ id: objectId }).strict();

// ---------- staff management ----------
const createInviteSchema = z
  .object({ email, role: z.enum(['kitchen', 'delivery', 'manager', 'admin']) })
  .strict();

const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

// ---------- orders ----------
const placeOrderSchema = z
  .object({
    orderType: z.enum(['collection', 'delivery']),
    items: z
      .array(z.object({ menuItemId: objectId, quantity: z.number().int().min(1).max(20) }).strict())
      .min(1, 'Your cart is empty')
      .max(30),
    deliveryAddress: z
      .object({
        line1: z.string().trim().min(3).max(120),
        suburb: z.string().trim().min(2).max(60),
      })
      .strict()
      .optional(),
    paymentMethod: z.enum(['cash', 'card', 'eft']),
    paymentReference: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9-]+$/, 'Reference may only contain letters, numbers and dashes')
      .optional(),
    // NOTE: no price or total fields - the server calculates them (NFR-S07 / NFR-DI01).
  })
  .strict()
  .refine((o) => o.orderType !== 'delivery' || o.deliveryAddress, {
    message: 'A delivery address is required for delivery orders',
    path: ['deliveryAddress'],
  });

const listOrdersQuerySchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

const updateStatusSchema = z
  .object({ status: z.enum(ORDER_STATUSES), driverId: objectId.optional() })
  .strict();

const ingredientSchema = z
  .object({ stockItemId: objectId, quantity: z.number().positive().max(100000) })
  .strict();

const menuCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(300).optional(),
    category: z.string().trim().min(2).max(40),
    price: z.number().min(0).max(100000),
    imageUrl: z.string().trim().url().max(300).optional(),
    isAvailable: z.boolean().optional(),
    ingredients: z.array(ingredientSchema).max(30).optional(),
  })
  .strict();

const menuUpdateSchema = menuCreateSchema.partial().strict().refine((body) => Object.keys(body).length > 0, {
  message: 'Nothing to update',
});

const menuQuerySchema = z
  .object({
    category: z.string().trim().min(1).max(40).optional(),
    q: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const availabilitySchema = z.object({ isAvailable: z.boolean() }).strict();

const stockWriteSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    unit: z.string().trim().min(1).max(20),
    quantityOnHand: z.number().min(0).max(1000000),
    reorderLevel: z.number().min(0).max(1000000),
  })
  .strict();

const stockUpdateSchema = stockWriteSchema.partial().strict().refine((body) => Object.keys(body).length > 0, {
  message: 'Nothing to update',
});

const deliveryAreaSchema = z
  .object({
    suburb: z.string().trim().min(2).max(60),
    fee: z.number().min(0).max(1000),
    isActive: z.boolean().optional(),
  })
  .strict();

const deliveryAreaUpdateSchema = deliveryAreaSchema.partial().strict().refine((body) => Object.keys(body).length > 0, {
  message: 'Nothing to update',
});

const promotionSchema = z
  .object({
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).optional(),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().min(0).max(100000),
    menuItemIds: z.array(objectId).max(50).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.discountType === 'percent' && body.discountValue > 100) {
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percent discount cannot be more than 100' });
    }
    if (body.startsAt && body.endsAt && body.endsAt <= body.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End date must be after the start date' });
    }
  });

const promotionUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).optional(),
    discountType: z.enum(['percent', 'fixed']).optional(),
    discountValue: z.number().min(0).max(100000).optional(),
    menuItemIds: z.array(objectId).max(50).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

const reviewSchema = z
  .object({
    orderId: objectId,
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(2).max(500).optional(),
  })
  .strict();

const salesQuerySchema = z.object({ period: z.enum(['daily', 'weekly', 'monthly']) }).strict();

module.exports = {
  isWeakPin,
  customerRegisterSchema,
  customerLoginSchema,
  ownerSetupSchema,
  staffRegisterSchema,
  staffLoginSchema,
  refreshSchema,
  idParamSchema,
  createInviteSchema,
  paginationQuerySchema,
  placeOrderSchema,
  listOrdersQuerySchema,
  updateStatusSchema,
  menuCreateSchema,
  menuUpdateSchema,
  menuQuerySchema,
  availabilitySchema,
  stockWriteSchema,
  stockUpdateSchema,
  deliveryAreaSchema,
  deliveryAreaUpdateSchema,
  promotionSchema,
  promotionUpdateSchema,
  reviewSchema,
  salesQuerySchema,
};
