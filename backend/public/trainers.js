// Trainers & PT — admin module

(async function () {
  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'trainers.manage') && !hasPermission(me, 'pt.manage')) { location.href = '/profile.html'; return; }

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  renderAdminNav('trainers', me);
  const isAdmin = me.role === 'admin';

  // ── Shared state ─────────────────────────────────────────────────────────────
  let trainers  = [];
  let packages  = [];
  let assignments = [];
  let assignmentFilter = 'active';
  let staff = [];
  let permissionCatalog = [];
  let staffDefaultPermissions = ['members.manage', 'batches.manage', 'attendance.manage'];

  const money = v => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // ── Tab switching ─────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-ttab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('[data-ttab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[id^=tpanel-]').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('tpanel-' + t.dataset.ttab).classList.add('active');
    });
  });

  // ── Permission checklists (shared by Add/Edit Trainer and Add/Edit Staff) ──
  function renderPermissionChecklist(container, selectedKeys) {
    if (!container) return;
    const selected = new Set(selectedKeys || []);
    const groups = {};
    permissionCatalog.forEach(p => { (groups[p.group] = groups[p.group] || []).push(p); });
    container.innerHTML = Object.entries(groups).map(([group, perms]) => `
      <div style="margin-bottom:10px;">
        <div class="body" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${group}</div>
        ${perms.map(p => `
          <label style="display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer;">
            <input type="checkbox" value="${p.key}" ${selected.has(p.key) ? 'checked' : ''} style="width:16px; height:16px;" />
            <span style="font-size:13px;">${p.label}</span>
          </label>
        `).join('')}
      </div>
    `).join('');
  }
  function getCheckedPermissions(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TRAINERS TAB
  // ════════════════════════════════════════════════════════════════════════════

  async function loadTrainers() {
    trainers = await api('/api/admin/trainers');
    renderTrainerStats();
    renderTrainersGrid();
  }

  function renderTrainerStats() {
    document.getElementById('stat-trainer-count').textContent = trainers.length;

    // Assigned members = sum of active PT assignments across all trainers (approximation from trainer data)
    const totalAssigned = trainers.reduce((s, t) => s + (t.active_clients || 0), 0);
    document.getElementById('stat-assigned-members').textContent = totalAssigned;

    const totalCommission = trainers.reduce((s, t) => s + Number(t.commission || 0), 0);
    document.getElementById('stat-mtd-commission').textContent = money(totalCommission);
  }

  function renderTrainersGrid() {
    const grid = document.getElementById('trainers-grid');
    if (trainers.length === 0) {
      grid.innerHTML = `
        <div class="empty">
          <span class="material-symbols-rounded">sports</span>
          No trainers yet. Click "Add Trainer" to get started.
        </div>`;
      return;
    }
    grid.innerHTML = trainers.map(t => {
      const revenue   = Number(t.revenue   || 0);
      const commission = Number(t.commission || 0);
      const target    = Number(t.monthly_target || 0);
      const progress  = target > 0 ? Math.min(100, Math.round((revenue / target) * 100)) : 0;
      const fillClass = progress >= 100 ? 'success' : progress >= 60 ? '' : 'warning';
      return `
        <div class="trainer-card" style="margin-bottom: 16px;">
          <div class="avatar lg admin">${initials(t.name)}</div>
          <div class="tc-info">
            <div class="tc-name">${t.name}</div>
            <div class="tc-spec">
              ${t.specialization || 'General Trainer'} &bull;
              ${t.is_partner
                ? '<span class="chip primary" style="font-size:11px;">Partner &middot; 100% PT</span>'
                : `${t.pt_rate || 50}% PT commission (${t.active_clients || 0} active client${t.active_clients === 1 ? '' : 's'})`}
            </div>
            <div class="tc-stats">
              <div class="tc-stat">
                <div class="n">${t.admissions_mtd || 0}</div>
                <div class="l">Admissions</div>
              </div>
              <div class="tc-stat">
                <div class="n">${money(revenue)}</div>
                <div class="l">MTD Revenue</div>
              </div>
              <div class="tc-stat">
                <div class="n">${money(commission)}</div>
                <div class="l">Commission</div>
              </div>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill ${fillClass}" style="width:${progress}%"></div>
            </div>
            <div class="body">${progress}% of ${money(target)} target</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
            <button class="btn btn-tonal sm" data-stats-id="${t.id}">Stats</button>
            <button class="btn btn-text sm"  data-edit-id="${t.id}">Edit</button>
            <button class="btn btn-danger sm" data-del-id="${t.id}">Remove</button>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-stats-id]').forEach(b =>
      b.addEventListener('click', () => openTrainerStats(parseInt(b.dataset.statsId))));
    grid.querySelectorAll('[data-edit-id]').forEach(b =>
      b.addEventListener('click', () => editTrainer(parseInt(b.dataset.editId))));
    grid.querySelectorAll('[data-del-id]').forEach(b =>
      b.addEventListener('click', () => deleteTrainer(parseInt(b.dataset.delId))));
  }

  // ── Trainer Stats popup ───────────────────────────────────────────────────
  async function openTrainerStats(id) {
    const t = trainers.find(x => x.id === id);
    if (!t) return;
    document.getElementById('ts-avatar').textContent = initials(t.name);
    document.getElementById('ts-name').textContent   = t.name;
    document.getElementById('ts-spec').textContent   = t.specialization || 'General Trainer';

    openModal('trainer-stats-modal');

    // Clear while loading
    document.getElementById('ts-active-clients').textContent   = '…';
    document.getElementById('ts-assignments-mtd').textContent  = '…';
    document.getElementById('ts-revenue-mtd').textContent      = '…';
    document.getElementById('ts-commission-summary').innerHTML = '';

    let stats;
    try {
      stats = await api(`/api/admin/trainers/${id}/stats`);
    } catch (e) {
      document.getElementById('ts-commission-summary').innerHTML =
        `<div class="empty"><span class="material-symbols-rounded">error</span>${e.message}</div>`;
      return;
    }

    const revenue   = Number(stats.mtd?.totalRevenue ?? t.revenue ?? 0);
    const target    = Number(t.monthly_target || 0);
    const progress  = target > 0 ? Math.min(100, Math.round((revenue / target) * 100)) : 0;

    document.getElementById('ts-active-clients').textContent  = stats.activeClients ?? t.active_clients ?? '—';
    document.getElementById('ts-assignments-mtd').textContent = stats.mtd?.ptSessions ?? '—';
    document.getElementById('ts-revenue-mtd').textContent     = money(revenue);

    const bar = document.getElementById('ts-progress-bar');
    bar.style.width = progress + '%';
    bar.className   = 'progress-bar-fill ' + (progress >= 100 ? 'success' : progress >= 60 ? '' : 'warning');
    document.getElementById('ts-progress-label').textContent =
      `${progress}% of ${money(target)} monthly target`;

    const summaryEl = document.getElementById('ts-commission-summary');
    summaryEl.innerHTML = `
      <div class="notif" style="margin-bottom:8px;">
        <div class="n-icon general"><span class="material-symbols-rounded">payments</span></div>
        <div class="n-body">
          <div class="n-title">${t.is_partner ? 'Partner — 100% of PT revenue' : `${stats.ptRate}% of PT revenue, ${stats.membershipRate}% of membership revenue`}</div>
          <div class="n-text">PT revenue: ${money(stats.mtd?.ptRevenue || 0)} · Membership revenue: ${money(stats.mtd?.admissionRevenue || 0)}</div>
          <div class="n-when">Commission earned this month: ${money(stats.mtd?.commissionEarned || 0)}</div>
        </div>
      </div>`;
  }

  // ── File upload helper (photo/certificate) ──────────────────────────────────
  async function uploadTrainerFile(fileInput, statusEl) {
    const file = fileInput.files[0];
    if (!file) return null;
    statusEl.textContent = 'Uploading…';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: Auth.token ? { Authorization: `Bearer ${Auth.token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) { statusEl.textContent = data.error || 'Upload failed'; throw new Error(data.error || 'Upload failed'); }
    statusEl.textContent = `Uploaded: ${file.name}`;
    return data.url;
  }

  // ── Add Trainer ───────────────────────────────────────────────────────────
  document.getElementById('add-trainer-btn').addEventListener('click', () => {
    ['at-name','at-email','at-phone','at-spec','at-instagram','at-target','at-bio','at-qualifications','at-achievements']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('at-password').value = 'trainer123';
    document.getElementById('at-partner').checked = false;
    document.getElementById('at-photo-file').value = '';
    document.getElementById('at-cert-file').value = '';
    document.getElementById('at-photo-status').textContent = '';
    document.getElementById('at-cert-status').textContent = '';
    renderPermissionChecklist(document.getElementById('at-permissions'), []);
    openModal('add-trainer-modal');
  });

  document.getElementById('at-save').addEventListener('click', async () => {
    const name  = document.getElementById('at-name').value.trim();
    const email = document.getElementById('at-email').value.trim();
    if (!name || !email) return alert('Name and email are required.');
    const btn = document.getElementById('at-save');
    btn.disabled = true;
    try {
      const [photo_url, certificate_url] = await Promise.all([
        uploadTrainerFile(document.getElementById('at-photo-file'), document.getElementById('at-photo-status')),
        uploadTrainerFile(document.getElementById('at-cert-file'), document.getElementById('at-cert-status')),
      ]);
      const body = {
        name, email,
        phone:           document.getElementById('at-phone').value.trim() || null,
        specialization:  document.getElementById('at-spec').value.trim() || null,
        instagram:       document.getElementById('at-instagram').value.trim() || null,
        monthly_target:  parseFloat(document.getElementById('at-target').value) || 0,
        bio:             document.getElementById('at-bio').value.trim() || null,
        qualifications:  document.getElementById('at-qualifications').value.trim() || null,
        achievements:    document.getElementById('at-achievements').value.trim() || null,
        is_partner:      document.getElementById('at-partner').checked,
        photo_url, certificate_url,
        password:        document.getElementById('at-password').value,
        permissions:     getCheckedPermissions(document.getElementById('at-permissions')),
      };
      await api('/api/admin/trainers', { method: 'POST', body });
      closeModal('add-trainer-modal');
      await loadTrainers();
    } catch (e) { alert(e.message); } finally { btn.disabled = false; }
  });

  // ── Edit Trainer ──────────────────────────────────────────────────────────
  let editingTrainerId = null;

  function editTrainer(id) {
    editingTrainerId = id;
    const t = trainers.find(x => x.id === id);
    if (!t) return;
    document.getElementById('et-name').value          = t.name || '';
    document.getElementById('et-email').value         = t.email || '';
    document.getElementById('et-phone').value         = t.phone || '';
    document.getElementById('et-spec').value          = t.specialization || '';
    document.getElementById('et-instagram').value     = t.instagram || '';
    document.getElementById('et-target').value        = t.monthly_target || '';
    document.getElementById('et-bio').value            = t.bio || '';
    document.getElementById('et-qualifications').value = t.qualifications || '';
    document.getElementById('et-achievements').value   = t.achievements || '';
    document.getElementById('et-partner').checked      = !!t.is_partner;
    document.getElementById('et-photo-file').value = '';
    document.getElementById('et-cert-file').value  = '';
    document.getElementById('et-photo-status').textContent = t.photo_url ? 'Current photo on file' : '';
    document.getElementById('et-cert-status').textContent  = t.certificate_url ? 'Current certificate on file' : '';
    renderPermissionChecklist(document.getElementById('et-permissions'), t.permissions || []);
    openModal('edit-trainer-modal');
  }

  document.getElementById('et-save').addEventListener('click', async () => {
    const btn = document.getElementById('et-save');
    btn.disabled = true;
    try {
      const [photo_url, certificate_url] = await Promise.all([
        uploadTrainerFile(document.getElementById('et-photo-file'), document.getElementById('et-photo-status')),
        uploadTrainerFile(document.getElementById('et-cert-file'), document.getElementById('et-cert-status')),
      ]);
      const body = {
        name:            document.getElementById('et-name').value.trim(),
        email:           document.getElementById('et-email').value.trim(),
        phone:           document.getElementById('et-phone').value.trim() || null,
        specialization:  document.getElementById('et-spec').value.trim() || null,
        instagram:       document.getElementById('et-instagram').value.trim() || null,
        monthly_target:  parseFloat(document.getElementById('et-target').value) || 0,
        bio:             document.getElementById('et-bio').value.trim() || null,
        qualifications:  document.getElementById('et-qualifications').value.trim() || null,
        achievements:    document.getElementById('et-achievements').value.trim() || null,
        is_partner:      document.getElementById('et-partner').checked,
        permissions:     getCheckedPermissions(document.getElementById('et-permissions')),
      };
      if (!body.name || !body.email) return alert('Name and email are required.');
      if (photo_url) body.photo_url = photo_url;
      if (certificate_url) body.certificate_url = certificate_url;
      await api(`/api/admin/trainers/${editingTrainerId}`, { method: 'PATCH', body });
      closeModal('edit-trainer-modal');
      await loadTrainers();
    } catch (e) { alert(e.message); } finally { btn.disabled = false; }
  });

  // ── Delete Trainer ─────────────────────────────────────────────────────────
  async function deleteTrainer(id) {
    const t = trainers.find(x => x.id === id);
    if (!confirm(`Remove ${t ? t.name : 'this trainer'}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/trainers/${id}`, { method: 'DELETE' });
      await loadTrainers();
    } catch (e) { alert(e.message); }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PT PACKAGES TAB
  // ════════════════════════════════════════════════════════════════════════════

  async function loadPackages() {
    packages = await api('/api/admin/pt-packages');
    renderPackagesGrid();
  }

  function renderPackagesGrid() {
    const grid = document.getElementById('packages-grid');
    if (packages.length === 0) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1;">
          <span class="material-symbols-rounded">inventory_2</span>
          No PT packages yet. Click "Add Package" to create one.
        </div>`;
      return;
    }
    grid.innerHTML = packages.map(p => `
      <div class="card ${p.is_active ? '' : ''}" style="opacity:${p.is_active ? 1 : 0.55};">
        <div class="flex between center" style="margin-bottom:8px;">
          <div style="font-weight:700;font-size:15px;">${p.name}</div>
          <span class="chip ${p.is_active ? 'success' : 'error'}">${p.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div style="font-size:26px;font-weight:700;color:var(--md-primary);margin-bottom:4px;">${money(p.price)}</div>
        <div class="body" style="margin-bottom:6px;">
          <span class="chip">${p.validity_days} days validity</span>
        </div>
        ${p.description ? `<div class="body" style="margin:10px 0 14px;">${p.description}</div>` : '<div style="margin-bottom:14px;"></div>'}
        <div class="flex gap">
          <button class="btn btn-tonal sm" data-edit-pkg="${p.id}">
            <span class="material-symbols-rounded">edit</span>Edit
          </button>
          <button class="btn btn-danger sm" data-del-pkg="${p.id}">
            <span class="material-symbols-rounded">delete</span>Delete
          </button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('[data-edit-pkg]').forEach(b =>
      b.addEventListener('click', () => editPackage(parseInt(b.dataset.editPkg))));
    grid.querySelectorAll('[data-del-pkg]').forEach(b =>
      b.addEventListener('click', () => deletePackage(parseInt(b.dataset.delPkg))));
  }

  // ── Add Package ───────────────────────────────────────────────────────────
  document.getElementById('add-package-btn').addEventListener('click', () => {
    ['ap-name','ap-price','ap-validity','ap-desc'].forEach(id =>
      document.getElementById(id).value = '');
    openModal('add-package-modal');
  });

  document.getElementById('ap-save').addEventListener('click', async () => {
    const body = {
      name:          document.getElementById('ap-name').value.trim(),
      price:         parseFloat(document.getElementById('ap-price').value) || 0,
      validity_days: parseInt(document.getElementById('ap-validity').value) || 0,
      description:   document.getElementById('ap-desc').value.trim() || null,
    };
    if (!body.name || !body.price || !body.validity_days)
      return alert('Name, price, and validity are required.');
    try {
      await api('/api/admin/pt-packages', { method: 'POST', body });
      closeModal('add-package-modal');
      await loadPackages();
    } catch (e) { alert(e.message); }
  });

  // ── Edit Package ──────────────────────────────────────────────────────────
  let editingPackageId = null;

  function editPackage(id) {
    editingPackageId = id;
    const p = packages.find(x => x.id === id);
    if (!p) return;
    document.getElementById('ep-name').value     = p.name || '';
    document.getElementById('ep-price').value    = p.price || '';
    document.getElementById('ep-validity').value = p.validity_days || '';
    document.getElementById('ep-desc').value     = p.description || '';
    document.getElementById('ep-active').value   = String(p.is_active !== false);
    openModal('edit-package-modal');
  }

  document.getElementById('ep-save').addEventListener('click', async () => {
    const body = {
      name:          document.getElementById('ep-name').value.trim(),
      price:         parseFloat(document.getElementById('ep-price').value) || 0,
      validity_days: parseInt(document.getElementById('ep-validity').value) || 0,
      description:   document.getElementById('ep-desc').value.trim() || null,
      is_active:     document.getElementById('ep-active').value === 'true',
    };
    if (!body.name || !body.price || !body.validity_days)
      return alert('Name, price, and validity are required.');
    try {
      await api(`/api/admin/pt-packages/${editingPackageId}`, { method: 'PATCH', body });
      closeModal('edit-package-modal');
      await loadPackages();
    } catch (e) { alert(e.message); }
  });

  // ── Delete Package ────────────────────────────────────────────────────────
  async function deletePackage(id) {
    const p = packages.find(x => x.id === id);
    if (!confirm(`Permanently delete package "${p ? p.name : ''}"? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/pt-packages/${id}`, { method: 'DELETE' });
      await loadPackages();
    } catch (e) { alert(e.message); }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PT ASSIGNMENTS TAB
  // ════════════════════════════════════════════════════════════════════════════

  // ── Filter chips ──────────────────────────────────────────────────────────
  document.querySelectorAll('[data-afilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-afilter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      assignmentFilter = chip.dataset.afilter;
      loadAssignments();
    });
  });

  async function loadAssignments() {
    const qs = assignmentFilter ? `?status=${assignmentFilter}` : '';
    assignments = await api('/api/admin/pt-assignments' + qs);
    renderAssignmentsTable();
  }

  function renderAssignmentsTable() {
    const tbody = document.getElementById('assignments-tbody');
    if (assignments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:40px;text-align:center;color:var(--md-on-surface-variant);">
            No assignments found.
          </td>
        </tr>`;
      return;
    }
    tbody.innerHTML = assignments.map(a => {
      const statusCls = a.status === 'active' ? 'active' : a.status === 'completed' ? 'completed' : 'cancelled';
      const actionBtns = a.status === 'active' ? `<button class="btn btn-danger sm" data-cancel="${a.id}">
          <span class="material-symbols-rounded">cancel</span>Cancel
        </button>` : '';
      return `
        <tr>
          <td>
            <div class="flex gap center">
              <div class="avatar">${initials(a.member_name || '')}</div>
              <div>
                <div style="font-weight:600;">${a.member_name || '—'}</div>
                <div class="body" style="font-size:12px;">${a.member_email || ''}</div>
              </div>
            </div>
          </td>
          <td>${a.trainer_name || '—'}</td>
          <td>${a.package_name || '—'}</td>
          <td>${money(a.price_paid)}</td>
          <td><span class="status-badge ${statusCls}">${a.status}</span></td>
          <td>${a.start_date ? new Date(a.start_date).toLocaleDateString() : '—'}</td>
          <td class="right" style="white-space:nowrap;">${actionBtns}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-cancel]').forEach(b =>
      b.addEventListener('click', () => cancelAssignment(parseInt(b.dataset.cancel))));
  }

  // ── Cancel assignment ─────────────────────────────────────────────────────
  async function cancelAssignment(id) {
    const a = assignments.find(x => x.id === id);
    if (!confirm(`Cancel PT assignment for ${a ? a.member_name : 'this member'}?`)) return;
    try {
      await api(`/api/admin/pt-assignments/${id}`, { method: 'PATCH', body: { status: 'cancelled' } });
      await loadAssignments();
    } catch (e) { alert(e.message); }
  }

  // ── New Assignment modal ──────────────────────────────────────────────────
  let memberSearchTimeout = null;

  document.getElementById('new-assignment-btn').addEventListener('click', () => {
    // Reset form
    document.getElementById('na-member-search').value = '';
    document.getElementById('na-member-id').value     = '';
    document.getElementById('na-member-results').innerHTML = '';
    document.getElementById('na-price').value         = '';
    document.getElementById('na-remarks').value       = '';
    document.getElementById('na-start').value         = todayISO();

    // Populate trainer select
    const tSel = document.getElementById('na-trainer');
    tSel.innerHTML = '<option value="">Select trainer…</option>' +
      trainers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    // Populate package select
    const pSel = document.getElementById('na-package');
    pSel.innerHTML = '<option value="">Select package…</option>' +
      packages
        .filter(p => p.is_active !== false)
        .map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} — ${money(p.price)}</option>`)
        .join('');

    openModal('new-assignment-modal');
  });

  // Package auto-fill
  document.getElementById('na-package').addEventListener('change', () => {
    const sel = document.getElementById('na-package');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.price) {
      document.getElementById('na-price').value = opt.dataset.price;
    }
  });

  // Member live search
  document.getElementById('na-member-search').addEventListener('input', () => {
    clearTimeout(memberSearchTimeout);
    const q = document.getElementById('na-member-search').value.trim();
    const resultsEl = document.getElementById('na-member-results');
    if (!q) { resultsEl.innerHTML = ''; return; }
    memberSearchTimeout = setTimeout(async () => {
      try {
        const members = await api(`/api/admin/members?q=${encodeURIComponent(q)}`);
        const list = Array.isArray(members) ? members : (members.members || []);
        if (list.length === 0) {
          resultsEl.innerHTML = `
            <div style="padding:10px 14px;background:var(--md-surface-container-highest);border-radius:var(--r-sm);margin-top:4px;color:var(--md-on-surface-variant);font-size:13px;">
              No members found.
            </div>`;
          return;
        }
        resultsEl.innerHTML = `
          <div style="background:var(--md-surface-container-highest);border-radius:var(--r-sm);margin-top:4px;overflow:hidden;box-shadow:var(--md-elev-2);">
            ${list.slice(0, 8).map(m => `
              <div class="member-result-item" data-id="${m.id}" data-name="${m.name}"
                   style="padding:10px 14px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--md-outline-variant);transition:background 0.12s ease;">
                <div style="font-weight:600;">${m.name}</div>
                <div style="font-size:12px;color:var(--md-on-surface-variant);">${m.email || ''}</div>
              </div>`).join('')}
          </div>`;
        resultsEl.querySelectorAll('.member-result-item').forEach(item => {
          item.addEventListener('mouseenter', () => item.style.background = 'rgba(59, 130, 246,0.08)');
          item.addEventListener('mouseleave', () => item.style.background = '');
          item.addEventListener('click', () => {
            document.getElementById('na-member-id').value     = item.dataset.id;
            document.getElementById('na-member-search').value = item.dataset.name;
            resultsEl.innerHTML = '';
          });
        });
      } catch (e) { /* silently ignore search errors */ }
    }, 250);
  });

  document.getElementById('na-save').addEventListener('click', async () => {
    const memberId  = document.getElementById('na-member-id').value;
    const trainerId = document.getElementById('na-trainer').value;
    const packageId = document.getElementById('na-package').value;
    const price     = parseFloat(document.getElementById('na-price').value) || 0;
    const startDate = document.getElementById('na-start').value;
    const remarks   = document.getElementById('na-remarks').value.trim() || null;

    if (!memberId)  return alert('Please select a member.');
    if (!trainerId) return alert('Please select a trainer.');
    if (!startDate) return alert('Start date is required.');

    const body = {
      user_id:    parseInt(memberId),
      trainer_id: parseInt(trainerId),
      package_id: packageId ? parseInt(packageId) : null,
      price_paid: price,
      start_date: startDate,
      remarks,
    };

    try {
      await api('/api/admin/pt-assignments', { method: 'POST', body });
      closeModal('new-assignment-modal');
      await loadAssignments();
    } catch (e) { alert(e.message); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // STAFF TAB (admin only)
  // ════════════════════════════════════════════════════════════════════════════

  async function loadStaff() {
    if (!isAdmin) return;
    staff = await api('/api/admin/staff');
    renderStaffGrid();
  }

  function renderStaffGrid() {
    const el = document.getElementById('staff-grid');
    if (!el) return;
    if (!staff.length) {
      el.innerHTML = `<div class="empty"><span class="material-symbols-rounded">badge</span>No staff accounts yet — click "Add Staff" to create a front-desk login.</div>`;
      return;
    }
    el.innerHTML = staff.map(s => `
      <div class="notif" style="padding:12px 0;">
        <div class="n-body">
          <div class="n-title">${s.name}</div>
          <div class="n-when">${s.email}${s.phone ? ' · ' + s.phone : ''}</div>
          <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
            ${(s.permissions || []).map(k => {
              const p = permissionCatalog.find(x => x.key === k);
              return `<span class="chip">${p ? p.label : k}</span>`;
            }).join('') || '<span class="chip">No permissions granted</span>'}
          </div>
        </div>
        <button class="btn btn-text sm" data-edit-staff="${s.id}">Edit</button>
        <button class="btn btn-text sm icon" data-del-staff="${s.id}"><span class="material-symbols-rounded">delete</span></button>
      </div>
    `).join('');
    el.querySelectorAll('[data-edit-staff]').forEach(b =>
      b.addEventListener('click', () => editStaff(parseInt(b.dataset.editStaff))));
    el.querySelectorAll('[data-del-staff]').forEach(b =>
      b.addEventListener('click', () => deleteStaff(parseInt(b.dataset.delStaff))));
  }

  const addStaffBtn = document.getElementById('add-staff-btn');
  if (addStaffBtn) addStaffBtn.addEventListener('click', () => {
    ['as-name','as-email','as-phone'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('as-password').value = 'staff1234';
    renderPermissionChecklist(document.getElementById('as-permissions'), staffDefaultPermissions);
    openModal('add-staff-modal');
  });

  const asSaveBtn = document.getElementById('as-save');
  if (asSaveBtn) asSaveBtn.addEventListener('click', async () => {
    const name  = document.getElementById('as-name').value.trim();
    const email = document.getElementById('as-email').value.trim();
    if (!name || !email) return alert('Name and email are required.');
    const body = {
      name, email,
      phone: document.getElementById('as-phone').value.trim() || null,
      password: document.getElementById('as-password').value,
      permissions: getCheckedPermissions(document.getElementById('as-permissions')),
    };
    try {
      const created = await api('/api/admin/staff', { method: 'POST', body });
      closeModal('add-staff-modal');
      await loadStaff();

      document.getElementById('sc-summary').innerHTML = body.phone
        ? `<strong>${body.name}</strong> is set up with email <strong>${body.email}</strong>.
           Send their login details to <strong>${body.phone}</strong>?`
        : `<strong>${body.name}</strong> is set up with email <strong>${body.email}</strong>.
           No phone number on file — add one to their profile to send credentials over WhatsApp.`;
      const sendBtn = document.getElementById('sc-send-creds');
      sendBtn.style.display = body.phone ? 'inline-flex' : 'none';
      sendBtn.onclick = async () => {
        sendBtn.disabled = true;
        try {
          const result = await api(`/api/admin/staff/${created.id}/send-credentials`, {
            method: 'POST', body: { password: body.password },
          });
          if (result.mode === 'api') {
            alert(`✅ Login credentials sent to ${body.name} (${result.phone}).`);
            closeModal('staff-created-modal');
          } else {
            window.open(result.link, '_blank', 'noopener');
          }
        } catch (e) {
          alert(`Could not send credentials: ${e.message}`);
        } finally {
          sendBtn.disabled = false;
        }
      };
      openModal('staff-created-modal');
    } catch (e) { alert(e.message); }
  });

  let editingStaffId = null;
  function editStaff(id) {
    editingStaffId = id;
    const s = staff.find(x => x.id === id);
    if (!s) return;
    document.getElementById('es-name').value  = s.name || '';
    document.getElementById('es-phone').value = s.phone || '';
    renderPermissionChecklist(document.getElementById('es-permissions'), s.permissions || []);
    openModal('edit-staff-modal');
  }

  const esSaveBtn = document.getElementById('es-save');
  if (esSaveBtn) esSaveBtn.addEventListener('click', async () => {
    const body = {
      name: document.getElementById('es-name').value.trim(),
      phone: document.getElementById('es-phone').value.trim() || null,
      permissions: getCheckedPermissions(document.getElementById('es-permissions')),
    };
    if (!body.name) return alert('Name is required.');
    try {
      await api(`/api/admin/staff/${editingStaffId}`, { method: 'PATCH', body });
      closeModal('edit-staff-modal');
      await loadStaff();
    } catch (e) { alert(e.message); }
  });

  async function deleteStaff(id) {
    const s = staff.find(x => x.id === id);
    if (!confirm(`Remove ${s ? s.name : 'this staff account'}? This cannot be undone.`)) return;
    await api(`/api/admin/staff/${id}`, { method: 'DELETE' });
    await loadStaff();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Permission-based visibility — hide whatever this account can't use.
  // Admin always sees everything; a staff/trainer account only sees the tabs
  // and buttons matching what was explicitly granted.
  // ════════════════════════════════════════════════════════════════════════════
  const canTrainers = isAdmin || hasPermission(me, 'trainers.manage');
  const canPt       = isAdmin || hasPermission(me, 'pt.manage');
  document.querySelector('[data-ttab="trainers"]').style.display    = canTrainers ? '' : 'none';
  document.querySelector('[data-ttab="packages"]').style.display    = canPt ? '' : 'none';
  document.querySelector('[data-ttab="assignments"]').style.display = canPt ? '' : 'none';
  document.getElementById('add-trainer-btn').style.display = isAdmin ? '' : 'none';
  document.getElementById('staff-tab-btn').style.display    = isAdmin ? '' : 'none';
  if (!canTrainers) {
    // Land on whichever tab this account can actually use.
    const firstVisibleKey = canPt ? 'packages' : (isAdmin ? 'staff' : null);
    if (firstVisibleKey) document.querySelector(`[data-ttab="${firstVisibleKey}"]`).click();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INIT — load permission catalog, then data sets in parallel
  // ════════════════════════════════════════════════════════════════════════════
  try {
    if (isAdmin) {
      const permRes = await api('/api/admin/permissions');
      permissionCatalog = permRes.catalog;
      staffDefaultPermissions = permRes.staffDefaults;
    }
    await Promise.all([
      canTrainers ? loadTrainers() : Promise.resolve(),
      canPt ? loadPackages() : Promise.resolve(),
      canPt ? loadAssignments() : Promise.resolve(),
      isAdmin ? loadStaff() : Promise.resolve(),
    ]);
  } catch (e) {
    console.error('Failed to load trainer data:', e);
  }
})();
