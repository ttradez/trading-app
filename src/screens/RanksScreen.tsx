import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ImageBackground, ScrollView,
  LayoutChangeEvent, Pressable, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useXpStore } from '../store/xpStore';
import {
  getRankForXP, RANK_ORDER, RANK_BEATS, RANK_THEME_COLOR, RankId,
} from '../data/rankConfig';
import LeaderboardScreen from './LeaderboardScreen';

/**
 * Ranks tab — vertical Clash-Royale-style journey. Six rank rows
 * stacked highest-at-top (Funded) → lowest-at-bottom (Paper), so
 * the player climbs UPWARD as XP grows. A single gold "spine" line
 * runs down the left edge with a node per row: check for achieved,
 * glowing dot for current, lock for not-yet-unlocked. Auto-scrolls
 * the current rank's row to the viewport center on mount.
 *
 * No BlurView / masked-view (they crash this build). The repeating
 * background tile lives inside an ImageBackground so it scrolls
 * with the content.
 */

const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';
const BG    = '#000000';
const GAIN  = '#00D395';
const LOCK_BORDER = '#5B5B5B';

const ROW_HEIGHT       = 220;
const HEADER_HEIGHT    = 64;
const SPINE_COL_WIDTH  = 56;     // x-extent of the leftmost column
const SPINE_WIDTH      = 3;
const NODE_SIZE        = 30;

// Display order is TOP → BOTTOM. RANK_ORDER is low→high; reverse to
// put the highest rank (Funded) at the top of the scroll.
const ROWS: ReadonlyArray<RankId> = [...RANK_ORDER].reverse() as RankId[];

// Per-rank arena art. Keys match RankId; the file names are the
// numbered set delivered for the rewrite. Background tile sits behind
// every row.
const ARENA: Record<RankId, ReturnType<typeof require>> = {
  paper:        require('../../assets/ranks/arena_1_paper.png'),
  unprofitable: require('../../assets/ranks/arena_2_unprofitable.png'),
  disciplined:  require('../../assets/ranks/arena_3_disciplined.png'),
  consistent:   require('../../assets/ranks/arena_4_consistent.png'),
  profitable:   require('../../assets/ranks/arena_5_profitable.png'),
  funded:       require('../../assets/ranks/arena_6_funded.png'),
};

const GRID_BG = require('../../assets/ranks/ranks_grid_bg.png');

const RANK_DISPLAY_NAME: Record<RankId, string> = {
  paper:        'PAPER',
  unprofitable: 'UNPROFITABLE',
  disciplined:  'DISCIPLINED',
  consistent:   'CONSISTENT',
  profitable:   'PROFITABLE',
  funded:       'FUNDED',
};

const ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' };

/** Entry XP for a rank = the cumulativeXP of its tier-I beat. The
 *  Funded cap's only beat has subTier === null; its cumulativeXP IS
 *  the entry threshold. */
function rankEntryXp(rank: RankId): number {
  const b = RANK_BEATS.find(
    (x) => x.rank === rank && (x.subTier === 1 || x.subTier === null),
  );
  return b?.cumulativeXP ?? 0;
}

type RowState = 'achieved' | 'current' | 'locked';
type SubTab = 'journey' | 'leaderboard' | 'badges';

