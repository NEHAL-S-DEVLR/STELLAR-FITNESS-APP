// Admin dashboard.

(async function () {
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  const isAdmin = me.role === 'admin';
  const TAB_PERMISSION = {
    overview:      ['finance.view', 'reports.view'],
    members:       ['members.manage'],
    notifications: ['notifications.send'],
    finance:       ['finance.view'],
  };
  const canSeeTab = key => isAdmin || (TAB_PERMISSION[key] || []).some(k => hasPermission(me, k));
  if (!isAdmin && !Object.keys(TAB_PERMISSION).some(canSeeTab)) { location.href = '/profile.html'; return; }

  renderAdminNav('dashboard', me);

  // Header
  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  // Hide whichever top-level tabs this account isn't permitted to use, and
  // land on the first one it can — staff without finance.view/reports.view
  // never even sees Overview's revenue cards, they just start on Members.
  let firstVisibleTab = null;
  document.querySelectorAll('[data-atab]').forEach(t => {
    if (!canSeeTab(t.dataset.atab)) { t.style.display = 'none'; return; }
    if (!firstVisibleTab) firstVisibleTab = t.dataset.atab;
  });
  document.getElementById('manage-batches-btn').style.display = (isAdmin || hasPermission(me, 'batches.manage')) ? '' : 'none';
  document.getElementById('checkin-qr-btn').style.display = (isAdmin || hasPermission(me, 'attendance.manage')) ? '' : 'none';

  if (firstVisibleTab && firstVisibleTab !== 'overview') {
    document.querySelectorAll('[data-atab]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('[id^=apanel-]').forEach(p => p.classList.remove('active'));
    document.querySelector(`[data-atab="${firstVisibleTab}"]`).classList.add('active');
    document.getElementById('apanel-' + firstVisibleTab).classList.add('active');
  }

  // Top-level tabs
  document.querySelectorAll('[data-atab]').forEach(t => {
    t.addEventListener('click', async () => {
      document.querySelectorAll('[data-atab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[id^=apanel-]').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('apanel-' + t.dataset.atab).classList.add('active');
      if (t.dataset.atab === 'finance') await loadFinance();
    });
  });

  // Click-through from overview cards and inline sub-links → Members tab + filter
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      applyFilter(el.dataset.goto);
    });
  });

  let members = [];
  let insights = null;
  let config = { whatsapp: { configured: false } };
  let memberFilter = 'all';

  // Member filter predicates — kept ordered so chips render in a sensible sequence.
  const FILTERS = {
    all:          { label: 'All',                icon: 'group',            match: () => true },
    active:       { label: 'Active this week',   icon: 'bolt',             match: u => {
      const w = new Date(); w.setDate(w.getDate() - 7);
      return (u.attendance || []).some(d => new Date(d) >= w);
    }},
    inactive:     { label: 'Inactive 7d+',       icon: 'do_not_disturb_on', match: u => {
      const w = new Date(); w.setDate(w.getDate() - 7);
      return !(u.attendance || []).some(d => new Date(d) >= w);
    }},
    todayCheckin: { label: 'Checked in today',   icon: 'today',            match: u => (u.attendance || []).includes(todayISO()) },
    new:          { label: 'New (last 30d)',     icon: 'fiber_new',        match: u => {
      const m = new Date(); m.setDate(m.getDate() - 30);
      return new Date(u.joined) >= m;
    }},
    nearExpiry:   { label: 'Near expiry (≤14d)', icon: 'schedule',         match: u => {
      if (!u.subscription) return false;
      const d = daysUntil(u.subscription.expiryDate);
      return d != null && d >= 0 && d <= 14;
    }},
    expired:      { label: 'Expired',            icon: 'block',            match: u => {
      if (!u.subscription) return false;
      const d = daysUntil(u.subscription.expiryDate);
      return d != null && d < 0;
    }},
    noPlan:       { label: 'No workout plan',    icon: 'assignment_late',  match: u => !u.workoutPlan },
    hasPlan:      { label: 'Has plan',           icon: 'assignment_turned_in', match: u => !!u.workoutPlan },
  };

  // Switch to the Members tab and apply a filter.
  function applyFilter(name) {
    if (!(name in FILTERS)) return;
    memberFilter = name;
    document.querySelectorAll('[data-atab]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('[id^=apanel-]').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-atab="members"]').classList.add('active');
    document.getElementById('apanel-members').classList.add('active');
    renderFilterChips();
    renderMembers();
    document.getElementById('apanel-members').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderFilterChips() {
    const el = document.getElementById('member-filters');
    el.innerHTML = Object.entries(FILTERS).map(([key, f]) => {
      const count = members.filter(f.match).length;
      const active = key === memberFilter;
      return `
        <button class="filter-chip ${active ? 'active' : ''}" data-filter="${key}">
          <span class="material-symbols-rounded" style="font-size: 16px;">${f.icon}</span>
          ${f.label}
          <span class="count">${count}</span>
        </button>
      `;
    }).join('');
    el.querySelectorAll('[data-filter]').forEach(b => {
      b.addEventListener('click', () => applyFilter(b.dataset.filter));
    });
  }

  async function loadAll() {
    // Guard every fetch by whether this account can actually see the tab
    // that data feeds — a staff account without reports.view/finance.view
    // must never even request /api/admin/insights, or a single 403 would
    // reject the whole Promise.all and break tabs it DOES have access to.
    const canOverview = canSeeTab('overview');
    const canMembers = canSeeTab('members');
    const canNotifications = canSeeTab('notifications');

    config = await api('/api/config').catch(() => ({ whatsapp: { configured: false } }));

    if (canMembers) {
      members = await api('/api/admin/members');
      renderFilterChips();
      renderMembers();
    }
    if (canOverview) {
      insights = await api('/api/admin/insights').catch(() => null);
      if (insights) renderInsights();
      loadDashboard().catch(() => {});
    }
    if (canNotifications) {
      populateRecipientSelect();
      renderExpiryList();
      refreshQuoteActiveCount();
      await renderBroadcastLog();
    }
    renderTodayNutrition().catch(() => {});
    loadTrainersForSelect().catch(() => {});
    loadBatches().catch(() => {});
    loadPtPackagesForSelect().catch(() => {});
  }

  // ---- Enhanced dashboard (revenue, profit, trainer perf, recent admissions) ----
  let dashRevChart = null, dashAdmChart = null;
  async function loadDashboard() {
    let dash;
    try { dash = await api('/api/admin/dashboard'); } catch { return; }

    const fmtINR = n => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    // Revenue stat cards
    document.getElementById('dash-today-rev').textContent = fmtINR(dash.today.revenue);
    document.getElementById('dash-today-adm').textContent = `${dash.today.admissions} admission${dash.today.admissions !== 1 ? 's' : ''} today`;
    document.getElementById('dash-month-rev').textContent = fmtINR(dash.monthly.revenue);
    document.getElementById('dash-month-exp').textContent = `₹${(dash.monthly.expenses || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} expenses`;
    const profitEl = document.getElementById('dash-profit');
    const profit = dash.monthly.profit || 0;
    profitEl.textContent = fmtINR(profit);
    profitEl.style.color = profit >= 0 ? 'var(--md-success)' : 'var(--md-error)';
    document.getElementById('dash-outstanding').textContent = fmtINR(dash.outstanding.amount);
    document.getElementById('dash-outstanding-sub').textContent = `${dash.outstanding.count || 0} with balance due`;

    // Revenue 30-day chart
    const revLabels = dash.charts.revenue.map(r => fmtDate(r.d));
    const revData   = dash.charts.revenue.map(r => r.revenue);
    if (dashRevChart) dashRevChart.destroy();
    dashRevChart = new Chart(document.getElementById('dash-rev-chart').getContext('2d'), {
      type: 'bar',
      data: { labels: revLabels, datasets: [{
        label: 'Revenue (₹)', data: revData,
        backgroundColor: 'rgba(59, 130, 246,0.7)', borderColor: '#3B82F6',
        borderWidth: 1, borderRadius: 4,
      }]},
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#52525B', maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: '#52525B' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
        },
      },
    });

    // Admissions 30-day chart
    const admLabels = dash.charts.admissions.map(r => fmtDate(r.d));
    const admData   = dash.charts.admissions.map(r => r.n);
    if (dashAdmChart) dashAdmChart.destroy();
    dashAdmChart = new Chart(document.getElementById('dash-adm-chart').getContext('2d'), {
      type: 'bar',
      data: { labels: admLabels, datasets: [{
        label: 'Admissions', data: admData,
        backgroundColor: 'rgba(52, 211, 153,0.7)', borderColor: '#34D399',
        borderWidth: 1, borderRadius: 4,
      }]},
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#52525B', maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: '#52525B', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
        },
      },
    });

    // Trainer performance
    const trainerEl = document.getElementById('dash-trainers');
    if (dash.trainerPerformance.length === 0) {
      trainerEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">sports</span>No trainers yet — <a href="/trainers.html">add one</a></div>`;
    } else {
      trainerEl.innerHTML = `<table><thead><tr><th>Trainer</th><th>Admissions</th><th>Revenue</th><th>Commission</th></tr></thead><tbody>${
        dash.trainerPerformance.map(t => `<tr>
          <td><strong>${t.name}</strong></td>
          <td>${t.admissions}</td>
          <td>${fmtINR(t.revenue)}</td>
          <td><span class="chip success">${fmtINR(t.commission)}</span></td>
        </tr>`).join('')
      }</tbody></table>`;
    }

    // Expiring memberships
    const expiringEl = document.getElementById('dash-expiring');
    const expList = dash.expiringMemberships || [];
    document.getElementById('dash-expiring-count').textContent = expList.length || '';
    if (expList.length === 0) {
      expiringEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">check_circle</span>No memberships expiring in 14 days</div>`;
    } else {
      expiringEl.innerHTML = expList.map(m => {
        const d = daysUntil(m.subscription_expiry);
        const sev = expirySeverity(d);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--md-outline-variant)">
          <div>
            <div style="font-weight:600">${m.name}</div>
            <div class="body">${m.subscription_plan}</div>
          </div>
          <span class="chip ${sev.cls}">${sev.label}</span>
        </div>`;
      }).join('');
    }

    // Recent admissions
    const recentEl = document.getElementById('dash-recent-adm');
    const admList = dash.recentAdmissions || [];
    if (admList.length === 0) {
      recentEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">receipt_long</span>No admissions yet — <a href="/admissions.html">record one</a></div>`;
    } else {
      recentEl.innerHTML = `<table>
        <thead><tr><th>Receipt</th><th>Member</th><th>Plan</th><th>Type</th><th>Paid</th><th>Balance</th><th>Date</th></tr></thead>
        <tbody>${admList.map(a => `<tr>
          <td><span style="font-family:monospace;font-size:12px">${a.receipt_number}</span></td>
          <td>${a.member_name}</td>
          <td>${a.plan_name}</td>
          <td><span class="status-badge ${a.type}">${a.type}</span></td>
          <td>${fmtINR(a.paid_amount)}</td>
          <td>${a.balance > 0 ? `<span class="chip warning">${fmtINR(a.balance)}</span>` : '<span class="chip success">Paid</span>'}</td>
          <td class="body">${fmtDate(a.admission_date)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
  }

  // Populate trainer dropdown in member modal
  let trainersCache = [];
  async function loadTrainersForSelect() {
    try {
      trainersCache = await api('/api/admin/trainers');
    } catch { return; }
    renderMembers(); // members table shows assigned trainer names — refresh now that trainersCache is populated
    const sel = document.getElementById('md-trainer');
    if (!sel) return;
    sel.innerHTML = `<option value="">None</option>` +
      trainersCache.map(t => `<option value="${t.id}">${t.name}${t.specialization ? ` — ${t.specialization}` : ''}</option>`).join('');
  }

  // Populate PT package options for the Add Member "joining as PT" flow
  let ptPackagesCache = [];
  async function loadPtPackagesForSelect() {
    try { ptPackagesCache = await api('/api/admin/pt-packages'); } catch { /* ignore */ }
  }

  // ------- Batches -------
  let batchesCache = [];
  function batchIsFull(b) { return b.capacity != null && b.member_count >= b.capacity; }
  function batchOptionLabel(b) {
    const seats = b.capacity != null ? `${b.member_count}/${b.capacity}` : `${b.member_count}`;
    return `${b.name} (${seats}${batchIsFull(b) ? ' — FULL' : ''})`;
  }
  // currentId's own batch stays selectable even if full — a member keeping
  // their existing seat isn't "taking" a new one.
  function fillBatchSelect(sel, currentId) {
    if (!sel) return;
    sel.innerHTML = `<option value="">No batch</option>` +
      batchesCache.filter(b => b.is_active !== false).map(b => {
        const full = batchIsFull(b) && String(b.id) !== String(currentId);
        return `<option value="${b.id}" ${full ? 'disabled' : ''}>${batchOptionLabel(b)}</option>`;
      }).join('');
    if (currentId) sel.value = currentId;
  }
  async function loadBatches() {
    try {
      batchesCache = await api('/api/admin/batches');
    } catch { return; }
    renderMembers();
    fillBatchSelect(document.getElementById('new-batch'));
    fillBatchSelect(document.getElementById('md-batch'), editingMember?.batchId);
    renderBatchesList();
  }

  function renderBatchesList() {
    const el = document.getElementById('batches-list');
    if (!el) return;
    if (!batchesCache.length) {
      el.innerHTML = `<div class="empty"><span class="material-symbols-rounded">groups</span>No batches yet — add one above (e.g. Morning Batch, Evening Batch, Yoga).</div>`;
      return;
    }
    el.innerHTML = batchesCache.map(b => `
      <div class="notif" style="padding:10px 0;">
        <div class="n-body">
          <div class="n-title">${b.name}${batchIsFull(b) ? ' <span class="chip error">FULL</span>' : ''}</div>
          <div class="n-when">${b.member_count} member${b.member_count === 1 ? '' : 's'}${b.is_active === false ? ' · inactive' : ''}</div>
        </div>
        <input type="number" min="1" data-cap-batch="${b.id}" value="${b.capacity ?? ''}" placeholder="No limit" style="width:80px;" title="Member limit" />
        <button class="btn btn-text sm" data-toggle-batch="${b.id}" data-active="${b.is_active}">${b.is_active === false ? 'Activate' : 'Deactivate'}</button>
        <button class="btn btn-text sm icon" data-del-batch="${b.id}"><span class="material-symbols-rounded">delete</span></button>
      </div>
    `).join('');
    el.querySelectorAll('[data-toggle-batch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/api/admin/batches/${btn.dataset.toggleBatch}`, { method: 'PATCH', body: { is_active: btn.dataset.active === 'false' } });
        await loadBatches();
      });
    });
    el.querySelectorAll('[data-del-batch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this batch? Members in it become unassigned.')) return;
        await api(`/api/admin/batches/${btn.dataset.delBatch}`, { method: 'DELETE' });
        await loadBatches();
      });
    });
    el.querySelectorAll('[data-cap-batch]').forEach(input => {
      input.addEventListener('change', async () => {
        try {
          await api(`/api/admin/batches/${input.dataset.capBatch}`, { method: 'PATCH', body: { capacity: input.value || null } });
          await loadBatches();
        } catch (e) { alert(e.message); }
      });
    });
  }

  document.getElementById('manage-batches-btn').addEventListener('click', () => openModal('batches-modal'));
  document.getElementById('add-batch-btn').addEventListener('click', async () => {
    const input = document.getElementById('new-batch-name');
    const capInput = document.getElementById('new-batch-capacity');
    const name = input.value.trim();
    if (!name) return;
    try {
      await api('/api/admin/batches', { method: 'POST', body: { name, capacity: capInput.value || null } });
      input.value = '';
      capInput.value = '';
      await loadBatches();
    } catch (e) { alert(e.message); }
  });

  async function loadCheckinQr() {
    const { qrDataUrl } = await api('/api/admin/checkin-qr');
    document.getElementById('checkin-qr-img').src = qrDataUrl;
  }
  document.getElementById('checkin-qr-btn').addEventListener('click', () => {
    openModal('checkin-qr-modal');
    loadCheckinQr().catch(e => alert(e.message));
  });
  document.getElementById('checkin-qr-print').addEventListener('click', () => {
    const w = window.open('', '_blank');
    w.document.write(`<img src="${document.getElementById('checkin-qr-img').src}" style="width:100%; max-width:500px;" />`);
    w.document.close();
    w.print();
  });
  document.getElementById('checkin-qr-regenerate').addEventListener('click', async () => {
    if (!confirm('Regenerate the QR code? The old printed copy will stop working immediately.')) return;
    await api('/api/admin/checkin-qr/regenerate', { method: 'POST' });
    await loadCheckinQr();
  });

  // WhatsApp reminder for a single member.
  // Backend returns either { mode: 'api', ... } (message actually sent) or
  // { mode: 'link', link: 'https://wa.me/...' } (open browser to send).
  async function sendWhatsAppReminder(memberId, memberName) {
    let result;
    try {
      result = await api(`/api/admin/members/${memberId}/whatsapp-reminder`, { method: 'POST' });
    } catch (e) {
      alert(`Could not send WhatsApp reminder: ${e.message}`);
      return;
    }
    if (result.mode === 'api') {
      alert(`✅ WhatsApp reminder sent to ${memberName} (${result.phone}).`);
    } else {
      // Fallback mode — open wa.me in a new tab
      window.open(result.link, '_blank', 'noopener');
    }
    await renderBroadcastLog();
  }

  // ------- Insights -------
  let attendanceChart = null, statusChart = null;
  function renderInsights() {
    document.getElementById('ins-members').textContent = insights.totalMembers;
    document.getElementById('ins-members-sub').textContent = `${insights.newThisMonth} joined in last 30 days`;
    document.getElementById('ins-today').textContent = insights.todayCheckIns;
    document.getElementById('ins-today-sub').textContent =
      `${insights.totalMembers ? Math.round(insights.todayCheckIns / insights.totalMembers * 100) : 0}% of members`;
    document.getElementById('ins-week').textContent = insights.activeWeek;
    document.getElementById('ins-week-sub').textContent = `${insights.totalMembers - insights.activeWeek} inactive`;
    document.getElementById('ins-plans').textContent = `${insights.plansAssigned}/${insights.totalMembers}`;
    document.getElementById('ins-plans-sub').textContent = `${insights.totalMembers - insights.plansAssigned} need a plan`;

    const labels = insights.attendanceTrend.map(p => new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const counts = insights.attendanceTrend.map(p => p.count);
    if (attendanceChart) attendanceChart.destroy();
    attendanceChart = new Chart(document.getElementById('attendance-chart').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{
        label: 'Check-ins', data: counts,
        backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: '#3B82F6',
        borderWidth: 1, borderRadius: 6,
      }]},
      options: {
        plugins: { legend: { labels: { color: '#F4F4F5' } } },
        scales: {
          x: { ticks: { color: '#52525B' }, grid: { display: false } },
          y: { ticks: { color: '#52525B', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
        },
      },
    });

    const inactive = insights.totalMembers - insights.activeWeek;
    const veryNew = insights.newThisMonth;
    const established = Math.max(0, insights.activeWeek - veryNew);
    if (statusChart) statusChart.destroy();
    // Order here MUST match the filter names in the onClick handler
    const segmentFilters = ['active', 'new', 'inactive'];
    statusChart = new Chart(document.getElementById('status-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Active (established)', 'Active (new)', 'Inactive (7d+)'],
        datasets: [{
          data: [established, veryNew, inactive],
          backgroundColor: ['#34D399', '#60A5FA', '#F87171'],
          borderColor: '#18181B', borderWidth: 3,
        }],
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: '#F4F4F5', padding: 12 } },
          tooltip: { callbacks: { afterLabel: () => 'Click to filter →' } },
        },
        cutout: '65%',
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        onClick: (_, els) => {
          if (els.length === 0) return;
          const idx = els[0].index;
          applyFilter(segmentFilters[idx]);
        },
      },
    });
  }

  // ------- Members table -------
  function lastCheckIn(u) {
    if (!u.attendance || u.attendance.length === 0) return null;
    return u.attendance.slice().sort().pop();
  }

  function renderMembers() {
    const q = document.getElementById('member-search').value.trim().toLowerCase();
    const filter = FILTERS[memberFilter] || FILTERS.all;
    const list = members
      .filter(filter.match)
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    const tbody = document.getElementById('members-tbody');
    if (list.length === 0) {
      const hint = memberFilter === 'all' ? '' : ` matching "${filter.label}"`;
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--md-on-surface-variant);">No members found${hint}.</td></tr>`;
      return;
    }
    const trainerName = id => trainersCache.find(t => t.id === id)?.name;
    const batchName = id => batchesCache.find(b => b.id === id)?.name;
    tbody.innerHTML = list.map(u => {
      const w = (u.weightLog && u.weightLog.length) ? u.weightLog[u.weightLog.length - 1].kg : null;
      const b = bmi(w, u.height);
      const cat = bmiCategory(b);
      const last = lastCheckIn(u);
      const lastLabel = last ? new Date(last).toLocaleDateString() : '—';
      const lastCls = !last ? 'error' : (Date.now() - new Date(last)) / 86400000 > 7 ? 'warning' : 'success';
      const subDays = u.subscription ? daysUntil(u.subscription.expiryDate) : null;
      const sev = expirySeverity(subDays);
      const subChip = u.subscription
        ? `<span class="chip ${sev.cls}">${sev.label}</span>`
        : `<span class="chip error">None</span>`;
      const tName = u.assignedTrainerId ? trainerName(u.assignedTrainerId) : null;
      return `
        <tr>
          <td>
            <div class="flex gap center">
              <div class="avatar">${initials(u.name)}</div>
              <div>
                <div style="font-weight: 600;">${u.name}</div>
                <div class="body" style="font-size: 12px;">${u.email}</div>
              </div>
            </div>
          </td>
          <td>${u.goal || '—'}</td>
          <td>${w ? w.toFixed(1) + ' kg' : '—'}</td>
          <td>${b ? `<span class="chip ${cat.cls}">${b.toFixed(1)}</span>` : '—'}</td>
          <td><span class="chip ${lastCls}">${lastLabel}</span></td>
          <td>${subChip}</td>
          <td>${tName ? tName : '<span class="body" style="font-size:12px;">Unassigned</span>'}</td>
          <td>${u.batchId ? (batchName(u.batchId) || '—') : '<span class="body" style="font-size:12px;">—</span>'}</td>
          <td>${u.workoutPlan ? `<span class="chip success">${u.workoutPlan.name.slice(0, 22)}${u.workoutPlan.name.length > 22 ? '…' : ''}</span>` : '<span class="chip warning">No plan</span>'}</td>
          <td class="right">
            <button class="btn btn-tonal sm" data-open="${u.id}">Manage</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-open]').forEach(b => {
      b.addEventListener('click', () => openMember(parseInt(b.dataset.open)));
    });
  }
  document.getElementById('member-search').addEventListener('input', renderMembers);

  // ------- Notifications: recipient dropdown + expiring list + broadcast log -------
  function populateRecipientSelect() {
    const s = document.getElementById('nt-recipient');
    s.innerHTML = `<option value="all">All members (${members.length})</option>` +
      members.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  }

  function renderExpiryList() {
    const expiring = members
      .filter(u => u.subscription)
      .map(u => ({ u, days: daysUntil(u.subscription.expiryDate) }))
      .filter(x => x.days != null && x.days <= 14)
      .sort((a, b) => a.days - b.days);
    document.getElementById('expiry-count').textContent = `${expiring.length} need attention`;
    const list = document.getElementById('expiry-list');
    if (expiring.length === 0) {
      list.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">check_circle</span>
        All subscriptions look healthy.
      </div>`;
      return;
    }
    list.innerHTML = expiring.map(({ u, days }) => {
      const sev = expirySeverity(days);
      const waTitle = u.phone
        ? (config.whatsapp.configured ? `Send WhatsApp message to ${u.phone}` : `Open WhatsApp with prefilled message (${u.phone})`)
        : 'No phone number on file';
      return `
        <div class="notif">
          <div class="n-icon expiry"><span class="material-symbols-rounded">schedule</span></div>
          <div class="n-body">
            <div class="n-title">${u.name} <span class="chip ${sev.cls}">${sev.label}</span></div>
            <div class="n-text">${u.subscription.plan} — expires ${new Date(u.subscription.expiryDate).toLocaleDateString()}</div>
            ${u.phone ? `<div class="n-when">📱 ${u.phone}</div>` : `<div class="n-when">⚠️ No phone on file</div>`}
          </div>
          <div class="flex gap" style="flex-direction: column; gap: 6px;">
            <button class="btn btn-tonal sm" data-wa="${u.id}" data-name="${u.name}" ${u.phone ? '' : 'disabled'} title="${waTitle}">
              <span class="material-symbols-rounded">chat</span>WhatsApp
            </button>
            <button class="btn btn-outlined sm" data-notify="${u.id}" data-days="${days}">In-app</button>
          </div>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-notify]').forEach(b => {
      b.addEventListener('click', async () => {
        const uid = parseInt(b.dataset.notify);
        const days = parseInt(b.dataset.days);
        const u = members.find(m => m.id === uid);
        const title = days < 0 ? 'Your subscription has expired'
                     : days === 0 ? 'Your subscription expires today'
                     : `Your subscription expires in ${days} day${days === 1 ? '' : 's'}`;
        const body = `Hi ${u.name.split(' ')[0]}, your ${u.subscription.plan} ${days < 0 ? 'expired on' : 'expires on'} ${new Date(u.subscription.expiryDate).toLocaleDateString()}. Visit the front desk to renew.`;
        await api('/api/admin/broadcasts', { method: 'POST', body: { type: 'expiry', title, body, recipientId: uid } });
        alert(`Reminder sent to ${u.name}.`);
        await renderBroadcastLog();
      });
    });
    list.querySelectorAll('[data-wa]').forEach(b => {
      b.addEventListener('click', () => sendWhatsAppReminder(parseInt(b.dataset.wa), b.dataset.name));
    });
  }

  async function renderBroadcastLog() {
    const list = await api('/api/admin/broadcasts');
    const el = document.getElementById('broadcast-log');
    if (list.length === 0) {
      el.innerHTML = `<div class="empty">No notifications sent yet.</div>`;
      return;
    }
    const iconMap = { offer: 'local_offer', expiry: 'schedule', general: 'campaign' };
    el.innerHTML = list.map(b => `
      <div class="notif">
        <div class="n-icon ${b.type}"><span class="material-symbols-rounded">${iconMap[b.type] || 'info'}</span></div>
        <div class="n-body">
          <div class="n-title">${b.title} <span class="chip">${b.recipients} recipient${b.recipients === 1 ? '' : 's'}</span></div>
          <div class="n-text">${b.body}</div>
          <div class="n-when">${new Date(b.sent).toLocaleString()} · by ${b.sent_by}</div>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('nt-send').addEventListener('click', async () => {
    const type = document.getElementById('nt-type').value;
    const title = document.getElementById('nt-title').value.trim();
    const body = document.getElementById('nt-body').value.trim();
    const recipient = document.getElementById('nt-recipient').value;
    if (!title || !body) return alert('Title and message are required.');
    const res = await api('/api/admin/broadcasts', {
      method: 'POST',
      body: { type, title, body, recipientId: recipient === 'all' ? null : parseInt(recipient) },
    });
    alert(`Sent to ${res.count} member${res.count === 1 ? '' : 's'}.`);
    document.getElementById('nt-title').value = '';
    document.getElementById('nt-body').value = '';
    await renderBroadcastLog();
  });

  document.getElementById('nt-template-offer').addEventListener('click', () => {
    document.getElementById('nt-type').value = 'offer';
    document.getElementById('nt-title').value = '30% off annual memberships — this week only!';
    document.getElementById('nt-body').value = 'Upgrade to our annual plan before the weekend and save 30%. Visit the front desk to lock in the deal.';
  });
  document.getElementById('nt-template-expiry').addEventListener('click', () => {
    document.getElementById('nt-type').value = 'expiry';
    document.getElementById('nt-title').value = 'Your subscription is about to expire';
    document.getElementById('nt-body').value = 'A quick heads-up — your membership is coming to an end soon. Drop by the desk to renew and avoid any interruption.';
  });

  // ------- Daily Quote -------
  const QUOTE_SUGGESTIONS = [
    'The only bad workout is the one that didn\'t happen. Let\'s go!',
    'Discipline is choosing between what you want now and what you want most.',
    'Small steps every day beat big plans that never start.',
    'Your body can stand almost anything — it\'s your mind you have to convince.',
    'Consistency is what transforms average into excellence.',
    'Push yourself, because no one else is going to do it for you.',
  ];

  function activeMembersForQuote() {
    const today = new Date().toISOString().slice(0, 10);
    return members.filter(u => u.phone && u.subscription?.expiryDate && u.subscription.expiryDate >= today);
  }

  function refreshQuoteActiveCount() {
    document.getElementById('quote-active-count').textContent = `${activeMembersForQuote().length} active with phone on file`;
  }

  document.getElementById('dq-shuffle').addEventListener('click', () => {
    const pick = QUOTE_SUGGESTIONS[Math.floor(Math.random() * QUOTE_SUGGESTIONS.length)];
    document.getElementById('dq-message').value = pick;
  });

  document.getElementById('dq-copy').addEventListener('click', async () => {
    const text = document.getElementById('dq-message').value.trim();
    if (!text) return alert('Write a quote first.');
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied — paste it into your gym\'s WhatsApp group.');
    } catch {
      alert('Could not copy automatically — select and copy the text manually.');
    }
  });

  document.getElementById('gm-copy').addEventListener('click', async () => {
    const text = document.getElementById('gm-message').value.trim();
    if (!text) return alert('Write a message first.');
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied — paste it into your gym\'s WhatsApp group.');
    } catch {
      alert('Could not copy automatically — select and copy the text manually.');
    }
  });

  document.getElementById('dq-send').addEventListener('click', async () => {
    const message = document.getElementById('dq-message').value.trim();
    if (!message) return alert('Write a quote first.');
    const btn = document.getElementById('dq-send');
    btn.disabled = true;
    try {
      const { results, waConfigured } = await api('/api/admin/broadcasts/quote', { method: 'POST', body: { message } });
      renderQuoteResults(results, waConfigured);
      await renderBroadcastLog();
    } catch (e) {
      alert(`Could not send: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  function renderQuoteResults(results, waConfigured) {
    const el = document.getElementById('dq-results');
    if (!results.length) {
      el.innerHTML = `<div class="empty"><span class="material-symbols-rounded">group_off</span>No active members with a phone number on file.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="label" style="margin-bottom:8px;">
        ${waConfigured ? 'Sent automatically to:' : `Click each to send (${results.length} recipients):`}
      </div>
      ${results.map(r => `
        <div class="notif" style="padding:8px 0;">
          <div class="n-body">
            <div class="n-title">${r.name}</div>
            <div class="n-when">📱 ${r.phone}</div>
          </div>
          ${r.mode === 'api'
            ? `<span class="chip success">Sent</span>`
            : r.mode === 'error'
              ? `<span class="chip error" title="${r.error}">Failed</span>`
              : `<button class="btn btn-tonal sm" data-quote-link="${encodeURIComponent(r.link)}">
                   <span class="material-symbols-rounded">chat</span>Send
                 </button>`}
        </div>
      `).join('')}
    `;
    el.querySelectorAll('[data-quote-link]').forEach(btn => {
      btn.addEventListener('click', () => window.open(decodeURIComponent(btn.dataset.quoteLink), '_blank', 'noopener'));
    });
  }

  // ------- Membership Renewal search -------
  let rnSelectedMember = null;

  document.getElementById('rn-search').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    const resultsEl = document.getElementById('rn-search-results');
    if (!term) { resultsEl.innerHTML = ''; return; }
    const matches = members
      .filter(u => u.name.toLowerCase().includes(term) || (u.phone || '').includes(term))
      .slice(0, 8);
    if (!matches.length) {
      resultsEl.innerHTML = `<div class="body" style="padding:8px 0;">No members match “${e.target.value}”.</div>`;
      return;
    }
    resultsEl.innerHTML = matches.map(u => `
      <div class="notif" style="padding:8px 0; cursor:pointer;" data-pick="${u.id}">
        <div class="n-body">
          <div class="n-title">${u.name}</div>
          <div class="n-when">${u.subscription ? u.subscription.plan : 'No active plan'}${u.phone ? ' · 📱 ' + u.phone : ' · ⚠️ No phone'}</div>
        </div>
      </div>
    `).join('');
    resultsEl.querySelectorAll('[data-pick]').forEach(row => {
      row.addEventListener('click', () => selectRenewalMember(parseInt(row.dataset.pick)));
    });
  });

  function selectRenewalMember(id) {
    const u = members.find(m => m.id === id);
    if (!u) return;
    rnSelectedMember = u;
    document.getElementById('rn-search').value = u.name;
    document.getElementById('rn-search-results').innerHTML = '';
    const box = document.getElementById('rn-selected');
    const info = document.getElementById('rn-selected-info');

    if (!u.subscription?.expiryDate) {
      info.innerHTML = `<strong>${u.name}</strong> has no subscription on file — nothing to remind them about.`;
      document.getElementById('rn-message').value = '';
      document.getElementById('rn-send').disabled = true;
    } else if (!u.phone) {
      info.innerHTML = `<strong>${u.name}</strong> has no phone number on file — add one to their profile first.`;
      document.getElementById('rn-message').value = '';
      document.getElementById('rn-send').disabled = true;
    } else {
      const days = daysUntil(u.subscription.expiryDate);
      const sev = expirySeverity(days);
      info.innerHTML = `<strong>${u.name}</strong> — ${u.subscription.plan} · <span class="chip ${sev.cls}">${sev.label}</span> · 📱 ${u.phone}`;
      document.getElementById('rn-message').value =
        `Hi ${u.name.split(' ')[0]}, just a reminder to renew your membership so you don't miss a session!`;
      document.getElementById('rn-send').disabled = false;
    }
    box.style.display = 'block';
  }

  document.getElementById('rn-send').addEventListener('click', async () => {
    if (!rnSelectedMember) return;
    const message = document.getElementById('rn-message').value.trim();
    if (!message) return alert('Write a message first.');
    const btn = document.getElementById('rn-send');
    btn.disabled = true;
    try {
      const result = await api(`/api/admin/members/${rnSelectedMember.id}/renewal-message`, { method: 'POST', body: { message } });
      if (result.mode === 'api') {
        alert(`✅ Renewal reminder sent to ${rnSelectedMember.name} (${result.phone}).`);
      } else {
        window.open(result.link, '_blank', 'noopener');
      }
      await renderBroadcastLog();
    } catch (e) {
      alert(`Could not send: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // ------- Member modal -------
  let editingMember = null;
  let editingPlan = null;

  async function openMember(id) {
    editingMember = await api(`/api/admin/members/${id}`);
    const u = editingMember;
    document.getElementById('md-avatar').textContent = initials(u.name);
    document.getElementById('md-name').textContent = u.name;
    document.getElementById('md-email').textContent = u.email;
    document.getElementById('md-name-input').value = u.name;
    document.getElementById('md-gym-pass').href = `/gym-pass.html?id=${u.id}`;
    document.getElementById('md-phone').value = u.phone || '';
    document.getElementById('md-goal').value = u.goal || '';
    document.getElementById('md-height').value = u.height || '';

    // Extended profile fields
    document.getElementById('md-dob').value = u.dateOfBirth || '';
    document.getElementById('md-blood-group').value = u.bloodGroup || '';
    document.getElementById('md-photo-url').value = u.photoUrl || '';
    document.getElementById('md-ec-name').value = u.emergencyContact?.name || '';
    document.getElementById('md-ec-phone').value = u.emergencyContact?.phone || '';
    document.getElementById('md-ec-relation').value = u.emergencyContact?.relation || '';
    document.getElementById('md-medical').value = u.medicalHistory || '';
    // Populate trainer select and pre-select assigned trainer
    const trainerSel = document.getElementById('md-trainer');
    if (trainersCache.length === 0) {
      try { trainersCache = await api('/api/admin/trainers'); } catch {}
      trainerSel.innerHTML = `<option value="">None</option>` +
        trainersCache.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
    trainerSel.value = u.assignedTrainerId || '';

    if (batchesCache.length === 0) { try { batchesCache = await api('/api/admin/batches'); } catch {} }
    fillBatchSelect(document.getElementById('md-batch'), u.batchId);

    const w = (u.weightLog && u.weightLog.length) ? u.weightLog[u.weightLog.length - 1].kg : null;
    document.getElementById('md-weight').textContent = w ? `${w.toFixed(1)} kg` : '—';
    const b = bmi(w, u.height);
    const cat = bmiCategory(b);
    document.getElementById('md-bmi').textContent = b ? b.toFixed(1) : '—';
    const catEl = document.getElementById('md-bmi-cat');
    catEl.textContent = cat.label; catEl.style.color = cat.color;

    // Subscription
    document.getElementById('sub-plan').value   = u.subscription?.plan       || '';
    document.getElementById('sub-start').value  = u.subscription?.startDate  || '';
    document.getElementById('sub-expiry').value = u.subscription?.expiryDate || '';
    renderSubStatus();

    // Nutrition
    if (u.nutritionPlan) {
      document.getElementById('np-cal').value  = u.nutritionPlan.calories;
      document.getElementById('np-pro').value  = u.nutritionPlan.protein;
      document.getElementById('np-carb').value = u.nutritionPlan.carbs;
      document.getElementById('np-fat').value  = u.nutritionPlan.fats;
      document.getElementById('np-meals').value = u.nutritionPlan.meals.map(m => `${m.name} | ${m.items}`).join('\n');
    } else {
      document.getElementById('np-cal').value = 2000;
      document.getElementById('np-pro').value = 140;
      document.getElementById('np-carb').value = 200;
      document.getElementById('np-fat').value = 60;
      document.getElementById('np-meals').value =
        'Breakfast | Oats with banana and protein shake\nLunch | Grilled chicken, rice, vegetables\nDinner | Fish, salad, sweet potato';
    }

    // Workout
    if (u.workoutPlan) {
      editingPlan = JSON.parse(JSON.stringify(u.workoutPlan));
      const byDay = new Map(editingPlan.days.map(d => [d.day, d]));
      editingPlan.days = WEEKDAYS.map(d => byDay.get(d) || { day: d, focus: '', items: [] });
      editingPlan.days.forEach(d => {
        d.items = (d.items || []).map(it =>
          typeof it === 'string' ? { muscleGroup: '', exercise: it, machine: '', sets: '' } : it
        );
      });
      document.getElementById('wp-name').value = editingPlan.name || '';
    } else {
      editingPlan = { name: '', assignedBy: me.name, days: WEEKDAYS.map(d => ({ day: d, focus: '', items: [] })) };
      document.getElementById('wp-name').value = '';
    }
    renderPlanEditor();
    renderMemberAttendance();
    openModal('member-modal');

    // Reset inner tabs
    document.querySelectorAll('[data-mtab]').forEach(t => t.classList.toggle('active', t.dataset.mtab === 'overview'));
    document.querySelectorAll('[id^=mpanel-]').forEach(p => p.classList.toggle('active', p.id === 'mpanel-overview'));
  }

  function renderSubStatus() {
    const expiry = document.getElementById('sub-expiry').value;
    const days = expiry ? daysUntil(expiry) : null;
    const sev = expirySeverity(days);
    const pill = document.getElementById('sub-status-pill');
    pill.textContent = sev.label;
    pill.className = 'chip ' + sev.cls;
  }
  document.getElementById('sub-expiry').addEventListener('input', renderSubStatus);

  document.getElementById('sub-save').addEventListener('click', async () => {
    const plan = document.getElementById('sub-plan').value.trim();
    const startDate = document.getElementById('sub-start').value;
    const expiryDate = document.getElementById('sub-expiry').value;
    if (!plan || !expiryDate) return alert('Plan name and expiry date are required.');
    await api(`/api/admin/members/${editingMember.id}/subscription`, {
      method: 'PUT', body: { plan, startDate, expiryDate },
    });
    alert('Subscription saved.');
    await loadAll();
  });

  document.getElementById('sub-notify').addEventListener('click', async () => {
    if (!editingMember.subscription) return alert('No subscription set.');
    const days = daysUntil(editingMember.subscription.expiryDate);
    const title = days < 0 ? 'Your subscription has expired' : `Your subscription expires in ${days} day${days === 1 ? '' : 's'}`;
    const body = `Hi ${editingMember.name.split(' ')[0]}, your ${editingMember.subscription.plan} ${days < 0 ? 'expired on' : 'expires on'} ${new Date(editingMember.subscription.expiryDate).toLocaleDateString()}. Renew at the front desk to avoid interruption.`;
    await api('/api/admin/broadcasts', { method: 'POST', body: { type: 'expiry', title, body, recipientId: editingMember.id } });
    alert(`Reminder sent to ${editingMember.name}.`);
    await renderBroadcastLog();
  });

  async function renderMemberAttendance() {
    renderGithubHeatmap(document.getElementById('md-attendance-heatmap'), editingMember.attendance || [], 26);
    const grid = document.getElementById('md-attendance');
    const today = new Date();
    const set = new Set(editingMember.attendance || []);
    let html = '';
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      html += `<div class="day-cell ${set.has(iso) ? 'present' : ''} ${i === 0 ? 'today' : ''}"
                    title="${d.toLocaleDateString()}" data-toggle="${iso}" style="cursor: pointer;"></div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll('[data-toggle]').forEach(c => {
      c.addEventListener('click', async () => {
        await api(`/api/admin/members/${editingMember.id}/attendance/toggle`, {
          method: 'POST', body: { date: c.dataset.toggle },
        });
        editingMember = await api(`/api/admin/members/${editingMember.id}`);
        renderMemberAttendance();
        await loadAll();
      });
    });
  }

  // ---- Structured workout plan editor
  function renderPlanEditor() {
    const c = document.getElementById('wp-day-cards');
    c.innerHTML = editingPlan.days.map((d, di) => {
      const items = d.items.map((it, ii) => `
        <div class="exercise-row">
          ${it.muscleGroup ? `<span class="chip primary">${it.muscleGroup}</span>` : ''}
          <span class="ex-name">${it.exercise}</span>
          ${it.machine ? `<span class="chip info">${it.machine}</span>` : ''}
          <span class="sets">${it.sets || ''}</span>
          <button class="btn btn-text sm icon" data-rm="${di}|${ii}"><span class="material-symbols-rounded">close</span></button>
        </div>
      `).join('') || '<div class="body" style="font-size: 12px; padding: 6px 0;">No exercises yet.</div>';
      const muscleOpts = Object.keys(EXERCISE_LIBRARY).map(g => `<option value="${g}">${g}</option>`).join('');
      return `
        <div class="plan-day">
          <div class="head">
            <div class="day-name">${d.day}</div>
            <input type="text" placeholder="Focus (e.g. Push, Legs, Rest)" data-focus="${di}" value="${d.focus || ''}" />
          </div>
          ${items}
          <div class="add-ex-form" data-add="${di}">
            <select data-field="muscle"><option value="">Muscle group…</option>${muscleOpts}</select>
            <select data-field="exercise" disabled><option value="">Exercise…</option></select>
            <select data-field="machine" disabled><option value="">Machine…</option></select>
            <input type="text" data-field="sets" placeholder="4 x 8" />
            <button class="btn btn-tonal sm" data-add-btn="${di}">Add</button>
          </div>
        </div>
      `;
    }).join('');

    c.querySelectorAll('[data-focus]').forEach(inp => {
      inp.addEventListener('input', () => {
        editingPlan.days[parseInt(inp.dataset.focus)].focus = inp.value;
      });
    });
    c.querySelectorAll('[data-rm]').forEach(b => {
      b.addEventListener('click', () => {
        const [di, ii] = b.dataset.rm.split('|').map(Number);
        editingPlan.days[di].items.splice(ii, 1);
        renderPlanEditor();
      });
    });
    c.querySelectorAll('[data-add]').forEach(form => {
      const mSel = form.querySelector('[data-field=muscle]');
      const eSel = form.querySelector('[data-field=exercise]');
      const machSel = form.querySelector('[data-field=machine]');
      mSel.addEventListener('change', () => {
        const m = mSel.value;
        eSel.innerHTML = '<option value="">Exercise…</option>';
        machSel.innerHTML = '<option value="">Machine…</option>';
        machSel.disabled = true;
        if (m) {
          (EXERCISE_LIBRARY[m] || []).forEach(x => eSel.innerHTML += `<option value="${x.name}">${x.name}</option>`);
          eSel.disabled = false;
        } else { eSel.disabled = true; }
      });
      eSel.addEventListener('change', () => {
        const m = mSel.value, e = eSel.value;
        machSel.innerHTML = '<option value="">Machine…</option>';
        const ex = (EXERCISE_LIBRARY[m] || []).find(x => x.name === e);
        if (ex) {
          ex.machines.forEach(mach => machSel.innerHTML += `<option value="${mach}">${mach}</option>`);
          machSel.disabled = false;
        } else { machSel.disabled = true; }
      });
    });
    c.querySelectorAll('[data-add-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const di = parseInt(btn.dataset.addBtn);
        const form = c.querySelector(`[data-add="${di}"]`);
        const muscleGroup = form.querySelector('[data-field=muscle]').value;
        const exercise    = form.querySelector('[data-field=exercise]').value;
        const machine     = form.querySelector('[data-field=machine]').value;
        const sets        = form.querySelector('[data-field=sets]').value.trim();
        if (!muscleGroup || !exercise) return alert('Pick a muscle group and exercise.');
        editingPlan.days[di].items.push({ muscleGroup, exercise, machine, sets });
        renderPlanEditor();
      });
    });
  }

  // Inner tabs
  document.querySelectorAll('[data-mtab]').forEach(t => {
    t.addEventListener('click', async () => {
      document.querySelectorAll('[data-mtab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[id^=mpanel-]').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('mpanel-' + t.dataset.mtab).classList.add('active');
      if (t.dataset.mtab === 'history') await renderEditHistory();
      if (t.dataset.mtab === 'foodlog') await renderMemberFoodLog();
    });
  });

  // ---- Member food log (admin view of what they've eaten) ----
  let foodTrendChart = null;
  const MEAL_ICONS = { breakfast: 'egg', lunch: 'lunch_dining', dinner: 'dinner_dining', snack: 'cookie' };
  const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

  async function renderMemberFoodLog() {
    const dateInput = document.getElementById('foodlog-date');
    if (!dateInput.value) dateInput.value = todayISO();
    const date = dateInput.value;
    const [day, summary] = await Promise.all([
      api(`/api/admin/members/${editingMember.id}/food?date=${date}`),
      api(`/api/admin/members/${editingMember.id}/food/summary?days=7`),
    ]);

    // Macro totals with target progress
    const macrosEl = document.getElementById('foodlog-macros');
    const t = day.total;
    const tgt = day.target;
    const pct = k => tgt && tgt[k] ? Math.min(100, Math.round((t[k] / tgt[k]) * 100)) : null;
    const stat = (label, value, unit, pctVal) => {
      const bar = pctVal != null
        ? `<div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 6px; overflow: hidden;">
             <div style="height: 100%; width: ${pctVal}%; background: ${pctVal > 110 ? 'var(--md-error)' : pctVal >= 80 ? 'var(--md-success)' : 'var(--md-primary)'};"></div>
           </div>` : '';
      return `<div class="stat"><div class="lbl">${label}</div><div class="num">${value}${unit}</div><div class="sub">${pctVal != null ? `${pctVal}% of ${tgt[label.toLowerCase()]}${unit}` : 'No target'}</div>${bar}</div>`;
    };
    macrosEl.innerHTML =
      stat('Calories', t.calories, ' kcal', pct('calories')) +
      stat('Protein',  Math.round(t.protein), 'g', pct('protein')) +
      stat('Carbs',    Math.round(t.carbs),   'g', pct('carbs')) +
      stat('Fats',     Math.round(t.fats),    'g', pct('fats'));

    // Entries grouped by meal
    const entriesEl = document.getElementById('foodlog-entries');
    if (day.entries.length === 0) {
      entriesEl.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">no_meals</span>
        Nothing logged for ${new Date(date).toLocaleDateString()}.
      </div>`;
    } else {
      const grouped = {};
      day.entries.forEach(e => { (grouped[e.meal_type] = grouped[e.meal_type] || []).push(e); });
      const order = ['breakfast', 'lunch', 'snack', 'dinner'];
      entriesEl.innerHTML = order.filter(k => grouped[k]).map(meal => {
        const total = grouped[meal].reduce((s, e) => s + (e.calories || 0), 0);
        return `
          <div class="day-card" style="margin-bottom: 10px;">
            <div class="day-head">
              <div class="name">
                <span class="material-symbols-rounded" style="vertical-align: middle;">${MEAL_ICONS[meal]}</span>
                ${MEAL_LABELS[meal]}
              </div>
              <div class="focus">${total} kcal</div>
            </div>
            ${grouped[meal].map(e => `
              <div class="ex-display">
                <div class="ex-name">${e.food_name}</div>
                <div class="meta">
                  <span class="chip primary">${e.calories} kcal</span>
                  ${e.protein != null ? `<span class="chip info">${Math.round(e.protein)}p</span>` : ''}
                  ${e.carbs   != null ? `<span class="chip info">${Math.round(e.carbs)}c</span>` : ''}
                  ${e.fats    != null ? `<span class="chip info">${Math.round(e.fats)}f</span>` : ''}
                  <span class="chip">${e.source === 'android' ? '📱 App' : '💻 Web'}</span>
                  <span class="sets">${new Date(e.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }).join('');
    }

    // 7-day calorie trend
    const labels = [], data = [];
    const map = Object.fromEntries(summary.days.map(d => [d.entry_date, d.calories]));
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }));
      data.push(map[iso] || 0);
    }
    if (foodTrendChart) foodTrendChart.destroy();
    foodTrendChart = new Chart(document.getElementById('foodlog-trend').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Calories', data, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246,0.15)',
          tension: 0.3, fill: true, pointRadius: 4, pointBackgroundColor: '#3B82F6' },
        ...(day.target ? [{ label: 'Target', data: Array(7).fill(day.target.calories),
          borderColor: '#34D399', borderDash: [6, 4], pointRadius: 0, fill: false }] : []),
      ]},
      options: {
        plugins: { legend: { labels: { color: '#F4F4F5' } } },
        scales: {
          x: { ticks: { color: '#52525B' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#52525B' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
        },
      },
    });
  }

  document.getElementById('foodlog-date').addEventListener('change', () => renderMemberFoodLog());

  // ---- Overview: today's nutrition across all members ----
  async function renderTodayNutrition() {
    const data = await api('/api/admin/food/today');
    const logged = data.members.filter(m => m.entries > 0);
    document.getElementById('food-today-count').textContent = `${logged.length}/${data.members.length} logged today`;
    const list = document.getElementById('food-today-list');
    if (logged.length === 0) {
      list.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">no_meals</span>
        No members have logged food today yet.
      </div>`;
      return;
    }
    list.innerHTML = data.members.map(m => {
      const pct = m.percentOfTarget;
      const barColor = pct == null ? 'var(--md-outline-variant)' :
        pct > 110 ? 'var(--md-error)' :
        pct >= 80 ? 'var(--md-success)' :
        pct >= 40 ? 'var(--md-warning)' : 'var(--md-primary)';
      const barWidth = pct == null ? 0 : Math.min(100, pct);
      return `
        <div class="notif" data-open-member="${m.id}" style="cursor: pointer;">
          <div class="avatar">${initials(m.name)}</div>
          <div class="n-body">
            <div class="n-title">${m.name}
              ${m.entries > 0 ? '' : '<span class="chip warning">Not logged</span>'}
              ${m.percentOfTarget != null && m.percentOfTarget > 110 ? '<span class="chip error">Over target</span>' : ''}
            </div>
            <div class="n-text" style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">
              ${m.calories} kcal${m.target ? ` / ${m.target}` : ''}
              &nbsp;·&nbsp; ${Math.round(m.protein)}p / ${Math.round(m.carbs)}c / ${Math.round(m.fats)}f
              &nbsp;·&nbsp; ${m.entries} entries
            </div>
            <div style="height: 5px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-top: 6px; overflow: hidden;">
              <div style="height: 100%; width: ${barWidth}%; background: ${barColor}; transition: width 0.4s ease;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-open-member]').forEach(el => {
      el.addEventListener('click', () => openMember(parseInt(el.dataset.openMember)));
    });
  }

  // Pretty field labels for the edit history diff view
  const FIELD_LABELS = {
    name: 'Name', email: 'Email', phone: 'Phone', goal: 'Goal', height: 'Height (cm)',
    subscription_plan: 'Subscription plan',
    subscription_start: 'Subscription start',
    subscription_expiry: 'Subscription expiry',
    password: 'Password',
  };

  async function renderEditHistory() {
    if (!editingMember) return;
    const rows = await api(`/api/admin/members/${editingMember.id}/history`);
    const el = document.getElementById('md-history');
    if (rows.length === 0) {
      el.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">history</span>
        No edits yet.
      </div>`;
      return;
    }
    el.innerHTML = rows.map(r => {
      const when = new Date(r.changed_at).toLocaleString();
      const editorChip = r.edited_by_role === 'admin'
        ? `<span class="chip primary">Admin · ${r.edited_by_name}</span>`
        : `<span class="chip info">Member · ${r.edited_by_name}</span>`;
      const diffs = Object.entries(r.changes || {}).map(([field, { from, to }]) => `
        <div class="ex-display">
          <div class="ex-name">${FIELD_LABELS[field] || field}</div>
          <div class="meta">
            <span class="chip error" title="Before">${from === null || from === '' ? '(empty)' : String(from)}</span>
            <span class="material-symbols-rounded" style="opacity: 0.5;">arrow_forward</span>
            <span class="chip success" title="After">${to === null || to === '' ? '(empty)' : String(to)}</span>
          </div>
        </div>
      `).join('');
      return `
        <div class="notif">
          <div class="n-icon general"><span class="material-symbols-rounded">history</span></div>
          <div class="n-body">
            <div class="n-title">${editorChip}</div>
            <div class="n-when">${when}</div>
            <div style="margin-top: 8px;">${diffs || '<div class="body">(no field changes recorded)</div>'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('md-save').addEventListener('click', async () => {
    try {
      await api(`/api/admin/members/${editingMember.id}`, {
        method: 'PATCH',
        body: {
          name:   document.getElementById('md-name-input').value.trim(),
          phone:  document.getElementById('md-phone').value.trim(),
          goal:   document.getElementById('md-goal').value.trim(),
          height: parseFloat(document.getElementById('md-height').value) || null,
          // Extended profile fields
          date_of_birth:               document.getElementById('md-dob').value || null,
          blood_group:                 document.getElementById('md-blood-group').value || null,
          photo_url:                   document.getElementById('md-photo-url').value.trim() || null,
          emergency_contact_name:      document.getElementById('md-ec-name').value.trim() || null,
          emergency_contact_phone:     document.getElementById('md-ec-phone').value.trim() || null,
          emergency_contact_relation:  document.getElementById('md-ec-relation').value.trim() || null,
          medical_history:             document.getElementById('md-medical').value.trim() || null,
          assigned_trainer_id:         document.getElementById('md-trainer').value || null,
          batch_id:                    document.getElementById('md-batch').value || null,
        },
      });
    } catch (e) { alert(e.message); return; }
    closeModal('member-modal');
    await loadAll();
  });

  document.getElementById('sub-whatsapp').addEventListener('click', () =>
    sendWhatsAppReminder(editingMember.id, editingMember.name)
  );

  document.getElementById('md-delete').addEventListener('click', async () => {
    if (!confirm('Remove this member? This cannot be undone.')) return;
    await api(`/api/admin/members/${editingMember.id}`, { method: 'DELETE' });
    closeModal('member-modal');
    await loadAll();
  });

  document.getElementById('md-checkin-today').addEventListener('click', async () => {
    await api(`/api/admin/members/${editingMember.id}/attendance/toggle`, {
      method: 'POST', body: { date: todayISO() },
    });
    editingMember = await api(`/api/admin/members/${editingMember.id}`);
    renderMemberAttendance();
    await loadAll();
  });

  document.getElementById('wp-save').addEventListener('click', async () => {
    const name = document.getElementById('wp-name').value.trim();
    if (!name) return alert('Give the plan a name.');
    const totalItems = editingPlan.days.reduce((s, d) => s + d.items.length, 0);
    if (totalItems === 0) return alert('Add at least one exercise.');
    editingPlan.name = name;
    editingPlan.assignedBy = me.name;
    await api(`/api/admin/members/${editingMember.id}/workout`, { method: 'PUT', body: editingPlan });
    alert('Workout plan saved.');
    await loadAll();
  });

  document.getElementById('np-save').addEventListener('click', async () => {
    const meals = document.getElementById('np-meals').value.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const [name, items] = line.split('|').map(s => (s || '').trim());
      return { name, items: items || '' };
    });
    if (!meals.length) return alert('Add at least one meal.');
    await api(`/api/admin/members/${editingMember.id}/nutrition`, {
      method: 'PUT',
      body: {
        calories: parseInt(document.getElementById('np-cal').value) || 0,
        protein:  parseInt(document.getElementById('np-pro').value) || 0,
        carbs:    parseInt(document.getElementById('np-carb').value) || 0,
        fats:     parseInt(document.getElementById('np-fat').value) || 0,
        meals,
      },
    });
    alert('Nutrition plan saved.');
  });

  // Add member
  document.getElementById('add-member-btn').addEventListener('click', () => {
    document.querySelector('input[name="new-member-type"][value="regular"]').checked = true;
    document.getElementById('new-pt-fields').style.display = 'none';
    const tSel = document.getElementById('new-pt-trainer');
    tSel.innerHTML = '<option value="">Select trainer…</option>' +
      trainersCache.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    const pSel = document.getElementById('new-pt-package');
    pSel.innerHTML = '<option value="">Select package…</option>' +
      ptPackagesCache.filter(p => p.is_active !== false).map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} — ${money(p.price)}</option>`).join('');
    document.getElementById('new-pt-price').value = '';
    openModal('add-member-modal');
  });
  document.querySelectorAll('input[name="new-member-type"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('new-pt-fields').style.display =
        document.querySelector('input[name="new-member-type"]:checked').value === 'pt' ? 'block' : 'none';
    });
  });
  document.getElementById('new-pt-package').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt && opt.dataset.price) document.getElementById('new-pt-price').value = opt.dataset.price;
  });

  document.getElementById('new-save').addEventListener('click', async () => {
    const memberType = document.querySelector('input[name="new-member-type"]:checked').value;
    const body = {
      name: document.getElementById('new-name').value.trim(),
      email: document.getElementById('new-email').value.trim(),
      phone: document.getElementById('new-phone').value.trim(),
      password: document.getElementById('new-pw').value,
      height: parseFloat(document.getElementById('new-height').value) || null,
      weight: parseFloat(document.getElementById('new-weight').value) || null,
      goal: document.getElementById('new-goal').value.trim(),
      plan: document.getElementById('new-plan').value,
      subDays: parseInt(document.getElementById('new-sub-days').value) || 30,
      batch_id: document.getElementById('new-batch').value || null,
      member_type: memberType,
    };
    if (memberType === 'pt') {
      body.trainer_id = document.getElementById('new-pt-trainer').value || null;
      body.package_id = document.getElementById('new-pt-package').value || null;
      body.pt_price = parseFloat(document.getElementById('new-pt-price').value) || 0;
      if (!body.trainer_id) return alert('Select a trainer for the PT member.');
    }
    if (!body.name || !body.email) return alert('Name and email are required.');
    try {
      const created = await api('/api/admin/members', { method: 'POST', body });
      closeModal('add-member-modal');
      await loadAll();

      document.getElementById('mc-summary').innerHTML = body.phone
        ? `<strong>${body.name}</strong> is set up with email <strong>${body.email}</strong>.
           Send their login details to <strong>${body.phone}</strong>?`
        : `<strong>${body.name}</strong> is set up with email <strong>${body.email}</strong>.
           No phone number on file — add one to their profile to send credentials over WhatsApp.`;
      const sendBtn = document.getElementById('mc-send-creds');
      sendBtn.style.display = body.phone ? 'inline-flex' : 'none';
      sendBtn.onclick = async () => {
        sendBtn.disabled = true;
        try {
          const result = await api(`/api/admin/members/${created.id}/send-credentials`, {
            method: 'POST', body: { password: body.password },
          });
          if (result.mode === 'api') {
            alert(`✅ Login credentials sent to ${body.name} (${result.phone}).`);
            closeModal('member-created-modal');
          } else {
            window.open(result.link, '_blank', 'noopener');
          }
        } catch (e) {
          alert(`Could not send credentials: ${e.message}`);
        } finally {
          sendBtn.disabled = false;
        }
      };
      openModal('member-created-modal');

      ['new-name','new-email','new-phone','new-height','new-weight','new-goal','new-pt-price'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('new-batch').value = '';
      document.querySelector('input[name="new-member-type"][value="regular"]').checked = true;
      document.getElementById('new-pt-fields').style.display = 'none';
    } catch (e) { alert(e.message); }
  });

  // ================================ FINANCE ================================
  let plans = [];
  let payments = [];
  let finance = null;
  let revenueChart = null, methodChart = null;
  let editingPlanId = null;

  const money = v => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const methodLabel = m => ({ cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer' }[m] || m);
  const statusChip = s => `<span class="chip ${s === 'paid' ? 'success' : s === 'pending' ? 'warning' : 'error'}">${s}</span>`;

  async function loadFinance() {
    const status = document.getElementById('payment-filter').value;
    [plans, payments, finance] = await Promise.all([
      api('/api/admin/plans'),
      api(`/api/admin/payments${status ? '?status=' + status : ''}`),
      api('/api/admin/finance'),
    ]);
    renderFinanceStats();
    renderRevenueChart();
    renderMethodChart();
    renderPlansList();
    renderPendingList();
    renderPaymentsTable();
  }

  function renderFinanceStats() {
    document.getElementById('fin-mtd').textContent  = money(finance.mtdRevenue);
    document.getElementById('fin-mtd-sub').textContent = `${finance.mtdPayments} payment${finance.mtdPayments === 1 ? '' : 's'}`;
    document.getElementById('fin-ytd').textContent  = money(finance.ytdRevenue);
    document.getElementById('fin-ytd-sub').textContent = `${finance.ytdPayments} payment${finance.ytdPayments === 1 ? '' : 's'}`;
    document.getElementById('fin-pending').textContent = money(finance.pendingAmount);
    document.getElementById('fin-pending-sub').textContent = `${finance.pendingCount} awaiting approval`;
    document.getElementById('fin-active').textContent = finance.activeSubscriptions;

    const gym = finance.gymRevenue || {};
    const pt  = finance.ptRevenue  || {};
    document.getElementById('fin-gym-mtd').textContent = money(gym.mtd || 0);
    document.getElementById('fin-gym-mtd-sub').textContent = `${gym.mtdPayments || 0} payment${gym.mtdPayments === 1 ? '' : 's'}`;
    document.getElementById('fin-gym-ytd').textContent = money(gym.ytd || 0);
    document.getElementById('fin-gym-ytd-sub').textContent = `${gym.ytdPayments || 0} payment${gym.ytdPayments === 1 ? '' : 's'}`;
    document.getElementById('fin-pt-mtd').textContent = money(pt.mtd || 0);
    document.getElementById('fin-pt-mtd-sub').textContent = `${pt.mtdPayments || 0} payment${pt.mtdPayments === 1 ? '' : 's'}`;
    document.getElementById('fin-pt-ytd').textContent = money(pt.ytd || 0);
    document.getElementById('fin-pt-ytd-sub').textContent = `${pt.ytdPayments || 0} payment${pt.ytdPayments === 1 ? '' : 's'}`;
  }

  function renderRevenueChart() {
    // Fill in any missing months in the last 6 with zeros so the axis reads cleanly
    const labels = [], data = [];
    const map = Object.fromEntries((finance.gymRevenue?.monthly || []).map(m => [m.ym, m.total]));
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
      data.push(map[ym] || 0);
    }
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(document.getElementById('revenue-chart').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{
        label: 'Revenue (₹)', data,
        backgroundColor: 'rgba(52, 211, 153, 0.7)', borderColor: '#34D399',
        borderWidth: 1, borderRadius: 6,
      }]},
      options: {
        plugins: {
          legend: { labels: { color: '#F4F4F5' } },
          tooltip: { callbacks: { label: c => '₹' + Number(c.parsed.y).toLocaleString('en-IN') } },
        },
        scales: {
          x: { ticks: { color: '#52525B' }, grid: { display: false } },
          y: {
            ticks: { color: '#52525B', callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) },
            grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true,
          },
        },
      },
    });
  }

  function renderMethodChart() {
    const src = (finance.byMethod || []);
    if (methodChart) methodChart.destroy();
    if (src.length === 0) {
      document.getElementById('method-chart').getContext('2d').clearRect(0, 0, 500, 300);
      return;
    }
    methodChart = new Chart(document.getElementById('method-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: src.map(x => methodLabel(x.method)),
        datasets: [{
          data: src.map(x => x.total),
          backgroundColor: ['#34D399', '#60A5FA', '#3B82F6', '#FBBF24', '#DAB3FF'],
          borderColor: '#18181B', borderWidth: 3,
        }],
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: '#F4F4F5', padding: 12 } },
          tooltip: { callbacks: { label: c => c.label + ': ₹' + Number(c.parsed).toLocaleString('en-IN') } },
        },
        cutout: '65%',
      },
    });
  }

  function renderPlansList() {
    const el = document.getElementById('plans-list');
    if (plans.length === 0) {
      el.innerHTML = `<div class="empty" style="grid-column: 1/-1;">No plans yet. Click "Add plan".</div>`;
      return;
    }
    el.innerHTML = plans.map(p => `
      <div class="card ${p.is_active ? '' : 'muted'}" style="padding: 18px; opacity: ${p.is_active ? 1 : 0.5};">
        <div class="flex between center" style="margin-bottom: 6px;">
          <div style="font-weight: 700; font-size: 16px;">${p.name}</div>
          <span class="chip ${p.is_active ? 'success' : 'error'}">${p.is_active ? 'Active' : 'Hidden'}</span>
        </div>
        <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: var(--md-primary);">${money(p.price)}<span style="font-size: 13px; color: var(--md-on-surface-variant); font-weight: 500;"> / ${p.duration_days} days</span></div>
        <div class="body" style="margin-top: 6px; margin-bottom: 12px;">${p.description || ''}</div>
        <div class="flex gap">
          <button class="btn btn-tonal sm" data-edit-plan="${p.id}">Edit</button>
          ${p.is_active ? `<button class="btn btn-text sm" data-toggle-plan="${p.id}" data-active="false">Hide</button>`
                       : `<button class="btn btn-text sm" data-toggle-plan="${p.id}" data-active="true">Show</button>`}
        </div>
      </div>
    `).join('');
    el.querySelectorAll('[data-edit-plan]').forEach(b =>
      b.addEventListener('click', () => openPlanModal(parseInt(b.dataset.editPlan))));
    el.querySelectorAll('[data-toggle-plan]').forEach(b => {
      b.addEventListener('click', async () => {
        await api(`/api/admin/plans/${b.dataset.togglePlan}`, {
          method: 'PATCH', body: { is_active: b.dataset.active === 'true' },
        });
        await loadFinance();
      });
    });
  }

  function renderPendingList() {
    const pending = payments.filter(p => p.status === 'pending');
    document.getElementById('fin-pending-count').textContent = `${pending.length} pending`;
    const el = document.getElementById('fin-pending-list');
    if (pending.length === 0) {
      el.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">check_circle</span>
        No pending renewal requests.
      </div>`;
      return;
    }
    el.innerHTML = pending.map(p => `
      <div class="notif">
        <div class="n-icon expiry"><span class="material-symbols-rounded">payments</span></div>
        <div class="n-body">
          <div class="n-title">${p.member_name} — ${p.plan_name} · ${money(p.amount)}</div>
          <div class="n-text">${p.notes || ''} · via ${methodLabel(p.method)}</div>
          <div class="n-when">Requested ${new Date(p.created_at).toLocaleString()}</div>
        </div>
        <div class="flex gap" style="flex-direction: column;">
          <button class="btn btn-filled sm" data-approve="${p.id}">
            <span class="material-symbols-rounded">check</span>Approve
          </button>
          <button class="btn btn-text sm" data-decline="${p.id}">Decline</button>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('[data-approve]').forEach(b => {
      b.addEventListener('click', async () => {
        await api(`/api/admin/payments/${b.dataset.approve}/approve`, { method: 'POST' });
        await loadFinance();
        // Reload main list too so the members table shows the new expiry
        await loadAll();
      });
    });
    el.querySelectorAll('[data-decline]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Decline and remove this renewal request?')) return;
        await api(`/api/admin/payments/${b.dataset.decline}`, { method: 'DELETE' });
        await loadFinance();
      });
    });
  }

  function renderPaymentsTable() {
    const tbody = document.getElementById('payments-tbody');
    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--md-on-surface-variant);">No payments yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = payments.map(p => `
      <tr>
        <td>${new Date(p.payment_date).toLocaleDateString()}</td>
        <td><strong>${p.member_name || '—'}</strong></td>
        <td>${p.plan_name}</td>
        <td style="font-family: 'JetBrains Mono', monospace;">${money(p.amount)}</td>
        <td>${methodLabel(p.method)}</td>
        <td>${statusChip(p.status)}</td>
        <td class="muted" style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${p.reference || '—'}</td>
        <td class="right" style="white-space:nowrap;">
          <button class="btn btn-tonal sm" data-receipt="${p.id}" title="Send PDF invoice on WhatsApp">
            <span class="material-symbols-rounded">receipt_long</span>
          </button>
          <a class="btn btn-text sm icon" href="/api/invoices/${p.id}.pdf?t=${p.invoice_token}" target="_blank" rel="noopener" title="View PDF invoice">
            <span class="material-symbols-rounded">picture_as_pdf</span>
          </a>
          <button class="btn btn-text sm icon" data-del-pay="${p.id}"><span class="material-symbols-rounded">delete</span></button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-del-pay]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Remove this payment record?')) return;
        await api(`/api/admin/payments/${b.dataset.delPay}`, { method: 'DELETE' });
        await loadFinance();
      });
    });
    tbody.querySelectorAll('[data-receipt]').forEach(b => {
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const result = await api(`/api/admin/payments/${b.dataset.receipt}/receipt`, { method: 'POST' });
          if (result.mode === 'api') {
            alert(`✅ Receipt sent on WhatsApp (${result.phone}).`);
          } else {
            window.open(result.link, '_blank', 'noopener');
          }
        } catch (e) {
          alert(`Could not send receipt: ${e.message}`);
        } finally {
          b.disabled = false;
        }
      });
    });
  }

  document.getElementById('payment-filter').addEventListener('change', () => loadFinance());

  // ---- Add / edit plan modal ----
  function openPlanModal(id) {
    editingPlanId = id;
    if (id) {
      const p = plans.find(x => x.id === id);
      document.getElementById('plan-modal-title').textContent = 'Edit subscription plan';
      document.getElementById('plan-name').value     = p.name;
      document.getElementById('plan-price').value    = p.price;
      document.getElementById('plan-duration').value = p.duration_days;
      document.getElementById('plan-desc').value     = p.description || '';
      document.getElementById('plan-active').value   = String(p.is_active);
    } else {
      document.getElementById('plan-modal-title').textContent = 'Add subscription plan';
      ['plan-name','plan-price','plan-duration','plan-desc'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('plan-active').value = 'true';
    }
    openModal('plan-modal');
  }
  document.getElementById('add-plan-btn').addEventListener('click', () => openPlanModal(null));
  document.getElementById('plan-save').addEventListener('click', async () => {
    const body = {
      name: document.getElementById('plan-name').value.trim(),
      price: parseFloat(document.getElementById('plan-price').value),
      duration_days: parseInt(document.getElementById('plan-duration').value),
      description: document.getElementById('plan-desc').value.trim(),
      is_active: document.getElementById('plan-active').value === 'true',
    };
    if (!body.name || !body.price || !body.duration_days) return alert('Name, price and duration are required.');
    try {
      if (editingPlanId) await api(`/api/admin/plans/${editingPlanId}`, { method: 'PATCH', body });
      else await api('/api/admin/plans', { method: 'POST', body });
      closeModal('plan-modal');
      await loadFinance();
    } catch (e) { alert(e.message); }
  });

  // ---- Record payment modal ----
  document.getElementById('record-payment-btn').addEventListener('click', () => {
    const memberSel = document.getElementById('pay-member');
    memberSel.innerHTML = members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    const planSel = document.getElementById('pay-plan');
    planSel.innerHTML = plans.filter(p => p.is_active).map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} — ${money(p.price)} / ${p.duration_days}d</option>`).join('');
    // Auto-fill amount from selected plan
    const syncAmount = () => {
      const opt = planSel.options[planSel.selectedIndex];
      if (opt) document.getElementById('pay-amount').value = opt.dataset.price;
    };
    planSel.onchange = syncAmount; syncAmount();
    document.getElementById('pay-date').value = todayISO();
    document.getElementById('pay-method').value = 'cash';
    document.getElementById('pay-ref').value = '';
    document.getElementById('pay-notes').value = '';
    document.getElementById('pay-extend').checked = true;
    openModal('pay-modal');
  });
  document.getElementById('pay-save').addEventListener('click', async () => {
    const memberId = parseInt(document.getElementById('pay-member').value);
    const planSel = document.getElementById('pay-plan');
    const opt = planSel.options[planSel.selectedIndex];
    const body = {
      plan_name: opt.dataset.name,
      amount: parseFloat(document.getElementById('pay-amount').value),
      method: document.getElementById('pay-method').value,
      reference: document.getElementById('pay-ref').value.trim() || null,
      payment_date: document.getElementById('pay-date').value,
      notes: document.getElementById('pay-notes').value.trim() || null,
      extend_subscription: document.getElementById('pay-extend').checked,
    };
    if (!body.plan_name || !body.amount) return alert('Plan and amount are required.');
    try {
      await api(`/api/admin/members/${memberId}/payments`, { method: 'POST', body });
      closeModal('pay-modal');
      await loadFinance();
      await loadAll(); // refresh member list to show new expiry
    } catch (e) { alert(e.message); }
  });

  await loadAll();
})();
