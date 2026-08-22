(async function () {
  if (!Auth.token) { location.href = '/'; return; }

  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'trainer' && me.role !== 'admin') { location.href = '/profile.html'; return; }

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
  `;
  document.getElementById('trainer-subtitle').textContent =
    `${me.trainerSpecialization ? me.trainerSpecialization + ' · ' : ''}Personal training clients assigned to you.`;

  // Admins already have the full admin dashboard elsewhere; this shortcut is
  // for a trainer specifically granted members.manage (add member / set up
  // a PT assignment themselves instead of asking admin).
  if (me.role === 'trainer' && hasPermission(me, 'members.manage')) {
    document.getElementById('manage-members-link').style.display = '';
  }

  // Regular trainers can't see their own PT client count or earnings unless
  // specifically granted 'trainer.earnings.view' — hide the tab entirely
  // rather than let them click into a 403.
  if (me.role === 'trainer' && !hasPermission(me, 'trainer.earnings.view')) {
    document.querySelector('[data-ttab="earnings"]').style.display = 'none';
  }

  // ---- Admin: view/act as any trainer ----------------------------------
  // Trainer-portal API routes are scoped to the logged-in trainer's own id.
  // An admin isn't literally the assigned trainer for anyone, so without
  // this they'd see an empty portal. Instead, admin picks a trainer from a
  // dropdown and every /api/trainer/* call below carries ?trainerId=<that>,
  // which the backend honours only for role: 'admin' (see effectiveTrainerId
  // in server.js) — a real trainer always acts as themselves regardless.
  let viewingTrainerId = null;
  function withTrainerParam(path) {
    if (!viewingTrainerId) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}trainerId=${viewingTrainerId}`;
  }

  if (me.role === 'admin') {
    const picker = document.getElementById('admin-trainer-picker');
    const select = document.getElementById('admin-trainer-select');
    picker.style.display = 'block';
    try {
      const trainers = await api('/api/admin/trainers');
      select.innerHTML = trainers.map(t =>
        `<option value="${t.id}">${t.name}${t.specialization ? ` — ${t.specialization}` : ''}</option>`
      ).join('');
      if (trainers.length) viewingTrainerId = trainers[0].id;
    } catch (e) {
      picker.insertAdjacentHTML('beforeend', `<div class="body" style="color:var(--md-error);">Failed to load trainers: ${e.message}</div>`);
    }
    select.addEventListener('change', async () => {
      viewingTrainerId = select.value ? parseInt(select.value, 10) : null;
      hoursLoaded = false;
      earningsLoaded = false;
      await loadClients();
      if (document.querySelector('[data-ttab="hours"]').classList.contains('active')) {
        hoursLoaded = true;
        loadWorkingHours();
        loadExceptions();
      }
    });
  }

  // ---- Tab switching inside client modal
  document.querySelectorAll('[data-ctab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('[data-ctab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[id^=ctpanel-]').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('ctpanel-' + t.dataset.ctab).classList.add('active');
    });
  });

  // ---- Page-level tabs (Clients / Working Hours)
  document.querySelectorAll('[data-ttab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('[data-ttab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[id^=tpanel-]').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('tpanel-' + t.dataset.ttab).classList.add('active');
    });
  });

  // ---- Earnings tab
  const money = v => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  let earningsLoaded = false;

  async function loadEarnings() {
    const s = await api(withTrainerParam('/api/trainer/stats'));
    document.getElementById('earn-mtd-revenue').textContent = money(s.mtd.totalRevenue);
    document.getElementById('earn-mtd-sub').textContent = `${s.mtd.admissions} admission${s.mtd.admissions === 1 ? '' : 's'} + ${s.mtd.ptSessions} PT this month`;
    document.getElementById('earn-commission').textContent = money(s.mtd.commissionEarned);
    document.getElementById('earn-rate').textContent = s.trainer.is_partner
      ? 'Partner · 100% of PT'
      : `${s.ptRate}% PT · ${s.membershipRate}% membership`;
    document.getElementById('earn-active-clients').textContent = s.activeClients;
    document.getElementById('earn-adm-revenue').textContent = money(s.mtd.admissionRevenue);
    document.getElementById('earn-pt-revenue').textContent = money(s.mtd.ptRevenue);
    document.getElementById('earn-pt-ytd').textContent = money(s.ytd.ptRevenue);
    document.getElementById('earn-target').textContent = s.mtd.targetProgress != null ? `${s.mtd.targetProgress}%` : 'No target set';
  }

  document.querySelector('[data-ttab="earnings"]').addEventListener('click', () => {
    if (!earningsLoaded) { earningsLoaded = true; loadEarnings().catch(() => {}); }
  });

  // ---- Working Hours tab
  const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let hoursLoaded = false;

  async function loadWorkingHours() {
    const data = await api(withTrainerParam('/api/trainer/working-hours'));
    document.getElementById('wh-duration').value = data.sessionDurationMinutes;
    const byDow = {};
    data.hours.forEach(h => { byDow[h.dayOfWeek] = h; });
    document.getElementById('wh-days').innerHTML = DOW_LABELS.map((label, dow) => {
      const h = byDow[dow];
      return `
        <div class="form-row" style="grid-template-columns: 140px 1fr 1fr 100px; align-items:center; gap:12px;" data-dow="${dow}">
          <div style="font-weight:600;">${label}</div>
          <input type="time" class="wh-start" value="${h ? h.startTime : ''}" />
          <input type="time" class="wh-end" value="${h ? h.endTime : ''}" />
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
            <input type="checkbox" class="wh-active" ${h && h.isActive ? 'checked' : ''} /> Active
          </label>
        </div>
      `;
    }).join('');
  }

  document.getElementById('wh-save').addEventListener('click', async () => {
    const hours = Array.from(document.querySelectorAll('#wh-days [data-dow]')).map(row => ({
      dayOfWeek: parseInt(row.dataset.dow, 10),
      startTime: row.querySelector('.wh-start').value,
      endTime: row.querySelector('.wh-end').value,
      isActive: row.querySelector('.wh-active').checked,
    })).filter(h => h.startTime && h.endTime);
    const sessionDurationMinutes = parseInt(document.getElementById('wh-duration').value, 10) || 60;
    try {
      await api(withTrainerParam('/api/trainer/working-hours'), { method: 'PUT', body: { sessionDurationMinutes, hours } });
      alert('Working hours saved.');
    } catch (e) { alert(e.message); }
  });

  async function loadExceptions() {
    const rows = await api(withTrainerParam('/api/trainer/schedule-exceptions'));
    renderExceptions(rows);
  }

  function renderExceptions(rows) {
    const el = document.getElementById('wh-exceptions');
    if (!rows.length) {
      el.innerHTML = `<div class="body">No exceptions added.</div>`;
      return;
    }
    el.innerHTML = rows.map(ex => `
      <div class="notif" style="margin-bottom:6px;">
        <div class="n-icon ${ex.type === 'block' ? 'error' : 'success'}">
          <span class="material-symbols-rounded">${ex.type === 'block' ? 'event_busy' : 'event_available'}</span>
        </div>
        <div class="n-body">
          <div class="n-title">${new Date(ex.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — ${ex.type === 'block' ? 'Blocked' : 'Extra availability'}</div>
          <div class="n-text">${ex.startTime && ex.endTime ? `${ex.startTime}–${ex.endTime}` : 'Whole day'}${ex.reason ? ' · ' + ex.reason : ''}</div>
        </div>
        <button class="btn btn-text sm" data-del-exception="${ex.id}">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    `).join('');
    el.querySelectorAll('[data-del-exception]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(withTrainerParam(`/api/trainer/schedule-exceptions/${btn.dataset.delException}`), { method: 'DELETE' });
        loadExceptions();
      });
    });
  }

  document.getElementById('wh-add-exception-btn').addEventListener('click', () => {
    document.getElementById('ex-date').value = '';
    document.getElementById('ex-type').value = 'block';
    document.getElementById('ex-start').value = '';
    document.getElementById('ex-end').value = '';
    document.getElementById('ex-reason').value = '';
    document.getElementById('ex-whole-day-hint').style.display = 'block';
    openModal('add-exception-modal');
  });

  document.getElementById('ex-type').addEventListener('change', e => {
    document.getElementById('ex-whole-day-hint').style.display = e.target.value === 'add' ? 'none' : 'block';
  });

  document.getElementById('ex-save').addEventListener('click', async () => {
    const date = document.getElementById('ex-date').value;
    const type = document.getElementById('ex-type').value;
    const startTime = document.getElementById('ex-start').value || null;
    const endTime = document.getElementById('ex-end').value || null;
    const reason = document.getElementById('ex-reason').value.trim() || null;
    if (!date) { alert('Pick a date.'); return; }
    if (type === 'add' && (!startTime || !endTime)) { alert('Start and end time required for extra availability.'); return; }
    try {
      await api(withTrainerParam('/api/trainer/schedule-exceptions'), { method: 'POST', body: { date, type, startTime, endTime, reason } });
      closeModal('add-exception-modal');
      loadExceptions();
    } catch (e) { alert(e.message); }
  });

  document.querySelector('[data-ttab="hours"]').addEventListener('click', () => {
    if (!hoursLoaded) { hoursLoaded = true; loadWorkingHours(); loadExceptions(); }
  });

  // ---- Load clients
  let clients = [];
  let activeClient = null;

  async function loadClients() {
    clients = await api(withTrainerParam('/api/trainer/clients'));
    renderStats();
    renderGrid(clients);
  }

  function renderStats() {
    document.getElementById('stat-clients').textContent = clients.filter(c => c.assignment_status === 'active').length;
    document.getElementById('stat-sessions').textContent = clients.length;
    const avgAtt = clients.length
      ? Math.round(clients.reduce((s, c) => s + (c.attendance_30d || 0), 0) / clients.length)
      : 0;
    document.getElementById('stat-attendance').textContent = avgAtt;
  }

  function renderGrid(list) {
    const grid = document.getElementById('clients-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="padding:40px; grid-column:1/-1;">
        <span class="material-symbols-rounded">group_off</span>
        No PT clients assigned to you yet.
      </div>`;
      return;
    }
    grid.innerHTML = list.map(c => {
      return `
        <div class="card elevated clickable" style="cursor:pointer;" data-client-id="${c.id}">
          <div class="flex between" style="margin-bottom:14px;">
            <div class="flex gap center">
              <div class="avatar">${initials(c.name)}</div>
              <div>
                <div style="font-weight:700;">${c.name}</div>
                <div class="body" style="font-size:12px;">${c.package_name || 'PT Package'}</div>
              </div>
            </div>
            ${c.assignment_status === 'completed' ? '<span class="chip" style="font-size:11px;">Completed</span>' : ''}
          </div>
          <div class="grid cols-3" style="gap:8px; margin-bottom:14px;">
            <div style="text-align:center;">
              <div style="font-size:14px; font-weight:700; text-transform:capitalize;">${c.assignment_status || '—'}</div>
              <div style="font-size:11px; color:var(--md-on-surface-variant);">Status</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px; font-weight:700;">${c.attendance_30d || 0}</div>
              <div style="font-size:11px; color:var(--md-on-surface-variant);">Days (30d)</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px; font-weight:700;">${c.last_weight_kg ? c.last_weight_kg.toFixed(1) + ' kg' : '—'}</div>
              <div style="font-size:11px; color:var(--md-on-surface-variant);">Weight</div>
            </div>
          </div>
          <div style="font-size:12px; color:var(--md-on-surface-variant);">Since ${c.start_date}${c.end_date ? ` · valid until ${c.end_date}` : ''}</div>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <span class="chip ${c.workout_plan ? 'success' : ''}" style="font-size:11px;">
              <span class="material-symbols-rounded" style="font-size:13px;">fitness_center</span>
              ${c.workout_plan ? 'Workout set' : 'No workout'}
            </span>
            <span class="chip ${c.nutrition_plan ? 'success' : ''}" style="font-size:11px;">
              <span class="material-symbols-rounded" style="font-size:13px;">nutrition</span>
              ${c.nutrition_plan ? 'Nutrition set' : 'No nutrition'}
            </span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-client-id]').forEach(card => {
      card.addEventListener('click', () => openClientModal(parseInt(card.dataset.clientId, 10)));
    });
  }

  // ---- Search filter
  document.getElementById('client-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderGrid(clients.filter(c => c.name.toLowerCase().includes(q)));
  });

  // ---- Open client modal
  async function openClientModal(id) {
    const detail = await api(withTrainerParam(`/api/trainer/clients/${id}`));
    activeClient = detail;

    document.getElementById('cm-avatar').textContent = initials(detail.name);
    document.getElementById('cm-name').textContent = detail.name;
    document.getElementById('cm-meta').textContent =
      [detail.email, detail.phone, detail.goal].filter(Boolean).join(' · ');

    // Find the matching summary client for assignment info
    const summary = clients.find(c => c.id === id) || {};
    document.getElementById('cm-status').textContent =
      summary.assignment_status ? summary.assignment_status[0].toUpperCase() + summary.assignment_status.slice(1) : '—';
    document.getElementById('cm-status-sub').textContent =
      summary.package_name ? `${summary.package_name} · since ${summary.start_date || '—'}` : (summary.start_date ? `Since ${summary.start_date}` : '—');
    document.getElementById('cm-weight').textContent =
      summary.last_weight_kg ? summary.last_weight_kg.toFixed(1) + ' kg' : '—';
    document.getElementById('cm-weight-date').textContent =
      summary.last_weight_date ? new Date(summary.last_weight_date).toLocaleDateString() : 'Not logged';
    document.getElementById('cm-attendance').textContent = summary.attendance_30d || 0;

    renderClientWorkout(detail);
    renderClientNutrition(detail);
    renderClientInfo(detail);

    // Reset to first tab
    document.querySelectorAll('[data-ctab]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('[id^=ctpanel-]').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-ctab="workout"]').classList.add('active');
    document.getElementById('ctpanel-workout').classList.add('active');

    openModal('client-modal');
  }

  function renderExerciseItem(item) {
    if (typeof item === 'string') return `<div class="ex-display"><div class="ex-name">${item}</div></div>`;
    const meta = [];
    if (item.muscleGroup) meta.push(`<span class="chip primary">${item.muscleGroup}</span>`);
    if (item.machine)     meta.push(`<span class="chip info">${item.machine}</span>`);
    if (item.sets)        meta.push(`<span class="sets">${item.sets}</span>`);
    return `
      <div class="ex-display">
        <div class="ex-name">${item.exercise || item}</div>
        ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
      </div>
    `;
  }

  function renderClientWorkout(detail) {
    const el = document.getElementById('cm-workout-view');
    const sendBtn = document.getElementById('send-workout-whatsapp-btn');
    if (!detail.workoutPlan) {
      el.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">fitness_center</span>
        No workout plan assigned yet. Click Edit to create one.
      </div>`;
      sendBtn.style.display = 'none';
      return;
    }
    sendBtn.style.display = 'inline-flex';
    const p = detail.workoutPlan;
    const today = todayDayName();
    el.innerHTML = `
      <div style="margin-bottom:14px;">
        <strong>${p.name || 'Workout Plan'}</strong>
        ${p.assignedBy ? `<span class="body"> · by ${p.assignedBy}</span>` : ''}
      </div>
      <div class="grid cols-2" style="gap:12px;">
        ${(p.days || []).map(d => `
          <div class="day-card ${d.day === today ? 'today' : ''}">
            <div class="day-head">
              <div class="name">${d.day}</div>
              <div class="focus">${d.focus || ''}</div>
            </div>
            ${(d.items || []).length === 0
              ? `<div class="body" style="font-size:12px;padding:8px 0;">Rest day</div>`
              : d.items.map(renderExerciseItem).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderClientNutrition(detail) {
    const el = document.getElementById('cm-nutrition-view');
    const sendBtn = document.getElementById('send-nutrition-whatsapp-btn');
    if (!detail.nutritionPlan) {
      el.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">nutrition</span>
        No nutrition plan assigned yet. Click Edit to create one.
      </div>`;
      sendBtn.style.display = 'none';
      return;
    }
    sendBtn.style.display = 'inline-flex';
    const p = detail.nutritionPlan;
    el.innerHTML = `
      <div class="grid cols-4" style="margin-bottom:16px; gap:8px;">
        <div class="stat tinted"><div class="lbl">Calories</div><div class="num" style="font-size:22px;">${p.calories}</div><div class="sub">kcal</div></div>
        <div class="stat"><div class="lbl">Protein</div><div class="num" style="font-size:22px;">${p.protein}g</div></div>
        <div class="stat"><div class="lbl">Carbs</div><div class="num" style="font-size:22px;">${p.carbs}g</div></div>
        <div class="stat"><div class="lbl">Fats</div><div class="num" style="font-size:22px;">${p.fats}g</div></div>
      </div>
      ${(p.meals || []).map(m => `
        <div class="meal">
          <div class="name">${m.name}</div>
          <div class="items">${m.items}</div>
        </div>
      `).join('')}
    `;
  }

  function renderClientInfo(detail) {
    const el = document.getElementById('cm-info-view');
    const age = detail.dateOfBirth
      ? Math.floor((Date.now() - new Date(detail.dateOfBirth)) / 3.156e10) + ' yrs'
      : '—';
    el.innerHTML = `
      <div class="grid cols-2" style="gap:16px;">
        <div>
          <div class="section-title" style="margin-bottom:10px;">Personal</div>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr><td class="body" style="padding:6px 0; width:120px;">Email</td><td>${detail.email || '—'}</td></tr>
            <tr><td class="body">Phone</td><td>${detail.phone || '—'}</td></tr>
            <tr><td class="body">Age</td><td>${age}</td></tr>
            <tr><td class="body">Height</td><td>${detail.height ? detail.height + ' cm' : '—'}</td></tr>
            <tr><td class="body">Blood Group</td><td>${detail.bloodGroup || '—'}</td></tr>
            <tr><td class="body">Goal</td><td>${detail.goal || '—'}</td></tr>
          </table>
        </div>
        <div>
          <div class="section-title" style="margin-bottom:10px;">Emergency Contact</div>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr><td class="body" style="padding:6px 0; width:120px;">Name</td><td>${detail.emergencyContact?.name || '—'}</td></tr>
            <tr><td class="body">Phone</td><td>${detail.emergencyContact?.phone || '—'}</td></tr>
            <tr><td class="body">Relation</td><td>${detail.emergencyContact?.relation || '—'}</td></tr>
          </table>
          ${detail.medicalHistory ? `
            <div class="section-title" style="margin:14px 0 8px;">Medical History</div>
            <div class="body" style="font-size:14px; line-height:1.6;">${detail.medicalHistory}</div>
          ` : ''}
        </div>
      </div>
      <div style="margin-top:20px;">
        <div class="section-title" style="margin-bottom:10px;">Recent Attendance</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${(detail.attendance || []).slice(0, 30).map(d => `
            <span class="chip success" style="font-size:11px;">${new Date(d).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
          `).join('')}
          ${!detail.attendance?.length ? '<div class="body">No attendance records yet.</div>' : ''}
        </div>
      </div>
      ${(detail.ptSessions || []).length ? `
        <div style="margin-top:20px;">
          <div class="section-title" style="margin-bottom:10px;">PT Sessions Done</div>
          ${detail.ptSessions.map(s => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--md-outline-variant); font-size:14px;">
              <span>${new Date(s.date).toLocaleDateString()}</span>
              <span class="body">${s.notes || '—'}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ---- Edit Workout
  document.getElementById('edit-workout-btn').addEventListener('click', () => {
    openWorkoutEditor(activeClient);
  });

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function openWorkoutEditor(client) {
    document.getElementById('ew-member-name').textContent = client.name;
    document.getElementById('ew-assigned-by').value = me.name;

    const plan = client.workoutPlan || { name: '', assignedBy: me.name, days: DAYS.map(d => ({ day: d, focus: '', items: [] })) };
    document.getElementById('ew-name').value = plan.name || '';
    document.getElementById('ew-assigned-by').value = plan.assignedBy || me.name;

    const ewDays = document.getElementById('ew-days');
    ewDays.innerHTML = (plan.days || DAYS.map(d => ({ day: d, focus: '', items: [] }))).map((d, di) => `
      <div class="card" style="margin-bottom:12px; padding:16px;" data-day-idx="${di}">
        <div class="flex between" style="margin-bottom:10px;">
          <strong>${d.day}</strong>
          <div class="field" style="margin:0; width:200px;">
            <input type="text" class="day-focus" placeholder="Focus (e.g. Chest & Shoulders)" value="${d.focus || ''}" style="font-size:13px;" />
          </div>
        </div>
        <div class="body" style="font-size:11px; margin-bottom:6px;">One exercise per line — Exercise | Muscle Group | Machine | Sets</div>
        <textarea class="day-exercises" rows="4" style="width:100%; font-family:'JetBrains Mono',monospace; font-size:12px;"
          placeholder="Bench Press | Chest | Barbell | 4x8">${itemsToText(d.items)}</textarea>
      </div>
    `).join('');

    closeModal('client-modal');
    openModal('edit-workout-modal');
  }

  // Same "Exercise | Muscle Group | Machine | Sets" plain-text line format
  // the app and admin dashboard both use, keeping the JSON shape identical.
  function itemsToText(items) {
    return (items || []).map(i => {
      const it = typeof i === 'string' ? { exercise: i } : i;
      return [it.exercise, it.muscleGroup, it.machine, it.sets].filter(Boolean).join(' | ');
    }).join('\n');
  }
  function textToItems(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const [exercise, muscleGroup, machine, sets] = line.split('|').map(s => (s || '').trim());
      return { exercise: exercise || line, muscleGroup: muscleGroup || '', machine: machine || '', sets: sets || '' };
    });
  }

  function collectWorkoutPlan() {
    const name = document.getElementById('ew-name').value.trim();
    const assignedBy = document.getElementById('ew-assigned-by').value.trim() || me.name;
    const dayCards = document.querySelectorAll('#ew-days [data-day-idx]');
    const days = Array.from(dayCards).map((card, di) => {
      const focus = card.querySelector('.day-focus').value.trim();
      const items = textToItems(card.querySelector('.day-exercises').value);
      return { day: DAYS[di], focus, items };
    });
    return { name, assignedBy, days };
  }

  // Save always sends too — a separate second click to send just added
  // friction with no real use case (why save a plan without telling the
  // client it changed?).
  document.getElementById('ew-save').addEventListener('click', async () => {
    const btn = document.getElementById('ew-save');
    btn.disabled = true;
    try {
      const plan = collectWorkoutPlan();
      await api(withTrainerParam(`/api/trainer/clients/${activeClient.id}/workout`), { method: 'PUT', body: plan });
      activeClient.workoutPlan = plan;
      renderClientWorkout(activeClient);
      const card = document.querySelector(`[data-client-id="${activeClient.id}"]`);
      if (card) {
        const chip = card.querySelectorAll('.chip')[0];
        if (chip) { chip.className = 'chip success'; chip.innerHTML = '<span class="material-symbols-rounded" style="font-size:13px;">fitness_center</span> Workout set'; }
      }
      closeModal('edit-workout-modal');
      openModal('client-modal');

      const result = await api(withTrainerParam(`/api/trainer/clients/${activeClient.id}/workout/whatsapp`), { method: 'POST' });
      if (result.mode === 'api') alert(`✅ Workout plan saved and sent to ${activeClient.name} on WhatsApp (${result.phone}).`);
      else window.open(result.link, '_blank', 'noopener');
    } catch (e) {
      alert(`Could not save/send: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Edit Nutrition
  document.getElementById('edit-nutrition-btn').addEventListener('click', () => {
    openNutritionEditor(activeClient);
  });

  function openNutritionEditor(client) {
    document.getElementById('en-member-name').textContent = client.name;
    const plan = client.nutritionPlan || { calories: '', protein: '', carbs: '', fats: '', meals: [] };
    document.getElementById('en-calories').value = plan.calories || '';
    document.getElementById('en-protein').value  = plan.protein  || '';
    document.getElementById('en-carbs').value    = plan.carbs    || '';
    document.getElementById('en-fats').value     = plan.fats     || '';

    const mealsEl = document.getElementById('en-meals');
    mealsEl.innerHTML = '';
    (plan.meals || []).forEach(m => addMealRow(m.name, m.items));

    closeModal('client-modal');
    openModal('edit-nutrition-modal');
  }

  function addMealRow(name = '', items = '') {
    const mealsEl = document.getElementById('en-meals');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid; grid-template-columns:160px 1fr 32px; gap:8px; margin-bottom:8px; align-items:start;';
    wrap.innerHTML = `
      <input type="text" class="meal-name-input" placeholder="Meal name (e.g. Breakfast)" value="${name}" style="font-size:13px;" />
      <textarea class="meal-items-input" rows="2" placeholder="e.g. 3 egg whites, 2 roti, 1 cup dal…" style="font-size:13px; resize:vertical;">${items}</textarea>
      <button class="btn btn-text icon sm" title="Remove meal" style="margin-top:4px;">
        <span class="material-symbols-rounded" style="font-size:16px;">close</span>
      </button>
    `;
    wrap.querySelector('button').addEventListener('click', () => wrap.remove());
    mealsEl.appendChild(wrap);
  }

  document.getElementById('en-add-meal').addEventListener('click', () => addMealRow());

  // Save always sends too — same reasoning as the workout editor above.
  document.getElementById('en-save').addEventListener('click', async () => {
    const btn = document.getElementById('en-save');
    btn.disabled = true;
    try {
      const plan = {
        calories: parseInt(document.getElementById('en-calories').value, 10) || 0,
        protein:  parseInt(document.getElementById('en-protein').value, 10)  || 0,
        carbs:    parseInt(document.getElementById('en-carbs').value, 10)    || 0,
        fats:     parseInt(document.getElementById('en-fats').value, 10)     || 0,
        meals: Array.from(document.querySelectorAll('#en-meals > div')).map(row => ({
          name:  row.querySelector('.meal-name-input').value.trim(),
          items: row.querySelector('.meal-items-input').value.trim(),
        })).filter(m => m.name),
      };
      await api(withTrainerParam(`/api/trainer/clients/${activeClient.id}/nutrition`), { method: 'PUT', body: plan });
      activeClient.nutritionPlan = plan;
      renderClientNutrition(activeClient);
      const card = document.querySelector(`[data-client-id="${activeClient.id}"]`);
      if (card) {
        const chip = card.querySelectorAll('.chip')[1];
        if (chip) { chip.className = 'chip success'; chip.innerHTML = '<span class="material-symbols-rounded" style="font-size:13px;">nutrition</span> Nutrition set'; }
      }
      closeModal('edit-nutrition-modal');
      openModal('client-modal');

      const result = await api(withTrainerParam(`/api/trainer/clients/${activeClient.id}/nutrition/whatsapp`), { method: 'POST' });
      if (result.mode === 'api') alert(`✅ Diet plan saved and sent to ${activeClient.name} on WhatsApp (${result.phone}).`);
      else window.open(result.link, '_blank', 'noopener');
    } catch (e) {
      alert(`Could not save/send: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Send diet plan on WhatsApp
  document.getElementById('send-nutrition-whatsapp-btn').addEventListener('click', async () => {
    if (!activeClient) return;
    const btn = document.getElementById('send-nutrition-whatsapp-btn');
    btn.disabled = true;
    try {
      const result = await api(withTrainerParam(`/api/trainer/clients/${activeClient.id}/nutrition/whatsapp`), { method: 'POST' });
      if (result.mode === 'api') {
        alert(`✅ Diet plan sent to ${activeClient.name} on WhatsApp (${result.phone}).`);
      } else {
        // No WhatsApp Business API configured — open a pre-filled wa.me chat instead.
        window.open(result.link, '_blank', 'noopener');
      }
    } catch (e) {
      alert(`Could not send diet plan: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Send workout plan on WhatsApp
  document.getElementById('send-workout-whatsapp-btn').addEventListener('click', async () => {
    if (!activeClient) return;
    const btn = document.getElementById('send-workout-whatsapp-btn');
    btn.disabled = true;
    try {
      const result = await api(withTrainerParam(`/api/trainer/clients/${activeClient.id}/workout/whatsapp`), { method: 'POST' });
      if (result.mode === 'api') {
        alert(`✅ Workout plan sent to ${activeClient.name} on WhatsApp (${result.phone}).`);
      } else {
        window.open(result.link, '_blank', 'noopener');
      }
    } catch (e) {
      alert(`Could not send workout plan: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  await loadClients();
})();
