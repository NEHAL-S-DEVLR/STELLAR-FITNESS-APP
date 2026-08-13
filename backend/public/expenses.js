// Expense Management — expenses.js

(async function () {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'expenses.manage')) { location.href = '/profile.html'; return; }

  renderAdminNav('expenses', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  // ── Constants ────────────────────────────────────────────────────────────────
  const CATEGORIES = ['Rent', 'Electricity', 'Salary', 'Maintenance', 'Cleaning', 'Marketing', 'Miscellaneous'];

  const CAT_COLOURS = {
    Rent:          '#60A5FA',
    Electricity:   '#FBBF24',
    Salary:        '#34D399',
    Maintenance:   '#3B82F6',
    Cleaning:      '#34D399',
    Marketing:     '#A1A1AA',
    Miscellaneous: '#52525B',
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function monthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }

  function formatINR(n) {
    return '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function catBadge(cat) {
    const cls = (cat || '').toLowerCase().replace(/\s+/g, '').replace('miscellaneous', 'misc');
    return `<span class="exp-cat ${cls}">${cat}</span>`;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  function hideError(id) {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.remove('show');
  }

  // ── State ────────────────────────────────────────────────────────────────────
  let summaryChart = null;
  let editingId = null;
  let yearTotal = 0;

  // ── Date pickers for month/year selector ─────────────────────────────────────
  const now = new Date();

  const monthSel = document.getElementById('summary-month');
  const yearSel  = document.getElementById('summary-year');

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  MONTHS.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = m;
    if (i === now.getMonth()) opt.selected = true;
    monthSel.appendChild(opt);
  });
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    yearSel.appendChild(opt);
  }

  // ── Initialise default filter dates ──────────────────────────────────────────
  document.getElementById('filter-from').value = monthStart();
  document.getElementById('filter-to').value   = todayISO();
  document.getElementById('exp-date').value     = todayISO();

  // ── Stats ────────────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const yearFrom = `${y}-01-01`;

      const [monthSummary, yearExpenses] = await Promise.all([
        api(`/api/admin/expenses/summary?year=${y}&month=${now.getMonth() + 1}`),
        api(`/api/admin/expenses?from=${yearFrom}&to=${todayISO()}`),
      ]);

      // Month total
      const monthTotal = (monthSummary.categories || []).reduce((s, c) => s + (c.total || 0), 0);
      const monthCount = (monthSummary.categories || []).reduce((s, c) => s + (c.count || 0), 0);
      document.getElementById('stat-month-total').textContent = formatINR(monthTotal);
      document.getElementById('stat-month-sub').textContent = `${monthCount} records this month`;

      // Year total
      yearTotal = (yearExpenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      document.getElementById('stat-year-total').textContent = formatINR(yearTotal);
      document.getElementById('stat-year-sub').textContent = `Jan – ${MONTHS[now.getMonth()]} ${y}`;

      // Largest category
      const cats = monthSummary.categories || [];
      if (cats.length > 0) {
        const top = cats.reduce((a, b) => (a.total > b.total ? a : b));
        document.getElementById('stat-top-cat').textContent = top.category;
        document.getElementById('stat-top-cat-amt').textContent = formatINR(top.total);
      } else {
        document.getElementById('stat-top-cat').textContent = '—';
        document.getElementById('stat-top-cat-amt').textContent = 'No data';
      }

      // Entry count
      document.getElementById('stat-entries').textContent = monthCount;
    } catch (e) {
      showError('error-banner', 'Failed to load stats: ' + e.message);
    }
  }

  // ── Monthly Summary card ─────────────────────────────────────────────────────
  async function loadSummary() {
    const y = parseInt(yearSel.value);
    const m = parseInt(monthSel.value);

    document.getElementById('summary-loading').style.display = 'block';
    document.getElementById('summary-content').style.display = 'none';
    document.getElementById('summary-empty').style.display   = 'none';

    try {
      const data = await api(`/api/admin/expenses/summary?year=${y}&month=${m}`);
      const cats = data.categories || [];

      document.getElementById('summary-loading').style.display = 'none';

      if (cats.length === 0) {
        document.getElementById('summary-empty').style.display = 'block';
        return;
      }

      document.getElementById('summary-content').style.display = 'block';

      // Donut chart
      const colours = cats.map(c => CAT_COLOURS[c.category] || '#52525B');
      if (summaryChart) summaryChart.destroy();
      summaryChart = new Chart(document.getElementById('summary-chart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: cats.map(c => c.category),
          datasets: [{
            data: cats.map(c => c.total),
            backgroundColor: colours,
            borderColor: '#18181B',
            borderWidth: 3,
          }],
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { color: '#F4F4F5', padding: 12 } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${formatINR(ctx.parsed)}`,
              },
            },
          },
          cutout: '60%',
        },
      });

      // Summary table
      const grandTotal = cats.reduce((s, c) => s + (c.total || 0), 0);
      const tbody = document.getElementById('summary-tbody');
      tbody.innerHTML = cats
        .sort((a, b) => b.total - a.total)
        .map(c => `
          <tr>
            <td>${catBadge(c.category)}</td>
            <td style="text-align:right; color: var(--md-on-surface-variant);">${c.count}</td>
            <td style="text-align:right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatINR(c.total)}</td>
          </tr>
        `).join('') + `
          <tr style="border-top: 2px solid var(--md-outline-variant);">
            <td style="font-weight: 700;">Total</td>
            <td></td>
            <td style="text-align:right; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--md-primary);">${formatINR(grandTotal)}</td>
          </tr>
        `;
    } catch (e) {
      document.getElementById('summary-loading').style.display = 'none';
      showError('error-banner', 'Failed to load summary: ' + e.message);
    }
  }

  monthSel.addEventListener('change', loadSummary);
  yearSel.addEventListener('change', loadSummary);

  // ── Expense History ───────────────────────────────────────────────────────────
  async function loadHistory() {
    const from     = document.getElementById('filter-from').value;
    const to       = document.getElementById('filter-to').value;
    const category = document.getElementById('filter-category').value;

    document.getElementById('history-loading').style.display = 'block';
    document.getElementById('history-content').style.display = 'none';
    document.getElementById('history-empty').style.display   = 'none';

    try {
      let url = `/api/admin/expenses?from=${from}&to=${to}`;
      if (category) url += `&category=${encodeURIComponent(category)}`;

      const expenses = await api(url);

      document.getElementById('history-loading').style.display = 'none';

      if (!expenses || expenses.length === 0) {
        document.getElementById('history-empty').style.display = 'block';
        return;
      }

      document.getElementById('history-content').style.display = 'block';
      renderHistoryTable(expenses);
    } catch (e) {
      document.getElementById('history-loading').style.display = 'none';
      showError('error-banner', 'Failed to load expenses: ' + e.message);
    }
  }

  function renderHistoryTable(expenses) {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = expenses.map(e => `
      <tr data-id="${e.id}">
        <td style="white-space: nowrap;">${formatDate(e.expense_date || e.date)}</td>
        <td>${catBadge(e.category)}</td>
        <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">${formatINR(parseFloat(e.amount))}</td>
        <td style="color: var(--md-on-surface-variant);">${e.description || '—'}</td>
        <td style="color: var(--md-on-surface-variant); font-size: 13px;">${e.recorded_by || e.created_by || '—'}</td>
        <td class="right">
          <div class="flex gap" style="justify-content: flex-end;">
            <button class="btn btn-tonal sm" data-edit="${e.id}">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="btn btn-danger sm" data-delete="${e.id}">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.edit), expenses));
    });

    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteExpense(parseInt(btn.dataset.delete)));
    });
  }

  document.getElementById('filter-btn').addEventListener('click', loadHistory);

  // ── Add Expense ───────────────────────────────────────────────────────────────
  document.getElementById('add-exp-btn').addEventListener('click', async () => {
    hideError('add-error');
    const date        = document.getElementById('exp-date').value;
    const category    = document.getElementById('exp-category').value;
    const amount      = parseFloat(document.getElementById('exp-amount').value);
    const description = document.getElementById('exp-description').value.trim();

    if (!date)        return showError('add-error', 'Please select a date.');
    if (!category)    return showError('add-error', 'Please select a category.');
    if (!amount || amount <= 0) return showError('add-error', 'Please enter a valid amount.');

    const btn = document.getElementById('add-exp-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await api('/api/admin/expenses', {
        method: 'POST',
        body: { expense_date: date, category, amount, description: description || null },
      });
      // Reset form
      document.getElementById('exp-date').value        = todayISO();
      document.getElementById('exp-category').value    = '';
      document.getElementById('exp-amount').value      = '';
      document.getElementById('exp-description').value = '';
      // Refresh
      await Promise.all([loadStats(), loadSummary(), loadHistory()]);
    } catch (e) {
      showError('add-error', 'Failed to save: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">save</span>Record Expense';
    }
  });

  document.getElementById('clear-exp-btn').addEventListener('click', () => {
    document.getElementById('exp-date').value        = todayISO();
    document.getElementById('exp-category').value    = '';
    document.getElementById('exp-amount').value      = '';
    document.getElementById('exp-description').value = '';
    hideError('add-error');
  });

  // ── Edit Expense ──────────────────────────────────────────────────────────────
  function openEditModal(id, expenses) {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;
    editingId = id;
    document.getElementById('edit-date').value        = (exp.expense_date || exp.date || '').slice(0, 10);
    document.getElementById('edit-category').value    = exp.category;
    document.getElementById('edit-amount').value      = exp.amount;
    document.getElementById('edit-description').value = exp.description || '';
    openModal('edit-modal');
  }

  document.getElementById('edit-save-btn').addEventListener('click', async () => {
    if (!editingId) return;
    const date        = document.getElementById('edit-date').value;
    const category    = document.getElementById('edit-category').value;
    const amount      = parseFloat(document.getElementById('edit-amount').value);
    const description = document.getElementById('edit-description').value.trim();

    if (!date || !category || !amount || amount <= 0) {
      return alert('Date, category and a valid amount are required.');
    }

    try {
      await api(`/api/admin/expenses/${editingId}`, {
        method: 'PATCH',
        body: { expense_date: date, category, amount, description: description || null },
      });
      closeModal('edit-modal');
      await Promise.all([loadStats(), loadSummary(), loadHistory()]);
    } catch (e) {
      alert('Failed to update: ' + e.message);
    }
  });

  // ── Delete Expense ────────────────────────────────────────────────────────────
  async function deleteExpense(id) {
    if (!confirm('Delete this expense record? This cannot be undone.')) return;
    try {
      await api(`/api/admin/expenses/${id}`, { method: 'DELETE' });
      await Promise.all([loadStats(), loadSummary(), loadHistory()]);
    } catch (e) {
      showError('error-banner', 'Failed to delete: ' + e.message);
    }
  }

  // ── Initial load ──────────────────────────────────────────────────────────────
  await Promise.all([loadStats(), loadSummary(), loadHistory()]);
})();
