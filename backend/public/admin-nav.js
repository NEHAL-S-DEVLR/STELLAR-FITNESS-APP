// Shared admin navigation — injected into every admin page as a left
// sidebar (was a horizontally-scrolling top bar, which stopped being
// usable once the page count grew past what fit on screen).
// Call renderAdminNav(activePage, user) once after auth check. `user` is the
// /api/me response — its role/permissions decide which pages a staff account
// (or a trainer granted extra permissions) actually sees; admins see everything.
// logout() is already provided by api.js

const ADMIN_NAV_GROUPS = [
  {
    label: null, // ungrouped, always first
    pages: [
      { key: 'dashboard', href: '/admin.html', icon: 'dashboard', label: 'Dashboard', requires: null },
    ],
  },
  {
    label: 'Front Desk',
    pages: [
      { key: 'enquiries',   href: '/enquiries.html',         icon: 'forum',          label: 'Enquiries',   requires: 'enquiries.manage' },
      { key: 'admissions',  href: '/admissions.html',        icon: 'assignment_add', label: 'Admissions',  requires: 'finance.view' },
      { key: 'form',        href: '/registration-form.html', icon: 'print',          label: 'Print Form',  requires: null },
    ],
  },
  {
    label: 'Team',
    pages: [
      { key: 'trainers', href: '/trainers.html', icon: 'sports', label: 'Trainers & Staff', requires: ['trainers.manage', 'pt.manage'] },
    ],
  },
  {
    label: 'Content',
    pages: [
      { key: 'plans',   href: '/plans.html',         icon: 'sell',           label: 'Plans',           requires: 'finance.view' },
      { key: 'gallery', href: '/gallery-admin.html', icon: 'photo_library',  label: 'Gallery',         requires: 'admin' },
      { key: 'workout', href: '/workout-plan.html',  icon: 'fitness_center', label: 'Default Workout', requires: 'workout.manage' },
      { key: 'reels',   href: '/reels.html',         icon: 'movie',          label: 'Reel Requests',   requires: 'reels.manage' },
    ],
  },
  {
    label: 'Money',
    pages: [
      { key: 'expenses', href: '/expenses.html', icon: 'receipt_long', label: 'Expenses', requires: 'expenses.manage' },
      { key: 'reports',  href: '/reports.html',  icon: 'bar_chart',    label: 'Reports',  requires: 'reports.view' },
    ],
  },
  {
    label: null,
    pages: [
      { key: 'manual', href: '/manual.html', icon: 'menu_book', label: 'Manual', requires: null },
    ],
  },
];

function renderAdminNav(activePage, user) {
  function visible(p) {
    if (!p.requires) return true;
    if (p.requires === 'admin') return user && user.role === 'admin';
    const keys = Array.isArray(p.requires) ? p.requires : [p.requires];
    return keys.some(k => hasPermission(user, k));
  }

  const groups = ADMIN_NAV_GROUPS
    .map(g => ({ ...g, pages: g.pages.filter(visible) }))
    .filter(g => g.pages.length > 0);

  const sidebar = document.createElement('nav');
  sidebar.className = 'admin-sidebar';
  sidebar.innerHTML = groups.map((g, gi) => `
    ${g.label ? `<div class="admin-sidebar-group-label">${g.label}</div>` : (gi > 0 ? '<div class="admin-sidebar-divider"></div>' : '')}
    ${g.pages.map(p => `
      <a class="admin-sidebar-link${p.key === activePage ? ' active' : ''}" href="${p.href}">
        <span class="material-symbols-rounded">${p.icon}</span>${p.label}
      </a>
    `).join('')}
  `).join('');

  document.body.classList.add('has-admin-sidebar');
  const appbar = document.querySelector('.appbar');
  if (appbar && appbar.nextSibling) {
    appbar.parentNode.insertBefore(sidebar, appbar.nextSibling);
  } else {
    document.body.prepend(sidebar);
  }
}
