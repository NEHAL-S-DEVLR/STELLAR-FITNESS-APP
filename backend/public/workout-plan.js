// Default Workout Plan (non-PT members) — workout-plan.js

(async function () {
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin' && !hasPermission(me, 'workout.manage')) { location.href = '/profile.html'; return; }

  renderAdminNav('workout', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">${me.role === 'admin' ? 'Admin' : 'Staff'}</span>
  `;

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const LEVEL_NAMES = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Elite' };

  let plans = [1, 2, 3, 4].map(level => ({ level, name: '', assignedBy: '', days: [] }));
  let activeLevel = 1;
  let dayFocus = {};
  let dayText = {};
  let activeDay = 'Monday';

  function itemsToText(items) {
    return (items || []).map(i => [i.exercise, i.muscleGroup, i.machine, i.sets].filter(Boolean).join(' | ')).join('\n');
  }
  function textToItems(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const [exercise, muscleGroup, machine, sets] = line.split('|').map(s => (s || '').trim());
      return { exercise: exercise || line, muscleGroup: muscleGroup || '', machine: machine || '', sets: sets || '' };
    });
  }

  function renderLevelTabs() {
    document.getElementById('wp-level-tabs').innerHTML = [1, 2, 3, 4].map(level => `
      <button type="button" class="chip${level === activeLevel ? ' primary' : ''}" data-level="${level}" style="cursor:pointer; border-width:1px; border-style:solid;">Level ${level} — ${LEVEL_NAMES[level]}</button>
    `).join('');
    document.getElementById('wp-level-tabs').querySelectorAll('[data-level]').forEach(btn => {
      btn.addEventListener('click', () => selectLevel(parseInt(btn.dataset.level, 10)));
    });
  }

  function renderDayTabs() {
    document.getElementById('wp-day-tabs').innerHTML = WEEKDAYS.map(d => `
      <button type="button" class="chip${d === activeDay ? ' primary' : ''}" data-day="${d}" style="cursor:pointer; border-width:1px; border-style:solid;">${d.slice(0, 3)}</button>
    `).join('');
    document.getElementById('wp-day-tabs').querySelectorAll('[data-day]').forEach(btn => {
      btn.addEventListener('click', () => selectDay(btn.dataset.day));
    });
  }

  function selectDay(day) {
    // Persist whatever's currently typed before switching tabs
    dayFocus[activeDay] = document.getElementById('wp-focus').value;
    dayText[activeDay] = document.getElementById('wp-exercises').value;
    activeDay = day;
    document.getElementById('wp-focus').value = dayFocus[day] || '';
    document.getElementById('wp-exercises').value = dayText[day] || '';
    renderDayTabs();
  }

  function loadLevelIntoEditor(level) {
    const plan = plans.find(p => p.level === level) || { name: '', days: [] };
    document.getElementById('wp-name').value = plan.name || '';
    dayFocus = {}; dayText = {};
    WEEKDAYS.forEach(day => {
      const found = (plan.days || []).find(d => d.day === day);
      dayFocus[day] = found?.focus || '';
      dayText[day] = itemsToText(found?.items);
    });
    activeDay = 'Monday';
    document.getElementById('wp-focus').value = dayFocus[activeDay] || '';
    document.getElementById('wp-exercises').value = dayText[activeDay] || '';
    renderDayTabs();
  }

  function selectLevel(level) {
    // Persist whatever's currently on screen for the level being left, so
    // switching levels to peek at another one doesn't drop unsaved edits.
    plans = plans.map(p => p.level === activeLevel ? { ...p, ...buildPlan() } : p);
    activeLevel = level;
    renderLevelTabs();
    loadLevelIntoEditor(level);
  }

  function buildPlan() {
    dayFocus[activeDay] = document.getElementById('wp-focus').value;
    dayText[activeDay] = document.getElementById('wp-exercises').value;
    return {
      name: document.getElementById('wp-name').value.trim(),
      days: WEEKDAYS.map(day => ({ day, focus: dayFocus[day] || '', items: textToItems(dayText[day] || '') })),
    };
  }

  async function loadPlans() {
    try {
      plans = await api('/api/admin/default-workout-plan');
      renderLevelTabs();
      loadLevelIntoEditor(activeLevel);
    } catch (e) {
      showError('error-banner', 'Failed to load plans: ' + e.message);
    }
  }

  document.getElementById('wp-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('wp-save-btn');
    btn.disabled = true;
    try {
      await api(`/api/admin/default-workout-plan/${activeLevel}`, { method: 'PUT', body: buildPlan() });
      alert(`Level ${activeLevel} — ${LEVEL_NAMES[activeLevel]} plan saved.`);
    } catch (e) {
      showError('error-banner', 'Failed to save: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('wp-send-btn').addEventListener('click', async () => {
    if (!confirm('Save this level and send every active, non-PT member their own level\'s plan on WhatsApp?')) return;
    const btn = document.getElementById('wp-send-btn');
    btn.disabled = true;
    try {
      await api(`/api/admin/default-workout-plan/${activeLevel}`, { method: 'PUT', body: buildPlan() });
      const res = await api('/api/admin/default-workout-plan/whatsapp', { method: 'POST' });
      const count = res.results?.length || 0;
      if (!res.waConfigured && count > 0) {
        alert(`${count} WhatsApp links were generated (auto-send isn't configured). Open each recipient's link to actually send — check the browser console for the list.`);
        console.log('Workout plan WhatsApp links:', res.results);
      } else {
        alert(`Sent to ${count} member${count === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      showError('error-banner', 'Failed to send: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  await loadPlans();
})();
