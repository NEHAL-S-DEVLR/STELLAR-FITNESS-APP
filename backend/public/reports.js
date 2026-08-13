// Reports — reports.js

(async function () {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'reports.view')) { location.href = '/profile.html'; return; }

  renderAdminNav('reports', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  // ── Date helpers ─────────────────────────────────────────────────────────────
  function monthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }

  function todayISOLocal() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatINR(n) {
    return '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Palette ──────────────────────────────────────────────────────────────────
  const PALETTE = ['#3B82F6', '#34D399', '#FBBF24', '#60A5FA', '#F87171', '#A1A1AA', '#34D399', '#52525B'];

  const CAT_COLOURS = {
    Rent:          '#60A5FA',
    Electricity:   '#FBBF24',
    Salary:        '#34D399',
    Maintenance:   '#3B82F6',
    Cleaning:      '#34D399',
    Marketing:     '#A1A1AA',
    Miscellaneous: '#52525B',
  };

  const METHOD_COLOURS = {
    cash:          '#34D399',
    upi:           '#60A5FA',
    card:          '#3B82F6',
    bank_transfer: '#FBBF24',
    online:        '#A1A1AA',
  };

  function methodLabel(m) {
    return ({ cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank Transfer', online: 'Online' }[m] || m || '—');
  }

  // ── Chart registry (to destroy on re-render) ──────────────────────────────────
  const charts = {};
  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
  }

  // ── Error banner ──────────────────────────────────────────────────────────────
  function showError(msg) {
    const el = document.getElementById('error-banner');
    el.textContent = msg;
    el.classList.add('show');
  }
  function hideError() {
    const el = document.getElementById('error-banner');
    el.textContent = '';
    el.classList.remove('show');
  }

  // ── Default date range: first day of current month → today ───────────────────
  const fromInput = document.getElementById('range-from');
  const toInput   = document.getElementById('range-to');
  fromInput.value = monthStart();
  toInput.value   = todayISOLocal();

  // ── Preset buttons ────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const today = new Date();
      let from, to;
      switch (btn.dataset.preset) {
        case 'today':
          from = to = todayISOLocal();
          break;
        case 'week': {
          const dow = today.getDay(); // 0=Sun
          const diff = (dow === 0) ? -6 : 1 - dow;
          const mon = new Date(today); mon.setDate(today.getDate() + diff);
          from = mon.toISOString().slice(0, 10);
          to   = todayISOLocal();
          break;
        }
        case 'month':
          from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
          to   = todayISOLocal();
          break;
        case 'lastmonth': {
          const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          from = lm.toISOString().slice(0, 10);
          const lme = new Date(today.getFullYear(), today.getMonth(), 0);
          to = lme.toISOString().slice(0, 10);
          break;
        }
        case 'year':
          from = `${today.getFullYear()}-01-01`;
          to   = todayISOLocal();
          break;
      }
      fromInput.value = from;
      toInput.value   = to;
      loadReport();
    });
  });

  document.getElementById('load-report-btn').addEventListener('click', loadReport);
  document.getElementById('print-btn').addEventListener('click', () => window.print());

  // ── Load & render report ──────────────────────────────────────────────────────
  async function loadReport() {
    const from = fromInput.value;
    const to   = toInput.value;
    if (!from || !to) return alert('Please select both From and To dates.');
    if (from > to)    return alert('From date must be before To date.');

    hideError();
    document.getElementById('report-loading').style.display  = 'block';
    document.getElementById('report-content').style.display  = 'none';
    document.getElementById('report-empty').style.display    = 'none';

    try {
      const data = await api(`/api/admin/reports?from=${from}&to=${to}`);
      document.getElementById('report-loading').style.display = 'none';

      // Detect completely empty report
      const hasAnyData =
        (data.admissions && data.admissions.total_count > 0) ||
        (data.revenue && data.revenue.total > 0) ||
        (data.expenses && data.expenses.total > 0) ||
        (data.attendance && data.attendance.total > 0);

      if (!hasAnyData) {
        document.getElementById('report-empty').style.display = 'block';
        return;
      }

      document.getElementById('report-content').style.display = 'block';
      renderReport(data, from, to);
    } catch (e) {
      document.getElementById('report-loading').style.display = 'none';
      showError('Failed to load report: ' + e.message);
    }
  }

  function renderReport(data, from, to) {
    // Range label
    document.getElementById('report-range-label').textContent =
      `${formatDate(from)} – ${formatDate(to)}`;

    const revenue  = data.revenue  || {};
    const expenses = data.expenses || {};
    const admissions = data.admissions || {};
    const trainers   = data.trainers   || [];
    const pt         = data.pt         || {};
    const attendance = data.attendance || {};

    const totalRevenue  = revenue.total  || 0;
    const totalExpenses = expenses.total || 0;
    const netProfit = totalRevenue - totalExpenses;

    // ── Top summary row ──────────────────────────────────────────────────────
    const profitColour = netProfit >= 0 ? 'var(--md-success)' : 'var(--md-error)';
    document.getElementById('sum-revenue').textContent = formatINR(totalRevenue);
    document.getElementById('sum-revenue-sub').textContent =
      `${revenue.count || 0} transaction${(revenue.count || 0) === 1 ? '' : 's'}`;
    document.getElementById('sum-expenses').textContent = formatINR(totalExpenses);
    document.getElementById('sum-expenses-sub').textContent =
      `${expenses.count || 0} expense record${(expenses.count || 0) === 1 ? '' : 's'}`;

    document.getElementById('summary-row').innerHTML = `
      <div class="summary-item">
        <div class="s-val" style="color: var(--md-success);">${formatINR(totalRevenue)}</div>
        <div class="s-lbl">Total Revenue</div>
      </div>
      <div class="summary-item">
        <div class="s-val" style="color: var(--md-error);">${formatINR(totalExpenses)}</div>
        <div class="s-lbl">Total Expenses</div>
      </div>
      <div class="summary-item">
        <div class="s-val" style="color: ${profitColour};">${netProfit >= 0 ? '' : '−'}${formatINR(Math.abs(netProfit))}</div>
        <div class="s-lbl">Net Profit</div>
      </div>
      <div class="summary-item">
        <div class="s-val">${admissions.total_count || 0}</div>
        <div class="s-lbl">Total Admissions</div>
      </div>
      <div class="summary-item">
        <div class="s-val">${admissions.new_count || 0}</div>
        <div class="s-lbl">New Members</div>
      </div>
      <div class="summary-item">
        <div class="s-val">${admissions.renewal_count || 0}</div>
        <div class="s-lbl">Renewals</div>
      </div>
      <div class="summary-item">
        <div class="s-val">${formatINR(pt.revenue || 0)}</div>
        <div class="s-lbl">PT Revenue</div>
      </div>
      <div class="summary-item">
        <div class="s-val">${attendance.total || 0}</div>
        <div class="s-lbl">Total Attendance</div>
      </div>
    `;

    // ── Admission Report ─────────────────────────────────────────────────────
    const admRows = admissions.by_type || [];
    const admTbody = document.getElementById('admission-tbody');
    if (admRows.length === 0) {
      admTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--md-on-surface-variant);">No admissions in this period.</td></tr>`;
    } else {
      const admGrandTotal = admRows.reduce((s, r) => s + (r.revenue || 0), 0);
      admTbody.innerHTML = admRows.map(r => `
        <tr>
          <td><span class="status-badge ${r.type === 'new' ? 'new' : 'renewal'}">${r.type === 'new' ? 'New' : 'Renewal'}</span></td>
          <td style="text-align:right;">${r.count || 0}</td>
          <td style="text-align:right; font-family: 'JetBrains Mono', monospace;">${formatINR(r.revenue)}</td>
          <td style="text-align:right; font-family: 'JetBrains Mono', monospace; color: var(--md-warning);">${formatINR(r.discount)}</td>
          <td style="text-align:right; font-family: 'JetBrains Mono', monospace; color: var(--md-error);">${formatINR(r.outstanding)}</td>
        </tr>
      `).join('') + `
        <tr style="border-top: 2px solid var(--md-outline-variant); font-weight: 700;">
          <td>Total</td>
          <td style="text-align:right;">${admissions.total_count || 0}</td>
          <td style="text-align:right; font-family: 'JetBrains Mono', monospace; color: var(--md-primary);">${formatINR(admGrandTotal)}</td>
          <td></td><td></td>
        </tr>
      `;
    }

    destroyChart('admission');
    if (admRows.length > 0) {
      charts.admission = new Chart(document.getElementById('admission-chart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: admRows.map(r => r.type === 'new' ? 'New Members' : 'Renewals'),
          datasets: [
            {
              label: 'Count',
              data: admRows.map(r => r.count || 0),
              backgroundColor: ['rgba(52, 211, 153,0.7)', 'rgba(96, 165, 250,0.7)'],
              borderColor: ['#34D399', '#60A5FA'],
              borderWidth: 1, borderRadius: 6, yAxisID: 'y',
            },
            {
              label: 'Revenue (₹)',
              data: admRows.map(r => r.revenue || 0),
              type: 'line',
              borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246,0.10)',
              borderWidth: 2, pointRadius: 4, fill: true, yAxisID: 'y1',
            },
          ],
        },
        options: {
          plugins: {
            legend: { labels: { color: '#F4F4F5' } },
            tooltip: { callbacks: {
              label: ctx => ctx.dataset.yAxisID === 'y1'
                ? `Revenue: ${formatINR(ctx.parsed.y)}`
                : `Count: ${ctx.parsed.y}`,
            }},
          },
          scales: {
            x: { ticks: { color: '#52525B' }, grid: { display: false } },
            y: { ticks: { color: '#52525B', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true, position: 'left' },
            y1: {
              ticks: { color: '#52525B', callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) },
              grid: { display: false }, beginAtZero: true, position: 'right',
            },
          },
        },
      });
    }

    // ── Revenue Breakdown ────────────────────────────────────────────────────
    const revMethods = revenue.by_method || [];
    const revTbody = document.getElementById('revenue-tbody');
    if (revMethods.length === 0) {
      revTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: var(--md-on-surface-variant);">No revenue data.</td></tr>`;
    } else {
      revTbody.innerHTML = revMethods.map(r => `
        <tr>
          <td>${methodLabel(r.method)}</td>
          <td style="text-align:right;">${r.count || 0}</td>
          <td style="text-align:right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatINR(r.total)}</td>
        </tr>
      `).join('') + `
        <tr style="border-top: 2px solid var(--md-outline-variant); font-weight: 700;">
          <td>Total</td>
          <td style="text-align:right;">${revenue.count || 0}</td>
          <td style="text-align:right; font-family: 'JetBrains Mono', monospace; color: var(--md-success);">${formatINR(totalRevenue)}</td>
        </tr>
      `;
    }

    destroyChart('revenue');
    if (revMethods.length > 0) {
      const revColours = revMethods.map(r => METHOD_COLOURS[r.method] || PALETTE[revMethods.indexOf(r) % PALETTE.length]);
      charts.revenue = new Chart(document.getElementById('revenue-chart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: revMethods.map(r => methodLabel(r.method)),
          datasets: [{
            data: revMethods.map(r => r.total),
            backgroundColor: revColours,
            borderColor: '#18181B', borderWidth: 3,
          }],
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { color: '#F4F4F5', padding: 12 } },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatINR(ctx.parsed)}` } },
          },
          cutout: '60%',
        },
      });
    }

    // ── Expense Breakdown ────────────────────────────────────────────────────
    const expCats = expenses.by_category || [];
    const expTbody = document.getElementById('expense-tbody');
    if (expCats.length === 0) {
      expTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: var(--md-on-surface-variant);">No expense data.</td></tr>`;
    } else {
      expTbody.innerHTML = expCats
        .sort((a, b) => b.total - a.total)
        .map(c => `
          <tr>
            <td>
              <span class="exp-cat ${(c.category || '').toLowerCase().replace(/\s+/g, '').replace('miscellaneous', 'misc')}">
                ${c.category}
              </span>
            </td>
            <td style="text-align:right;">${c.count || 0}</td>
            <td style="text-align:right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatINR(c.total)}</td>
          </tr>
        `).join('') + `
          <tr style="border-top: 2px solid var(--md-outline-variant); font-weight: 700;">
            <td>Total</td>
            <td style="text-align:right;">${expenses.count || 0}</td>
            <td style="text-align:right; font-family: 'JetBrains Mono', monospace; color: var(--md-error);">${formatINR(totalExpenses)}</td>
          </tr>
        `;
    }

    destroyChart('expense');
    if (expCats.length > 0) {
      const expColours = expCats.map(c => CAT_COLOURS[c.category] || '#52525B');
      charts.expense = new Chart(document.getElementById('expense-chart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: expCats.map(c => c.category),
          datasets: [{
            data: expCats.map(c => c.total),
            backgroundColor: expColours,
            borderColor: '#18181B', borderWidth: 3,
          }],
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { color: '#F4F4F5', padding: 12 } },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatINR(ctx.parsed)}` } },
          },
          cutout: '60%',
        },
      });
    }

    // ── Trainer Performance ──────────────────────────────────────────────────
    const trainerTbody = document.getElementById('trainer-tbody');
    if (!trainers || trainers.length === 0) {
      trainerTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--md-on-surface-variant);">No trainer data for this period.</td></tr>`;
    } else {
      // Determine top performer by revenue
      const maxRev = Math.max(...trainers.map(t => t.revenue || 0));
      trainerTbody.innerHTML = trainers
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .map((t, i) => {
          const isTop = (t.revenue || 0) === maxRev && maxRev > 0;
          const rateLabel = t.is_partner ? '100% (Partner)' : `${t.ptRate || 50}%`;
          return `
            <tr ${isTop ? 'style="background: rgba(59, 130, 246,0.07);"' : ''}>
              <td>
                <div class="flex gap center">
                  <div class="avatar" style="width: 28px; height: 28px; font-size: 11px;">${initials(t.name)}</div>
                  <span style="font-weight: ${isTop ? 700 : 500};">${t.name}</span>
                  ${isTop ? '<span class="chip primary" style="font-size: 11px;">Top</span>' : ''}
                </div>
              </td>
              <td style="text-align:right;">${t.admissions || 0}</td>
              <td style="text-align:right; font-family: 'JetBrains Mono', monospace;">${formatINR(t.revenue)}</td>
              <td style="text-align:right;">${rateLabel}</td>
              <td style="text-align:right; font-family: 'JetBrains Mono', monospace; color: var(--md-warning);">${formatINR(t.commission || 0)}</td>
            </tr>
          `;
        }).join('');
    }

    // ── PT Summary ───────────────────────────────────────────────────────────
    const ptAssignments = pt.assignments || 0;
    const ptRevenue     = pt.revenue     || 0;
    const ptAvg         = ptAssignments > 0 ? Math.round(ptRevenue / ptAssignments) : 0;
    document.getElementById('pt-sessions').textContent = ptAssignments;
    document.getElementById('pt-revenue').textContent  = formatINR(ptRevenue);
    document.getElementById('pt-avg').textContent      = formatINR(ptAvg);
    document.getElementById('pt-members').textContent  = pt.members || 0;

    // ── Attendance Summary ───────────────────────────────────────────────────
    const attTotal  = attendance.total   || 0;
    const attUnique = attendance.unique  || 0;
    const attDays   = attendance.days    || 1;
    const attAvg    = attDays > 0 ? (attTotal / attDays).toFixed(1) : '—';
    const attPeak   = attendance.peak_date
      ? `${formatDate(attendance.peak_date)} (${attendance.peak_count})`
      : '—';
    document.getElementById('att-total').textContent  = attTotal;
    document.getElementById('att-unique').textContent = attUnique;
    document.getElementById('att-avg').textContent    = attAvg;
    document.getElementById('att-peak').textContent   = attPeak;
  }

  // ── Trends & Analytics (month-over-month line charts) ───────────────────────
  let trendRevenueChart = null, trendProfitChart = null, trendMembersChart = null, trendAttendanceChart = null;
  function renderTrendCharts(monthsDesc) {
    // API returns most-recent-first; charts read left→right chronologically.
    const months = [...monthsDesc].reverse();
    const labels = months.map(m => new Date(m.month + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
    const lineOpts = (label, data, color) => ({
      label, data, borderColor: color, backgroundColor: color + '33',
      tension: 0.3, fill: true, pointRadius: 3,
    });
    const chartOpts = {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#52525B' }, grid: { display: false } },
        y: { ticks: { color: '#52525B' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
      },
    };

    if (trendRevenueChart) trendRevenueChart.destroy();
    trendRevenueChart = new Chart(document.getElementById('trend-revenue-chart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        lineOpts('Revenue', months.map(m => m.revenue), '#3B82F6'),
        lineOpts('Expenses', months.map(m => m.expenses), '#F87171'),
      ]},
      options: { ...chartOpts, plugins: { legend: { display: true, labels: { color: '#A1A1AA' } } } },
    });

    if (trendProfitChart) trendProfitChart.destroy();
    trendProfitChart = new Chart(document.getElementById('trend-profit-chart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [lineOpts('Net Profit', months.map(m => m.netProfit), '#34D399')] },
      options: chartOpts,
    });

    if (trendMembersChart) trendMembersChart.destroy();
    trendMembersChart = new Chart(document.getElementById('trend-members-chart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [lineOpts('New Members', months.map(m => m.newMembers), '#A78BFA')] },
      options: chartOpts,
    });

    if (trendAttendanceChart) trendAttendanceChart.destroy();
    trendAttendanceChart = new Chart(document.getElementById('trend-attendance-chart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [lineOpts('Check-ins', months.map(m => m.checkins), '#FBBF24')] },
      options: chartOpts,
    });
  }

  // ── Monthly Profit Split ─────────────────────────────────────────────────────
  async function loadMonthlySplit() {
    let data;
    try {
      data = await api('/api/admin/reports/monthly-summary');
    } catch (e) {
      document.getElementById('mp-tbody').innerHTML =
        `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--md-error);">${e.message}</td></tr>`;
      return;
    }

    renderTrendCharts(data.months);
    document.getElementById('mp-company-name').textContent = data.companyName;
    document.getElementById('mp-partner-name').textContent = data.partnerName;
    document.getElementById('mp-company-col').textContent  = `${data.companyName} (50%)`;
    document.getElementById('mp-partner-col').textContent  = `${data.partnerName} (50%)`;

    const monthLabel = ym => new Date(ym + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const current = data.months[0];
    const currentEl = document.getElementById('mp-current');
    if (!current) {
      currentEl.innerHTML = `<div class="empty" style="grid-column:1/-1;"><span class="material-symbols-rounded">calendar_today</span>No revenue or expense activity recorded yet.</div>`;
    } else {
      currentEl.innerHTML = `
        <div class="stat"><div class="lbl">${monthLabel(current.month)} Revenue</div><div class="num">${formatINR(current.revenue)}</div></div>
        <div class="stat"><div class="lbl">Expenses</div><div class="num">${formatINR(current.expenses)}</div></div>
        <div class="stat tinted"><div class="lbl">Net Profit</div><div class="num">${formatINR(current.netProfit)}</div></div>
        <div class="stat"><div class="lbl">${data.companyName} / ${data.partnerName}</div><div class="num" style="font-size:20px;">${formatINR(current.companyShare)} / ${formatINR(current.partnerShare)}</div></div>
      `;
    }

    const tbody = document.getElementById('mp-tbody');
    if (data.months.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--md-on-surface-variant);">No months recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.months.map(m => `
      <tr>
        <td>${monthLabel(m.month)}</td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace;">${formatINR(m.revenue)}</td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace;">${formatINR(m.expenses)}</td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace; font-weight:600;">${formatINR(m.netProfit)}</td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace;">${formatINR(m.companyShare)}</td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace;">${formatINR(m.partnerShare)}</td>
      </tr>
    `).join('');
  }

  // ── Initial load ──────────────────────────────────────────────────────────────
  await loadReport();
  await loadMonthlySplit();
})();
