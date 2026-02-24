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

  const nativeAlert = window.alert ? window.alert.bind(window) : null;
  window.alert = function (message) {
    try {
      showSnackbar(message, inferType(message), 3800);
    } catch (_) {
      if (nativeAlert) nativeAlert(message);
    }
  };
})();

