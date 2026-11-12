/**
 * Environment-aware API origin configuration.
 * - Local development (localhost / 127.0.0.1): uses same-origin ''
 * - Production (Vercel): points to the Railway backend URL
 */
(function () {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  window.DUKAANSAATHI_API_ORIGIN = isLocal
    ? ''
    : 'https://dukaansaathi-backend-production.up.railway.app';
})();
