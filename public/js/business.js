const api = createApi('staff');

/*
 * UI copy of the permission table, used ONLY to decide which panels to show.
 * The server enforces the real rules on every request (src/config/roles.js).
 */
const MANAGER = ['orders:read', 'staff:read', 'staff:invite', 'staff:deactivate'];
const UI_PERMISSIONS = {
  kitchen: ['orders:read'],
  delivery: ['deliveries:read_assigned'],
  manager: MANAGER,
  owner: [...MANAGER, 'audit:read'],
  admin: ['staff:read', 'staff:invite', 'staff:deactivate', 'audit:read'],
};
const MANAGEABLE = { manager: ['kitchen', 'delivery'], owner: ['kitchen', 'delivery', 'manager', 'admin'], admin: ['kitchen', 'delivery', 'manager'] };
const ROLE_LABELS = { kitchen: 'Kitchen', delivery: 'Delivery', manager: 'Manager', owner: 'Owner', admin: 'System admin' };
const ROLE_SUMMARY = {
  owner: 'You can invite and remove staff, see every order and review the activity log.',
  manager: 'You can invite kitchen and delivery staff and see incoming orders.',
  admin: 'You manage staff accounts and can review the activity log.',
  kitchen: 'Incoming orders appear here as customers place them.',
  delivery: 'Deliveries assigned to you appear here.',
};
const AUDIT_LABELS = {
  OWNER_ACCOUNT_CREATED: 'Owner account created',
  OWNER_SETUP_FAILED: 'Owner setup attempt with wrong key',
  STAFF_REGISTERED: 'Staff member joined',
  STAFF_REGISTER_FAILED: 'Join attempt with invalid invite',
  STAFF_LOGIN: 'Signed in',
  STAFF_LOGIN_FAILED: 'Failed sign-in',
  STAFF_LOGIN_BLOCKED_LOCKED: 'Sign-in blocked (account locked)',
  STAFF_INVITE_CREATED: 'Invite code created',
  STAFF_DEACTIVATED: 'Staff member removed',
};

const can = (role, perm) => (UI_PERMISSIONS[role] || []).includes(perm);
const rolePill = (role, inactive) =>
  el('span', { class: `pill ${inactive ? 'pill-inactive' : `pill-${role}`}`, text: inactive ? 'Removed' : ROLE_LABELS[role] || role });

let me = null;
const selectTab = setupTabs($('.tabbed'), () => $$('form', $('.tabbed')).forEach(clearErrors));

function show(screen) {
  $$('[data-screen]').forEach((s) => { s.hidden = s.dataset.screen !== screen; });
}

function showAuth(message, tab = 'login') {
  me = null;
  const notice = $('#session-notice');
  notice.textContent = message || '';
  notice.hidden = !message;
  selectTab(tab);
  show('auth');
}

/** Returns true if the error means the session is over (and handles it). */
function sessionEnded(err) {
  if (!SESSION_ENDED.includes(err.code)) return false;
  showAuth('Your session has ended. Log in again.');
  return true;
}

// ---------------- sign-in forms ----------------
function handleAuthForm(id, label, call) {
  $(id).addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    busy($('button[type=submit]', form), label, async () => {
      try {
        clearErrors(form);
        const user = await call(formValues(form));
        form.reset();
        renderDashboard(user);
      } catch (err) { showErrors(form, err); }
    });
  });
}
handleAuthForm('#login-form', 'Logging in…', (v) => api.login(v));
handleAuthForm('#join-form', 'Joining…', (v) => api.register(v));
handleAuthForm('#setup-form', 'Creating account…', (v) => api.setupOwner(v));

// Keep PIN fields to digits only
$$('.pin-input').forEach((input) => input.addEventListener('input', () => {
  input.value = input.value.replace(/\D/g, '').slice(0, 6);
}));

// ---------------- dashboard ----------------
function renderDashboard(user) {
  me = user;
  $('#me-name').textContent = user.name;
  const pill = $('#me-role');
  pill.textContent = ROLE_LABELS[user.role];
  pill.className = `pill pill-${user.role}`;
  $('#greeting').textContent = `Hello, ${user.name.split(' ')[0]}`;
  $('#role-summary').textContent = ROLE_SUMMARY[user.role] || '';

  $$('[data-perm]').forEach((p) => { p.hidden = !can(user.role, p.dataset.perm); });

  const roleSelect = $('#invite-role');
  roleSelect.replaceChildren(...(MANAGEABLE[user.role] || []).map((r) => el('option', { value: r, text: ROLE_LABELS[r] })));
  $('#ticket-slot').replaceChildren();

  show('dashboard');
  if (can(user.role, 'staff:read')) loadTeam();
  if (can(user.role, 'orders:read')) loadOrders('/api/orders?limit=20', '#orders', 'No orders yet. New orders from the customer app will appear here.');
  if (can(user.role, 'deliveries:read_assigned')) loadOrders('/api/orders/deliveries/assigned', '#deliveries', 'No deliveries assigned to you right now.');
  if (can(user.role, 'audit:read')) loadAudit();
}

