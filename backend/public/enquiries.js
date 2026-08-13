// Enquiries — enquiries.js
// Book Visit / Contact submissions from the public marketing site.

(async function () {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'enquiries.manage')) { location.href = '/profile.html'; return; }

  renderAdminNav('enquiries', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const SOURCE_LABEL = { 'book-visit': 'Book Visit', 'contact': 'Contact' };
  const STATUS_CHIP = {
    new:       'info',
    contacted: 'warning',
    confirmed: 'primary',
    completed: 'success',
    cancelled: 'error',
  };
  const STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];

  function formatDateTime(d) {
    return new Date(d).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  // ── Load + render ────────────────────────────────────────────────────────────
  async function loadLeads() {
    const source = document.getElementById('filter-source').value;
    const status = document.getElementById('filter-status').value;

    document.getElementById('list-loading').style.display = 'block';
    document.getElementById('list-content').style.display = 'none';
    document.getElementById('list-empty').style.display   = 'none';

    try {
      const params = new URLSearchParams();
      if (source) params.set('source', source);
      if (status) params.set('status', status);
      const qs = params.toString();
      const leads = await api(`/api/admin/leads${qs ? '?' + qs : ''}`);

      document.getElementById('list-loading').style.display = 'none';
      renderStats(leads);

      if (!leads || leads.length === 0) {
        document.getElementById('list-empty').style.display = 'block';
        return;
      }

      document.getElementById('list-content').style.display = 'block';
      renderTable(leads);
    } catch (e) {
      document.getElementById('list-loading').style.display = 'none';
      showError('error-banner', 'Failed to load enquiries: ' + e.message);
    }
  }

  function renderStats(leads) {
    const count = s => leads.filter(l => l.status === s).length;
    document.getElementById('stat-new').textContent       = count('new');
    document.getElementById('stat-contacted').textContent = count('contacted');
    document.getElementById('stat-confirmed').textContent = count('confirmed');
    document.getElementById('stat-total').textContent     = leads.length;
  }

  function renderTable(leads) {
    const tbody = document.getElementById('list-tbody');
    tbody.innerHTML = leads.map(l => {
      const details = [];
      if (l.interested_plan_name) details.push(`Interested in: ${l.interested_plan_name}`);
      if (l.goal)              details.push(l.goal);
      if (l.preferred_trainer) details.push(`Trainer: ${l.preferred_trainer}`);
      if (l.preferred_date)    details.push(`${l.preferred_date}${l.preferred_time ? ' ' + l.preferred_time : ''}`);
      if (l.message)           details.push(`"${l.message}"`);

      return `
        <tr data-id="${l.id}">
          <td style="white-space: nowrap; color: var(--md-on-surface-variant); font-size: 13px;">${formatDateTime(l.created_at)}</td>
          <td><span class="chip">${SOURCE_LABEL[l.source] || l.source}</span></td>
          <td>${l.name}</td>
          <td style="font-size: 13px; color: var(--md-on-surface-variant);">
            ${l.phone ? `<div>${l.phone}</div>` : ''}
            ${l.whatsapp && l.whatsapp !== l.phone ? `<div>WhatsApp: ${l.whatsapp}</div>` : ''}
            ${l.email ? `<div>${l.email}</div>` : ''}
          </td>
          <td style="font-size: 13px; color: var(--md-on-surface-variant); max-width: 260px;">${details.join(' · ') || '—'}</td>
          <td>
            <select class="status-select" data-id="${l.id}" style="width: 130px;">
              ${STATUSES.map(s => `<option value="${s}" ${s === l.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
            </select>
          </td>
          <td class="right">
            <button class="btn btn-danger sm" data-delete="${l.id}">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', () => updateStatus(parseInt(sel.dataset.id), sel.value));
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteLead(parseInt(btn.dataset.delete)));
    });
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/admin/leads/${id}`, { method: 'PATCH', body: { status } });
      await loadLeads();
    } catch (e) {
      showError('error-banner', 'Failed to update status: ' + e.message);
    }
  }

  async function deleteLead(id) {
    if (!confirm('Delete this enquiry? This cannot be undone.')) return;
    try {
      await api(`/api/admin/leads/${id}`, { method: 'DELETE' });
      await loadLeads();
    } catch (e) {
      showError('error-banner', 'Failed to delete: ' + e.message);
    }
  }

  document.getElementById('filter-btn').addEventListener('click', loadLeads);

  // ── Initial load ──────────────────────────────────────────────────────────────
  await loadLeads();
})();
