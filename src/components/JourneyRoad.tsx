import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ImageBackground, Image, Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import NumericText from './NumericText';
import ProgressBar from './ProgressBar';
import { useXpStore } from '../store/xpStore';
import { useAuthStore } from '../store/authStore';
import { getRanks, RankLadderEntry } from '../services/api';
import { getRankForXP } from '../data/rankConfig';
import { RANK_BANNERS, RANK_BACKGROUNDS, RANK_COLORS, EmblemKey } from '../data/rankArt';

/**
 * JourneyRoad — the 7-arena trophy road. Extracted from the old
 * standalone JourneyScreen body so the same content can render
 * inside JourneyScreen (stack route, with back-arrow header) AND
 * the new Ranks tab's Journey sub-tab (no back arrow, lives under
 * a pinned header). Logic + styling unchanged from the original.
 */

const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';

const TIER_ORDER: EmblemKey[] = [
  'elite',
  'professional',
  'consistent',
  'disciplined',
  'developing',
  'retail',
  'gambler',
];

const TIER_LABELS: Record<EmblemKey, string> = {
  gambler:      'GAMBLER',
  retail:       'RETAIL TRADER',
  developing:   'DEVELOPING PRO',
  disciplined:  'DISCIPLINED TRADER',
  consistent:   'CONSISTENT TRADER',
  professional: 'PROFESSIONAL',
  elite:        'ELITE',
};

const ZIGZAG_OFFSETS = [0, -70, 70];
// 600 (was 420) — fits the worst case (3 stones where one is "current",
// which adds a YOU pill + progress bar below its circle) with breathing
// room so the bottom "I" stone's name + XP label never get clipped by
// the arena's overflow: 'hidden'.
const ARENA_HEIGHT = 600;
const NODE_SIZE_DEFAULT = 70;
const NODE_SIZE_CURRENT = 84;

// Total scroll-content height the connector path needs to span: every
// tier renders one ARENA_HEIGHT block back-to-back (no gates anymore).
// Used to size the per-arena SVG layer so the same global path can render
// inside every arena at the correct vertical offset.
const TIER_COUNT = 7;
const TOTAL_PATH_HEIGHT = ARENA_HEIGHT * TIER_COUNT;

// Frosted-glass nameplate-band tuning.
//   BAND_BLUR_RADIUS — passed straight to React Native's built-in
//                      <Image blurRadius=...>, no native blur module.
//   BAND_TOP_FADE_PCT — height of the LinearGradient that eases the
//                       top edge of each band toward the rank-above
//                       color. 45 % of the band leaves the bottom
//                       half showing only this rank's blurred scene,
//                       so the band's bottom edge matches the sharp
//                       arena photo directly under it.
const BAND_BLUR_RADIUS = 30;
const BAND_TOP_FADE_PCT = '45%' as const;
const BANNER_TOP_FADE_OPACITY = 0.45;

// Progress path styling.
const PATH_WIDTH       = 5;
const PATH_COLOR_GREY  = 'rgba(255,255,255,0.25)';   // matches stoneLocked border
const PATH_COLOR_GOLD  = GOLD;
// Catmull-Rom tension: 0 = sharp corners, 1 = max smoothing. 0.5 yields
// gentle S-curves that follow the zigzag of the node positions without
// overshooting between adjacent nodes.
const PATH_TENSION = 0.5;
// Distance from each circle's CENTRE at which the connector must end.
// = outer rendered radius (layout radius + border, scaled by `transform`
// when the stone is "current") + a 3 px gap.
//   Default / locked stone: width 70, border 2 → outer radius 37
//     → PATH_GAP_DEFAULT = 37 + 3 = 40
//   Current stone: width 84 + border 2, scaled ×1.2 → outer radius 52.8
//     → PATH_GAP_CURRENT = 52.8 + 3 = 55.8
// (Verify: distance from each segment endpoint to its node's centre is
// equal to these values — see findTFromStart / findTFromEnd below.)
const STONE_BORDER_WIDTH = 2;
const PATH_GAP_PADDING   = 3;
const PATH_GAP_DEFAULT =
  NODE_SIZE_DEFAULT / 2 + STONE_BORDER_WIDTH + PATH_GAP_PADDING;            // 40
