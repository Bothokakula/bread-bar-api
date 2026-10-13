/**
 * Observer for order, stock, and menu changes.
 * Socket.IO (and tests) subscribe; services only publish.
 */
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(event) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[orderEvents] listener failed', err.message);
    }
  }
}

module.exports = { subscribe, publish };
