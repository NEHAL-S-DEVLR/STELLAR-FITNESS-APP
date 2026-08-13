// admissions.js — Stellar Fitness Club Admission Module

(async function () {

  // ──────────────────────────────────────────────
  // 1. Auth guard
  // ──────────────────────────────────────────────
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'finance.view')) { location.href = '/profile.html'; return; }

  // User chip
  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : me.role === 'trainer' ? 'Trainer' : 'Staff'}</span>
  `;

  // Inject nav
  renderAdminNav('admissions', me);

  // ──────────────────────────────────────────────
  // 2. Utility helpers
  // ──────────────────────────────────────────────
  function fmtCurrency(n) {
    return '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function monthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
  }
  function clearError(id) {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.remove('show');
  }

  // ──────────────────────────────────────────────
  // 3. Tab switching
  // ──────────────────────────────────────────────
  const tabs   = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.tab;
      document.getElementById('panel-' + key).classList.add('active');
      if (key === 'history')     await loadHistory();
      if (key === 'outstanding') await loadOutstanding();
    });
  });

  // ──────────────────────────────────────────────
  // 4. Dashboard stats
  // ──────────────────────────────────────────────
  async function loadStats() {
    try {
      const dash = await api('/api/admin/dashboard');
      document.getElementById('stat-today-adm').textContent = dash.today.admissions ?? 0;
      document.getElementById('stat-today-rev').textContent = fmtCurrency(dash.today.revenue);

      // Month admissions: sum from charts.admissions array this month
      const mStart = monthStart();
      const monthAdm = (dash.charts.admissions || [])
        .filter(r => r.d >= mStart)
        .reduce((s, r) => s + (r.n || 0), 0);
      document.getElementById('stat-month-adm').textContent = monthAdm;
      document.getElementById('stat-month-sub').textContent = 'Month-to-date';

      const outstanding = dash.outstanding || {};
      document.getElementById('stat-outstanding').textContent = fmtCurrency(outstanding.s || 0);
      const n = outstanding.n || 0;
      document.getElementById('stat-outstanding-sub').textContent =
        n === 1 ? '1 admission' : `${n} admissions`;

      // Badge on outstanding tab
      if (n > 0) {
        const badge = document.getElementById('outstanding-count');
        badge.textContent = n;
        badge.style.display = '';
      }
    } catch (e) {
      console.warn('Stats load failed:', e.message);
    }
  }

  // ──────────────────────────────────────────────
  // 5. Load plans + trainers for form selects
  // ──────────────────────────────────────────────
  let allPlans   = [];
  let allTrainers = [];
  let allMembers  = [];

  async function loadFormData() {
    try {
      [allPlans, allTrainers, allMembers] = await Promise.all([
        api('/api/plans'),
        api('/api/admin/trainers'),
        api('/api/admin/members'),
      ]);
    } catch (e) {
      console.warn('Form data load failed:', e.message);
    }

    const planSel = document.getElementById('adm-plan');
    planSel.innerHTML = '<option value="">— Select plan —</option>' +
      allPlans.map(p =>
        `<option value="${p.id}" data-price="${p.price}" data-days="${p.duration_days}">
          ${p.name} — ${fmtCurrency(p.price)} / ${p.duration_days}d
        </option>`
      ).join('');

    const trainerSel = document.getElementById('adm-trainer');
    trainerSel.innerHTML = '<option value="">— No trainer —</option>' +
      allTrainers.map(t =>
        `<option value="${t.id}">${t.name}${t.specialization ? ' · ' + t.specialization : ''}</option>`
      ).join('');
  }

  // ──────────────────────────────────────────────
  // 6. New Admission Form
  // ──────────────────────────────────────────────

  // Defaults
  document.getElementById('adm-date').value  = todayISO();
  document.getElementById('adm-start').value = todayISO();

  // Auto-fetch next receipt number
  async function fetchNextReceipt() {
    try {
      const r = await api('/api/admin/admissions/next-receipt');
      document.getElementById('receipt-number').value = r.receipt_number;
    } catch (e) {
      console.warn('Receipt fetch failed:', e.message);
    }
  }

  // ── Member search ──
  let searchDebounce = null;
  let selectedMember = null;

  const memberSearchEl  = document.getElementById('member-search');
  const searchResultsEl = document.getElementById('search-results');
  const memberSelectedEl = document.getElementById('member-selected');

  memberSearchEl.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q2 = memberSearchEl.value.trim().toLowerCase();
    if (!q2) { searchResultsEl.classList.remove('open'); return; }
    searchDebounce = setTimeout(() => {
      const matches = allMembers.filter(m =>
        (m.name  || '').toLowerCase().includes(q2) ||
        (m.email || '').toLowerCase().includes(q2) ||
        (m.phone || '').toLowerCase().includes(q2)
      ).slice(0, 10);
      renderSearchResults(matches);
    }, 150);
  });

  memberSearchEl.addEventListener('focus', () => {
    if (memberSearchEl.value.trim()) searchResultsEl.classList.add('open');
  });

  document.addEventListener('click', e => {
    if (!memberSearchEl.contains(e.target) && !searchResultsEl.contains(e.target)) {
      searchResultsEl.classList.remove('open');
    }
  });

  function renderSearchResults(members) {
    if (!members.length) {
      searchResultsEl.innerHTML =
        '<div class="search-result-item"><div class="sr-name muted">No members found</div></div>';
      searchResultsEl.classList.add('open');
      return;
    }
    searchResultsEl.innerHTML = members.map(m => {
      const sub = m.subscription;
      const expiry = sub ? fmtDate(sub.expiryDate || sub.expiry_date) : 'No subscription';
      return `
        <div class="search-result-item" data-id="${m.id}">
          <div class="sr-name">${m.name}</div>
          <div class="sr-meta">${m.email || ''}${m.phone ? ' · ' + m.phone : ''} · Expiry: ${expiry}</div>
        </div>
      `;
    }).join('');
    searchResultsEl.classList.add('open');
    searchResultsEl.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const mid = parseInt(item.dataset.id);
        const member = allMembers.find(m => m.id === mid);
        if (member) selectMember(member);
      });
    });
  }

  function selectMember(member) {
    selectedMember = member;
    memberSearchEl.value = '';
    searchResultsEl.classList.remove('open');

    const sub = member.subscription;
    const expiry = sub ? fmtDate(sub.expiryDate || sub.expiry_date) : 'No active subscription';
    const initStr = initials(member.name);

    document.getElementById('ms-avatar').textContent = initStr;
    document.getElementById('ms-name').textContent   = member.name;
    document.getElementById('ms-meta').innerHTML =
      `${member.email || ''}${member.phone ? ' &nbsp;·&nbsp; ' + member.phone : ''}<br>
       <span class="muted" style="font-size:12px;">Current expiry: ${expiry}</span>`;
    memberSelectedEl.classList.add('show');
  }

  document.getElementById('ms-clear').addEventListener('click', () => {
    selectedMember = null;
    memberSelectedEl.classList.remove('show');
    memberSearchEl.value = '';
  });

  // ── Plan selection → auto-fill price + end date ──
  document.getElementById('adm-plan').addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    const price = parseFloat(opt.dataset.price) || 0;
    const days  = parseInt(opt.dataset.days)  || 0;

    document.getElementById('adm-plan-price').value = price || '';
    recalcBalance();

    if (days && document.getElementById('adm-start').value) {
      const start = new Date(document.getElementById('adm-start').value);
      start.setDate(start.getDate() + days - 1);
      document.getElementById('adm-end').value = start.toISOString().slice(0, 10);
    }
  });

  // ── Start date change → recalc end date ──
  document.getElementById('adm-start').addEventListener('change', function () {
    const planSel = document.getElementById('adm-plan');
    const opt = planSel.options[planSel.selectedIndex];
    const days = parseInt(opt ? opt.dataset.days : 0) || 0;
    if (days && this.value) {
      const start = new Date(this.value);
      start.setDate(start.getDate() + days - 1);
      document.getElementById('adm-end').value = start.toISOString().slice(0, 10);
    }
  });

  // ── Balance recalculation ──
  function recalcBalance() {
    const price    = parseFloat(document.getElementById('adm-plan-price').value) || 0;
    const discount = parseFloat(document.getElementById('adm-discount').value)   || 0;
    const paid     = parseFloat(document.getElementById('adm-paid').value)       || 0;
    const balance  = Math.max(0, price - discount - paid);
    document.getElementById('adm-balance').value = balance.toFixed(2);
  }

  document.getElementById('adm-discount').addEventListener('input', recalcBalance);
  document.getElementById('adm-paid').addEventListener('input',     recalcBalance);

  // ── Reset form ──
  function resetForm() {
    selectedMember = null;
    memberSelectedEl.classList.remove('show');
    memberSearchEl.value = '';
    document.getElementById('adm-date').value  = todayISO();
    document.getElementById('adm-start').value = todayISO();
    document.getElementById('adm-end').value   = '';
    document.getElementById('adm-plan').value  = '';
    document.getElementById('adm-plan-price').value = '';
    document.getElementById('adm-trainer').value    = '';
    document.getElementById('adm-payment-mode').value = 'cash';
    document.getElementById('adm-discount').value  = '0';
    document.getElementById('adm-paid').value      = '0';
    document.getElementById('adm-balance').value   = '';
    document.getElementById('adm-remarks').value   = '';
    document.querySelectorAll('input[name="adm-type"]').forEach(r => { r.checked = (r.value === 'new'); });
    clearError('adm-error');
    fetchNextReceipt();
  }

  document.getElementById('adm-reset').addEventListener('click', resetForm);

  // ── Submit ──
  document.getElementById('adm-submit').addEventListener('click', async () => {
    clearError('adm-error');

    if (!selectedMember) {
      showError('adm-error', 'Please search and select a member first.');
      return;
    }
    if (!document.getElementById('adm-start').value) {
      showError('adm-error', 'Start date is required.');
      return;
    }
    if (!document.getElementById('adm-end').value) {
      showError('adm-error', 'End date is required.');
      return;
    }

    const planSel   = document.getElementById('adm-plan');
    const planId    = planSel.value ? parseInt(planSel.value) : null;
    const trainerId = document.getElementById('adm-trainer').value
      ? parseInt(document.getElementById('adm-trainer').value) : null;
    const type = document.querySelector('input[name="adm-type"]:checked').value;

    const payload = {
      user_id:        selectedMember.id,
      admission_date: document.getElementById('adm-date').value,
      type,
      plan_id:        planId,
      trainer_id:     trainerId,
      payment_mode:   document.getElementById('adm-payment-mode').value,
      paid_amount:    parseFloat(document.getElementById('adm-paid').value)     || 0,
      discount:       parseFloat(document.getElementById('adm-discount').value) || 0,
      start_date:     document.getElementById('adm-start').value,
      end_date:       document.getElementById('adm-end').value,
      remarks:        document.getElementById('adm-remarks').value.trim() || null,
    };

    const btn = document.getElementById('adm-submit');
    btn.disabled = true;
    btn.textContent = 'Recording…';

    try {
      const result = await api('/api/admin/admissions', { method: 'POST', body: payload });

      // Build receipt data for print
      const planOpt  = planSel.options[planSel.selectedIndex];
      const planName = planId && planOpt ? planOpt.text.split(' — ')[0] : 'Custom';
      const trainerSel = document.getElementById('adm-trainer');
      const trainerOpt = trainerSel.options[trainerSel.selectedIndex];
      const trainerName = trainerId && trainerOpt ? trainerOpt.text.split(' · ')[0] : '—';

      const receipt = {
        receipt_number: result.receipt_number,
        date:           document.getElementById('adm-date').value,
        type:           type === 'new' ? 'New Membership' : 'Renewal',
        member_name:    selectedMember.name,
        member_phone:   selectedMember.phone || '—',
        plan_name:      planName,
        trainer_name:   trainerName,
        plan_price:     parseFloat(document.getElementById('adm-plan-price').value) || 0,
        discount:       parseFloat(document.getElementById('adm-discount').value)   || 0,
        paid_amount:    parseFloat(document.getElementById('adm-paid').value)       || 0,
        balance:        parseFloat(document.getElementById('adm-balance').value)    || 0,
        start_date:     document.getElementById('adm-start').value,
        end_date:       document.getElementById('adm-end').value,
        payment_mode:   document.getElementById('adm-payment-mode').value,
      };

      showReceipt(receipt);
      resetForm();
      await loadStats();
    } catch (e) {
      showError('adm-error', e.message || 'Failed to record admission. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">check_circle</span>Record Admission';
    }
  });

  // ──────────────────────────────────────────────
  // 7. Print Receipt
  // ──────────────────────────────────────────────
  function showReceipt(r) {
    const modeName = {
      cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank Transfer'
    }[r.payment_mode] || r.payment_mode;

    document.getElementById('receipt-print').innerHTML = `
      <div class="rec-logo">Stellar Fitness Club</div>
      <div class="rec-sub">Official Membership Receipt</div>
      <div class="rec-title">Receipt / Membership Admission</div>

      <div class="rec-row"><span class="lbl">Receipt No</span><span class="val">${r.receipt_number}</span></div>
      <div class="rec-row"><span class="lbl">Date</span><span class="val">${fmtDate(r.date)}</span></div>
      <div class="rec-row"><span class="lbl">Type</span><span class="val">${r.type}</span></div>

      <div style="border-top: 1px dashed #ccc; margin: 10px 0;"></div>

      <div class="rec-row"><span class="lbl">Member</span><span class="val">${r.member_name}</span></div>
      <div class="rec-row"><span class="lbl">Phone</span><span class="val">${r.member_phone}</span></div>
      <div class="rec-row"><span class="lbl">Plan</span><span class="val">${r.plan_name}</span></div>
      <div class="rec-row"><span class="lbl">Trainer</span><span class="val">${r.trainer_name}</span></div>

      <div style="border-top: 1px dashed #ccc; margin: 10px 0;"></div>

      <div class="rec-row"><span class="lbl">Plan Price</span><span class="val">${fmtCurrency(r.plan_price)}</span></div>
      <div class="rec-row"><span class="lbl">Discount</span><span class="val">${fmtCurrency(r.discount)}</span></div>
      <div class="rec-row"><span class="lbl">Paid</span><span class="val">${fmtCurrency(r.paid_amount)}</span></div>
      <div class="rec-total"><span>Balance Due</span><span>${fmtCurrency(r.balance)}</span></div>

      <div style="border-top: 1px dashed #ccc; margin: 10px 0;"></div>

      <div class="rec-row"><span class="lbl">Valid</span><span class="val">${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}</span></div>
      <div class="rec-row"><span class="lbl">Payment</span><span class="val">${modeName}</span></div>

      <div class="rec-footer">Thank you for choosing Stellar Fitness Club!<br>Stay fit, stay strong.</div>
    `;

    window.print();
  }

  // ──────────────────────────────────────────────
  // 8. History Tab
  // ──────────────────────────────────────────────

  // Default date range: current month
  document.getElementById('hist-from').value = monthStart();
  document.getElementById('hist-to').value   = todayISO();

  document.getElementById('hist-search').addEventListener('click', loadHistory);
  document.getElementById('history-refresh').addEventListener('click', loadHistory);

  async function loadHistory() {
    const from  = document.getElementById('hist-from').value;
    const to    = document.getElementById('hist-to').value;
    const type  = document.getElementById('hist-type').value;

    let url = '/api/admin/admissions?';
    if (from) url += `from=${from}&`;
    if (to)   url += `to=${to}&`;
    if (type) url += `type=${type}&`;

    const tbody = document.getElementById('history-tbody');
    const empty = document.getElementById('history-empty');
    tbody.innerHTML = '<tr><td colspan="9" class="muted" style="padding:20px; text-align:center;">Loading…</td></tr>';
    empty.style.display = 'none';

    try {
      const rows = await api(url);
      renderHistoryTable(rows);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="9" style="color:var(--md-error);padding:20px;">${e.message}</td></tr>`;
    }
  }

  function renderHistoryTable(rows) {
    const tbody = document.getElementById('history-tbody');
    const empty = document.getElementById('history-empty');

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = rows.map(r => {
      const typeBadge = r.type === 'renewal'
        ? '<span class="status-badge renewal">Renewal</span>'
        : '<span class="status-badge new">New</span>';
      const balChip = r.balance > 0
        ? `<span class="chip warning">₹${r.balance.toLocaleString('en-IN')}</span>`
        : '<span class="chip success">Cleared</span>';

      return `
        <tr>
          <td><strong style="font-family: monospace;">${r.receipt_number}</strong></td>
          <td>${fmtDate(r.admission_date)}</td>
          <td>
            <div style="font-weight:600;">${r.member_name || '—'}</div>
            <div class="muted" style="font-size:12px;">${r.member_phone || ''}</div>
          </td>
          <td>${typeBadge}</td>
          <td>${r.plan_name || '—'}</td>
          <td>${fmtCurrency(r.paid_amount)}</td>
          <td>${balChip}</td>
          <td>${r.trainer_name || '<span class="muted">—</span>'}</td>
          <td>
            <div class="tbl-actions">
              <button class="btn btn-tonal sm" title="Print receipt" onclick='printExistingReceipt(${JSON.stringify(r)})'>
                <span class="material-symbols-rounded">print</span>
              </button>
              <button class="btn btn-danger sm" title="Delete" onclick='confirmDelete(${r.id}, "${escapeHtml(r.receipt_number)}")'>
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.printExistingReceipt = function(r) {
    showReceipt({
      receipt_number: r.receipt_number,
      date:           r.admission_date,
      type:           r.type === 'renewal' ? 'Renewal' : 'New Membership',
      member_name:    r.member_name || '—',
      member_phone:   r.member_phone || '—',
      plan_name:      r.plan_name || 'Custom',
      trainer_name:   r.trainer_name || '—',
      plan_price:     r.plan_price,
      discount:       r.discount,
      paid_amount:    r.paid_amount,
      balance:        r.balance,
      start_date:     r.start_date,
      end_date:       r.end_date,
      payment_mode:   r.payment_mode,
    });
  };

  // ── Delete ──
  let pendingDeleteId = null;

  window.confirmDelete = function(id, receiptNum) {
    pendingDeleteId = id;
    document.getElementById('del-receipt').textContent = receiptNum;
    openModal('del-modal');
  };

  document.getElementById('del-confirm').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const btn = document.getElementById('del-confirm');
    btn.disabled = true;
    try {
      await api(`/api/admin/admissions/${pendingDeleteId}`, { method: 'DELETE' });
      closeModal('del-modal');
      pendingDeleteId = null;
      await loadHistory();
      await loadStats();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ──────────────────────────────────────────────
  // 9. Outstanding Tab
  // ──────────────────────────────────────────────
  document.getElementById('outstanding-refresh').addEventListener('click', loadOutstanding);

  async function loadOutstanding() {
    const tbody = document.getElementById('outstanding-tbody');
    const empty = document.getElementById('outstanding-empty');
    tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:20px; text-align:center;">Loading…</td></tr>';
    empty.style.display = 'none';

    try {
      // Fetch all admissions and filter client-side for balance > 0
      // (The API doesn't have a balance>0 filter, so we fetch without type filter)
      const rows = await api('/api/admin/admissions');
      const owing = rows.filter(r => r.balance > 0);
      renderOutstandingTable(owing);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--md-error);padding:20px;">${e.message}</td></tr>`;
    }
  }

  function renderOutstandingTable(rows) {
    const tbody = document.getElementById('outstanding-tbody');
    const empty = document.getElementById('outstanding-empty');

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    // Sort by balance descending
    const sorted = [...rows].sort((a, b) => b.balance - a.balance);

    tbody.innerHTML = sorted.map(r => `
      <tr>
        <td><strong style="font-family: monospace;">${r.receipt_number}</strong></td>
        <td>
          <div style="font-weight:600;">${r.member_name || '—'}</div>
          <div class="muted" style="font-size:12px;">${r.member_phone || ''}</div>
        </td>
        <td>${r.plan_name || '—'}</td>
        <td><span class="bal-pill">₹${r.balance.toLocaleString('en-IN')}</span></td>
        <td>${fmtDate(r.admission_date)}</td>
        <td>
          <button class="btn btn-filled sm" onclick='openPayModal(${JSON.stringify(r)})'>
            <span class="material-symbols-rounded">payments</span>Record Payment
          </button>
        </td>
      </tr>
    `).join('');
  }

  // ── Balance payment modal ──
  let currentPayAdmission = null;

  window.openPayModal = function(r) {
    currentPayAdmission = r;
    document.getElementById('pr-member-name').textContent = r.member_name || '—';
    document.getElementById('pr-receipt').textContent = 'Receipt: ' + r.receipt_number;
    document.getElementById('pr-plan').textContent = 'Plan: ' + (r.plan_name || '—');
    document.getElementById('pr-balance').textContent = fmtCurrency(r.balance);
    document.getElementById('pr-amount').value = '';
    document.getElementById('pr-mode').value = r.payment_mode || 'cash';
    clearError('pr-error');
    openModal('pay-modal');
  };

  document.getElementById('pr-submit').addEventListener('click', async () => {
    if (!currentPayAdmission) return;
    clearError('pr-error');

    const amount = parseFloat(document.getElementById('pr-amount').value);
    if (!amount || amount <= 0) {
      showError('pr-error', 'Please enter a valid amount.');
      return;
    }
    if (amount > currentPayAdmission.balance) {
      showError('pr-error', `Amount cannot exceed outstanding balance of ${fmtCurrency(currentPayAdmission.balance)}.`);
      return;
    }

    const mode = document.getElementById('pr-mode').value;
    const btn = document.getElementById('pr-submit');
    btn.disabled = true;

    try {
      await api(`/api/admin/admissions/${currentPayAdmission.id}/payment`, {
        method: 'POST',
        body: { amount, payment_mode: mode },
      });
      closeModal('pay-modal');
      currentPayAdmission = null;
      await loadOutstanding();
      await loadStats();
    } catch (e) {
      showError('pr-error', e.message || 'Payment failed. Try again.');
    } finally {
      btn.disabled = false;
    }
  });

  // ──────────────────────────────────────────────
  // 10. Helper: HTML escape
  // ──────────────────────────────────────────────
  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ──────────────────────────────────────────────
  // 11. Bootstrap: load everything
  // ──────────────────────────────────────────────
  await Promise.all([
    loadStats(),
    loadFormData(),
    fetchNextReceipt(),
  ]);

})();
