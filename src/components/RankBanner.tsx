import React from 'react';
import {
  View, Text, Image, StyleSheet, ViewStyle,
} from 'react-native';
import type { RankId } from '../data/rankConfig';

/**
 * RankBanner — image-backed rank name-tag / plate.
 *
 * Renders the per-rank PNG from `assets/ranks/banner_<n>_<rank>.png`
 * with the rank's display NAME overlaid in the plate's central
 * cartouche. Plates differ in lightness (paper is bone, profitable
 * is dark warm, the rest are gold-on-dark), so the overlay color is
 * tuned per rank via `RANK_TAG_TEXT_COLOR`.
 *
 * Prop interface is preserved exactly from the prior SVG-based
 * version (`rank`, `width`, `showYouIndicator`, `upNext`, `locked`,
 * `subTier`) so existing callers — CelebrationModal,
 * RankUpCelebrationHost, the onboarding rank-reveal cascade — keep
 * working unchanged.
 *
 * `Rank` is re-exported as an alias for `RankId` for the same
 * reason: any old `import { Rank } from './RankBanner'` still
 * resolves to the new 6-rank union.
 */

export type Rank = RankId;

interface Props {
  rank: Rank;
  /** Fixes the banner display width in px. If omitted, the banner
   *  stretches to fill its parent and the 3:1 aspect drives the
   *  height. */
  width?: number;
  /** Render a small "← YOU" label to the right of the banner. */
  showYouIndicator?: boolean;
  /** Show a small gold "UP NEXT" pill in the top-right corner + a
   *  faint gold glow on the plate. Used on screens (e.g. the
   *  rank-reveal cascade) where one rank is highlighted as the
   *  immediate next goal. */
  upNext?: boolean;
  /** Render the whole banner at ~0.45 opacity with a subtle dark
   *  scrim — signals "future rank, not yet earned". */
  locked?: boolean;
  /** Sub-tier (1|2|3), or null for the Funded cap (no division —
   *  pips are hidden entirely). When 1|2|3 is provided, 3 pip dots
   *  render at the bottom of the plate — filled gold for earned
   *  tiers, hollow for the rest (e.g. Disciplined II → ●●○). Omit
   *  (or pass null) to render no pips. */
  subTier?: 1 | 2 | 3 | null;
}

const BANNER_SRC: Record<RankId, ReturnType<typeof require>> = {
  paper:        require('../../assets/ranks/banner_1_paper.png'),
  unprofitable: require('../../assets/ranks/banner_2_unprofitable.png'),
  disciplined:  require('../../assets/ranks/banner_3_disciplined.png'),
  consistent:   require('../../assets/ranks/banner_4_consistent.png'),
  profitable:   require('../../assets/ranks/banner_5_profitable.png'),
  funded:       require('../../assets/ranks/banner_6_funded.png'),
};

const RANK_NAME: Record<RankId, string> = {
  paper:        'PAPER',
  unprofitable: 'UNPROFITABLE',
  disciplined:  'DISCIPLINED',
  consistent:   'CONSISTENT',
  profitable:   'PROFITABLE',
  funded:       'FUNDED',
};

/**
 * Per-rank vertical offset for the rank label. The plate art inside
 * each PNG isn't at the geometric center of the image — wings extend
 * different amounts above vs below the central plate, so a label
 * centered in the bannerBox (absoluteFillObject) lands above or
 * below the plate's actual middle on some emblems. These offsets
 * nudge the label so it visually sits dead-center of the plate face.
 *
 * Positive = down. Tune per emblem after a visual check.
 */
const RANK_LABEL_Y_OFFSET: Record<RankId, number> = {
  paper:        0,
  unprofitable: 10,   // plate sits low; default render lands above it
  disciplined:  0,
  consistent:   6,    // mild low-bias
  profitable:   0,
  funded:       0,
};

/**
 * Per-rank font size — sized for the WORST CASE rendered glyph width.
 * Bold uppercase chars (with letter-spacing) realistically run ≈1.1 ×
 * fontSize wide per char on the system sans-serif fallback — wider
 * than my earlier 0.75× estimate, which is why "UNPROFITABLE" kept
 * truncating with "..." even after the labelInner widen.
 *
 * For a 345 pt banner with labelInner at 55% (190 pt available):
 *   ≤ 6 chars  → 18 pt    (PAPER, FUNDED)        5×1.1×18 = 99 pt
 *   7+ chars   → 11 pt    (long names)          12×1.1×11 = 145 pt
 *
 * Both leave ≥40 pt safety margin so the bundled-font load timing
 * (Inter vs JBM vs system fallback) can't cause overrun.
 */
function fontSizeForRank(rank: RankId): number {
  const len = RANK_NAME[rank].length;
  if (len <= 6) return 18;
  return 11;
}

/** Text color per rank. Every plate has a dark or fully-transparent
 *  central cartouche (verified by sampling each PNG's center pixel —
 *  paper alpha=28, profitable alpha=0, the rest are near-black), so
 *  all six labels need light fills. Cream for the two transparent
 *  plates (paper, profitable) gives them a parchment feel; gold and
 *  off-white for the rest matches the warm-metal frames. */