export default function RanksScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('journey');

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Repeating grid backdrop — JOURNEY only. The leaderboard and
          badges panes have their own visual rhythm; the diagonal
          tile pattern reads as visual noise behind them. */}
      {activeTab === 'journey' && (
        <ImageBackground
          source={GRID_BG}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, styles.bgPointer]}
          imageStyle={styles.bgImage}
        />
      )}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>RANKS</Text>
      </View>

      {/* Sub-tab strip — Journey / Leaderboard / Badges. Three pills.
          Challenges moved to a Home banner → standalone screen. */}
      <View style={styles.tabRow}>
        {(['journey', 'leaderboard', 'badges'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabPill, active && styles.tabPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab === 'journey'
                  ? 'JOURNEY'
                  : tab === 'leaderboard'
                    ? 'LEADERBOARD'
                    : 'BADGES'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {activeTab === 'journey' && <JourneyPane />}
        {activeTab === 'leaderboard' && (
          <LeaderboardScreen embedded segment="rankings" />
        )}
        {activeTab === 'badges' && (
          <LeaderboardScreen embedded segment="badges" />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Journey pane — extracted from the screen body so the sub-tab
// switcher above can mount/unmount it without recomputing the rest
// of the screen.
//
// Descend animation (June 2026):
//   1. Snap-scroll to the TOP of the journey (Funded — the top of the
//      ladder, the destination every trader is climbing toward).
//      Renders before paint so the user never sees the wrong position
//      flash.
//   2. After a 300 ms beat (lets the user register "here's where you're
//      going"), animated-scroll DOWN to the current rank over ~1100 ms
//      with an ease-out curve.
//   3. When the scroll completes, the current row's node + arena
//      pulse-burst (scale + glow halo) for 700 ms to land the eye on
//      "you are here".
//
// Re-fires on every focus (bottom-tab return) via useFocusEffect, AND
// on every JourneyPane mount (sub-tab switch).

const SCROLL_PAUSE_MS    = 300;
const SCROLL_DURATION_MS = 1100;
const PULSE_DURATION_MS  = 700;

function JourneyPane() {
  const serverXp  = useXpStore((s) => s.serverXp);
  const currentXP = useXpStore((s) => s.currentXP);
  // Local challenge XP only lives in currentXP — server total can
  // lag behind. Use max so progress never regresses.
  const xp = Math.max(serverXp ?? 0, currentXP);

  const info = useMemo(() => getRankForXP(xp), [xp]);
  const currentRank: RankId = info.rank;
  const currentIdx = RANK_ORDER.indexOf(currentRank); // 0..5 low→high

  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH]   = useState(0);
  const onScrollLayout = (e: LayoutChangeEvent) =>
    setViewportH(e.nativeEvent.layout.height);
  const onContentSizeChange = (_w: number, h: number) => setContentH(h);

  // Pulse value shared with the current Row → drives node scale +
  // arena halo opacity when the climb scroll completes. Reset to 0
  // on each focus so the burst replays.
  const pulse = useRef(new Animated.Value(0)).current;

  // Each climb run has a unique id so a stale rAF / timeout from a
  // previous run can short-circuit if it fires after the next focus
  // already started. Avoids racy scroll jumps when the user taps
  // the tab quickly.
  const runIdRef = useRef(0);
  // Pending timeout handles for the in-flight climb. setTimeout on
  // RN returns a number primitive, so we hold them in a ref array
  // rather than trying to stash one on the other (which throws in
  // strict mode: "Cannot create property 'inner' on number").
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Guard the climb until BOTH the viewport and content heights are
  // known — `scrollTo` is a no-op before the ScrollView measures.
  const ready = viewportH > 0 && contentH > 0;

  const climb = useCallback(() => {
    if (!ready) return;
    const myRun = ++runIdRef.current;

    // Cancel any in-flight timeouts from a previous run.
    for (const id of pendingTimeoutsRef.current) clearTimeout(id);
    pendingTimeoutsRef.current = [];

    pulse.setValue(0);

    const displayIdx = ROWS.indexOf(currentRank);
    const targetY = Math.max(
      0,
      displayIdx * ROW_HEIGHT + ROW_HEIGHT / 2 - viewportH / 2,
    );

    // 1) Snap to the TOP (Funded — the goal) instantly.
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    // 2) After a beat, animated-scroll DOWN to current rank.
    const t1 = setTimeout(() => {
      if (runIdRef.current !== myRun) return;
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      // 3) After the scroll's expected duration, fire the pulse burst.
      const t2 = setTimeout(() => {
        if (runIdRef.current !== myRun) return;
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: PULSE_DURATION_MS * 0.4,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: PULSE_DURATION_MS * 0.6,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: false,
          }),
        ]).start();
      }, SCROLL_DURATION_MS);
      pendingTimeoutsRef.current.push(t2);
    }, SCROLL_PAUSE_MS);
    pendingTimeoutsRef.current.push(t1);

    return () => {
      for (const id of pendingTimeoutsRef.current) clearTimeout(id);
      pendingTimeoutsRef.current = [];
    };
  }, [ready, viewportH, contentH, currentRank, pulse]);

  // Fire on every focus — bottom-tab return AND first mount. The
  // ready flag may flip true AFTER focus the very first time (since
  // viewport/content measurements come asynchronously) — the second
  // effect below catches that case.
  useFocusEffect(
    useCallback(() => {
      const cleanup = climb();
      return () => { if (cleanup) cleanup(); };
    }, [climb]),
  );

  // First-paint catch: when measurements arrive after the focus
  // effect already ran, kick off the climb here too. runIdRef
  // prevents both paths from racing each other.
  useEffect(() => {
    if (ready) climb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={onScrollLayout}
      onContentSizeChange={onContentSizeChange}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Continuous gold spine spanning the entire scroll content.
          Sits behind the row nodes — each Row draws its own node on
          top of this in the same x lane. */}
      <View style={styles.spine} pointerEvents="none" />

      {ROWS.map((rank) => {
        const rankIdx = RANK_ORDER.indexOf(rank);
        const state: RowState =
          rankIdx === currentIdx
            ? 'current'
            : rankIdx < currentIdx
              ? 'achieved'
              : 'locked';
        return (
          <Row
            key={rank}
            rank={rank}
            state={state}
            xp={xp}
            subTier={state === 'current' ? info.subTier : null}
            pulse={state === 'current' ? pulse : undefined}
          />
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────

function Row({
  rank, state, xp, subTier, pulse,
}: {
  rank: RankId;
  state: RowState;
  xp: number;
  subTier: 1 | 2 | 3 | null;
  /** Driven by JourneyPane's climb sequence. Non-zero only on the
   *  current row; null/undefined for achieved/locked rows. The Node
   *  + arena read this value to scale-and-glow during the burst. */
  pulse?: Animated.Value;
}) {
  const accent     = RANK_THEME_COLOR[rank];
  const thisEntry  = rankEntryXp(rank);
  const rankIdx    = RANK_ORDER.indexOf(rank);
  const nextRank   = RANK_ORDER[rankIdx + 1] as RankId | undefined;
  const nextEntry  = nextRank ? rankEntryXp(nextRank) : null;
  const isFundedCap = rank === 'funded';

  // Pulse-driven transforms for the current row only. The arena
  // image scales 1 → 1.18 → 1 (briefly larger than its static 1.05
  // scale) and a gold "ring" overlay fades in over the image during
  // the burst. The node scales 1 → 1.5 → 1 in lockstep.
  const arenaScale = pulse
    ? pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1.05, 1.18],
      })
    : null;
  const ringOpacity = pulse
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] })
    : null;
  const ringScale = pulse
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] })
    : null;

  // Progress within this rank's bracket — only consumed when this row
  // is `current` AND not the Funded cap. Clamped 0..1.
  const progress =
    nextEntry == null
      ? 1
      : Math.max(0, Math.min(1, (xp - thisEntry) / (nextEntry - thisEntry)));

  return (
    <View style={styles.row}>
      <View style={styles.spineCol}>
        <Node state={state} pulse={pulse} />
      </View>

      <View style={styles.leftCol}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.rankName,
              state === 'locked' && styles.rankNameLocked,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {RANK_DISPLAY_NAME[rank]}
          </Text>
          {/* Divisions removed (Phase 4): no "I / III" sub-tier
              indicator. Kept the subTier prop on Row so other call
              sites compile, but the UI no longer surfaces it. */}
        </View>

        <View
          style={[
            styles.tag,
            state === 'achieved' && styles.tagAchieved,
            state === 'current'  && styles.tagCurrent,
            state === 'locked'   && styles.tagLocked,
          ]}
        >
          <Text
            style={[
              styles.tagText,
              state === 'current' && { color: GAIN },
              state === 'locked'  && { color: '#888' },
            ]}
          >
            {state === 'current'
              ? 'CURRENT'
              : state === 'achieved'
                ? 'ACHIEVED'
                : 'LOCKED'}
          </Text>
        </View>

        {state === 'current' ? (
          isFundedCap ? (
            <View style={styles.progressBlock}>
              <View style={[styles.barTrack, { borderColor: accent }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: '100%', backgroundColor: accent },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>MAX</Text>
            </View>
          ) : (
            <AnimatedProgressBar
              progress={progress}
              accent={accent}
              xp={xp}
              nextEntry={nextEntry}
              nextRank={nextRank}
            />
          )
        ) : state === 'achieved' ? (
          <View style={styles.progressBlock}>
            <View style={[styles.barTrack, styles.barTrackAchieved]}>
              <View style={[styles.barFill, styles.barFillAchieved]} />
            </View>
          </View>
        ) : (
          <Text style={styles.lockedLabel}>
            Reach {thisEntry.toLocaleString('en-US')} XP
          </Text>
        )}
      </View>

      <View style={styles.arenaCol}>
        {pulse && ringScale && ringOpacity && (
          // Expanding gold halo behind the arena. Fades + scales
          // outward during the burst, like a stadium spotlight
          // resolving on the current rank.
          <Animated.View
            pointerEvents="none"
            style={[
              styles.arenaHalo,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
        )}
        {pulse && arenaScale ? (
          <Animated.Image
            source={ARENA[rank]}
            resizeMode="contain"
            style={[
              styles.arena,
              styles.arenaCurrent,
              { transform: [{ scale: arenaScale }] },
            ]}
          />
        ) : (
          <Image
            source={ARENA[rank]}
            resizeMode="contain"
            style={[
              styles.arena,
              state === 'locked' && styles.arenaLocked,
              state === 'current' && styles.arenaCurrent,
            ]}
          />
        )}
      </View>
    </View>
  );
}

/**
 * AnimatedProgressBar — current-rank XP bar that animates from its
 * previous fill % to the new one whenever `progress` changes (driven
 * by XP). Used when the user claims a challenge: they land on the
 * Ranks tab and watch the bar fill toward the next rank.
 *
 * Width animations require the JS driver — `useNativeDriver: false` —
 * because layout props aren't supported on the native side.
 */
function AnimatedProgressBar({
  progress, accent, xp, nextEntry, nextRank,
}: {
  progress: number;
  accent: string;
  xp: number;
  nextEntry: number | null;
  nextRank: RankId | undefined;
}) {
  const animProgress = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress, animProgress]);

  const widthInterp = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.progressBlock}>
      <View style={[styles.barTrack, { borderColor: accent }]}>
        <Animated.View
          style={[
            styles.barFill,
            { width: widthInterp as any, backgroundColor: accent },
          ]}
        />
      </View>
      <Text style={styles.progressLabel} numberOfLines={1}>
        {xp.toLocaleString('en-US')} /{' '}
        {nextEntry?.toLocaleString('en-US')} XP →{' '}
        {nextRank ? RANK_DISPLAY_NAME[nextRank] : ''}
      </Text>
    </View>
  );
}

