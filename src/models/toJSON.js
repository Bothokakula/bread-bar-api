/** Fields that must never leave the server, even by accident. */
const PRIVATE_FIELDS = ['passwordHash', 'pinHash', 'tokenVersion', 'failedLoginAttempts', 'lockUntil', '__v'];

function stripPrivateFields(doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  for (const field of PRIVATE_FIELDS) delete ret[field];
  return ret;
}

module.exports = { stripPrivateFields };
