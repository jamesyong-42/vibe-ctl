/**
 * Content-Security-Policy builder (spec 05 §8.1).
 *
 * Two modes:
 *
 *   **Production** (no `ELECTRON_RENDERER_URL`): strict — no inline
 *   scripts, no eval, no external origins.
 *
 *   **Dev** (`ELECTRON_RENDERER_URL` set): carve out the three things
 *   Vite's HMR runtime needs and nothing else:
 *     - `'unsafe-inline'` on `script-src` so Vite's preamble injection
 *       can execute
 *     - `'unsafe-eval'` on `script-src` so Vite's client can eval HMR
 *       payloads
 *     - the dev server origin on `script-src` and `connect-src` so the
 *       renderer can fetch modules and open the HMR WebSocket
 *
 * `style-src 'unsafe-inline'` is always present — Tailwind v4 + React
 * inline styles require it (documented in spec 05 §8.1).
 *
 * `ELECTRON_RENDERER_URL` is set by electron-vite in dev and absent in
 * packaged builds, so it's a reliable mode switch.
 */

export function buildCsp(): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const wsUrl = devUrl?.replace(/^http/, 'ws');

  const scriptSrc = devUrl ? `'self' 'unsafe-inline' 'unsafe-eval' ${devUrl}` : "'self'";
  const connectSrc = devUrl ? `'self' ${devUrl} ${wsUrl}` : "'self'";

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': scriptSrc,
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: blob: host: plugin:",
    'font-src': "'self' data:",
    'connect-src': connectSrc,
    'media-src': "'self' blob: host: plugin:",
    'worker-src': "'self' blob:",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
  };

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join('; ');
}
