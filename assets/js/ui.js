(function () {
  if (window.__snackbarReady) return;
  window.__snackbarReady = true;

  function ensureRoot() {
    let root = document.getElementById('snackbarRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'snackbarRoot';
      root.className = 'snackbar-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function inferType(message) {
    const text = String(message || '').toLowerCase();
    if (/(failed|error|invalid|cannot|not found|missing|rejected|denied|unable)/.test(text)) return 'error';
    if (/(success|saved|approved|updated|uploaded|created|done)/.test(text)) return 'success';
    return 'info';
  }

  function showSnackbar(message, type, timeoutMs) {
    const root = ensureRoot();
    const el = document.createElement('div');
    const resolvedType = type || inferType(message);
    el.className = 'snackbar ' + resolvedType;
    el.textContent = String(message || '');
    root.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, timeoutMs || 3500);
  }

  window.notify = showSnackbar;
  window.notifySuccess = function (message, timeoutMs) {
    showSnackbar(message, 'success', timeoutMs || 3200);
  };
  window.notifyError = function (message, timeoutMs) {
    showSnackbar(message, 'error', timeoutMs || 4200);
  };

  function setButtonLoading(button, loading, pendingText) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.classList.add('btn-loading');
      button.innerHTML = '<span class="inline-spinner" aria-hidden="true"></span>' + (pendingText || 'Please wait...');
      return;
    }
    button.disabled = false;
    button.classList.remove('btn-loading');
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }

  async function withButtonLoading(button, pendingText, task) {
    setButtonLoading(button, true, pendingText);
    try {
      return await task();
    } finally {
      setButtonLoading(button, false);
    }
  }

  function setTableLoading(tbodyOrId, message, colspan) {
    const tbody = typeof tbodyOrId === 'string' ? document.getElementById(tbodyOrId) : tbodyOrId;
    if (!tbody) return;
    const cols = Number(colspan || tbody.dataset.colspan || 1);
    tbody.innerHTML = '<tr><td colspan="' + cols + '" class="table-loading-cell"><span class="inline-spinner" aria-hidden="true"></span>' +
      (message || 'Loading...') + '</td></tr>';
  }

  window.setButtonLoading = setButtonLoading;
  window.withButtonLoading = withButtonLoading;
  window.setTableLoading = setTableLoading;

  const nativeAlert = window.alert ? window.alert.bind(window) : null;
  window.alert = function (message) {
    try {
      showSnackbar(message, inferType(message), 3800);
    } catch (_) {
      if (nativeAlert) nativeAlert(message);
    }
  };
})();
