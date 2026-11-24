/**
 * Layout & Navigation Helpers (Vanilla JS)
 * Manages sidebar active links, mobile drawer, and current user info display.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Enforce authentication for protected pages
  if (typeof auth !== 'undefined' && !window.location.pathname.includes('login.html')) {
    auth.requireAuth();
  }

  // 2. Populate user info in sidebar & header
  const user = typeof auth !== 'undefined' ? auth.getUser() : null;
  const userNameElements = document.querySelectorAll('.current-user-name');
  userNameElements.forEach(el => {
    el.textContent = user?.name || 'Shop Admin';
  });

  const userEmailElements = document.querySelectorAll('.current-user-email');
  userEmailElements.forEach(el => {
    el.textContent = user?.email || 'admin@shop.com';
  });

  // 3. Set formatted current date in top bar
  const dateDisplay = document.getElementById('current-date-display');
  if (dateDisplay) {
    const today = new Date();
    dateDisplay.textContent = today.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // 4. Highlight active navigation item
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && (currentPath.endsWith(href) || (href === 'index.html' && (currentPath === '/' || currentPath.endsWith('/'))))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 5. Mobile hamburger menu toggle
  const menuBtn = document.getElementById('menu-toggle-btn');
  const sidebar = document.querySelector('.sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Close sidebar on click outside on mobile
  document.addEventListener('click', (e) => {
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
      sidebar.classList.remove('open');
    }
  });

  // 6. Bind logout buttons
  const logoutButtons = document.querySelectorAll('.btn-logout, .action-logout');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        auth.logout();
      }
    });
  });
});
