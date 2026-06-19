import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNews, NewsEvent } from '../services/api';

/**
 * NewsPanel — slide-up sheet listing the CURRENT REPLAY DAY's economic
 * events. Date is derived from the chart's last-revealed bar (unix
 * seconds, prop) converted to America/New_York. Re-fetch fires whenever
 * the ET date changes; past/upcoming split recomputes on every render
 * against the same bar time, so as bars advance the divider moves
 * without a refetch.
 *
 * Only USD events for now (matches the chart focus on US futures /
 * macro news). The All / High filter is purely client-side — the API
 * call always asks for everything so toggling doesn't refetch.
 */

const NY_TZ = 'America/New_York';

// Brand palette (raw hex — no theme dependency so the panel stays
// self-contained alongside the other sheet components).
const PANEL_BG      = '#0F0F0F';
const PANEL_BORDER  = '#1F1F1F';
const TEXT_PRIMARY  = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.72)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.45)';
const RED           = '#FF4757';
const ORANGE        = '#F59E0B';
const GREEN         = '#00D395';
const GOLD          = '#FFB800';

type ImpactFilter = 'all' | 'high';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Current replay bar time in unix SECONDS. Drives BOTH the date to
   *  fetch AND the past/upcoming split. null when no session is open. */
  currentBarTimeSec: number | null;
}

/** YYYY-MM-DD in America/New_York for the given unix seconds. */
function etDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y   = parts.find((p) => p.type === 'year')?.value   ?? '';
  const m   = parts.find((p) => p.type === 'month')?.value  ?? '';
  const day = parts.find((p) => p.type === 'day')?.value    ?? '';
  return `${y}-${m}-${day}`;
}

