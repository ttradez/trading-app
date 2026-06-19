import { Candle, Timeframe } from '../types';
import { CHART_BACKEND_URL } from '../config/chartBackend';

// In dev, reuse the SAME cloudflared tunnel the chart already uses
// (CHART_BACKEND_URL in src/config/chartBackend.ts). The previous
// debuggerHost-based LAN URL — http://<host>:8000 — silently timed out
// from the phone whenever the phone was on cellular or a different
// WiFi than the laptop, which manifested as the News panel spinner
// hanging and `refreshServerXp` repeatedly timing out. Unifying both
// callers on the tunnel fixes both. EXPO_PUBLIC_API_URL still wins if
// the user wants to override.
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__
    ? CHART_BACKEND_URL
    : 'https://api.pockettrade.app'); // production placeholder

async function req<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  // Fail fast if backend is unreachable — no infinite hangs.
  // 30s instead of 10s — session start does a lot of SQLite work and was
  // sometimes finishing right after the old 10s timeout fired.
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('Request timed out — backend unreachable. Check your phone is on the same WiFi as your laptop and the backend is running.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── News (economic calendar) ──────────────────────────────────────────────────
// GET /news returns the day's macro events for the replay clock. Each row
// carries datetime_utc (for "past vs upcoming" comparison against the replay
// bar) and time_local (preformatted HH:MM in the panel's display tz).
//
// time_known=false means the source CSV stored a date but no time — the row
// is still returned so the panel can show it as "All day" instead of
// silently dropping it.

export type NewsImpact = 'high' | 'medium' | 'low' | 'holiday';

export interface NewsEvent {
  datetime_utc: string;     // ISO 8601 with trailing Z, e.g. "2023-06-02T12:30:00Z"
  time_local: string;       // "HH:MM" in the panel's display tz
  currency: string | null;
  impact: NewsImpact | null;
  title: string | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  time_known: boolean;
}

export interface NewsResponse {
  date: string;             // YYYY-MM-DD echoed back
  tz: string;
  events: NewsEvent[];
}

export interface FetchNewsArgs {
  /** Replay day, YYYY-MM-DD in `tz`. */
  date: string;
  /** IANA tz; defines BOTH the day boundary AND each event's time_local. */
  tz?: string;
  /** Comma-separated filter, e.g. "USD" or "USD,EUR". Omit = all. */
  currency?: string;
  /** Threshold: events at or above this impact level. Omit = all. */
  minImpact?: 'high' | 'medium' | 'low';
}

// Surface the resolved BASE_URL at module-load so we can diff against
// CHART_BACKEND_URL (chartBackend.ts) when the phone can hit one but not
// the other — a known cause of XP/news calls timing out.
// eslint-disable-next-line no-console
console.log('[fetchNews] api.ts BASE_URL resolved to:', BASE_URL);

// Tighter timeout than `req`'s 30s default so a non-reachable backend
// surfaces as a clear error in the panel within seconds.
const NEWS_TIMEOUT_MS = 8000;

export async function fetchNews(args: FetchNewsArgs): Promise<NewsResponse> {
  const params = new URLSearchParams({
    date: args.date,
    tz: args.tz ?? 'America/New_York',
  });
  if (args.currency) params.set('currency', args.currency);
  if (args.minImpact) params.set('min_impact', args.minImpact);
  const url = `${BASE_URL}/news?${params.toString()}`;
  // eslint-disable-next-line no-console
  console.log('[fetchNews] BASE_URL=', BASE_URL);
  // eslint-disable-next-line no-console
  console.log('[fetchNews] url=', url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NEWS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    // eslint-disable-next-line no-console
    console.log('[fetchNews] HTTP', res.status, res.statusText || '');
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.log('[fetchNews] error body:', body);
      throw new Error(body || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as NewsResponse;
    // eslint-disable-next-line no-console
    console.log(
      '[fetchNews] success — events count =',
      data.events?.length ?? 0,
      'date =',
      data.date,
    );
    return data;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.log('[fetchNews] FAILED name=', e?.name, 'message=', e?.message);
    if (e?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${NEWS_TIMEOUT_MS}ms. ${BASE_URL} is unreachable from the phone.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Markets ───────────────────────────────────────────────────────────────────

export function fetchMarkets() {
  return req<any[]>('/markets');
}

// ── Candles (market browser preview only) ─────────────────────────────────────

export function fetchCandles(symbol: string, timeframe: Timeframe, limit = 200) {
  return req<Candle[]>(`/candles?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`);
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function upsertUser(uid: string, username: string, email: string) {
  return req('/users', {
    method: 'POST',
    body: JSON.stringify({ uid, username, email }),
  });
}

export function getUser(uid: string) {
  return req<{ uid: string; username: string; email: string }>(`/users/${uid}`);
}

export function getAccount(uid: string) {
  return req<any>(`/users/${uid}/account`);
}

export interface XpEvent {
  id: number;
  session_id: string;
  amount: number;
  reason: string;
  breakdown: {
    base: number;
    multipliers: Array<{ name: string; applied: boolean; factor: number }>;
    product: number;
    final: number;
  };
  created_at: number;
}

/**
 * Phase 2 rank object — returned by /users/{uid}/xp,
 * /users/{uid}/account (as `rank_obj`), and /sessions/{id}/end.
 * Mirrors `_rank_from_xp` in backend/main.py. `division` is null
 * at the top of the ladder (Elite); `is_max` flags that state for
 * the UI so it can swap the progress bar for a "MAX" pill.
 */
export interface RankObj {
  xp: number;
  tier: string;
  division: 'I' | 'II' | 'III' | null;
  level_index: number;
  level_name: string;
  xp_into_level: number;
  next_level_name: string | null;
  xp_for_next: number;
  is_max: boolean;
  emblem_key: string;
}

export interface RankLadderEntry {
  level_index: number;
  tier: string;
  division: 'I' | 'II' | 'III' | null;
  level_name: string;
  threshold: number;
  emblem_key: string;
}

export function getUserXp(uid: string) {
  return req<{ xp_total: number; recent_events: XpEvent[]; rank?: RankObj }>(`/users/${uid}/xp`);
}

export function getRanks() {
  return req<{ ladder: RankLadderEntry[] }>(`/ranks`);
}

export function getTrades(uid: string, limit = 50) {
  return req<any[]>(`/users/${uid}/trades?limit=${limit}`);
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export interface SessionStartResponse {
  session_id: string;
  symbol: string;
  timeframe: string;
  account_size: number;
  balance: number;
  candles: Array<{ bar: number; open: number; high: number; low: number; close: number; volume: number }>;
  current_bar: number;
}

export function getSession(session_id: string): Promise<any> {
  return req(`/sessions/${session_id}`);
}

export function changeSessionTimeframe(session_id: string, timeframe: string): Promise<any> {
  return req(`/sessions/${session_id}/timeframe`, {
    method: 'POST',
    body: JSON.stringify({ timeframe }),
  });
}

export function startSession(
  uid: string,
  username: string,
  symbol: string,
  timeframe: string,
  account_size: number,
  start_time?: number,   // optional unix-seconds override; backend snaps to nearest bar
): Promise<SessionStartResponse> {
  return req('/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ uid, username, symbol, timeframe, account_size, start_time }),
  });
}

export interface AdvanceResponse {
  candles: Array<{ bar: number; open: number; high: number; low: number; close: number; volume: number }>;
  done: boolean;
  auto_closed?: any[];
}

export function advanceSession(session_id: string, count = 1): Promise<AdvanceResponse> {
  return req(`/sessions/${session_id}/advance`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}

export function openTrade(
  session_id: string,
  side: 'buy' | 'sell',
  lots: number,
  stop_loss?: number,
  take_profit?: number,
  entry_price?: number,
) {
  return req<any>(`/sessions/${session_id}/trade`, {
    method: 'POST',
    body: JSON.stringify({ action: 'open', side, lots, stop_loss, take_profit, entry_price }),
  });
}

export function seekSession(session_id: string, target_time: number) {
  return req<any>(`/sessions/${session_id}/seek`, {
    method: 'POST',
    body: JSON.stringify({ target_time }),
  });
}

export function closeTrade(session_id: string, position_id: string) {
  return req<any>(`/sessions/${session_id}/trade`, {
    method: 'POST',
    body: JSON.stringify({ action: 'close', position_id }),
  });
}

export interface SessionEndResponse {
  return_pct: number;
  win_rate: number;
  xp_awarded: number;
  xp_breakdown: XpEvent['breakdown'];
  xp_total: number;
  /** Phase 2 backends include the post-grant rank. Optional for
   *  back-compat with older deployments. */
  rank?: RankObj;
}

export function endSession(session_id: string, final_balance: number, username: string) {
  return req<SessionEndResponse>(`/sessions/${session_id}/end`, {
    method: 'POST',
    body: JSON.stringify({ final_balance, username }),
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export function fetchLeaderboard(period: 'weekly' | 'monthly' | 'alltime') {
  return req<any[]>(`/leaderboard?period=${period}`);
}

// ── Feed ─────────────────────────────────────────────────────────────────────

export function getFeed(limit = 50) {
  return req<any[]>(`/feed?limit=${limit}`);
}

export function postToFeed(uid: string, trade_id: string) {
  return req('/feed/post', {
    method: 'POST',
    body: JSON.stringify({ uid, trade_id }),
  });
}

// ── Groups ────────────────────────────────────────────────────────────────────

export function createGroup(uid: string, name: string) {
  return req<any>('/groups/create', {
    method: 'POST',
    body: JSON.stringify({ uid, name }),
  });
}

export function joinGroup(uid: string, invite_code: string) {
  return req<any>('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ uid, invite_code }),
  });
}

export function getGroupLeaderboard(group_id: number) {
  return req<any[]>(`/groups/${group_id}/leaderboard`);
}
