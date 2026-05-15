/**
 * Static economic-calendar dataset for the replay-trading chart.
 *
 * 2022 events only — the app's hardcoded replay scenarios live in
 * 2022 (NQ 2022-09-13 CPI day on the onboarding screen, etc.).
 * Expand to 2021 / 2023 / 2024 as historical data coverage grows.
 *
 * Times are EASTERN TIME (the U.S. data calendar's native zone) in
 * 24-hour HH:MM. Dates are YYYY-MM-DD. The chart screen converts
 * its replay clock to a NY-zone date string before calling
 * `getEventsForDate`, so the date axis matches regardless of the
 * user's device timezone.
 *
 * Schema is deliberately minimal — actual / forecast / previous
 * values would require a richer dataset; deferred. Impact is
 * `'high' | 'medium' | 'low'`; v1 dataset is mostly high-impact
 * with quarterly GDP at medium.
 */

export type EventImpact = 'high' | 'medium' | 'low';

export interface EconomicEvent {
  /** YYYY-MM-DD, U.S. Eastern calendar date the event was released. */
  date: string;
  /** HH:MM in 24-hour Eastern Time. */
  time: string;
  /** Display name. e.g. "CPI - Consumer Price Index". */
  name: string;
  impact: EventImpact;
  /** Short category label. e.g. "Inflation", "Employment". */
  category: string;
}

const CPI_NAME  = 'CPI - Consumer Price Index';
const NFP_NAME  = 'Nonfarm Payrolls';
const FOMC_NAME = 'FOMC Rate Decision';
const GDP_NAME  = 'GDP Advance Estimate';

const EVENTS: ReadonlyArray<EconomicEvent> = [
  // ── CPI — monthly, 8:30 AM ET, high impact ───────────────────
  { date: '2022-01-12', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-02-10', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-03-10', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-04-12', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-05-11', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-06-10', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-07-13', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-08-10', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-09-13', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-10-13', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-11-10', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },
  { date: '2022-12-13', time: '08:30', name: CPI_NAME, impact: 'high', category: 'Inflation' },

  // ── NFP — first Friday, 8:30 AM ET, high impact ──────────────
  { date: '2022-01-07', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-02-04', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-03-04', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-04-01', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-05-06', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-06-03', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-07-08', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-08-05', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-09-02', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-10-07', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-11-04', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },
  { date: '2022-12-02', time: '08:30', name: NFP_NAME, impact: 'high', category: 'Employment' },

  // ── FOMC — 8 meetings/yr, 2:00 PM ET, high impact ────────────
  { date: '2022-01-26', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-03-16', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-05-04', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-06-15', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-07-27', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-09-21', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-11-02', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },
  { date: '2022-12-14', time: '14:00', name: FOMC_NAME, impact: 'high', category: 'Interest Rates' },

  // ── GDP — quarterly advance estimates, 8:30 AM ET, medium ────
  { date: '2022-01-27', time: '08:30', name: GDP_NAME, impact: 'medium', category: 'Growth' },
  { date: '2022-03-30', time: '08:30', name: GDP_NAME, impact: 'medium', category: 'Growth' },
  { date: '2022-06-29', time: '08:30', name: GDP_NAME, impact: 'medium', category: 'Growth' },
  { date: '2022-09-29', time: '08:30', name: GDP_NAME, impact: 'medium', category: 'Growth' },
];

/** Look up events for a single calendar date. The returned array is
 *  a fresh copy sorted by `time` (ascending). Returns `[]` if no
 *  events for the date — callers don't have to null-check. */
export function getEventsForDate(dateString: string): EconomicEvent[] {
  return EVENTS
    .filter((e) => e.date === dateString)
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Total event count for the loaded dataset — handy for analytics
 *  and the WORK_LOG smoke check. */
export const ECONOMIC_EVENT_COUNT = EVENTS.length;
