/**
 * Environment-aware API origin configuration.
 * Both local dev (http://localhost:5000) and Vercel production (via vercel.json /api/* rewrite)
 * use same-origin '' so authentication cookies are always first-party.
 */
window.DUKAANSAATHI_API_ORIGIN = '';
