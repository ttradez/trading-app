import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, borders, surface } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { useAuthStore } from '../store/authStore';
import CreateSessionSheet from '../components/CreateSessionSheet';
import SelectCircle from '../components/SelectCircle';

/**
 * One row in the GET /users/{uid}/sessions response. `progress_pct` is
 * only present when the session was created with an end_time bound;
 * see the backend handler docstring.
 */
export interface SessionListItem {
  session_id: string;
  symbol: string;
  timeframe: string;
  start_time: number;
  end_time: number | null;
  current_time: number;
  created_at: number;
  status: string;
  trade_count: number;
  realized_pnl: number;
  account_size: number;
  progress_pct?: number;
}

interface Props {
  /** Called with a session_id when the user taps a Continue card OR
   *  when the create flow successfully starts a new session. Parent
   *  switches to the chart with that session loaded. */
  onSessionSelected: (sessionId: string, symbol: string, timeframe: string) => void;
}

/**
 * SessionsScreen — entry point inside the Chart tab. Shown when the
 * user has no active session selected. Two sections:
 *
 *  • Continue — vertical list of the user's existing sessions, newest
 *    first. Tapping a card resumes that session on the chart.
 *  • New Session — a gold button that opens the CreateSessionSheet.
 *
 * Reads `uid` reactively from useAuthStore so a late auth hydration
 * triggers the fetch once the user is known (mirrors ChartScreen's
 * pattern). On uid-less mount we render a soft "Sign in to trade"
 * fallback rather than fetching with an empty uid.
 */
export default function SessionsScreen({ onSessionSelected }: Props) {
  const uid = useAuthStore((s) => s.uid);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // iOS-style Edit/Done mode for bulk-delete. Circles only render
  // (and rows become tap-inert) while editMode is true.
  const [editMode, setEditMode] = useState(false);
  // Selection state for the bulk-delete UX. Held as a Set for O(1)
  // membership checks per row render.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Standalone fetch helper so both the initial load AND pull-to-refresh
  // share one code path. cancel-on-unmount via the outer effect's flag.
  const fetchSessions = useCallback(
    async (signal: { cancelled: boolean }) => {
      if (!uid) return;
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/users/${uid}/sessions`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SessionListItem[] = await res.json();
        if (signal.cancelled) return;
        setSessions(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err: any) {
        if (signal.cancelled) return;
        setError(
          err && err.message ? `Couldn't load sessions: ${err.message}` : "Couldn't load sessions",
        );
      }
    },
    [uid],
  );

  // Initial load whenever uid resolves / changes.
  useEffect(() => {
    const signal = { cancelled: false };
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return () => {
        signal.cancelled = true;
      };
    }
    setLoading(true);
    fetchSessions(signal).finally(() => {
      if (!signal.cancelled) setLoading(false);
    });
    return () => {
      signal.cancelled = true;
    };
  }, [uid, fetchSessions]);

  const handleRefresh = useCallback(async () => {
    const signal = { cancelled: false };
    setRefreshing(true);
    await fetchSessions(signal);
    setRefreshing(false);
  }, [fetchSessions]);

  // When the create sheet hands back a freshly-started session id, we
  // ALSO refresh our local list (so a quick back-out re-enters with the
  // new session visible) and dispatch upward to load the chart.
  const handleSessionCreated = useCallback(
    (sessionId: string, symbol: string, timeframe: string) => {
      setCreateOpen(false);
      onSessionSelected(sessionId, symbol, timeframe);
    },
    [onSessionSelected],
  );

  // Bulk-delete the currently selected sessions. Confirms with a
  // native Alert, then fires `DELETE /sessions/{id}?uid=...` in
  // parallel. Successful ids are removed from local state and the
  // selection is cleared; any failure surfaces an alert + refetch.
  // Always exits edit mode after a delete attempt (success OR
  // failure) so the user lands back on the read-only list.
  const handleBulkDelete = useCallback(() => {
    if (!uid) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      `Delete ${ids.length} session${ids.length === 1 ? '' : 's'}?`,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const results = await Promise.all(
                ids.map((id) =>
                  fetch(
                    `${CHART_BACKEND_URL}/sessions/${id}?uid=${encodeURIComponent(uid)}`,
                    { method: 'DELETE' },
                  ).then((res) => ({ id, ok: res.ok, status: res.status })),
                ),
              );
              const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
              const failures = results.filter((r) => !r.ok);
              setSessions((prev) => prev.filter((s) => !okIds.has(s.session_id)));
              setSelectedIds(new Set());
              setEditMode(false);
              if (failures.length > 0) {
                Alert.alert(
                  "Couldn't delete some sessions",
                  `${failures.length} of ${ids.length} failed`,
                );
                const signal = { cancelled: false };
                fetchSessions(signal);
              }
            } catch (err: any) {
              Alert.alert(
                "Couldn't delete sessions",
                err && err.message ? err.message : 'Network error',
              );
              setSelectedIds(new Set());
              setEditMode(false);
              const signal = { cancelled: false };
              fetchSessions(signal);
            }
          },
        },
      ],
    );
  }, [uid, selectedIds, fetchSessions]);

  if (!uid) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.signInText}>Sign in to trade</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* ── Continue ───────────────────────────────────────────────── */}
        {/* iOS-style Edit/Done header. Default mode shows a single
            "Edit" pill; edit mode swaps in a red "Delete (N)" pill
            on the left and a "Done" pill on the right. */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Continue</Text>
          {!editMode ? (
            <Pressable
              onPress={() => setEditMode(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.editBtn,
                pressed && styles.editBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit sessions"
            >
              <Text style={styles.editBtnLabel}>Edit</Text>
            </Pressable>
          ) : (
            <View style={styles.editActionsRow}>
              <Pressable
                onPress={handleBulkDelete}
                disabled={selectedIds.size === 0}
                style={({ pressed }) => [
                  styles.bulkDeleteBtn,
                  selectedIds.size === 0 && styles.bulkDeleteBtnDisabled,
                  pressed && selectedIds.size > 0 && styles.bulkDeleteBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  selectedIds.size === 0
                    ? 'Delete (no sessions selected)'
                    : `Delete ${selectedIds.size} selected session${
                        selectedIds.size === 1 ? '' : 's'
                      }`
                }
                accessibilityState={{ disabled: selectedIds.size === 0 }}
              >
                <Text style={styles.bulkDeleteLabel}>
                  {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditMode(false);
                  setSelectedIds(new Set());
                }}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.editBtn,
                  pressed && styles.editBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Done editing"
              >
                <Text style={styles.editBtnLabel}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.gold} size="large" />
          </View>
        ) : error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No sessions yet — create one to start trading.
            </Text>
          </View>
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.session_id}
              session={s}
              editMode={editMode}
              selected={selectedIds.has(s.session_id)}
              onToggleSelect={() => toggleSelect(s.session_id)}
              onPress={() => onSessionSelected(s.session_id, s.symbol, s.timeframe)}
            />
          ))
        )}

        {/* ── New Session ───────────────────────────────────────────── */}
        <View style={styles.newSessionWrap}>
          <Pressable
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => [
              styles.newSessionBtn,
              pressed && styles.newSessionBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start a new session"
          >
            <Text style={styles.newSessionLabel}>New Session</Text>
          </Pressable>
        </View>
      </ScrollView>

      <CreateSessionSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSessionCreated={handleSessionCreated}
      />
    </View>
  );
}

