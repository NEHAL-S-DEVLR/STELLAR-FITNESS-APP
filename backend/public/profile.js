// Member dashboard. All data comes from the server via /api endpoints.

(async function () {
  if (!Auth.token) { location.href = '/'; return; }
  let user;
  try { user = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (user.role === 'admin') { location.href = '/admin.html'; return; }
  if (user.role === 'trainer') { location.href = '/trainer-portal.html'; return; }
  if (user.role === 'staff') { location.href = '/admin.html'; return; }

  // ---- Header
  document.getElementById('user-chip').innerHTML = `
    <div class="avatar">${initials(user.name)}</div>
    <span>${user.name}</span>
  `;
  document.getElementById('welcome-line').textContent = `Hey, ${user.name.split(' ')[0]}.`;
  document.getElementById('date-line').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // ---- Refresh helper: pulls fresh user object from server
  async function refresh() {
    user = await api('/api/me');
    renderAll();
  }


  // ---- Tabs
  document.querySelectorAll('[data-tab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[id^=panel-]').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('panel-' + t.dataset.tab).classList.add('active');
    });
  });

  // ---- Notifications
  function renderNotifications() {
    const notes = (user.notifications || []).slice().sort((a, b) => b.sent.localeCompare(a.sent));
    const unread = notes.filter(n => !n.read).length;
    const cnt = document.getElementById('bell-count');
    if (unread > 0) { cnt.textContent = unread; cnt.style.display = 'grid'; }
    else cnt.style.display = 'none';

    const list = document.getElementById('notif-list');
    if (notes.length === 0) {
      list.innerHTML = `<div class="empty" style="padding: 24px;">
        <span class="material-symbols-rounded">notifications_off</span>
        No notifications yet.
      </div>`;
      return;
    }
    list.innerHTML = notes.map(n => {
      const iconMap = { offer: 'local_offer', expiry: 'schedule', general: 'campaign' };
      return `
        <div class="notif ${n.read ? '' : 'unread'}">
          <div class="n-icon ${n.type}"><span class="material-symbols-rounded">${iconMap[n.type] || 'info'}</span></div>
          <div class="n-body">
            <div class="n-title">${n.title}</div>
            <div class="n-text">${n.body}</div>
            <div class="n-when">${new Date(n.sent).toLocaleString()}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('bell-btn').addEventListener('click', async e => {
    e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    const wasOpen = panel.classList.contains('open');
    panel.classList.toggle('open');
    if (!wasOpen && (user.notifications || []).some(n => !n.read)) {
      setTimeout(async () => {
        await api('/api/me/notifications/read-all', { method: 'POST' });
        await refresh();
      }, 1500);
    }
  });
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    if (!panel.contains(e.target) && !e.target.closest('#bell-btn')) panel.classList.remove('open');
  });
  document.getElementById('mark-all-read').addEventListener('click', async () => {
    await api('/api/me/notifications/read-all', { method: 'POST' });
    await refresh();
  });

  // ---- Stats
  function renderStats() {
    const log = user.weightLog || [];
    const latest = log[log.length - 1];
    const prev = log[log.length - 2];
    document.getElementById('stat-weight').textContent = latest ? `${latest.kg.toFixed(1)} kg` : '—';
    if (latest && prev) {
      const diff = latest.kg - prev.kg;
      const el = document.getElementById('stat-weight-delta');
      el.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg since last log`;
      el.className = 'sub delta ' + (diff <= 0 ? 'up' : 'down');
    }

    const bv = latest ? bmi(latest.kg, user.height) : null;
    document.getElementById('stat-bmi').textContent = bv ? bv.toFixed(1) : '—';
    const cat = bmiCategory(bv);
    const catEl = document.getElementById('stat-bmi-cat');
    catEl.textContent = cat.label; catEl.style.color = cat.color;

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const recent = (user.attendance || []).filter(d => new Date(d) >= cutoff);
    document.getElementById('stat-attendance').textContent = `${recent.length}`;
    document.getElementById('stat-attendance-sub').textContent = `${Math.round(recent.length / 30 * 100)}% of last 30 days`;

    if (user.subscription) {
      const days = daysUntil(user.subscription.expiryDate);
      const sev = expirySeverity(days);
      document.getElementById('sub-plan-name').textContent = user.subscription.plan;
      document.getElementById('sub-countdown').textContent = sev.label;
      document.getElementById('sub-dates').textContent =
        `${new Date(user.subscription.startDate).toLocaleDateString()} → ${new Date(user.subscription.expiryDate).toLocaleDateString()}`;
    } else {
      document.getElementById('sub-plan-name').textContent = 'No active plan';
      document.getElementById('sub-countdown').textContent = '—';
      document.getElementById('sub-dates').textContent = 'Ask the front desk to subscribe.';
    }
  }

  // ---- Workout logs (loaded once, kept in sync locally)
  let workoutLogs = [];

  async function loadWorkoutLogs() {
    workoutLogs = await api('/api/me/workout-logs');
  }

  // Normalise: old logs stored strings, new store {exercise, weight}
  function normCompleted(completed) {
    return (completed || []).map(e =>
      typeof e === 'string' ? { exercise: e, weight: null } : e
    );
  }

  function todayLogMap() {
    const log = workoutLogs.find(l => l.date === todayISO());
    const map = new Map();
    normCompleted(log?.completed).forEach(e => map.set(e.exercise, e));
    return map;
  }

  function exName(item) { return typeof item === 'string' ? item : item.exercise; }

  function renderExerciseItem(item) {
    if (typeof item === 'string') return `<div class="ex-display"><div class="ex-name">${item}</div></div>`;
    const meta = [];
    if (item.muscleGroup) meta.push(`<span class="chip primary">${item.muscleGroup}</span>`);
    if (item.machine)     meta.push(`<span class="chip info">${item.machine}</span>`);
    if (item.sets)        meta.push(`<span class="sets">${item.sets}</span>`);
    return `
      <div class="ex-display">
        <div class="ex-name">${item.exercise}</div>
        ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
      </div>
    `;
  }

  // Renders a single exercise row with checkbox + weight input.
  // logEntry = { exercise, weight } | null
  function renderExerciseCheckbox(item, logEntry) {
    const name    = exName(item);
    const done    = !!logEntry;
    const wVal    = logEntry?.weight != null ? logEntry.weight : '';
    const meta = [];
    if (item.muscleGroup) meta.push(`<span class="chip primary" style="font-size:11px;">${item.muscleGroup}</span>`);
    if (item.machine)     meta.push(`<span class="chip info" style="font-size:11px;">${item.machine}</span>`);
    if (item.sets)        meta.push(`<span class="sets" style="font-size:11px;">${item.sets}</span>`);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--md-outline-variant);">
        <input type="checkbox" data-ex-check="${name}" ${done ? 'checked' : ''}
          style="margin-top:1px;width:16px;height:16px;accent-color:var(--md-primary);flex-shrink:0;cursor:pointer;" />
        <div style="flex:1;transition:opacity .15s;${done ? 'opacity:.45;' : ''}">
          <div class="ex-name" style="${done ? 'text-decoration:line-through;' : ''}">${name}</div>
          ${meta.length ? `<div class="meta" style="margin-top:4px;">${meta.join('')}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <input type="text" inputmode="decimal" data-ex-weight="${name}"
            value="${wVal}" placeholder="—"
            oninput="this.value=this.value.replace(/[^0-9.]/g,'')"
            style="width:60px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;padding:4px 6px;" />
          <span style="font-size:12px;color:var(--md-on-surface-variant);width:16px;">kg</span>
        </div>
      </div>
    `;
  }

  // Collect all exercise entries from a container into [{exercise, weight}]
  // Only checked exercises are included.
  function collectCompleted(container) {
    return Array.from(container.querySelectorAll('[data-ex-check]'))
      .filter(cb => cb.checked)
      .map(cb => {
        const n = cb.dataset.exCheck;
        const w = parseFloat(container.querySelector(`[data-ex-weight="${n}"]`)?.value);
        return { exercise: n, weight: isNaN(w) ? null : w };
      });
  }

  function saveWorkoutLog(container) {
    const completed = collectCompleted(container);
    const entry = { date: todayISO(), completed };
    api('/api/me/workout-log', { method: 'POST', body: entry });
    const idx = workoutLogs.findIndex(l => l.date === todayISO());
    if (idx >= 0) workoutLogs[idx] = entry; else workoutLogs.unshift(entry);
    renderWorkoutProgress();
  }

  function attachTodayListeners(container) {
    // Checkbox toggle: update strikethrough and save
    container.querySelectorAll('[data-ex-check]').forEach(cb => {
      cb.addEventListener('change', () => {
        const nameEl = cb.closest('div')?.querySelector('.ex-name');
        const inner  = cb.closest('div')?.querySelector('div[style*="flex:1"]');
        if (nameEl) nameEl.style.textDecoration = cb.checked ? 'line-through' : '';
        if (inner)  inner.style.opacity = cb.checked ? '0.45' : '1';
        saveWorkoutLog(container);
      });
    });
    // Weight input blur: save (only when something is checked)
    container.querySelectorAll('[data-ex-weight]').forEach(inp => {
      inp.addEventListener('change', () => saveWorkoutLog(container));
    });
  }

  function renderToday() {
    const todayName = todayDayName();
    document.getElementById('today-day-pill').textContent = todayName;

    const wEl = document.getElementById('today-workout');
    if (!user.workoutPlan) {
      wEl.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">fitness_center</span>
        No workout plan assigned yet. Speak to your coach.
      </div>`;
    } else {
      const day = user.workoutPlan.days.find(d => d.day === todayName);
      if (!day || (day.items || []).length === 0) {
        wEl.innerHTML = `<div class="empty">
          <span class="material-symbols-rounded">bedtime</span>
          Rest day — recover well.
        </div>`;
      } else {
        const logMap  = todayLogMap();
        const doneCount = day.items.filter(i => logMap.has(exName(i))).length;
        const allDone   = doneCount === day.items.length;
        wEl.innerHTML = `
          <div class="body" style="margin-bottom:8px;">Focus: <strong style="color:var(--md-on-surface);">${day.focus || '—'}</strong></div>
          <div style="margin-bottom:12px;font-size:12px;color:var(--md-on-surface-variant);">
            ${doneCount}/${day.items.length} exercises done
            ${allDone ? '<span class="chip success" style="font-size:11px;margin-left:6px;">All done!</span>' : ''}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:4px;font-size:11px;color:var(--md-on-surface-variant);margin-bottom:4px;padding-right:20px;">
            <span style="width:60px;text-align:right;">Weight</span><span style="width:16px;"></span>
          </div>
          ${day.items.map(i => renderExerciseCheckbox(i, logMap.get(exName(i)) || null)).join('')}
        `;
        attachTodayListeners(wEl);
      }
    }

    const nEl = document.getElementById('today-nutrition');
    if (!user.nutritionPlan) {
      nEl.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">nutrition</span>
        No nutrition plan assigned yet.
      </div>`;
      document.getElementById('today-cal-pill').textContent = '—';
    } else {
      document.getElementById('today-cal-pill').textContent = `${user.nutritionPlan.calories} kcal`;
      nEl.innerHTML = user.nutritionPlan.meals.map(m => `
        <div class="meal">
          <div class="name">${m.name}</div>
          <div class="items">${m.items}</div>
        </div>
      `).join('');
    }
  }

  function renderWeeklyWorkout() {
    const nameEl = document.getElementById('plan-name');
    const metaEl = document.getElementById('plan-meta');
    const gridEl = document.getElementById('week-grid');
    if (!user.workoutPlan) {
      nameEl.textContent = 'No plan assigned';
      metaEl.textContent = 'Ask your coach to assign a workout plan.';
      gridEl.innerHTML = '';
      return;
    }
    nameEl.textContent = user.workoutPlan.name;
    metaEl.textContent = `Assigned by ${user.workoutPlan.assignedBy}`;
    const today = todayDayName();
    gridEl.innerHTML = user.workoutPlan.days.map(d => `
      <div class="day-card ${d.day === today ? 'today' : ''}">
        <div class="day-head">
          <div class="name">${d.day}</div>
          <div class="focus">${d.focus || ''}</div>
        </div>
        ${(d.items || []).length === 0
          ? `<div class="body" style="font-size: 12px; padding: 8px 0;">Rest day</div>`
          : d.items.map(renderExerciseItem).join('')}
      </div>
    `).join('');
  }

  function renderNutrition() {
    const macros = document.getElementById('macros');
    const meals = document.getElementById('meal-list');
    if (!user.nutritionPlan) {
      macros.innerHTML = '';
      meals.innerHTML = `<div class="empty">No nutrition plan assigned yet.</div>`;
      return;
    }
    const p = user.nutritionPlan;
    macros.innerHTML = `
      <div class="macro"><div class="num">${p.calories}</div><div class="lbl">kcal</div></div>
      <div class="macro"><div class="num">${p.protein}g</div><div class="lbl">Protein</div></div>
      <div class="macro"><div class="num">${p.carbs}g</div><div class="lbl">Carbs</div></div>
      <div class="macro"><div class="num">${p.fats}g</div><div class="lbl">Fats</div></div>
    `;
    meals.innerHTML = p.meals.map(m => `
      <div class="meal"><div class="name">${m.name}</div><div class="items">${m.items}</div></div>
    `).join('');
  }

  let weightChart = null;
  function renderProgress() {
    const log = (user.weightLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));

    const tbody = document.getElementById('weight-history');
    tbody.innerHTML = log.slice().reverse().map(entry => `
      <tr>
        <td>${new Date(entry.date).toLocaleDateString()}</td>
        <td>${entry.kg.toFixed(1)}</td>
        <td class="right">
          <button class="btn btn-text sm" data-del-weight="${entry.date}">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-del-weight]').forEach(b => {
      b.addEventListener('click', async () => {
        await api(`/api/me/weight/${b.dataset.delWeight}`, { method: 'DELETE' });
        await refresh();
      });
    });

    const ctx = document.getElementById('weight-chart').getContext('2d');
    if (weightChart) weightChart.destroy();
    weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: log.map(e => new Date(e.date).toLocaleDateString()),
        datasets: [{
          label: 'Weight (kg)',
          data: log.map(e => e.kg),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246,0.15)',
          fill: true, tension: 0.35,
          pointRadius: 4, pointBackgroundColor: '#3B82F6',
        }],
      },
      options: {
        plugins: { legend: { labels: { color: '#F4F4F5' } } },
        scales: {
          x: { ticks: { color: '#52525B' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#52525B' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }
  document.getElementById('weight-date').value = todayISO();
  document.getElementById('log-weight-btn').addEventListener('click', async () => {
    const date = document.getElementById('weight-date').value;
    const kg = parseFloat(document.getElementById('weight-kg').value);
    if (!date || !kg || kg <= 0) { alert('Enter a valid date and weight.'); return; }
    await api('/api/me/weight', { method: 'POST', body: { date, kg } });
    document.getElementById('weight-kg').value = '';
    await refresh();
  });

  function renderPhotos() {
    const grid = document.getElementById('photo-grid');
    if (!user.photos || user.photos.length === 0) {
      grid.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">
        <span class="material-symbols-rounded">add_a_photo</span>
        No progress photos yet.
      </div>`;
      return;
    }
    grid.innerHTML = user.photos.map(p => `
      <div class="photo">
        <img src="${p.url}" alt="${p.caption || 'Progress'}"
             onerror="this.src='https://via.placeholder.com/400x300/261E1F/A18C89?text=Image+unavailable'" />
        <div class="info">
          <div>
            <div class="caption">${p.caption || 'Progress'}</div>
            <div class="date">${new Date(p.date).toLocaleDateString()}</div>
          </div>
          <button class="btn btn-text sm" data-del-photo="${p.id}">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    `).join('');
    grid.querySelectorAll('[data-del-photo]').forEach(b => {
      b.addEventListener('click', async () => {
        await api(`/api/me/photos/${b.dataset.delPhoto}`, { method: 'DELETE' });
        await refresh();
      });
    });
  }
  let photoMode = 'upload'; // or 'url'
  function setPhotoMode(mode) {
    photoMode = mode;
    document.getElementById('photo-tab-upload').classList.toggle('active', mode === 'upload');
    document.getElementById('photo-tab-url').classList.toggle('active', mode === 'url');
    document.getElementById('photo-upload-form').style.display = mode === 'upload' ? '' : 'none';
    document.getElementById('photo-url-form').style.display    = mode === 'url'    ? '' : 'none';
  }
  document.getElementById('photo-tab-upload').addEventListener('click', () => setPhotoMode('upload'));
  document.getElementById('photo-tab-url').addEventListener('click', () => setPhotoMode('url'));

  // Live preview of chosen file
  document.getElementById('photo-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    const preview = document.getElementById('photo-preview');
    const img = document.getElementById('photo-preview-img');
    if (!file) { preview.style.display = 'none'; return; }
    img.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  });

  document.getElementById('add-photo-btn').addEventListener('click', () => {
    // Reset the form each time it opens
    document.getElementById('photo-file').value = '';
    document.getElementById('photo-url').value = '';
    document.getElementById('photo-caption').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    setPhotoMode('upload');
    openModal('photo-modal');
  });

  document.getElementById('photo-save').addEventListener('click', async () => {
    const caption = document.getElementById('photo-caption').value.trim();
    try {
      if (photoMode === 'upload') {
        const fileInput = document.getElementById('photo-file');
        const file = fileInput.files && fileInput.files[0];
        if (!file) { alert('Please choose an image.'); return; }
        // multipart upload — do NOT go through api() because it forces JSON
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('caption', caption);
        const res = await fetch('/api/me/photos/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${Auth.token}` },
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
      } else {
        const url = document.getElementById('photo-url').value.trim();
        if (!url) { alert('Please enter an image URL.'); return; }
        await api('/api/me/photos', { method: 'POST', body: { url, caption } });
      }
      closeModal('photo-modal');
      await refresh();
    } catch (e) {
      alert(e.message);
    }
  });

  function renderAttendance() {
    const today = new Date();
    renderGithubHeatmap(document.getElementById('attendance-heatmap'), user.attendance || [], 26);
    document.getElementById('attendance-count').textContent =
      `${(user.attendance || []).filter(d => (today - new Date(d)) / 86400000 <= 90).length} check-ins (90d)`;
  }

  // ---- Check-in modal
  document.getElementById('check-in-btn').addEventListener('click', () => {
    const alreadyIn = (user.attendance || []).includes(todayISO());
    const todayName = todayDayName();

    document.getElementById('ci-title').textContent = alreadyIn ? 'Log Today' : 'Check In';
    document.getElementById('ci-subtitle').textContent = alreadyIn
      ? 'Already checked in — update your workout and weight.'
      : todayName + ' · ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    document.getElementById('ci-btn-label').textContent = alreadyIn ? 'Save' : 'Check In & Save';

    // Pre-fill weight if already logged today
    const todayWeight = (user.weightLog || []).find(w => w.date === todayISO());
    document.getElementById('ci-weight').value = todayWeight ? todayWeight.kg : '';

    // Render exercise checkboxes
    const exEl = document.getElementById('ci-exercises');
    const labelEl = document.getElementById('ci-workout-label');
    if (!user.workoutPlan) {
      labelEl.style.display = 'none';
      exEl.innerHTML = '';
    } else {
      const day = user.workoutPlan.days.find(d => d.day === todayName);
      if (!day || !(day.items || []).length) {
        labelEl.style.display = 'none';
        exEl.innerHTML = `<div class="body" style="padding:8px 0;color:var(--md-on-surface-variant);">Rest day — no exercises scheduled.</div>`;
      } else {
        labelEl.style.display = '';
        labelEl.textContent = `${todayName}'s Workout · ${day.focus || ''}`;
        const logMap = todayLogMap();
        exEl.innerHTML = `
          <div style="display:flex;justify-content:flex-end;gap:4px;font-size:11px;color:var(--md-on-surface-variant);margin-bottom:4px;padding-right:20px;">
            <span style="width:60px;text-align:right;">Weight</span><span style="width:16px;"></span>
          </div>
          ${day.items.map(i => renderExerciseCheckbox(i, logMap.get(exName(i)) || null)).join('')}
        `;
      }
    }

    openModal('checkin-modal');
  });

  document.getElementById('ci-save').addEventListener('click', async () => {
    const btn = document.getElementById('ci-save');
    btn.disabled = true;
    try {
      const weightVal = parseFloat(document.getElementById('ci-weight').value);
      const alreadyIn = (user.attendance || []).includes(todayISO());
      const todayName = todayDayName();
      const day = user.workoutPlan?.days.find(d => d.day === todayName);

      const completed = collectCompleted(document.getElementById('ci-exercises'));

      const tasks = [];
      if (!alreadyIn) tasks.push(api('/api/me/attendance', { method: 'POST' }));
      if (weightVal > 0) tasks.push(api('/api/me/weight', { method: 'POST', body: { date: todayISO(), kg: weightVal } }));
      if (day && (day.items || []).length)
        tasks.push(api('/api/me/workout-log', { method: 'POST', body: { date: todayISO(), completed } }));

      await Promise.all(tasks);
      workoutLogs = await api('/api/me/workout-logs');
      closeModal('checkin-modal');
      await refresh();
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Workout progress
  function renderWorkoutProgress() {
    const plan = user.workoutPlan;
    const mgMap = {};  // exercise name → muscle group
    if (plan) {
      for (const day of plan.days) {
        for (const item of day.items || []) {
          const n = exName(item);
          if (item.muscleGroup) mgMap[n] = item.muscleGroup;
        }
      }
    }

    // Accumulate: per muscle group count, per exercise weight history
    const mgCount   = {};
    const mgLast    = {};
    const exWeights = {};  // exercise name → [{date, weight}] newest-first

    for (const log of workoutLogs) {
      const entries = normCompleted(log.completed);
      for (const e of entries) {
        const mg = mgMap[e.exercise] || 'Other';
        mgCount[mg] = (mgCount[mg] || 0) + 1;
        if (!mgLast[mg] || log.date > mgLast[mg]) mgLast[mg] = log.date;
        if (e.weight != null) {
          if (!exWeights[e.exercise]) exWeights[e.exercise] = [];
          exWeights[e.exercise].push({ date: log.date, weight: e.weight });
        }
      }
    }

    const sessionCount = workoutLogs.filter(l => (l.completed || []).length > 0).length;
    const logCountEl = document.getElementById('workout-log-count');
    if (logCountEl) logCountEl.textContent = `${sessionCount} session${sessionCount !== 1 ? 's' : ''} logged`;

    // ---- Muscle group summary cards
    const mgEl = document.getElementById('muscle-group-progress');
    if (!mgEl) return;
    const sorted = Object.entries(mgCount).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) {
      mgEl.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:24px 0;">
        <span class="material-symbols-rounded">fitness_center</span>
        No sessions logged yet — check in and log exercise weights to track progress.
      </div>`;
    } else {
      const max = sorted[0][1];
      mgEl.innerHTML = sorted.map(([mg, count]) => `
        <div class="stat">
          <div class="lbl">${mg}</div>
          <div class="num">${count}</div>
          <div class="sub">exercises done</div>
          <div class="progress-bar-wrap" style="margin-top:10px;">
            <div class="progress-bar-fill success" style="width:${Math.round(count / max * 100)}%"></div>
          </div>
          <div style="font-size:11px;color:var(--md-on-surface-variant);margin-top:4px;">
            Last: ${mgLast[mg] ? new Date(mgLast[mg]).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '—'}
          </div>
        </div>
      `).join('');
    }

    // ---- Exercise weight progression table
    const histEl = document.getElementById('workout-log-history');
    if (!histEl) return;

    // Build per-exercise progression (weights are stored newest-first in exWeights)
    const exProgressEntries = Object.entries(exWeights)
      .map(([name, entries]) => {
        const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
        const first  = sorted[0].weight;
        const last   = sorted[sorted.length - 1].weight;
        const best   = Math.max(...sorted.map(s => s.weight));
        const diff   = last - first;
        return { name, sorted, first, last, best, diff, mg: mgMap[name] || 'Other' };
      })
      .sort((a, b) => b.sorted.length - a.sorted.length || a.name.localeCompare(b.name));

    // Recent session log (for exercises without weight or general view)
    const recentLogs = workoutLogs.filter(l => (l.completed || []).length > 0).slice(0, 10);

    if (!exProgressEntries.length && !recentLogs.length) {
      histEl.innerHTML = `<div class="body" style="padding:12px 0;color:var(--md-on-surface-variant);">No sessions yet.</div>`;
      return;
    }

    let html = '';

    if (exProgressEntries.length) {
      html += `<div class="section-title" style="margin-bottom:10px;">Strength Progression</div>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        <thead>
          <tr style="border-bottom:2px solid var(--md-outline-variant);">
            <th style="text-align:left;padding:6px 8px;color:var(--md-on-surface-variant);font-weight:600;">Exercise</th>
            <th style="text-align:center;padding:6px 8px;color:var(--md-on-surface-variant);font-weight:600;">Sessions</th>
            <th style="text-align:right;padding:6px 8px;color:var(--md-on-surface-variant);font-weight:600;">Best</th>
            <th style="padding:6px 8px;color:var(--md-on-surface-variant);font-weight:600;">Recent weights</th>
            <th style="text-align:right;padding:6px 8px;color:var(--md-on-surface-variant);font-weight:600;">Change</th>
          </tr>
        </thead>
        <tbody>
        ${exProgressEntries.map(e => {
          const diffStr = e.diff > 0 ? `+${e.diff} kg` : e.diff < 0 ? `${e.diff} kg` : '—';
          const diffCls = e.diff > 0 ? 'color:var(--md-success)' : e.diff < 0 ? 'color:var(--md-error)' : 'color:var(--md-on-surface-variant)';
          const last5 = e.sorted.slice(-5).map(w => `${w.weight}`).join(' → ');
          return `
            <tr style="border-bottom:1px solid var(--md-outline-variant);">
              <td style="padding:8px 8px;">
                <div style="font-weight:600;">${e.name}</div>
                <div style="font-size:11px;color:var(--md-on-surface-variant);">${e.mg}</div>
              </td>
              <td style="text-align:center;padding:8px;font-family:'JetBrains Mono',monospace;">${e.sorted.length}</td>
              <td style="text-align:right;padding:8px;font-family:'JetBrains Mono',monospace;font-weight:700;">${e.best} kg</td>
              <td style="padding:8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--md-on-surface-variant);">${last5} kg</td>
              <td style="text-align:right;padding:8px;font-family:'JetBrains Mono',monospace;${diffCls};">${diffStr}</td>
            </tr>
          `;
        }).join('')}
        </tbody>
      </table>`;
    }

    if (recentLogs.length) {
      html += `<div class="section-title" style="margin-bottom:10px;">Recent Sessions</div>`;
      html += recentLogs.map(log => {
        const entries = normCompleted(log.completed);
        const groups = [...new Set(entries.map(e => mgMap[e.exercise] || 'Other'))];
        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--md-outline-variant);">
            <div style="min-width:72px;font-size:13px;padding-top:2px;color:var(--md-on-surface-variant);">
              ${new Date(log.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}
            </div>
            <div style="flex:1;">
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
                ${groups.map(g => `<span class="chip primary" style="font-size:11px;">${g}</span>`).join('')}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${entries.map(e => `
                  <span style="font-size:12px;background:rgba(59, 130, 246,.08);border:1px solid var(--md-outline-variant);border-radius:6px;padding:2px 8px;">
                    ${e.exercise}${e.weight != null ? `<span style="font-family:'JetBrains Mono',monospace;color:var(--md-primary);margin-left:6px;">${e.weight} kg</span>` : ''}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    histEl.innerHTML = html;
  }

  // ---- Finance tab ----
  const money = v => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const methodLabel = m => ({ cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer' }[m] || m);
  const statusChip = s => `<span class="chip ${s === 'paid' ? 'success' : s === 'pending' ? 'warning' : 'error'}">${s}</span>`;

  let availablePlans = [];
  let myPayments = [];

  async function loadFinance() {
    [availablePlans, myPayments] = await Promise.all([
      api('/api/plans'),
      api('/api/me/payments'),
    ]);
    renderFinance();
  }

  function renderFinance() {
    // Current plan card
    if (user.subscription) {
      const days = daysUntil(user.subscription.expiryDate);
      const sev = expirySeverity(days);
      document.getElementById('fin-my-plan').textContent = user.subscription.plan;
      const cd = document.getElementById('fin-my-countdown');
      cd.textContent = sev.label;
      document.getElementById('fin-my-dates').textContent =
        `${new Date(user.subscription.startDate).toLocaleDateString()} → ${new Date(user.subscription.expiryDate).toLocaleDateString()}`;
    } else {
      document.getElementById('fin-my-plan').textContent = 'No active plan';
      document.getElementById('fin-my-countdown').textContent = '—';
      document.getElementById('fin-my-dates').textContent = 'Pick a plan below to request one';
    }

    // Total paid + pending
    const paid = myPayments.filter(p => p.status === 'paid');
    const pending = myPayments.filter(p => p.status === 'pending');
    const total = paid.reduce((s, p) => s + Number(p.amount), 0);
    document.getElementById('fin-total').textContent = money(total);
    document.getElementById('fin-total-sub').textContent = `${paid.length} payment${paid.length === 1 ? '' : 's'} recorded`;

    const pendingEl = document.getElementById('fin-pending-me');
    if (pending.length === 0) {
      pendingEl.innerHTML = `<div class="body">No pending requests.</div>`;
    } else {
      pendingEl.innerHTML = pending.map(p => `
        <div class="notif" style="margin-bottom: 6px;">
          <div class="n-icon expiry"><span class="material-symbols-rounded">hourglass_top</span></div>
          <div class="n-body">
            <div class="n-title">${p.plan_name} — ${money(p.amount)}</div>
            <div class="n-text">Awaiting admin approval</div>
            <div class="n-when">Requested ${new Date(p.created_at).toLocaleString()}</div>
          </div>
        </div>
      `).join('');
    }

    // Available plans
    const plansEl = document.getElementById('fin-plans');
    if (availablePlans.length === 0) {
      plansEl.innerHTML = `<div class="empty" style="grid-column: 1/-1;">No plans available right now.</div>`;
    } else {
      plansEl.innerHTML = availablePlans.map(p => `
        <div class="card" style="padding: 18px;">
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">${p.name}</div>
          <div style="font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: var(--md-primary);">${money(p.price)}<span style="font-size: 13px; color: var(--md-on-surface-variant); font-weight: 500;"> / ${p.duration_days} days</span></div>
          <div class="body" style="margin: 8px 0 12px;">${p.description || ''}</div>
          <button class="btn btn-filled" data-request-plan="${p.id}" data-name="${p.name}" ${pending.length ? 'disabled' : ''}>
            <span class="material-symbols-rounded">${pending.length ? 'hourglass_empty' : 'send'}</span>
            ${pending.length ? 'Request pending' : 'Request renewal'}
          </button>
        </div>
      `).join('');
      plansEl.querySelectorAll('[data-request-plan]').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm(`Request renewal of "${b.dataset.name}"? An admin will approve and update your subscription.`)) return;
          try {
            await api('/api/me/payments/request', { method: 'POST', body: { plan_id: parseInt(b.dataset.requestPlan) } });
            alert('Renewal request sent to the front desk.');
            await loadFinance();
          } catch (e) { alert(e.message); }
        });
      });
    }

    // Payment history
    const tbody = document.getElementById('fin-history-tbody');
    if (myPayments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--md-on-surface-variant);">No payments yet.</td></tr>`;
    } else {
      tbody.innerHTML = myPayments.map(p => `
        <tr>
          <td>${new Date(p.payment_date).toLocaleDateString()}</td>
          <td>${p.plan_name}</td>
          <td style="font-family: 'JetBrains Mono', monospace;">${money(p.amount)}</td>
          <td>${methodLabel(p.method)}</td>
          <td>${statusChip(p.status)}</td>
          <td class="muted" style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${p.reference || '—'}</td>
        </tr>
      `).join('');
    }
  }

  // Lazy-load finance data when the tab is opened
  document.querySelector('[data-tab="finance"]').addEventListener('click', () => loadFinance());

  // ---- Book PT Session ----
  let ptContext = null;
  let bookingCalendar = null;
  let selectedBookingDate = null;
  let availabilityCache = {};

  async function loadPtContext() {
    ptContext = await api('/api/me/pt-context');
    renderPtContext();
  }

  const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function formatTime12(t) {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  // Groups consecutive days sharing the same start/end into ranges,
  // e.g. "Mon–Fri 9:00 AM–5:00 PM, Sat 10:00 AM–1:00 PM".
  function formatWorkingHours(hours) {
    if (!hours || hours.length === 0) return null;
    const weekOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
    const sorted = weekOrder.map(d => hours.find(h => h.dayOfWeek === d)).filter(Boolean);
    const groups = [];
    for (const h of sorted) {
      const last = groups[groups.length - 1];
      const lastDow = last ? last.days[last.days.length - 1] : null;
      const isConsecutive = last && weekOrder.indexOf(h.dayOfWeek) === weekOrder.indexOf(lastDow) + 1;
      if (last && isConsecutive && last.startTime === h.startTime && last.endTime === h.endTime) {
        last.days.push(h.dayOfWeek);
      } else {
        groups.push({ days: [h.dayOfWeek], startTime: h.startTime, endTime: h.endTime });
      }
    }
    return groups.map(g => {
      const label = g.days.length > 1
        ? `${DOW_SHORT[g.days[0]]}–${DOW_SHORT[g.days[g.days.length - 1]]}`
        : DOW_SHORT[g.days[0]];
      return `${label} ${formatTime12(g.startTime)}–${formatTime12(g.endTime)}`;
    }).join(', ');
  }

  function renderPtContext() {
    const noTrainerEl = document.getElementById('book-no-trainer');
    const contentEl = document.getElementById('book-content');
    if (!ptContext.hasTrainer) {
      noTrainerEl.style.display = 'block';
      contentEl.style.display = 'none';
      return;
    }
    noTrainerEl.style.display = 'none';
    contentEl.style.display = 'block';
    document.getElementById('book-trainer-name').textContent = ptContext.trainer.name;
    document.getElementById('book-trainer-spec').textContent = ptContext.trainer.specialization || 'Personal Trainer';
    document.getElementById('book-remaining').textContent = ptContext.remainingCredits;

    const hoursSummary = formatWorkingHours(ptContext.trainer.workingHours);
    const hoursEl = document.getElementById('book-trainer-hours');
    const noHoursEl = document.getElementById('book-no-hours');
    if (hoursSummary) {
      document.getElementById('book-trainer-hours-text').textContent = hoursSummary;
      hoursEl.style.display = 'block';
      noHoursEl.style.display = 'none';
    } else {
      hoursEl.style.display = 'none';
      noHoursEl.style.display = 'block';
    }
  }

  async function fetchAvailability(fromStr, toStr) {
    const key = `${fromStr}_${toStr}`;
    if (!availabilityCache[key]) {
      availabilityCache[key] = await api(`/api/trainer/${ptContext.trainer.id}/availability?from=${fromStr}&to=${toStr}`);
    }
    return availabilityCache[key];
  }

  async function refreshCalendarBackground() {
    if (!bookingCalendar) return;
    availabilityCache = {};
    const from = bookingCalendar.view.activeStart.toISOString().slice(0, 10);
    const to = bookingCalendar.view.activeEnd.toISOString().slice(0, 10);
    const slots = await fetchAvailability(from, to);
    bookingCalendar.getEvents().forEach(e => e.remove());
    Object.keys(slots).forEach(date => {
      if (slots[date].length) {
        bookingCalendar.addEvent({ start: date, display: 'background', backgroundColor: 'rgba(52, 211, 153,0.25)' });
      }
    });
  }

  function initBookingCalendar() {
    if (bookingCalendar || !ptContext?.hasTrainer) return;
    const el = document.getElementById('book-calendar');
    bookingCalendar = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      height: 'auto',
      headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
      validRange: { start: todayISO() },
      datesSet: () => refreshCalendarBackground(),
      dateClick: info => {
        selectedBookingDate = info.dateStr;
        renderSlotsForDate(info.dateStr);
      },
    });
    bookingCalendar.render();
  }

  async function renderSlotsForDate(dateStr) {
    const slots = await fetchAvailability(dateStr, dateStr);
    const card = document.getElementById('book-slots-card');
    const list = document.getElementById('book-slots');
    document.getElementById('book-slots-date').textContent =
      new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const times = slots[dateStr] || [];
    if (times.length === 0) {
      list.innerHTML = `<div class="body">No open slots on this day.</div>`;
    } else {
      list.innerHTML = times.map(t => `<button class="btn btn-tonal sm" data-slot="${t}">${t}</button>`).join('');
      list.querySelectorAll('[data-slot]').forEach(btn => {
        btn.addEventListener('click', () => openBookingConfirm(dateStr, btn.dataset.slot));
      });
    }
    card.style.display = 'block';
  }

  function openBookingConfirm(date, time) {
    document.getElementById('cb-summary').textContent =
      `Book a session with ${ptContext.trainer.name} on ${new Date(date + 'T00:00:00').toLocaleDateString()} at ${time}?`;
    const btn = document.getElementById('cb-confirm');
    btn.onclick = async () => {
      try {
        await api('/api/pt-bookings', { method: 'POST', body: { date, startTime: time } });
        closeModal('confirm-booking-modal');
        availabilityCache = {};
        await loadPtContext();
        await renderSlotsForDate(date);
        if (bookingCalendar) refreshCalendarBackground();
        await loadMyBookings('upcoming');
      } catch (e) { alert(e.message); }
    };
    openModal('confirm-booking-modal');
  }

  async function loadMyBookings(scope) {
    const rows = await api(`/api/me/pt-bookings?scope=${scope}`);
    renderMyBookings(scope, rows);
  }

  function renderMyBookings(scope, rows) {
    const el = document.getElementById(`book-list-${scope}`);
    if (rows.length === 0) {
      el.innerHTML = `<div class="body">No ${scope} bookings.</div>`;
      return;
    }
    el.innerHTML = rows.map(b => `
      <div class="notif" style="margin-bottom:6px;">
        <div class="n-icon"><span class="material-symbols-rounded">event</span></div>
        <div class="n-body">
          <div class="n-title">${new Date(b.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${b.startTime}–${b.endTime}</div>
          <div class="n-text">with ${b.trainerName} · ${b.status}</div>
        </div>
        ${scope === 'upcoming' && b.status === 'confirmed' ? `<button class="btn btn-text sm" data-cancel-booking="${b.id}">Cancel</button>` : ''}
      </div>
    `).join('');
    el.querySelectorAll('[data-cancel-booking]').forEach(btn => {
      btn.addEventListener('click', () => cancelBooking(btn.dataset.cancelBooking));
    });
  }

  async function cancelBooking(id) {
    if (!confirm('Cancel this booking? Your session credit will be refunded.')) return;
    try {
      await api(`/api/pt-bookings/${id}`, { method: 'DELETE' });
      availabilityCache = {};
      await loadPtContext();
      await loadMyBookings('upcoming');
      if (bookingCalendar) refreshCalendarBackground();
      if (selectedBookingDate) await renderSlotsForDate(selectedBookingDate);
    } catch (e) { alert(e.message); }
  }

  document.querySelectorAll('[data-btab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('[data-btab]').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('book-list-upcoming').style.display = t.dataset.btab === 'upcoming' ? 'block' : 'none';
      document.getElementById('book-list-past').style.display = t.dataset.btab === 'past' ? 'block' : 'none';
      loadMyBookings(t.dataset.btab);
    });
  });

  let bookTabLoaded = false;
  document.querySelector('[data-tab="book"]').addEventListener('click', async () => {
    if (!bookTabLoaded) {
      bookTabLoaded = true;
      await loadPtContext();
      initBookingCalendar();
      await loadMyBookings('upcoming');
    } else if (bookingCalendar) {
      bookingCalendar.updateSize();
    }
  });

  // ---- Account settings ----
  const FIELD_LABELS = {
    name: 'Name', email: 'Email', phone: 'Phone', goal: 'Goal', height: 'Height (cm)',
    subscription_plan: 'Subscription plan',
    subscription_start: 'Subscription start',
    subscription_expiry: 'Subscription expiry',
    password: 'Password',
  };

  function showBanner(id, msg, ok = false) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
    el.style.color = ok ? 'var(--md-success)' : '';
    el.style.background = ok ? 'rgba(52, 211, 153,0.12)' : '';
    el.style.borderColor = ok ? 'rgba(52, 211, 153,0.30)' : '';
    setTimeout(() => el.classList.remove('show'), 4000);
  }

  function renderAccount() {
    document.getElementById('acc-name').value  = user.name;
    document.getElementById('acc-email').value = user.email;
    document.getElementById('acc-phone').value = user.phone || '';
    document.getElementById('acc-goal').value  = user.goal || '';
    document.getElementById('acc-height').value = user.height || '';
  }

  async function renderHistory() {
    const rows = await api('/api/me/history');
    const el = document.getElementById('account-history');
    if (!rows.length) {
      el.innerHTML = `<div class="empty">
        <span class="material-symbols-rounded">history</span>
        No changes recorded yet.
      </div>`;
      return;
    }
    el.innerHTML = rows.map(r => {
      const when = new Date(r.changed_at).toLocaleString();
      const editorChip = r.edited_by_role === 'admin'
        ? `<span class="chip primary">Admin · ${r.edited_by_name}</span>`
        : `<span class="chip info">You</span>`;
      const diffs = Object.entries(r.changes || {}).map(([f, { from, to }]) => `
        <div class="ex-display">
          <div class="ex-name">${FIELD_LABELS[f] || f}</div>
          <div class="meta">
            <span class="chip error">${from === null || from === '' ? '(empty)' : String(from)}</span>
            <span class="material-symbols-rounded" style="opacity: 0.5;">arrow_forward</span>
            <span class="chip success">${to === null || to === '' ? '(empty)' : String(to)}</span>
          </div>
        </div>
      `).join('');
      return `
        <div class="notif">
          <div class="n-icon general"><span class="material-symbols-rounded">history</span></div>
          <div class="n-body">
            <div class="n-title">${editorChip}</div>
            <div class="n-when">${when}</div>
            <div style="margin-top: 8px;">${diffs}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('acc-save').addEventListener('click', async () => {
    try {
      const updated = await api('/api/me', {
        method: 'PATCH',
        body: {
          name:   document.getElementById('acc-name').value.trim(),
          email:  document.getElementById('acc-email').value.trim(),
          phone:  document.getElementById('acc-phone').value.trim(),
          goal:   document.getElementById('acc-goal').value.trim(),
          height: document.getElementById('acc-height').value,
        },
      });
      user = updated;
      renderAccount();
      renderStats();
      renderHistory();
      // Update header + welcome line in case name changed
      document.getElementById('user-chip').innerHTML = `
        <div class="avatar">${initials(user.name)}</div><span>${user.name}</span>
      `;
      document.getElementById('welcome-line').textContent = `Hey, ${user.name.split(' ')[0]}.`;
      showBanner('account-error', '✓ Profile updated', true);
    } catch (e) { showBanner('account-error', e.message); }
  });

  document.getElementById('pw-save').addEventListener('click', async () => {
    const cur = document.getElementById('pw-current').value;
    const nw  = document.getElementById('pw-new').value;
    if (!cur || !nw) return showBanner('pw-error', 'Both fields are required.');
    try {
      await api('/api/me/password', { method: 'POST', body: { currentPassword: cur, newPassword: nw } });
      document.getElementById('pw-current').value = '';
      document.getElementById('pw-new').value = '';
      renderHistory();
      showBanner('pw-error', '✓ Password updated', true);
    } catch (e) { showBanner('pw-error', e.message); }
  });

  // When the Account tab is opened, refresh the history
  document.querySelector('[data-tab="account"]').addEventListener('click', () => renderHistory());

  function renderAll() {
    renderStats();
    renderToday();
    renderWeeklyWorkout();
    renderNutrition();
    renderProgress();
    renderPhotos();
    renderAttendance();
    renderNotifications();
    renderAccount();
    renderWorkoutProgress();
  }

  await loadWorkoutLogs();
  renderAll();
})();
