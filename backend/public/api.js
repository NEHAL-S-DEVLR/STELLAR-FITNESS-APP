// Client-side API wrapper. Sends JSON, attaches JWT, handles 401.

const TOKEN_KEY = 'fitcore_token';

const Auth = {
  get token()   { return localStorage.getItem(TOKEN_KEY); },
  set token(v)  { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
  clear()       { localStorage.removeItem(TOKEN_KEY); },
};

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const hadToken = !!Auth.token;
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  // A 401 on a request that carried a token means the session expired/was
  // revoked — force back to login. A 401 with no token (e.g. a wrong-password
  // login attempt) is a normal auth failure and must surface as an error
  // message instead, or callers like the login form can never show it.
  if (res.status === 401 && hadToken) {
    Auth.clear();
    if (!location.pathname.endsWith('/') && !location.pathname.endsWith('/index.html')) {
      location.href = '/';
    }
    throw new Error('Not authenticated');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

// ----- Utility helpers reused across pages -----
function todayISO() { return new Date().toISOString().slice(0, 10); }

// Locale-independent weekday name matching the day names workout plans are
// stored with (e.g. WEEKDAYS in admin.js). toLocaleDateString(undefined, ...)
// returns a translated name on non-English browsers/OSes, which then silently
// fails to match any plan day — use this instead wherever "today" needs to
// look up a plan day.
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function todayDayName() { return WEEKDAY_NAMES[new Date().getDay()]; }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function bmi(kg, cm) {
  if (!kg || !cm) return null;
  const m = cm / 100;
  return kg / (m * m);
}

function bmiCategory(v) {
  if (v == null)     return { label: '—',           color: 'var(--md-outline)',  cls: '' };
  if (v < 18.5)      return { label: 'Underweight', color: 'var(--md-info)',     cls: 'info' };
  if (v < 25)        return { label: 'Healthy',     color: 'var(--md-success)',  cls: 'success' };
  if (v < 30)        return { label: 'Overweight',  color: 'var(--md-warning)',  cls: 'warning' };
  return             { label: 'Obese',              color: 'var(--md-error)',    cls: 'error' };
}

function expirySeverity(days) {
  if (days == null) return { label: '—', cls: '' };
  if (days < 0)   return { label: `Expired ${Math.abs(days)}d ago`, cls: 'error' };
  if (days <= 3)  return { label: `${days}d left`, cls: 'error' };
  if (days <= 14) return { label: `${days}d left`, cls: 'warning' };
  return { label: `${days}d left`, cls: 'success' };
}

function initials(name) {
  return (name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// Admins implicitly have every permission; everyone else needs the specific
// key in their granted `permissions` array (staff accounts, or a trainer
// given extra abilities). Mirrors userHasPermission() in server.js.
function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(key);
}

// GitHub-style contribution heatmap: weeks as columns (oldest → newest,
// left → right), 7 day-of-week rows. `dateStrings` is an array of
// "YYYY-MM-DD" attendance dates. Renders into any container element.
function renderGithubHeatmap(container, dateStrings, weeks = 26) {
  const present = new Set(dateStrings || []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalDays = weeks * 7;
  // Start on a Sunday so day-of-week rows line up correctly.
  const start = new Date(today);
  start.setDate(start.getDate() - totalDays + 1 - today.getDay());

  const cols = [];
  for (let w = 0; w < weeks + 1; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(day.getDate() + w * 7 + d);
      if (day > today) { col.push(null); continue; }
      const iso = day.toISOString().slice(0, 10);
      col.push({ iso, present: present.has(iso), label: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
    }
    cols.push(col);
  }

  const monthLabels = [];
  let lastMonth = null;
  cols.forEach((col, i) => {
    const first = col.find(c => c);
    if (!first) { monthLabels.push(''); return; }
    const m = new Date(first.iso).getMonth();
    if (m !== lastMonth) { monthLabels.push(new Date(first.iso).toLocaleDateString('en-IN', { month: 'short' })); lastMonth = m; }
    else monthLabels.push('');
  });

  container.innerHTML = `
    <div style="display:flex; gap:3px; margin-bottom:4px; padding-left:0;">
      ${monthLabels.map(m => `<div style="width:12px; font-size:10px; color:var(--md-on-surface-variant); flex-shrink:0;">${m}</div>`).join('')}
    </div>
    <div style="display:flex; gap:3px;">
      ${cols.map(col => `
        <div style="display:flex; flex-direction:column; gap:3px;">
          ${col.map(c => c
            ? `<div title="${c.label}${c.present ? ' — checked in' : ' — no check-in'}"
                    style="width:12px; height:12px; border-radius:3px; background:${c.present ? 'var(--md-primary)' : 'var(--md-surface-container-high)'};"></div>`
            : `<div style="width:12px; height:12px;"></div>`
          ).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  document.querySelectorAll('.modal-backdrop.open').forEach(m => {
    if (e.target === m) m.classList.remove('open');
  });
});

// Global logout helper
async function logout() {
  Auth.clear();
  location.href = '/';
}
