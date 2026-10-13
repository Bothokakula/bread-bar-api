const AuditLog = require('../models/AuditLog');

/** Extracts the details we record about who made a request. */
function requestContext(req) {
  return { ip: req.ip, userAgent: (req.get('user-agent') || '').slice(0, 200) };
}

/**
 * Writes an audit record. Never throws: a logging failure must not break the
 * user's request. Never pass passwords, PINs, codes or tokens in `meta`.
 */
async function audit(action, { actorId, actorType, targetId, ctx = {}, meta } = {}) {
  try {
    await AuditLog.create({ action, actorId, actorType, targetId, ip: ctx.ip, userAgent: ctx.userAgent, meta });
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

module.exports = { audit, requestContext };
