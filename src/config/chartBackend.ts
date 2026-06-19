// DEV ONLY: cloudflared quick-tunnel URL for the chart's data backend.
// This changes every time cloudflared restarts. Update it here and
// rebuild when you start a new tunnel.
// TODO: replace with a stable URL (ngrok static domain or named
// cloudflared tunnel) so we stop rebuilding on every tunnel restart.
export const CHART_BACKEND_URL =
  'https://falling-cologne-studied-price.trycloudflare.com';