/** "2023-06-02" → "Fri, Jun 2, 2023" (display tz neutral). */
function formatPrettyDate(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  // Noon UTC so the device tz can't roll the day forward or backward.
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function impactColor(impact: NewsEvent['impact']): string {
  if (impact === 'high')   return RED;
  if (impact === 'medium') return ORANGE;
  if (impact === 'low')    return TEXT_TERTIARY;
  return TEXT_TERTIARY;
}

export default function NewsPanel({ visible, onClose, currentBarTimeSec }: Props) {
  const date = currentBarTimeSec != null ? etDate(currentBarTimeSec) : null;

  const [events, setEvents]   = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [filter, setFilter]   = useState<ImpactFilter>('all');

  // Re-fetch when the panel opens AND whenever the replay day rolls
  // over (the etDate changes). Inside the same day, advances only
  // update currentBarTimeSec → no refetch.
  useEffect(() => {
    if (!visible) return;
    if (!date) {
      setEvents([]);
      setLoading(false);
      setErr('Open a replay session to see news for the day.');
      // eslint-disable-next-line no-console
      console.log('[NewsPanel] open without currentBarTimeSec — no fetch');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setEvents([]);
    // eslint-disable-next-line no-console
    console.log('[NewsPanel] fetch start date=', date);
    fetchNews({ date, tz: NY_TZ, currency: 'USD' })
      .then((res) => {
        // eslint-disable-next-line no-console
        console.log(
          '[NewsPanel] fetch resolved — events =',
          res.events.length,
          'cancelled =',
          cancelled,
        );
        if (!cancelled) setEvents(res.events);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.log(
          '[NewsPanel] fetch FAILED:',
          e?.message ?? String(e),
          'cancelled =',
          cancelled,
        );
        if (!cancelled) setErr(e?.message ?? 'Could not load news');
      })
      .finally(() => {
        // Always exit loading even if the effect was cancelled — the
        // panel will start a fresh fetch on the next open if needed.
        // Leaving loading=true forever was the original "stuck spinner"
        // failure mode.
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, date]);

  // Split past vs upcoming each render — keyed on currentBarTimeSec so
  // an advance updates the "now" line in real-time without refetching.
  const { pastEvents, upcomingEvents, filteredCount } = useMemo(() => {
    const filtered = filter === 'high'
      ? events.filter((e) => e.impact === 'high')
      : events;
    const nowMs = currentBarTimeSec != null ? currentBarTimeSec * 1000 : Date.now();
    const past: NewsEvent[] = [];
    const upcoming: NewsEvent[] = [];
    for (const e of filtered) {
      const ts = Date.parse(e.datetime_utc);
      if (Number.isNaN(ts)) {
        upcoming.push(e);
        continue;
      }
      if (ts <= nowMs) past.push(e);
      else upcoming.push(e);
    }
    return { pastEvents: past, upcomingEvents: upcoming, filteredCount: filtered.length };
  }, [events, currentBarTimeSec, filter]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => { /* swallow */ }}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>NEWS · USD</Text>
              <Text style={styles.title}>
                {date ? formatPrettyDate(date) : 'News'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close news"
            >
              <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            <FilterPill
              label="All"
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterPill
              label="High only"
              active={filter === 'high'}
              onPress={() => setFilter('high')}
            />
          </View>

          {loading && (
            <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
          )}
          {err && !loading && (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={36} color={TEXT_TERTIARY} />
              <Text style={styles.emptyTitle}>News unavailable</Text>
              <Text style={styles.emptySub}>{err}</Text>
            </View>
          )}
          {!loading && !err && filteredCount === 0 && (
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={36} color={TEXT_TERTIARY} />
              <Text style={styles.emptyTitle}>No events</Text>
              <Text style={styles.emptySub}>
                {filter === 'high'
                  ? 'No high-impact USD events today. Try All.'
                  : 'No USD events scheduled for this date.'}
              </Text>
            </View>
          )}

          {!loading && !err && filteredCount > 0 && (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {pastEvents.map((e, i) => (
                <EventRow key={`p-${i}`} event={e} past />
              ))}
              {pastEvents.length > 0 && upcomingEvents.length > 0 && (
                <View style={styles.nowDivider}>
                  <View style={styles.dividerLine} />
                  <View style={styles.nowPill}>
                    <View style={styles.nowDot} />
                    <Text style={styles.nowText}>NOW</Text>
                  </View>
                  <View style={styles.dividerLine} />
                </View>
              )}
              {upcomingEvents.map((e, i) => (
                <EventRow key={`u-${i}`} event={e} past={false} />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterPill({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EventRow({ event, past }: { event: NewsEvent; past: boolean }) {
  const timeStr = event.time_known ? event.time_local : 'All day';
  const hasNumbers = !!(event.actual || event.forecast || event.previous);
  return (
    <View style={[styles.row, past && styles.rowPast]}>
      <View style={[styles.impactDot, { backgroundColor: impactColor(event.impact) }]} />
      <Text style={[styles.timeCol, past && styles.textDimmed]} numberOfLines={1}>
        {timeStr}
      </Text>
      <View style={styles.bodyCol}>
        <View style={styles.titleRow}>
          <View style={styles.currencyChip}>
            <Text style={[styles.currencyChipText, past && styles.textDimmed]}>
              {event.currency ?? '—'}
            </Text>
          </View>
          <Text
            style={[styles.titleText, past && styles.textDimmed]}
            numberOfLines={2}
          >
            {event.title ?? ''}
          </Text>
          {past && (
            <Ionicons
              name="checkmark"
              size={14}
              color={GREEN}
              style={{ marginLeft: 6, marginTop: 1 }}
            />
          )}
        </View>
        {hasNumbers && (
          <View style={styles.afpRow}>
            <AfpStat label="A" value={event.actual} past={past} />
            <AfpStat label="F" value={event.forecast} past={past} />
            <AfpStat label="P" value={event.previous} past={past} />
          </View>
        )}
      </View>
    </View>
  );
}

function AfpStat({
  label, value, past,
}: { label: string; value: string | null; past: boolean }) {
  return (
    <View style={styles.afpStat}>
      <Text style={[styles.afpLabel, past && styles.textDimmed]}>{label}</Text>
      <Text style={[styles.afpValue, past && styles.textDimmed]}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Transparent so the chart underneath stays at full brightness
    // — the news panel just slides up over it, no dimming. The
    // Pressable still receives tap-outside-to-close events; its
    // hitbox doesn't need a visible background.
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: PANEL_BG,
    borderTopWidth: 1,
    borderTopColor: PANEL_BORDER,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 10,
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 4,
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillActive: {
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderColor: GOLD,
  },
  pillText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: GOLD,
  },

  empty: {
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    color: TEXT_TERTIARY,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
  },
  rowPast: {
    opacity: 0.55,
  },
  impactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    marginRight: 10,
  },
  timeCol: {
    width: 58,
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  bodyCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  currencyChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  currencyChipText: {
    color: TEXT_PRIMARY,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  titleText: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  textDimmed: {
    color: TEXT_TERTIARY,
  },
  afpRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 16,
  },
  afpStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  afpLabel: {
    color: TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  afpValue: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  nowDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD,
    opacity: 0.5,
  },
  nowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,0,0.18)',
    borderWidth: 1,
    borderColor: GOLD,
    gap: 5,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  nowText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
