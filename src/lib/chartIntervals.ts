/**
 * TradingView interval codes -> backend API `timeframe` values.
 *
 * The chart screen tracks intervals in TradingView's resolution format
 * (`'5'`, `'60'`, `'D'`, ...), but the session API expects the backend
 * timeframe string (`'5m'`, `'1h'`, `'1D'`, ...). This map bridges the two.
 *
 * REPO-BOUNDARY NOTE: the hosted chart page (pt-chart-host/index.html) keeps
 * its OWN inline `RESOLUTION_TO_TIMEFRAME` map for the same conversion. A truly
 * shared util can't span the two repos (the hosted HTML can't import from this
 * RN app), so the maps are duplicated by necessity. Keep them consistent in
 * content if either side changes.
 */
export const TV_INTERVAL_TO_API_TF: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  D: '1D',
  '1D': '1D',
  W: '1W',
  '1W': '1W',
};

export function tvIntervalToApiTimeframe(interval: string): string {
  return TV_INTERVAL_TO_API_TF[interval] ?? '5m';
}