function Node({
  state, pulse,
}: { state: RowState; pulse?: Animated.Value }) {
  if (state === 'achieved') {
    return (
      <View style={[styles.node, styles.nodeAchieved]}>
        <Ionicons name="checkmark" size={16} color="#000" />
      </View>
    );
  }
  if (state === 'current') {
    // Node scales 1 → 1.5 → 1 during the burst, riding the same
    // pulse value the arena/halo use. A second expanding gold ring
    // emanates outward — radar-ping vibe.
    const nodeScale = pulse
      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] })
      : null;
    const pingScale = pulse
      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] })
      : null;
    const pingOpacity = pulse
      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] })
      : null;
    return (
      <View style={styles.nodeWrap}>
        {pulse && pingScale && pingOpacity && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.nodePing,
              { opacity: pingOpacity, transform: [{ scale: pingScale }] },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.node,
            styles.nodeCurrent,
            nodeScale ? { transform: [{ scale: nodeScale }] } : null,
          ]}
        >
          <View style={styles.nodeCurrentDot} />
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={[styles.node, styles.nodeLocked]}>
      <Ionicons name="lock-closed" size={12} color="#999" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    // Transparent so the grid backdrop shows through to the top.
    backgroundColor: 'transparent',
  },
  headerTitle: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },

  // Scroll itself is transparent so the absolute-positioned grid
  // backdrop reads through the rows' negative space.
  // ── Sub-tab strip ─────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    // Transparent so the grid backdrop reads through this row too.
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: GOLD,
  },
  tabText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  tabTextActive: {
    color: '#000',
  },

  body: { flex: 1 },

  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: {},

  // Dim the repeating tile so it sits as ambience rather than a loud
  // foreground pattern. 0.22 keeps the diamonds readable up close
  // while letting the rows + spine dominate.
  bgImage: {
    opacity: 0.22,
  },
  // pointerEvents moved into style (the top-level prop is deprecated
  // in current RN). Touches still reach the ScrollView because the
  // backdrop sits below everything else in JSX order anyway.
  bgPointer: {
    pointerEvents: 'none',
  },

  spine: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: SPINE_COL_WIDTH / 2 - SPINE_WIDTH / 2,
    width: SPINE_WIDTH,
    backgroundColor: GOLD,
    opacity: 0.55,
  },

  // ── Row layout ─────────────────────────────────────────────────
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spineCol: {
    width: SPINE_COL_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Left content + arena split the remaining width 45 / 55. No
  // explicit `width` — flex weights do the proportional split since
  // the spine column has a fixed width.
  leftCol: {
    flex: 45,
    paddingRight: 6,
    paddingLeft: 4,
  },
  arenaCol: {
    flex: 55,
    height: '100%',
    paddingRight: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },

  // ── Node ───────────────────────────────────────────────────────
  // Wraps the node + its expanding radar-ping so the ping can sit
  // centered behind the node without affecting layout.
  nodeWrap: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodePing: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    borderColor: GOLD,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nodeAchieved: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  nodeCurrent: {
    backgroundColor: '#000',
    borderColor: GOLD,
    // Soft gold glow so the current node reads as "you are here".
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  nodeCurrentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GOLD,
  },
  nodeLocked: {
    backgroundColor: '#0E0E0E',
    borderColor: LOCK_BORDER,
  },

  // ── Left text block ────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rankName: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  rankNameLocked: {
    color: '#7A7A7A',
  },
  subTier: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },

  tag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tagText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  tagAchieved: {
    backgroundColor: 'rgba(255,184,0,0.10)',
    borderColor:     'rgba(255,184,0,0.35)',
  },
  tagCurrent: {
    backgroundColor: 'rgba(0,211,149,0.12)',
    borderColor:     'rgba(0,211,149,0.40)',
  },
  tagLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor:     'rgba(255,255,255,0.10)',
  },

  progressBlock: {
    marginTop: 10,
    gap: 4,
  },
  barTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  barTrackAchieved: {
    borderColor: 'rgba(255,184,0,0.25)',
  },
  barFillAchieved: {
    width: '100%',
    backgroundColor: 'rgba(255,184,0,0.45)',
  },
  progressLabel: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  lockedLabel: {
    marginTop: 10,
    color: '#7A7A7A',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ── Arena image ────────────────────────────────────────────────
  // Soft gold halo behind the current arena — driven by the climb
  // pulse. Fills the arena column, scales outward, fades to 0.
  arenaHalo: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  arena: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  arenaLocked: {
    opacity: 0.32,
  },
  arenaCurrent: {
    transform: [{ scale: 1.05 }],
    // Soft gold halo on the current row's arena. iOS reads shadow;
    // Android picks up `elevation`.
    shadowColor: GOLD,
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
});
