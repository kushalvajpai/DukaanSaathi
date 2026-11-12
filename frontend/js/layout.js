/**
 * Renders the consistent responsive sidebar, topbar, and enforces authentication.
 */
async function initAppLayout(activePage, pageTitle) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', href: '/pages/dashboard.html' },
    { id: 'products', label: 'Products & Inventory', icon: 'bi-box-seam', href: '/pages/products.html' },
    { id: 'sales', label: 'Sales', icon: 'bi-receipt', href: '/pages/sales.html' },
    { id: 'purchases', label: 'Purchases', icon: 'bi-bag-plus', href: '/pages/purchases.html' },
    { id: 'expenses', label: 'Expenses', icon: 'bi-wallet2', href: '/pages/expenses.html' },
    { id: 'pnl', label: 'Profit & Loss', icon: 'bi-graph-up-arrow', href: '/pages/pnl.html' },
    { id: 'reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph', href: '/pages/reports.html' },
    { id: 'settings', label: 'Settings', icon: 'bi-gear', href: '/pages/settings.html' }
  ];

  const sidebarEl = document.getElementById('appSidebar');
  const backdropEl = document.getElementById('sidebarBackdrop');
  const topbarTitleEl = document.getElementById('topbarTitle');
  const mobileToggleBtn = document.getElementById('mobileSidebarToggle');

  if (topbarTitleEl) {
    topbarTitleEl.textContent = pageTitle;
  }

  let user;
  try {
    const data = await apiFetch('/auth/me');
    user = data.user;
  } catch (err) {
    window.location.href = '/index.html';
    return null;
  }

  if (sidebarEl) {
    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <a href="/pages/dashboard.html" class="sidebar-brand">
          <span class="brand-icon"><i class="bi bi-shop"></i></span>
          <span>DukaanSaathi</span>
        </a>
        <div class="store-pill" title="${escapeHtml(user.storeName)}">
          <i class="bi bi-building me-1"></i>${escapeHtml(user.storeName)}
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navItems
          .map(
            (item) => `
          <a href="${item.href}" class="nav-item-link ${item.id === activePage ? 'active' : ''}">
            <i class="bi ${item.icon}"></i>
            <span>${item.label}</span>
          </a>
        `
          )
          .join('')}
      </nav>
      <div class="sidebar-footer">
        <button id="logoutBtn" class="nav-item-link text-danger-emphasis">
          <i class="bi bi-box-arrow-right"></i>
          <span>Logout</span>
        </button>
      </div>
    `;
  }

  const topbarUserEl = document.getElementById('topbarUser');
  if (topbarUserEl) {
    topbarUserEl.textContent = user.ownerName;
  }

  const closeMobile = () => {
    sidebarEl && sidebarEl.classList.remove('open');
    backdropEl && backdropEl.classList.remove('show');
  };

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebarEl.classList.toggle('open');
      backdropEl.classList.toggle('show');
    });
  }

  if (backdropEl) {
    backdropEl.addEventListener('click', closeMobile);
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/auth/logout', { method: 'POST' });
        window.location.href = '/index.html';
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  return user;
}
