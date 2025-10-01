// Simple global toaster utilities using CustomEvent

export function showToast(message, type = 'info') {
  try {
    const detail = { message: String(message || ''), type, id: `t-${Date.now()}-${Math.random().toString(36).slice(2,8)}` };
    window.dispatchEvent(new CustomEvent('voyager:toast', { detail }));
    return detail.id;
  } catch {
    // Fallback for environments without window
    console.log(`[toast:${type}]`, message);
    return null;
  }
}

export const toast = {
  info: (m) => showToast(m, 'info'),
  success: (m) => showToast(m, 'success'),
  error: (m) => showToast(m, 'error'),
  warn: (m) => showToast(m, 'warn'),
};

// Optionally expose on window for debugging
try { window.voyagerToast = showToast; } catch {}
