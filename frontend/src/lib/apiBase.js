// Centralized API base resolution to prevent localhost calls in production
export function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE;
  const hosted = typeof window !== 'undefined' && /(?:web\.app|firebaseapp\.com)$/i.test(window.location.hostname);
  // In Hosting, default to same-origin rewrites unless explicitly pointed to a non-local API
  if (hosted) {
    if (envBase && !/localhost|127\.0\.0\.1/i.test(envBase)) {
      return String(envBase).replace(/\/$/, '');
    }
    return '';
  }
  // Local dev
  return String(envBase || 'http://localhost:5000').replace(/\/$/, '');
}

export function isApiMisconfiguredForHosting() {
  const hosted = typeof window !== 'undefined' && /(?:web\.app|firebaseapp\.com)$/i.test(window.location.hostname);
  if (!hosted) return false;
  const base = getApiBase();
  // Misconfigured only if we somehow end up with an explicit localhost base while hosted.
  return /https?:\/\/(localhost|127\.0\.0\.1)/i.test(base);
}
