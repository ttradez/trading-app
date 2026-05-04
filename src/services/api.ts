import { Candle, Timeframe } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
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

export function getAccount(uid: string) {
  return req<any>(`/users/${uid}/account`);
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

export function startSession(
  uid: string,
  username: string,
  symbol: string,
  timeframe: string,
  account_size: number,
): Promise<SessionStartResponse> {
  return req('/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ uid, username, symbol, timeframe, account_size }),
  });
}

export interface AdvanceResponse {
  candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>;
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
) {
  return req<any>(`/sessions/${session_id}/trade`, {
    method: 'POST',
    body: JSON.stringify({ action: 'open', side, lots, stop_loss, take_profit }),
  });
}

export function closeTrade(session_id: string, position_id: string) {
  return req<any>(`/sessions/${session_id}/trade`, {
    method: 'POST',
    body: JSON.stringify({ action: 'close', position_id }),
  });
}

export function endSession(session_id: string, final_balance: number, username: string) {
  return req<any>(`/sessions/${session_id}/end`, {
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