const PATH_GAP_CURRENT =
  (NODE_SIZE_CURRENT / 2 + STONE_BORDER_WIDTH) * 1.2 + PATH_GAP_PADDING;    // 55.8

// ── Cubic-bezier helpers (de Casteljau split + trim) ──
// Used to carve a gap around each node and to render only the gold-
// fraction portion of each segment.
type PathPoint = { x: number; y: number };
type CubicBezier = { p0: PathPoint; c1: PathPoint; c2: PathPoint; p3: PathPoint };

function lerpPoint(a: PathPoint, b: PathPoint, t: number): PathPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function splitCubic(b: CubicBezier, t: number): {
  first: CubicBezier; second: CubicBezier;
} {
  const q0 = lerpPoint(b.p0, b.c1, t);
  const q1 = lerpPoint(b.c1, b.c2, t);
  const q2 = lerpPoint(b.c2, b.p3, t);
  const r0 = lerpPoint(q0, q1, t);
  const r1 = lerpPoint(q1, q2, t);
  const s  = lerpPoint(r0, r1, t);
  return {
    first:  { p0: b.p0, c1: q0, c2: r0, p3: s },
    second: { p0: s,    c1: r1, c2: q2, p3: b.p3 },
  };
}

function trimCubic(b: CubicBezier, t1: number, t2: number): CubicBezier {
  const after1 = splitCubic(b, t1).second;
  // Remap t2 from [0,1] of the original bezier into [0,1] of the
  // "after t1" bezier so the second split lands at the right point.
  const tRel = (t2 - t1) / (1 - t1);
  return splitCubic(after1, tRel).first;
}

function bezierToD(b: CubicBezier): string {
  return `M ${b.p0.x.toFixed(2)} ${b.p0.y.toFixed(2)} `
    + `C ${b.c1.x.toFixed(2)} ${b.c1.y.toFixed(2)}, `
    + `${b.c2.x.toFixed(2)} ${b.c2.y.toFixed(2)}, `
    + `${b.p3.x.toFixed(2)} ${b.p3.y.toFixed(2)}`;
}

function bezierPointAt(b: CubicBezier, t: number): PathPoint {
  const u  = 1 - t;
  const u2 = u * u;
  const t2 = t * t;
  return {
    x: u2 * u * b.p0.x + 3 * u2 * t * b.c1.x + 3 * u * t2 * b.c2.x + t2 * t * b.p3.x,
    y: u2 * u * b.p0.y + 3 * u2 * t * b.c1.y + 3 * u * t2 * b.c2.y + t2 * t * b.p3.y,
  };
}

