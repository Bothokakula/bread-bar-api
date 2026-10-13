const crypto = require('crypto');

// No I, O, 0 or 1 so codes can be read aloud or written down without confusion.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Constant-time string comparison (prevents timing attacks on secrets). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** One-time staff invite code, e.g. BB-7KQ2-M9XD-4PWT (~60 bits of randomness). */
function generateInviteCode() {
  const group = () =>
    Array.from({ length: 4 }, () => INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)]).join('');
  return `BB-${group()}-${group()}-${group()}`;
}

/** Opaque random token (used for refresh tokens). */
function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { sha256, safeEqual, generateInviteCode, generateOpaqueToken };
