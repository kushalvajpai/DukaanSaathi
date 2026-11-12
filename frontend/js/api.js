/**
 * Shared API client, formatting helpers, toast notifications, and confirmation modal.
 */
const API_ORIGIN = window.DUKAANSAATHI_API_ORIGIN || '';
const API_BASE = `${API_ORIGIN}/api`;

async function apiFetch(endpoint, options = {}) {
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  const isAuthPage =
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/index.html') ||
    window.location.pathname.endsWith('/register.html');

  if (
    response.status === 401 &&
    !isAuthPage &&
    !endpoint.startsWith('/auth/login') &&
    !endpoint.startsWith('/auth/register')
  ) {
    window.location.href = '/index.html';
    throw new Error('Session expired');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  if (!response.ok) {
    throw new Error('Request failed');
  }
  return response;
}

function formatINR(amount) {
  const num = Number(amount || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}₹${Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  let container = document.getElementById('dsToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dsToastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1100';
    document.body.appendChild(container);
  }

  const bgClass =
    type === 'error' ? 'text-bg-danger' : type === 'warning' ? 'text-bg-warning' : 'text-bg-success';

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${bgClass} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

function confirmAction(title, message) {
  return new Promise((resolve) => {
    let modalEl = document.getElementById('dsConfirmModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'dsConfirmModal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="dsConfirmTitle"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="dsConfirmMessage"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal" id="dsConfirmCancel">Cancel</button>
              <button type="button" class="btn btn-danger" id="dsConfirmOk">Confirm</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    document.getElementById('dsConfirmTitle').textContent = title;
    document.getElementById('dsConfirmMessage').textContent = message;

    const modal = new bootstrap.Modal(modalEl);
    const okBtn = document.getElementById('dsConfirmOk');
    const cancelBtn = document.getElementById('dsConfirmCancel');

    let settled = false;
    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      resolve(result);
    };

    const onOk = () => {
      modal.hide();
      cleanup(true);
    };
    const onCancel = () => cleanup(false);
    const onHidden = () => cleanup(false);

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modalEl.addEventListener('hidden.bs.modal', onHidden);
    modal.show();
  });
}