/**
 * One Continue-row card. Shows symbol + TF chip on the first line,
 * the date being traded on the second, and a progress bar on the
 * third. The previous "N trades / $X.XX" line was removed — the
 * local trade-count overlay was unreliable (trades only land in
 * the perSession store when the chart-host capture pipeline
 * succeeds; failures left the card showing 0/0). Until trades are
 * persisted server-side, the card sticks to symbol/date/progress.
 */
function SessionCard({
  session,
  editMode,
  selected,
  onToggleSelect,
  onPress,
}: {
  session: SessionListItem;
  editMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onPress: () => void;
}) {
  const dateLabel = formatETDate(session.current_time);

  return (
    <View style={styles.cardRow}>
      {editMode && (
        <SelectCircle
          selected={selected}
          onPress={onToggleSelect}
          accessibilityLabel={`Select ${session.symbol} session from ${dateLabel}`}
        />
      )}
      <Pressable
        onPress={editMode ? undefined : onPress}
        disabled={editMode}
        style={({ pressed }) => [
          styles.card,
          styles.cardFlex,
          pressed && !editMode && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Resume ${session.symbol} ${session.timeframe} session from ${dateLabel}`}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.cardSymbol}>{session.symbol}</Text>
          <View style={styles.tfChip}>
            <Text style={styles.tfChipText}>{session.timeframe}</Text>
          </View>
        </View>

        <Text style={styles.cardDate}>{dateLabel}</Text>

        {typeof session.progress_pct === 'number' && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(100, session.progress_pct))}%` },
              ]}
            />
          </View>
        )}
      </Pressable>
    </View>
  );
}

/**
 * Format a unix-seconds timestamp as an ET wall-clock date, e.g.
 * "Jun 4, 2024". Uses Intl with the America/New_York timezone so the
 * display matches the rest of the chart screen's ET convention.
 */
function formatETDate(unixSeconds: number): string {
  try {
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },

  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 32,
  },
  signInText: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    textAlign: 'center',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  // Edit-mode header layout — Delete pill on the left, Done on
  // the right. Uses a small gap so the two pills sit cleanly.
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Plain "Edit" / "Done" pill — transparent, white text. Matches
  // the iOS chrome the user expects without competing with the
  // primary gold/red controls.
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  editBtnPressed: {
    opacity: 0.6,
  },
  editBtnLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // Top-of-list bulk-delete control. Loss-red when enabled (>= 1
  // selection); 40% opacity + non-interactive when nothing's picked.
  bulkDeleteBtn: {
    backgroundColor: '#FF4757',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  bulkDeleteBtnDisabled: {
    opacity: 0.4,
  },
  bulkDeleteBtnPressed: {
    opacity: 0.85,
  },
  bulkDeleteLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingVertical: 24,
    paddingHorizontal: 4,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    lineHeight: 20,
  },

  // ── Session card ──────────────────────────────────────────────────────
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardFlex: {
    flex: 1,
    marginBottom: 0,
  },
  card: {
    backgroundColor: surface.l2,
    borderWidth: 1,
    borderColor: borders.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardPressed: {
    backgroundColor: colors.cardAlt,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardSymbol: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  // Small rounded pill for the timeframe (e.g. "5m"). Sits inline with
  // the gold symbol so the two read as one identifier line.
  tfChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tfChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardDate: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },

  // ── New Session CTA ──────────────────────────────────────────────────
  newSessionWrap: {
    marginTop: 24,
  },
  newSessionBtn: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSessionBtnPressed: {
    opacity: 0.85,
  },
  newSessionLabel: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
