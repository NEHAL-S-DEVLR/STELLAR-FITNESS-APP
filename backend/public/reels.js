// Reel Requests (admin/staff view) — reels.js

(async function () {
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'reels.manage')) { location.href = '/profile.html'; return; }

  renderAdminNav('reels', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  const STATUS_CHIP = { requested: 'info', scheduled: 'warning', completed: 'success', declined: 'error' };
  const STATUSES = ['requested', 'scheduled', 'completed', 'declined'];

  function formatDateTime(d) {
    return new Date(d).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  let requests = [];

  function renderStats(list) {
    const count = s => list.filter(r => r.status === s).length;
    document.getElementById('stat-requested').textContent = count('requested');
    document.getElementById('stat-scheduled').textContent = count('scheduled');
    document.getElementById('stat-completed').textContent = count('completed');
    document.getElementById('stat-total').textContent     = list.length;
  }

  function renderTable(list) {
    const filter = document.getElementById('filter-status').value;
    const filtered = filter ? list.filter(r => r.status === filter) : list;

    document.getElementById('list-loading').style.display = 'none';
    if (!filtered.length) {
      document.getElementById('list-content').style.display = 'none';
      document.getElementById('list-empty').style.display = '';
      return;
    }
    document.getElementById('list-content').style.display = '';
    document.getElementById('list-empty').style.display = 'none';

    const tbody = document.getElementById('list-tbody');
    tbody.innerHTML = filtered.map(r => `
      <tr data-id="${r.id}">
        <td style="white-space: nowrap; color: var(--md-on-surface-variant); font-size: 13px;">${formatDateTime(r.createdAt)}</td>
        <td>
          ${r.memberName}
          ${r.memberPhone ? `<div style="font-size: 12px; color: var(--md-on-surface-variant);">${r.memberPhone}</div>` : ''}
        </td>
        <td style="font-size: 13px; color: var(--md-on-surface-variant); max-width: 260px;">${r.message || '—'}</td>
        <td style="font-size: 13px; max-width: 220px; overflow-wrap: anywhere;">
          ${r.reelUrl ? `<a href="${r.reelUrl}" target="_blank" rel="noopener">${r.reelUrl}</a>` : '<span style="color: var(--md-on-surface-variant);">Not posted yet</span>'}
        </td>
        <td>
          <select class="status-select" data-id="${r.id}" style="width: 130px;">
            ${STATUSES.map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
        </td>
        <td class="right">
          <button class="btn btn-danger sm" data-delete="${r.id}">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', () => updateStatus(parseInt(sel.dataset.id, 10), sel.value));
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteRequest(parseInt(btn.dataset.delete, 10)));
    });
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/admin/reel-requests/${id}`, { method: 'PATCH', body: { status } });
      await loadRequests();
    } catch (e) {
      showError('error-banner', 'Failed to update status: ' + e.message);
    }
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this reel request? This cannot be undone.')) return;
    try {
      await api(`/api/admin/reel-requests/${id}`, { method: 'DELETE' });
      await loadRequests();
    } catch (e) {
      showError('error-banner', 'Failed to delete: ' + e.message);
    }
  }

  async function loadRequests() {
    try {
      requests = await api('/api/admin/reel-requests');
      renderStats(requests);
      renderTable(requests);
    } catch (e) {
      showError('error-banner', 'Failed to load reel requests: ' + e.message);
    }
  }

  document.getElementById('filter-status').addEventListener('change', () => renderTable(requests));

  await loadRequests();
})();