function distance(a: PathPoint, b: PathPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Find t in [0, 1] where the bezier is at straight-line distance
// `targetDist` from its own start point p0. Bisection — 25 iterations
// → sub-pixel precision. Returns 1 if the whole curve stays inside
// targetDist (degenerate case; caller skips the segment).
function findTFromStart(b: CubicBezier, targetDist: number): number {
  if (distance(bezierPointAt(b, 1), b.p0) < targetDist) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    if (distance(bezierPointAt(b, mid), b.p0) < targetDist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Symmetric — find t in [0, 1] where the bezier is at `targetDist` from
// its END point p3. As t decreases from 1, distance from p3 grows.
function findTFromEnd(b: CubicBezier, targetDist: number): number {
  if (distance(bezierPointAt(b, 0), b.p3) < targetDist) return 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    if (distance(bezierPointAt(b, mid), b.p3) > targetDist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

type NodeState = 'reached' | 'current' | 'locked';

export default function JourneyRoad() {
  const [ladder, setLadder] = useState<RankLadderEntry[] | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const scrollRef           = useRef<ScrollView>(null);

  const uid              = useAuthStore((s) => s.uid);
  const serverXp         = useXpStore((s) => s.serverXp);
  const currentXP        = useXpStore((s) => s.currentXP);
  const serverRank       = useXpStore((s) => s.serverRank);
  const refreshServerXp  = useXpStore((s) => s.refreshServerXp);

  // ── Progress-path measurement (onLayout-based composition) ──
  // measureLayout fails on Fabric ("ref to a native component" error), so
  // the path is built from a 3-layer onLayout chain that composes offsets
  // without any native-ref API calls:
  //   sectionYs[tierKey]   — section's y relative to the wrapping View
  //                          (which is a direct child of ScrollView)
  //   stonesYs[tierKey]    — stonesWrap's y relative to the arena (==
  //                          bannerWrap height, since stonesWrap is the
  //                          banner's next sibling inside the arena)
  //   stoneRows[lvlIdx]    — stoneRow's layout box inside stonesWrap
  //                          (x, y, width), pre-transform
  // After task 3 removed the gate pill, the arena is the first child of
  // section so arena.y_in_section is 0 — no extra onLayout needed there.
  // Composition for each circle's center in scroll-content space:
  //   y = sectionY + stonesY + row.y + circleH/2
  //   x = row.x + zigzag_offset + row.width/2
  const [sectionYs, setSectionYs] = useState<Record<string, number>>({});
  const [stonesYs, setStonesYs]   = useState<Record<string, number>>({});
  const [stoneRows, setStoneRows] = useState<
    Record<number, { x: number; y: number; width: number }>
  >({});

  const handleSectionLayout = useCallback(
    (tierKey: string, e: LayoutChangeEvent) => {
      const y = e.nativeEvent.layout.y;
      setSectionYs((prev) => {
        const existing = prev[tierKey];
        if (existing !== undefined && Math.abs(existing - y) < 0.5) return prev;
        return { ...prev, [tierKey]: y };
      });
    },
    [],
  );

  const handleStonesLayout = useCallback(
    (tierKey: string, e: LayoutChangeEvent) => {
      const y = e.nativeEvent.layout.y;
      setStonesYs((prev) => {
        const existing = prev[tierKey];
        if (existing !== undefined && Math.abs(existing - y) < 0.5) return prev;
        return { ...prev, [tierKey]: y };
      });
    },
    [],
  );

  const handleStoneRowLayout = useCallback(
    (levelIndex: number, e: LayoutChangeEvent) => {
      const { x, y, width } = e.nativeEvent.layout;
      setStoneRows((prev) => {
        const existing = prev[levelIndex];
        if (existing
          && Math.abs(existing.x - x) < 0.5
          && Math.abs(existing.y - y) < 0.5
          && Math.abs(existing.width - width) < 0.5
        ) return prev;
        return { ...prev, [levelIndex]: { x, y, width } };
      });
    },
    [],
  );

  useEffect(() => {
    if (uid) refreshServerXp(uid);
  }, [uid, refreshServerXp]);

  useEffect(() => {
    let cancelled = false;
    getRanks()
      .then((res) => { if (!cancelled) setLadder(res.ladder); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  const currentLevelIndex = useMemo(() => {
    if (serverRank) return serverRank.level_index;
    if (ladder == null) return 0;
    // Local challenge XP only lives in currentXP (never sent to
    // server), so server XP can lag behind. Use max so progress
    // never regresses when a server fetch returns a smaller total.
    const xp = Math.max(serverXp ?? 0, currentXP);
    let idx = 1;
    for (const e of ladder) {
      if (e.threshold <= xp) idx = e.level_index;
      else break;
    }
    return idx;
  }, [serverRank, ladder, serverXp, currentXP]);

  const localFallback = getRankForXP(Math.max(serverXp ?? 0, currentXP));

  // Same XP source the pinned header uses.
  const userXP = Math.max(serverXp ?? 0, currentXP);

  const groupedByTier = useMemo(() => {
    const map: Record<string, RankLadderEntry[]> = {};
    if (!ladder) return map;
    for (const e of ladder) {
      const k = e.emblem_key;
      if (!map[k]) map[k] = [];
      map[k].push(e);
    }
    return map;
  }, [ladder]);

  // Compose each circle's center {x, y} in scroll-content space from the
  // 3-layer onLayout chain. Circle height is the layout value (not the
  // scaled visual size of the "current" stone) since onLayout reports
  // the box, not the post-transform render.
  const positions = useMemo(() => {
    const out: Record<number, { x: number; y: number }> = {};
    if (!ladder) return out;
    for (const entry of ladder) {
      const tierKey = entry.emblem_key;
      const sy = sectionYs[tierKey];
      const wy = stonesYs[tierKey];
      const row = stoneRows[entry.level_index];
      if (sy === undefined || wy === undefined || !row) continue;
      const tierEntries = groupedByTier[tierKey];
      if (!tierEntries) continue;
      const origIdx = tierEntries.findIndex(
        (e) => e.level_index === entry.level_index,
      );
      const offsetX = ZIGZAG_OFFSETS[origIdx] ?? 0;
      const isCurrent = entry.level_index === currentLevelIndex;
      const circleH = isCurrent ? NODE_SIZE_CURRENT : NODE_SIZE_DEFAULT;
      out[entry.level_index] = {
        x: row.x + offsetX + row.width / 2,
        y: sy + wy + row.y + circleH / 2,
      };
    }
    return out;
  }, [ladder, sectionYs, stonesYs, stoneRows, groupedByTier, currentLevelIndex]);

  // Ordered list of node positions in ascending-XP order (Gambler I →
  // Elite). Empty until every stone has reported its layout — the path
  // doesn't render until all 19 nodes are measured.
  const orderedPositions = useMemo(() => {
    if (!ladder) return [];
    const arr: Array<{ x: number; y: number }> = [];
    for (const e of ladder) {
      const p = positions[e.level_index];
      if (!p) return [];
      arr.push(p);
    }
    return arr;
  }, [ladder, positions]);

  // One Catmull-Rom (tension 0.5) cubic-bezier per segment, trimmed at
  // both ends by PATH_NODE_GAP so the visible curve stops just outside
  // each node circle on either side. Gold fill is rendered as a
  // separately-trimmed inner bezier so its endpoint lands at the user's
  // XP progress point inside the segment.
  const segments = useMemo(() => {
    if (orderedPositions.length < 2 || !ladder) return [];
    const pts = orderedPositions;
    const out: Array<{ key: string; greyD: string; goldD: string | null }> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1: PathPoint = {
        x: p1.x + ((p2.x - p0.x) / 6) * PATH_TENSION,
        y: p1.y + ((p2.y - p0.y) / 6) * PATH_TENSION,
      };
      const c2: PathPoint = {
        x: p2.x - ((p3.x - p1.x) / 6) * PATH_TENSION,
        y: p2.y - ((p3.y - p1.y) / 6) * PATH_TENSION,
      };
      const full: CubicBezier = { p0: p1, c1, c2, p3: p2 };

      const a = ladder[i];
      const b = ladder[i + 1];
      // Per-end gap radius — the "current" node is visually ~50 % bigger
      // because of its `transform: [{ scale: 1.2 }]`, so its end needs a
      // wider gap or the line would still penetrate its rim.
      const startGap = a.level_index === currentLevelIndex
        ? PATH_GAP_CURRENT : PATH_GAP_DEFAULT;
      const endGap   = b.level_index === currentLevelIndex
        ? PATH_GAP_CURRENT : PATH_GAP_DEFAULT;

      // The previous implementation used `tInset = gap / chord`, which
      // assumes |bezier(t) − p0| ≈ t × chord. That holds only for
      // straight lines; with Catmull-Rom tangents pointing off-axis at
      // the endpoints, the curve reaches `gap` distance at a different
      // t than `gap / chord`, so the trimmed endpoint can land *inside*
      // the circle. Bisection finds the exact t at which the bezier
      // point is at the gap radius from each centre — guaranteed
      // outside both circles.
      const tStart = findTFromStart(full, startGap);
      const tEnd   = findTFromEnd(full, endGap);
      if (tStart >= tEnd) continue;       // segment fully consumed by rims
      const visible = trimCubic(full, tStart, tEnd);
      const greyD = bezierToD(visible);
      const span = b.threshold - a.threshold;
      const fraction = span > 0
        ? Math.max(0, Math.min(1, (userXP - a.threshold) / span))
        : (userXP >= b.threshold ? 1 : 0);
      let goldD: string | null = null;
      if (fraction >= 1) {
        goldD = greyD;
      } else if (fraction > 0) {
        const goldBez = splitCubic(visible, fraction).first;
        goldD = bezierToD(goldBez);
      }

      out.push({ key: `${a.level_index}-${b.level_index}`, greyD, goldD });
    }
    return out;
  }, [orderedPositions, ladder, userXP]);

  // On first load, scroll to the bottom (Gambler arena) so the
  // user sees their starting point. setTimeout defers past the
  // first layout pass.
  useEffect(() => {
    if (!ladder) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [ladder]);

  return (
    <View style={styles.root}>
      {error != null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {ladder == null && error == null && (
        <Text style={styles.loading}>Loading…</Text>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View collapsable={false}>
        {ladder && TIER_ORDER.map((tierKey, tierIdx) => {
          const entries = groupedByTier[tierKey];
          if (!entries || entries.length === 0) return null;

          const firstEntry = entries[0];
          // For the frosted-glass band: the scene ABOVE this band is the
          // bottom of the previous arena in scroll order (= the next-
          // higher-ranked tier in TIER_ORDER). Elite is at the top of
          // the scroll, so its "above" is the page bg colour.
          const aboveTierKey: EmblemKey | null =
            tierIdx > 0 ? TIER_ORDER[tierIdx - 1] : null;
          const aboveColor = aboveTierKey
            ? RANK_COLORS[aboveTierKey] : '#0A0A0A';

          return (
            <View
              key={tierKey}
              onLayout={(e) => handleSectionLayout(tierKey, e)}
            >
              <ImageBackground
                source={RANK_BACKGROUNDS[tierKey]}
                resizeMode="cover"
                style={styles.arena}
                imageStyle={styles.arenaImage}
              >
                <View style={styles.arenaOverlay} />

                {/* ── Connector-path layer ──
                    Renders the same global Catmull-Rom path inside every
                    arena, translated so the path's content-space (0,0)
                    aligns with this arena's local (0,0). The arena's
                    overflow: 'hidden' clips the path to this arena's
                    bounds, so each block only shows its slice; the next
                    block continues seamlessly from its own slice. Sits
                    BETWEEN arenaOverlay and bannerWrap so the title band
                    (banner + nameplate) renders on top — line never
                    crosses over rank text. Stones in stonesWrap also
                    render after this layer, so the circles cover the
                    line where they overlap. */}
                {segments.length > 0 && sectionYs[tierKey] !== undefined && (
                  <View
                    style={[
                      styles.connectorLayer,
                      { top: -(sectionYs[tierKey] as number) },
                    ]}
                    pointerEvents="none"
                  >
                    <Svg width="100%" height={TOTAL_PATH_HEIGHT}>
                      {segments.map((seg) => (
                        <React.Fragment key={seg.key}>
                          <Path
                            d={seg.greyD}
                            stroke={PATH_COLOR_GREY}
                            strokeWidth={PATH_WIDTH}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {seg.goldD && (
                            <Path
                              d={seg.goldD}
                              stroke={PATH_COLOR_GOLD}
                              strokeWidth={PATH_WIDTH}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </Svg>
                  </View>
                )}

                <View style={styles.bannerWrap}>
                  {/* ── BASE — this rank's blurred scene ──
                      Fills the band edge-to-edge as the bottom-most
                      layer. With <Image blurRadius>, RN's built-in
                      blur — no native module. Guarantees the band is
                      never black. */}
                  <Image
                    source={RANK_BACKGROUNDS[tierKey]}
                    blurRadius={BAND_BLUR_RADIUS}
                    resizeMode="cover"
                    style={styles.bannerSceneBase}
                  />
                  {/* ── TOP FADE — ease into the rank above ──
                      Solid above-rank color at the band's top edge,
                      fading to transparent so the bottom 55 % of the
                      band shows only this rank's blurred scene (a
                      seamless match for the sharp photo right under
                      the band). For Elite the above color falls back
                      to #0A0A0A — a quiet dark neutral. */}
                  <LinearGradient
                    colors={[aboveColor, 'transparent']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.bannerTopFade, { height: BAND_TOP_FADE_PCT }]}
                    pointerEvents="none"
                  />
                  <Image
                    source={RANK_BANNERS[tierKey]}
                    style={styles.bannerImg}
                    resizeMode="contain"
                  />
                  <View style={styles.bannerTextWrap} pointerEvents="none">
                    <Text
                      style={styles.bannerText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {TIER_LABELS[tierKey]}
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.stonesWrap}
                  onLayout={(e) => handleStonesLayout(tierKey, e)}
                >
                  {[...entries].reverse().map((entry, i) => {
                    const origIdx = entries.length - 1 - i;
                    const offset = ZIGZAG_OFFSETS[origIdx] ?? 0;

                    const state: NodeState =
                      entry.level_index < currentLevelIndex ? 'reached'
                      : entry.level_index === currentLevelIndex ? 'current'
                      : 'locked';

                    return (
                      <View
                        key={entry.level_index}
                        style={[styles.stoneRow, { transform: [{ translateX: offset }] }]}
                        onLayout={(e) => handleStoneRowLayout(entry.level_index, e)}
                      >
                        <Stone
                          division={entry.division}
                          state={state}
                          levelName={entry.level_name}
                          threshold={entry.threshold}
                          xpIntoLevel={
                            serverRank?.xp_into_level
                            ?? localFallback.xpInTier
                          }
                          xpForNext={
                            serverRank?.xp_for_next
                            ?? localFallback.xpNeededForNext
                          }
                          isMax={serverRank?.is_max ?? localFallback.next === null}
                        />
                      </View>
                    );
                  })}
                </View>
              </ImageBackground>
            </View>
          );
        })}

        </View>
      </ScrollView>
    </View>
  );
}

interface StoneProps {
  division: 'I' | 'II' | 'III' | null;
  state: NodeState;
  levelName: string;
  threshold: number;
  xpIntoLevel: number;
  xpForNext: number;
  isMax: boolean;
}

function Stone({
  division, state, levelName, threshold, xpIntoLevel, xpForNext, isMax,
}: StoneProps) {
  const isCurrent = state === 'current';
  const isReached = state === 'reached';
  const isLocked  = state === 'locked';
  const size = isCurrent ? NODE_SIZE_CURRENT : NODE_SIZE_DEFAULT;

  return (
    <View style={styles.stoneCenter}>
      <View
        style={[
          styles.stone,
          { width: size, height: size, borderRadius: size / 2 },
          isReached && styles.stoneReached,
          isCurrent && styles.stoneCurrent,
          isLocked  && styles.stoneLocked,
        ]}
      >
        <Text
          style={[
            styles.stoneNumeral,
            isLocked && { opacity: 0.5 },
          ]}
        >
          {division ?? ''}
        </Text>
        {isReached && (
          <View style={styles.checkOverlay}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </View>

      <Text style={[styles.stoneName, isLocked && styles.stoneNameLocked]} numberOfLines={1}>
        {levelName}
      </Text>
      <NumericText
        style={[styles.stoneThreshold, isLocked && styles.stoneThresholdLocked]}
      >
        {threshold.toLocaleString('en-US')} XP
      </NumericText>

      {isCurrent && (
        <View style={styles.youCol}>
          <View style={styles.youPill}>
            <Text style={styles.youText}>YOU</Text>
          </View>
          {isMax ? (
            <View style={styles.maxPill}>
              <Text style={styles.maxText}>MAX</Text>
            </View>
          ) : (
            <View style={styles.progressWrap}>
              <ProgressBar
                progress={
                  xpIntoLevel + xpForNext > 0
                    ? Math.min(1, xpIntoLevel / (xpIntoLevel + xpForNext))
                    : 0
                }
                size="sm"
                variant="gold"
                animated
              />
              <NumericText style={styles.progressLabel}>
                {xpIntoLevel.toLocaleString('en-US')} / {(xpIntoLevel + xpForNext).toLocaleString('en-US')} XP
              </NumericText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const SCREEN_W = Dimensions.get('window').width;

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 40,
    textAlign: 'center',
  },
  errorBox: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: '#FF6B6B', fontSize: 12 },
  scrollContent: {},

  arena: {
    width: '100%',
    height: ARENA_HEIGHT,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  arenaImage: {},
  arenaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  // Connector-path layer rendered inside each arena. Sized to the full
  // content height; `top` is set inline per-arena to -sectionY so the
  // SVG's local (0,0) lines up with content-space (0,0). Arena's
  // overflow: 'hidden' clips it to the arena's visible region.
  connectorLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TOTAL_PATH_HEIGHT,
  },

  bannerWrap: {
    width: '100%',
    aspectRatio: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Below-rank scene at the back of bannerWrap — blurred copy of THIS
  // rank's bg photo, fills the band edge-to-edge.
  bannerSceneBase: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  // Top fade overlay — solid above-rank colour at the band's top edge
  // easing to transparent over BAND_TOP_FADE_PCT of the band's height.
  // `height` is supplied inline so the constant stays in one place.
  bannerTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: BANNER_TOP_FADE_OPACITY,
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerTextWrap: {
    // The banner art puts the emblem on the LEFT and the ornate frame
    // (where the rank name sits) on the RIGHT. The paddings push the
    // text container to fully overlap that frame, then `alignItems` +
    // `justifyContent` center the name visually inside it. Values
    // chosen so the horizontal centre of the text container lands at
    // ~66% of the banner width — roughly the centre of the frame —
    // for every tier.
    ...StyleSheet.absoluteFillObject,
    paddingLeft: '34%',
    paddingRight: '2%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    // 14 (was 18) + letterSpacing 1 (was 2) so the longest names
    // ("CONSISTENT TRADER" / "DISCIPLINED TRADER") fit inside the
    // ornate plaque area without truncation across every screen
    // width. adjustsFontSizeToFit + minimumFontScale={0.6} on the
    // <Text> is the safety net for edge cases.
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  stonesWrap: {
    flex: 1,
    paddingTop: 8,
    // Extra room at the bottom so the "I" stone's name + XP label (and
    // its progress bar when it's the current node) sit fully inside
    // the photo with a little gap to the bottom edge.
    paddingBottom: 28,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stoneRow: { alignItems: 'center' },
  stoneCenter: { alignItems: 'center' },
  stone: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  stoneReached: { backgroundColor: GOLD, borderColor: WHITE },
  stoneCurrent: {
    backgroundColor: GOLD,
    borderColor: WHITE,
    transform: [{ scale: 1.2 }],
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  stoneLocked: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stoneNumeral: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  checkOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#000',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GOLD,
  },
  checkText: { color: GOLD, fontSize: 12, fontWeight: '900' },
  stoneName: {
    marginTop: 6,
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stoneNameLocked: { color: 'rgba(255,255,255,0.5)' },
  stoneThreshold: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stoneThresholdLocked: { color: 'rgba(255,255,255,0.35)' },
  youCol: { marginTop: 6, alignItems: 'center', gap: 4 },
  youPill: {
    backgroundColor: GOLD,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  youText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  progressWrap: { width: 140 },
  progressLabel: {
    marginTop: 3,
    color: WHITE,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  maxPill: {
    backgroundColor: GOLD,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
  },
  maxText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

});