const RANK_TAG_TEXT_COLOR: Record<RankId, string> = {
  paper:        '#F4E6D0',
  unprofitable: '#EDEDED',
  disciplined:  '#F2D27A',
  consistent:   '#F2D27A',
  profitable:   '#F4E6D0',
  funded:       '#F4D67A',
};

const GOLD = '#FFB800';

export default function RankBanner({
  rank,
  width,
  showYouIndicator = false,
  upNext = false,
  locked = false,
  subTier,
}: Props) {
  // Container always carries the 3:1 aspect that the plate art
  // assumes. With `width` it's pinned; otherwise it fills the parent
  // and the row height follows the aspect ratio.
  const bannerSizeStyle: ViewStyle =
    width != null ? { width, aspectRatio: 3 } : { width: '100%', aspectRatio: 3 };

  // Label-overlay vars kept for v1.1 typography pass — see commented
  // block in the JSX below. Underscore-prefixed to satisfy lint while
  // unused.
  const _labelText = RANK_NAME[rank];
  const _labelColor = RANK_TAG_TEXT_COLOR[rank];
  const _labelFontSize = fontSizeForRank(rank);
  const _labelYOffset = RANK_LABEL_Y_OFFSET[rank];
  void _labelText; void _labelColor; void _labelFontSize; void _labelYOffset;

  const banner = (
    <View
      style={[
        styles.bannerBox,
        bannerSizeStyle,
        upNext && styles.bannerUpNextGlow,
      ]}
    >
      <Image
        source={BANNER_SRC[rank]}
        resizeMode="contain"
        style={[styles.image, locked && styles.imageLocked]}
      />

      {/* Dark scrim on locked plates — sits on top of the dimmed
          image so it reads as "not yet earned" without a grayscale
          filter (no SVG primitives needed). */}
      {locked && <View style={styles.lockedScrim} pointerEvents="none" />}

      {/* Rank-name text overlay was removed for v1.0 — the user
          preferred the banners to read as pure heraldic emblems
          without the engraved name plate. Vars labelText / labelColor
          / labelFontSize / labelYOffset are kept in scope above for
          when we re-introduce a refined typography pass in v1.1.
      <View style={styles.labelWrap} pointerEvents="none">
        <View
          style={[
            styles.labelInner,
            labelYOffset !== 0 && { transform: [{ translateY: labelYOffset }] },
          ]}
        >
          <Text
            style={[
              styles.labelText,
              { color: labelColor, fontSize: labelFontSize },
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {labelText}
          </Text>
        </View>
      </View>
      */}

      {/* Sub-tier pips — three small dots pinned to the bottom edge
          of the plate. Hidden when subTier is null/undefined (e.g.
          the Funded cap, or callers that don't pass it). */}
      {subTier != null && (
        <View style={styles.pipsRow} pointerEvents="none">
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.pip, i <= subTier ? styles.pipOn : styles.pipOff]}
            />
          ))}
        </View>
      )}

      {/* "UP NEXT" pill — gold flag in the top-right corner. The
          softer banner-wide gold glow lives on `bannerBox` via the
          `bannerUpNextGlow` style above. */}
      {upNext && (
        <View style={styles.upNextPill} pointerEvents="none">
          <Text style={styles.upNextText}>UP NEXT</Text>
        </View>
      )}
    </View>
  );

  if (!showYouIndicator) return banner;

  // Wrap in a row so the "← YOU" arrow sits to the right of the
  // banner (matches the prior SVG version's external label).
  return (
    <View style={styles.youRow}>
      {banner}
      <Text style={styles.youLabel}>← YOU</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  youRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  youLabel: {
    marginLeft: 10,
    color: GOLD,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  bannerBox: {
    position: 'relative',
    justifyContent: 'center',
  },
  bannerUpNextGlow: {
    shadowColor: GOLD,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  image: {
    width: '100%',
    height: '100%',
  },
  imageLocked: {
    opacity: 0.45,
  },
  lockedScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },

  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 55% inner width — enough horizontal room that even the longest
  // name ("UNPROFITABLE", 12 chars) at the bold sans-serif fallback
  // font's actual rendered width sits inside with ≥40 pt safety
  // margin, so numberOfLines:1 never has to truncate with "...".
  labelInner: {
    width: '55%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    // JetBrainsMono Bold — chosen for the "engraved metal plate" vibe.
    // Monospaced slabby glyphs read as stamped/etched on the rank
    // emblem's central cartouche, which is a much better aesthetic
    // match for the wings + plate artwork than a generic sans-serif.
    // (Inter / system fonts looked too "app UI" against the heraldic
    // emblems.) Loaded in App.tsx via useFonts.
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    // Strong dark halo gives the uniformly-light text weight against
    // each plate's dark / transparent interior. Same tuning as
    // RankStrip.bannerText.
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  pipsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  pipOn: {
    backgroundColor: GOLD,
  },
  pipOff: {
    backgroundColor: 'transparent',
  },

  upNextPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: GOLD,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  upNextText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
