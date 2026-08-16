// Shared admin navigation — injected into every admin page.
// Call renderAdminNav(activePage, user) once after auth check. `user` is the
// /api/me response — its role/permissions decide which pages a staff account
// (or a trainer granted extra permissions) actually sees; admins see everything.
// Pages: 'dashboard' | 'enquiries' | 'admissions' | 'trainers' | 'expenses' | 'reports' | 'manual'
// logout() is already provided by api.js

const ADMIN_PAGES = [
  { key: 'dashboard',  href: '/admin.html',              icon: 'dashboard',      label: 'Dashboard',  requires: null },
  { key: 'enquiries',  href: '/enquiries.html',          icon: 'forum',          label: 'Enquiries',  requires: 'enquiries.manage' },
  { key: 'admissions', href: '/admissions.html',         icon: 'assignment_add', label: 'Admissions', requires: 'finance.view' },
  { key: 'trainers',   href: '/trainers.html',           icon: 'sports',         label: 'Trainers',   requires: ['trainers.manage', 'pt.manage'] },
  { key: 'plans',      href: '/plans.html',              icon: 'sell',           label: 'Plans',      requires: 'finance.view' },
  { key: 'gallery',    href: '/gallery-admin.html',      icon: 'photo_library',  label: 'Gallery',    requires: 'admin' },
  { key: 'workout',    href: '/workout-plan.html',       icon: 'fitness_center', label: 'Default Workout', requires: 'workout.manage' },
  { key: 'expenses',   href: '/expenses.html',           icon: 'receipt_long',   label: 'Expenses',   requires: 'expenses.manage' },
  { key: 'reports',    href: '/reports.html',            icon: 'bar_chart',      label: 'Reports',    requires: 'reports.view' },
  { key: 'form',       href: '/registration-form.html',  icon: 'print',          label: 'Print Form', requires: null },
  { key: 'manual',     href: '/manual.html',             icon: 'menu_book',      label: 'Manual',     requires: null },
];

function renderAdminNav(activePage, user) {
  const pages = ADMIN_PAGES.filter(p => {
    if (!p.requires) return true;
    if (p.requires === 'admin') return user && user.role === 'admin';
    const keys = Array.isArray(p.requires) ? p.requires : [p.requires];
    return keys.some(k => hasPermission(user, k));
  });
  const nav = document.createElement('div');
  nav.className = 'admin-page-nav';
  nav.innerHTML = pages.map(p => `
    <a class="admin-page-link${p.key === activePage ? ' active' : ''}" href="${p.href}">
      <span class="material-symbols-rounded">${p.icon}</span>${p.label}
    </a>
  `).join('');
  // Insert right after the appbar
  const appbar = document.querySelector('.appbar');
  if (appbar && appbar.nextSibling) {
    appbar.parentNode.insertBefore(nav, appbar.nextSibling);
  } else {
    document.body.prepend(nav);
  }
}
