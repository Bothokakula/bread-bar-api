const api = createApi('customer');
const selectTab = setupTabs($('.tabbed'), () => { clearErrors($('#login-form')); clearErrors($('#register-form')); });

function show(screen) {
  $$('[data-screen]').forEach((s) => { s.hidden = s.dataset.screen !== screen; });
}

function showAuth(message) {
  const notice = $('#session-notice');
  notice.textContent = message || '';
  notice.hidden = !message;
  selectTab('login');
  show('auth');
}

async function renderProfile(user) {
  $('#avatar').textContent = user.name.trim().charAt(0).toUpperCase();
  $('#profile-name').textContent = user.name;
  $('#profile-contact').textContent = user.phone || user.email;
  $('#points').textContent = user.loyaltyPoints ?? 0;
  show('profile');
  await loadOrders();
}

async function loadOrders() {
  const box = $('#orders');
  box.replaceChildren(el('p', { class: 'empty', text: 'Loading your orders…' }));
  try {
    const { orders } = await api.get('/api/orders/mine');
    if (!orders.length) {
      box.replaceChildren(el('p', { class: 'empty', text: 'No orders yet. Your orders will show here once you place one.' }));
      return;
    }
    box.replaceChildren(...orders.map((o) => el('div', { class: 'order-card' },
      el('div', { class: 'top' },
        el('span', { text: `Order #${o._id.slice(-6).toUpperCase()}` }),
        el('span', { class: 'money', text: formatRand(o.totalAmount) })),
      el('p', { class: 'sub', text: `${o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}` }),
      el('p', { class: 'sub', text: `${statusLabel(o.status)} · ${formatDate(o.createdAt)}` }))));
  } catch (err) {
    if (SESSION_ENDED.includes(err.code)) return showAuth('Your session has ended. Log in again.');
    box.replaceChildren(el('p', { class: 'empty', text: err.message }));
  }
}

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  busy($('button[type=submit]', form), 'Logging in…', async () => {
    try {
      clearErrors(form);
      const user = await api.login(formValues(form));
      form.reset();
      await renderProfile(user);
    } catch (err) { showErrors(form, err); }
  });
});

$('#register-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  busy($('button[type=submit]', form), 'Creating account…', async () => {
    try {
      clearErrors(form);
      const values = formValues(form);
      if (values.phone) values.phone = values.phone.replace(/\s+/g, '');
      const user = await api.register(values);
      form.reset();
      await renderProfile(user);
    } catch (err) { showErrors(form, err); }
  });
});

$('#logout').addEventListener('click', async () => {
  await api.logout();
  showAuth('You have logged out.');
});

$('#logout-all').addEventListener('click', async () => {
  try { await api.post('/api/customer/auth/logout-all'); } catch { /* already signed out */ }
  await api.logout();
  showAuth('You have been logged out on all your devices.');
});

(async () => {
  const user = await api.resume();
  if (user) renderProfile(user); else showAuth();
})();