async function loadTeam() {
  const table = $('#team');
  try {
    const { staff } = await api.get('/api/staff');
    table.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', { text: 'Name' }), el('th', { text: 'Role' }), el('th', { text: 'Last sign-in' }), el('th'))),
      el('tbody', {}, staff.map((s) => {
        const removable = s.isActive && s.id !== me.id && (MANAGEABLE[me.role] || []).includes(s.role);
        return el('tr', {},
          el('td', {}, el('strong', { text: s.name }), el('span', { class: 'sub', text: s.email })),
          el('td', {}, rolePill(s.role, !s.isActive)),
          el('td', { class: 'nowrap', text: s.lastLoginAt ? formatDate(s.lastLoginAt) : 'Never' }),
          el('td', {}, removable
            ? el('button', { class: 'btn btn-small btn-quiet', onclick: () => deactivate(s) }, 'Remove access')
            : null));
      })));
  } catch (err) {
    if (!sessionEnded(err)) table.replaceChildren(el('caption', { text: err.message }));
  }
}

async function deactivate(staff) {
  if (!confirm(`Remove ${staff.name}'s access? They will be signed out on every device straight away.`)) return;
  try {
    await api.patch(`/api/staff/${staff.id}/deactivate`);
    loadTeam();
    if (can(me.role, 'audit:read')) loadAudit();
  } catch (err) {
    if (!sessionEnded(err)) alert(err.message);
  }
}

async function loadOrders(path, target, emptyText) {
  const box = $(target);
  try {
    const { orders } = await api.get(path);
    if (!orders.length) return box.replaceChildren(el('p', { class: 'empty', text: emptyText }));
    box.replaceChildren(...orders.map((o) => el('div', { class: 'order-row' },
      el('div', {},
        el('strong', { text: `#${o._id.slice(-6).toUpperCase()}` }),
        el('span', { class: 'sub', text: o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ') })),
      el('div', {}, el('span', { class: 'pill', text: statusLabel(o.status) }), el('span', { class: 'sub money', text: formatRand(o.totalAmount) })))));
  } catch (err) {
    if (!sessionEnded(err)) box.replaceChildren(el('p', { class: 'empty', text: err.message }));
  }
}

async function loadAudit() {
  const table = $('#audit');
  try {
    const { items } = await api.get('/api/staff/audit-logs?limit=20');
    if (!items.length) return table.replaceChildren(el('caption', { text: 'Nothing recorded yet.' }));
    table.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', { text: 'When' }), el('th', { text: 'What happened' }), el('th', { text: 'Details' }), el('th', { text: 'IP address' }))),
      el('tbody', {}, items.map((a) => el('tr', {},
        el('td', { class: 'nowrap', text: formatDate(a.createdAt) }),
        el('td', { text: AUDIT_LABELS[a.action] || a.action }),
        el('td', { text: auditDetails(a.meta) }),
        el('td', { class: 'mono', text: a.ip || '' })))));
  } catch (err) {
    if (!sessionEnded(err)) table.replaceChildren(el('caption', { text: err.message }));
  }
}

function auditDetails(meta) {
  if (!meta) return '';
  const parts = [];
  if (meta.email) parts.push(meta.email);
  if (meta.role) parts.push(ROLE_LABELS[meta.role] || meta.role);
  if (meta.reason) parts.push(meta.reason.replace(/_/g, ' '));
  return parts.join(', ');
}

$('#invite-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  busy($('button[type=submit]', form), 'Creating…', async () => {
    try {
      clearErrors(form);
      const invite = await api.post('/api/staff/invites', formValues(form));
      form.reset();
      $('#ticket-slot').replaceChildren(renderTicket(invite));
      if (can(me.role, 'audit:read')) loadAudit();
    } catch (err) {
      if (!sessionEnded(err)) showErrors(form, err);
    }
  });
});

function renderTicket(invite) {
  const copyBtn = el('button', { class: 'btn btn-small btn-dark', type: 'button' }, 'Copy code');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(invite.inviteCode); copyBtn.textContent = 'Copied'; }
    catch { copyBtn.textContent = 'Select and copy the code'; }
  });
  return el('div', { class: 'ticket-wrap' },
    el('div', { class: 'ticket', role: 'group', 'aria-label': 'Invite code' },
      el('div', { class: 'ticket-head' }, el('span', { text: 'BREAD BAR' }), el('span', { text: 'STAFF INVITE' })),
      el('p', { class: 'ticket-code', text: invite.inviteCode }),
      el('dl', {},
        el('dt', { text: 'For' }), el('dd', { text: invite.email }),
        el('dt', { text: 'Role' }), el('dd', { text: ROLE_LABELS[invite.role] }),
        el('dt', { text: 'Expires' }), el('dd', { text: formatDate(invite.expiresAt) })),
      el('div', { class: 'ticket-foot' }, el('span', { text: 'Works once. Hand it over in person.' }), copyBtn)));
}

$('#logout').addEventListener('click', async () => {
  await api.logout();
  showAuth('You have logged out.');
});

(async () => {
  const user = await api.resume();
  if (user) renderDashboard(user); else showAuth();
})();
