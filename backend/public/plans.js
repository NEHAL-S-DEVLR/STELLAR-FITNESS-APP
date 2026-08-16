// Membership Plans management — plans.js

(async function () {
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'finance.view')) { location.href = '/profile.html'; return; }

  renderAdminNav('plans', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  function formatINR(n) { return '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  let plans = [];
  let editingId = null;

  async function loadPlans() {
    document.getElementById('plans-loading').style.display = 'block';
    document.getElementById('plans-grid').style.display = 'none';
    document.getElementById('plans-empty').style.display = 'none';
    try {
      plans = await api('/api/admin/plans');
      document.getElementById('plans-loading').style.display = 'none';
      if (plans.length === 0) { document.getElementById('plans-empty').style.display = 'block'; return; }
      document.getElementById('plans-grid').style.display = 'grid';
      renderPlans();
    } catch (e) {
      document.getElementById('plans-loading').style.display = 'none';
      showError('error-banner', 'Failed to load plans: ' + e.message);
    }
  }

  function renderPlans() {
    document.getElementById('plans-grid').innerHTML = plans.map(p => `
      <div class="card${p.is_active ? '' : ' tonal'}" style="${p.is_active ? '' : 'opacity:0.55;'}">
        <div class="card-header">
          <h3>${p.name}${p.highlighted ? ' <span class="chip primary" style="margin-left:6px;">★ Popular</span>' : ''}</h3>
        </div>
        <div class="body" style="margin-bottom: 10px;">${p.description || 'No description'}</div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom: 10px;">
          ${p.originalPrice && p.originalPrice > p.price ? `<span style="text-decoration:line-through; color:var(--md-on-surface-variant); font-size:14px;">${formatINR(p.originalPrice)}</span>` : ''}
          <span style="font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700;">${formatINR(p.price)}</span>
          <span class="body" style="font-size:12px;">/ ${p.duration_days} days</span>
        </div>
        ${(p.features || []).length ? `<ul style="margin:0 0 12px; padding-left:18px; font-size:13px; color:var(--md-on-surface-variant);">${p.features.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
        <div class="flex gap">
          <button class="btn btn-tonal sm" data-edit="${p.id}"><span class="material-symbols-rounded">edit</span>Edit</button>
          <button class="btn btn-text sm" data-toggle="${p.id}">${p.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>
    `).join('');

    document.getElementById('plans-grid').querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.edit)));
    });
    document.getElementById('plans-grid').querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => toggleActive(parseInt(btn.dataset.toggle)));
    });
  }

  async function toggleActive(id) {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    try {
      await api(`/api/admin/plans/${id}`, { method: 'PATCH', body: { is_active: !plan.is_active } });
      await loadPlans();
    } catch (e) { showError('error-banner', 'Failed: ' + e.message); }
  }

  function resetModal() {
    editingId = null;
    document.getElementById('plan-modal-title').textContent = 'Add Plan';
    document.getElementById('pl-name').value = '';
    document.getElementById('pl-duration').value = '30';
    document.getElementById('pl-price').value = '';
    document.getElementById('pl-original-price').value = '';
    document.getElementById('pl-description').value = '';
    document.getElementById('pl-features').value = '';
    document.getElementById('pl-highlighted').checked = false;
  }

  document.getElementById('add-plan-btn').addEventListener('click', () => {
    resetModal();
    openModal('plan-modal');
  });

  function openEditModal(id) {
    const p = plans.find(x => x.id === id);
    if (!p) return;
    editingId = id;
    document.getElementById('plan-modal-title').textContent = 'Edit Plan';
    document.getElementById('pl-name').value = p.name;
    document.getElementById('pl-duration').value = p.duration_days;
    document.getElementById('pl-price').value = p.price;
    document.getElementById('pl-original-price').value = p.originalPrice || '';
    document.getElementById('pl-description').value = p.description || '';
    document.getElementById('pl-features').value = (p.features || []).join('\n');
    document.getElementById('pl-highlighted').checked = !!p.highlighted;
    openModal('plan-modal');
  }

  document.getElementById('plan-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('pl-name').value.trim();
    const duration_days = parseInt(document.getElementById('pl-duration').value, 10);
    const price = parseFloat(document.getElementById('pl-price').value);
    const original_price = document.getElementById('pl-original-price').value
      ? parseFloat(document.getElementById('pl-original-price').value) : null;
    const description = document.getElementById('pl-description').value.trim();
    const features = document.getElementById('pl-features').value.split('\n').map(f => f.trim()).filter(Boolean);
    const highlighted = document.getElementById('pl-highlighted').checked;

    if (!name || !duration_days || price == null || isNaN(price)) {
      return showError('plan-modal-error', 'Name, duration, and price are required.');
    }

    try {
      const body = { name, duration_days, price, original_price, description: description || null, features, highlighted };
      if (editingId) await api(`/api/admin/plans/${editingId}`, { method: 'PATCH', body });
      else await api('/api/admin/plans', { method: 'POST', body });
      closeModal('plan-modal');
      await loadPlans();
    } catch (e) {
      showError('plan-modal-error', 'Failed to save: ' + e.message);
    }
  });

  await loadPlans();
})();
