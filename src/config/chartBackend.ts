// Production backend — Railway deployment.
// Volume seeded 2026-06-19 with ES/NQ/YM/GC market candles.
//
// If you ever need to fall back to a local dev tunnel, replace this
// constant with the cloudflared quick-tunnel URL — they're plain
// strings, swap freely. Production builds should always ship the
// Railway URL below.
export const CHART_BACKEND_URL =
  'https://trading-app-production-1423.up.railway.app';
