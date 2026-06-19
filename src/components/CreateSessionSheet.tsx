import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { useAuthStore } from '../store/authStore';

/**
 * CreateSessionSheet — full-screen wizard for starting a fresh replay
 * session. Rebuilt to match the "Replay Session" mockup: header with
 * back arrow + wordmark, ES/NQ toggle, Start/End date fields driven by
 * a `react-native-calendars` month grid (with a tappable year overlay
 * for jumping across the 2020–2025 data window), quick-add pills, an
 * OR divider, a Random Session card, an Auto-update end-date toggle,
 * a How-it-works info card, and a gold gradient "Start Replay Session"
 * CTA.
 *
 * Props are unchanged — SessionsScreen still passes {visible, onClose,
 * onSessionCreated}. The Modal is rendered with presentationStyle
 * "fullScreen" so it owns the whole viewport; the back arrow calls
 * onClose, returning to the Continue list.
 *
 * On submit: POST /sessions/start with the assembled body. The
 * "Start Replay Session" path always includes start_time + (optionally)
 * end_time when auto-update is OFF; the Random Session card posts the
 * body without start/end so the backend's `_pick_random_start` runs.
 */

const SYMBOLS: Array<'ES' | 'NQ' | 'YM' | 'GC'> = ['NQ', 'ES', 'YM', 'GC'];

// Badge content per symbol — shown in the colored circle inside each
// pill. Index futures show their underlying index (NQ→100, ES→500,
// YM→30 for the Dow 30). Gold uses "OZ" since the contract is priced
// per ounce. Add new symbols here when extending SYMBOLS.
const BADGE_LABEL: Record<typeof SYMBOLS[number], string> = {
  NQ: '100',
  ES: '500',
  YM: '30',
  GC: 'OZ',
};
const DEFAULT_ACCOUNT_SIZE = 50000; // preserved from the previous sheet
const DEFAULT_TIMEFRAME = '5m';

interface SymbolRange {
  min_time: number; // unix seconds
  max_time: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Fired with the new session_id (+ symbol/tf) on a successful create. */
  onSessionCreated: (sessionId: string, symbol: string, timeframe: string) => void;
}

export default function CreateSessionSheet({
  visible,
  onClose,
  onSessionCreated,
}: Props) {
  const uid = useAuthStore((s) => s.uid);
  const username = useAuthStore((s) => s.username);
  const insets = useSafeAreaInsets();

  const [symbol, setSymbol] = useState<typeof SYMBOLS[number]>('NQ');

  // Dates stored as ISO yyyy-mm-dd strings — that's the shape react-native-calendars
  // emits and consumes. Converted to unix seconds (UTC midnight) on submit.
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Which date the calendar modal is editing (null = closed).
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  const [symbolRange, setSymbolRange] = useState<SymbolRange | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset transient state every time the screen closes so the next open
  // starts fresh.
  useEffect(() => {
    if (!visible) {
      setSubmitError(null);
      setSubmitting(false);
      setPickerTarget(null);
    }
  }, [visible]);

  // Fetch the candle data range for the active symbol when the screen is
  // visible. Drives min/max bounds on the calendar.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setRangeLoading(true);
    (async () => {
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/symbols/${symbol}/range`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SymbolRange = await res.json();
        if (cancelled) return;
        setSymbolRange(data);
      } catch {
        if (cancelled) return;
        setSymbolRange(null);
      } finally {
        if (!cancelled) setRangeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, symbol]);

  // Derived ISO bounds for the calendar. Defaults span the known
  // Databento window (2020-04 → 2025-04) until the API responds.
  const minDateISO = useMemo(
    () => (symbolRange ? toISODate(symbolRange.min_time * 1000) : '2020-04-01'),
    [symbolRange],
  );
  const maxDateISO = useMemo(
    () => (symbolRange ? toISODate(symbolRange.max_time * 1000) : '2025-04-30'),
    [symbolRange],
  );

  const minYear = useMemo(() => Number(minDateISO.slice(0, 4)), [minDateISO]);
  const maxYear = useMemo(() => Number(maxDateISO.slice(0, 4)), [maxDateISO]);

  // Quick-add: bump End by N days/weeks/months/year relative to Start.
  // Cap at maxDateISO so we never exceed the data window.
  const applyQuickAdd = useCallback(
    (kind: '1D' | '1W' | '1M' | '3M' | '1Y') => {
      if (!startDate) return;
      const base = isoToDate(startDate);
      const next = new Date(base);
      if (kind === '1D') next.setUTCDate(next.getUTCDate() + 1);
      else if (kind === '1W') next.setUTCDate(next.getUTCDate() + 7);
      else if (kind === '1M') next.setUTCMonth(next.getUTCMonth() + 1);
      else if (kind === '3M') next.setUTCMonth(next.getUTCMonth() + 3);
      else if (kind === '1Y') next.setUTCFullYear(next.getUTCFullYear() + 1);
      const maxDate = isoToDate(maxDateISO);
      if (next > maxDate) next.setTime(maxDate.getTime());
      setEndDate(toISODate(next.getTime()));
    },
    [startDate, maxDateISO],
  );

  const closePicker = useCallback(() => setPickerTarget(null), []);

  // Common POST helper — handles the Random Session card and the
  // Start Replay Session CTA. The Random path passes null for
  // start_time/end_time; the dated path supplies both (end_time only
  // when auto-update is OFF).
  const submit = useCallback(
    async (
      mode: 'random' | 'dated',
    ) => {
      if (!uid || submitting) return;
      if (mode === 'dated') {
        if (!startDate || !endDate) {
          setSubmitError('Pick both a Start and an End date.');
          return;
        }
        if (isoToDate(endDate) <= isoToDate(startDate)) {
          setSubmitError('End date must be after Start date.');
          return;
        }
      }

      const body: Record<string, unknown> = {
        uid,
        username,
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        account_size: DEFAULT_ACCOUNT_SIZE,
        start_time: null,
      };
      if (mode === 'dated' && startDate) {
        body.start_time = Math.floor(isoToDate(startDate).getTime() / 1000);
        if (endDate) {
          body.end_time = Math.floor(isoToDate(endDate).getTime() / 1000);
        }
      }

      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.session_id) throw new Error('Missing session_id');
        onSessionCreated(data.session_id, symbol, DEFAULT_TIMEFRAME);
      } catch (err: any) {
        setSubmitError(
          err && err.message
            ? `Couldn't create session: ${err.message}`
            : "Couldn't create session",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [uid, username, submitting, symbol, startDate, endDate, onSessionCreated],
  );

  const datesReady = !!startDate && !!endDate;
  const startBtnDisabled = submitting || !uid || !datesReady;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {/* ── Header: back arrow + wordmark ─────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to sessions"
          >
            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.wordmark}>PIP</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Title + subtitle ──────────────────────────────────────── */}
          <Text style={styles.title}>Replay Session</Text>
          <Text style={styles.subtitle}>
            Practice your strategy in real market conditions by replaying historical sessions.
          </Text>

          {/* ── Symbol toggle (ES / NQ) ───────────────────────────────── */}
          <View style={styles.symbolRow}>
            {SYMBOLS.map((sym) => {
              const selected = sym === symbol;
              return (
                <Pressable
                  key={sym}
                  onPress={() => setSymbol(sym)}
                  style={({ pressed }) => [
                    styles.symbolPill,
                    selected && styles.symbolPillSelected,
                    pressed && !selected && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Symbol ${sym}`}
                >
                  <View
                    style={[
                      styles.symbolBadge,
                      sym === 'NQ' && styles.symbolBadgeNq,
                      sym === 'ES' && styles.symbolBadgeEs,
                      sym === 'YM' && styles.symbolBadgeYm,
                      sym === 'GC' && styles.symbolBadgeGc,
                    ]}
                  >
                    <Text style={styles.symbolBadgeText}>{BADGE_LABEL[sym]}</Text>
                  </View>
                  <Text
                    style={[
                      styles.symbolPillText,
                      selected && styles.symbolPillTextSelected,
                    ]}
                  >
                    {sym}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Start Date ────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Start Date</Text>
          <Pressable
            onPress={() => setPickerTarget('start')}
            disabled={rangeLoading}
            style={({ pressed }) => [
              styles.dateField,
              pressed && styles.pressed,
              rangeLoading && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pick start date"
          >
            <Text
              style={[
                styles.dateFieldText,
                !startDate && styles.dateFieldPlaceholder,
              ]}
            >
              {startDate ? formatDisplay(startDate) : 'Select start date'}
            </Text>
            <Ionicons name="calendar-outline" size={22} color={colors.gold} />
          </Pressable>

          {/* ── End Date ──────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>End Date</Text>
          <Pressable
            onPress={() => setPickerTarget('end')}
            disabled={rangeLoading || !startDate}
            style={({ pressed }) => [
              styles.dateField,
              pressed && styles.pressed,
              (rangeLoading || !startDate) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pick end date"
          >
            <Text
              style={[
                styles.dateFieldText,
                !endDate && styles.dateFieldPlaceholder,
              ]}
            >
              {endDate ? formatDisplay(endDate) : 'Select end date'}
            </Text>
            <Ionicons name="calendar-outline" size={22} color={colors.gold} />
          </Pressable>

          {/* ── Quick-add pills ───────────────────────────────────────── */}
          <View style={styles.quickAddRow}>
            {(['1D', '1W', '1M', '3M', '1Y'] as const).map((kind) => (
              <Pressable
                key={kind}
                onPress={() => applyQuickAdd(kind)}
                disabled={!startDate}
                style={({ pressed }) => [
                  styles.quickAddPill,
                  pressed && styles.pressed,
                  !startDate && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Set end date to start plus ${kind}`}
              >
                <Text style={styles.quickAddText}>+{kind}</Text>
              </Pressable>
            ))}
          </View>
          {!startDate && (
            <Text style={styles.hintText}>Pick a start date first</Text>
          )}

          {/* ── OR divider ────────────────────────────────────────────── */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {/* ── Random Session card ───────────────────────────────────── */}
          <Pressable
            onPress={() => submit('random')}
            disabled={submitting || !uid}
            style={({ pressed }) => [
              styles.randomCard,
              pressed && styles.pressed,
              (submitting || !uid) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start a random replay session"
          >
            <View style={styles.randomIconWrap}>
              <Ionicons name="dice-outline" size={28} color={colors.gold} />
            </View>
            <View style={styles.randomTextWrap}>
              <Text style={styles.randomTitle}>Random Session</Text>
              <Text style={styles.randomBody}>
                Jump into a random time in the past and start trading.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.gold} />
          </Pressable>

          {/* ── How it works card ─────────────────────────────────────── */}
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={colors.gold}
              style={styles.infoIcon}
            />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoBody}>
                You'll be taken to a random historical point (or your selected range) and can practice as if it's live. No data is changed. All trades are simulated.
              </Text>
            </View>
          </View>

          {submitError && <Text style={styles.errorText}>{submitError}</Text>}

          {/* ── Start Replay Session CTA ──────────────────────────────── */}
          <Pressable
            onPress={() => submit('dated')}
            disabled={startBtnDisabled}
            style={({ pressed }) => [
              styles.ctaWrap,
              pressed && !startBtnDisabled && styles.pressed,
              startBtnDisabled && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start replay session"
          >
            <LinearGradient
              colors={['#FFD24D', '#FFB800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Text style={styles.ctaLabel}>Start Replay Session</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>

        {/* ── Calendar modal ──────────────────────────────────────────── */}
        <CalendarPicker
          visible={pickerTarget !== null}
          target={pickerTarget}
          minDateISO={pickerTarget === 'end' && startDate ? startDate : minDateISO}
          maxDateISO={maxDateISO}
          minYear={minYear}
          maxYear={maxYear}
          currentValue={pickerTarget === 'start' ? startDate : endDate}
          onSelect={(iso) => {
            if (pickerTarget === 'start') {
              setStartDate(iso);
              // If the existing end date is now before the new start, clear it.
              if (endDate && isoToDate(endDate) <= isoToDate(iso)) {
                setEndDate(null);
              }
            } else if (pickerTarget === 'end') {
              setEndDate(iso);
            }
            closePicker();
          }}
          onClose={closePicker}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CalendarPicker — a modal overlay containing the month-grid calendar plus
// a tappable year overlay for jumping across the multi-year data window.
// ──────────────────────────────────────────────────────────────────────────────

interface CalendarPickerProps {
  visible: boolean;
  target: 'start' | 'end' | null;
  minDateISO: string;
  maxDateISO: string;
  minYear: number;
  maxYear: number;
  currentValue: string | null;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

function CalendarPicker({
  visible,
  target,
  minDateISO,
  maxDateISO,
  minYear,
  maxYear,
  currentValue,
  onSelect,
  onClose,
}: CalendarPickerProps) {
  // The calendar's currently-displayed month (yyyy-mm-dd of the 1st).
  // Initialized from currentValue or clamped to the data range.
  const initialMonth = useMemo(() => {
    if (currentValue) return currentValue;
    const today = toISODate(Date.now());
    if (today < minDateISO) return minDateISO;
    if (today > maxDateISO) return maxDateISO;
    return today;
  }, [currentValue, minDateISO, maxDateISO]);

  const [displayMonth, setDisplayMonth] = useState(initialMonth);
  const [yearOverlay, setYearOverlay] = useState(false);

  // Reset month + close year overlay every time the picker re-opens.
  useEffect(() => {
    if (visible) {
      setDisplayMonth(initialMonth);
      setYearOverlay(false);
    }
  }, [visible, initialMonth]);

  const markedDates = useMemo(() => {
    if (!currentValue) return {};
    return {
      [currentValue]: {
        selected: true,
        selectedColor: colors.gold,
        selectedTextColor: colors.textInverse,
      },
    };
  }, [currentValue]);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = minYear; y <= maxYear; y++) out.push(y);
    return out;
  }, [minYear, maxYear]);

  const handleYearPick = useCallback(
    (year: number) => {
      // Jump to January of that year, clamped to [minDateISO, maxDateISO].
      let iso = `${year}-01-01`;
      if (iso < minDateISO) iso = minDateISO;
      if (iso > maxDateISO) iso = maxDateISO;
      setDisplayMonth(iso);
      setYearOverlay(false);
    },
    [minDateISO, maxDateISO],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.calBackdrop} onPress={onClose}>
        <Pressable style={styles.calCard} onPress={() => {}}>
          <Text style={styles.calHeading}>
            {target === 'start' ? 'Start Date' : 'End Date'}
          </Text>

          {yearOverlay ? (
            <View style={styles.yearOverlayWrap}>
              <FlatList
                data={years}
                keyExtractor={(y) => String(y)}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleYearPick(item)}
                    style={({ pressed }) => [
                      styles.yearRow,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Jump to ${item}`}
                  >
                    <Text style={styles.yearRowText}>{item}</Text>
                  </Pressable>
                )}
              />
            </View>
          ) : (
            <Calendar
              key={displayMonth}
              current={displayMonth}
              minDate={minDateISO}
              maxDate={maxDateISO}
              onDayPress={(d) => onSelect(d.dateString)}
              markedDates={markedDates}
              enableSwipeMonths
              renderHeader={(date: any) => {
                const d: Date = date instanceof Date ? date : new Date(date);
                const monthName = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
                const year = d.getUTCFullYear();
                return (
                  <View style={styles.calHeaderRow}>
                    <Text style={styles.calHeaderMonth}>{monthName}</Text>
                    <Pressable
                      onPress={() => setYearOverlay(true)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.calYearBtn,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Jump to year"
                    >
                      <Text style={styles.calYearBtnText}>{year}</Text>
                      <Ionicons name="chevron-down" size={14} color={colors.gold} />
                    </Pressable>
                  </View>
                );
              }}
              theme={{
                calendarBackground: colors.card,
                backgroundColor: colors.card,
                textSectionTitleColor: 'rgba(255,255,255,0.55)',
                dayTextColor: colors.textPrimary,
                todayTextColor: colors.gold,
                selectedDayBackgroundColor: colors.gold,
                selectedDayTextColor: colors.textInverse,
                monthTextColor: colors.textPrimary,
                textDisabledColor: 'rgba(255,255,255,0.20)',
                arrowColor: colors.gold,
              }}
            />
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.calCloseBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
          >
            <Text style={styles.calCloseLabel}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Date helpers — all calendar dates are UTC midnight to stay timezone-stable.
// ──────────────────────────────────────────────────────────────────────────────

function toISODate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string): Date {
  // Parse yyyy-mm-dd as UTC midnight so the resulting unix epoch matches
  // the dataset's UTC time column.
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDisplay(iso: string): string {
  try {
    return isoToDate(iso).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // ── Title block ─────────────────────────────────────────────────────
  title: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },

  // ── Symbol pills ────────────────────────────────────────────────────
  symbolRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  symbolPill: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 10,
  },
  symbolPillSelected: {
    backgroundColor: colors.gold,
  },
  symbolPillText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  symbolPillTextSelected: {
    color: colors.textInverse,
  },
  symbolBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeNq: {
    backgroundColor: '#2962FF',
  },
  symbolBadgeEs: {
    backgroundColor: '#F23645',
  },
  // Dow E-mini — deep blue chosen to be distinct from NQ's brighter blue
  // and from ES's red, so the four-pill row reads at a glance.
  symbolBadgeYm: {
    backgroundColor: '#0EA968',
  },
  // Gold futures — orange-gold, deliberately darker than the brand
  // gold (#FFB800) used as the pill's selected-state background, so
  // the badge stays visible when GC is the active selection.
  symbolBadgeGc: {
    backgroundColor: '#C9742F',
  },
  symbolBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // ── Section labels ──────────────────────────────────────────────────
  sectionLabel: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // ── Date fields ─────────────────────────────────────────────────────
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateFieldText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  dateFieldPlaceholder: {
    color: 'rgba(255,255,255,0.50)',
    fontWeight: '500',
  },

  // ── Quick-add pills ─────────────────────────────────────────────────
  quickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  quickAddPill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  quickAddText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  hintText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },

  // ── OR divider ──────────────────────────────────────────────────────
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 18,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },

  // ── Random Session card ─────────────────────────────────────────────
  randomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    gap: 14,
  },
  randomIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,184,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomTextWrap: {
    flex: 1,
  },
  randomTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  randomBody: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Info cards (auto-update toggle + how-it-works) ──────────────────
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoBody: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Submit CTA ──────────────────────────────────────────────────────
  errorText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 8,
  },
  ctaWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  ctaLabel: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },

  // ── Calendar modal ──────────────────────────────────────────────────
  calBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  calCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 12,
  },
  calHeading: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  calHeaderMonth: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  calYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.45)',
  },
  calYearBtnText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  calCloseBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  calCloseLabel: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Year overlay ────────────────────────────────────────────────────
  yearOverlayWrap: {
    maxHeight: 320,
    marginTop: 4,
  },
  yearRow: {
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  yearRowText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
