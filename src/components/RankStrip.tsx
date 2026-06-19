import React from 'react';
import {
  View, Text, StyleSheet, Image, Pressable,
} from 'react-native';

// Banner-only render — NumericText / ProgressBar / PressableCard /
// Ionicons no longer used; left out of imports.
import { RankForXP, RankId } from '../data/rankConfig';
import { Badge } from '../data/badges';
import { useOnboardingStore } from '../store/onboardingStore';
import { useXpStore } from '../store/xpStore';

// New per-RankId banner art (the 6-rank plate set delivered with
// the rank rewrite). Replaces the old 7-tier `RANK_BANNERS[emblemKey]`
// lookup — the backend now sends `emblem_key` values matching the
// new RankId union, so an explicit RankId → image map is the
// correct shape.
const BANNER_SRC: Record<RankId, ReturnType<typeof require>> = {
  paper:        require('../../assets/ranks/banner_1_paper.png'),
  unprofitable: require('../../assets/ranks/banner_2_unprofitable.png'),
  disciplined:  require('../../assets/ranks/banner_3_disciplined.png'),
  consistent:   require('../../assets/ranks/banner_4_consistent.png'),
  profitable:   require('../../assets/ranks/banner_5_profitable.png'),
  funded:       require('../../assets/ranks/banner_6_funded.png'),
};

// Text color per rank's plate — every banner has a DARK or
// TRANSPARENT cartouche (the card's #0A0A0A shows through on the
// alpha-0 ones), so dark ink would vanish. Verified by sampling the
// center pixel of each PNG: paper/profitable are transparent, the
// other four are near-black. Light cream + warm gold tones below
// read on all six. Mirrors RankBanner's RANK_TAG_TEXT_COLOR.
const USERNAME_TEXT_COLOR: Record<RankId, string> = {
  paper:        '#F4E6D0',
  unprofitable: '#EDEDED',
  disciplined:  '#F2D27A',
  consistent:   '#F2D27A',
  profitable:   '#F4E6D0',
  funded:       '#F4D67A',
};

/**
 * Rank card (Phase 3 — Ideogram art). Replaces the prior slim
 * stripe with a banner-art card: the current tier's 3:1 plaque
 * artwork as the visual lead, the user's username overlaid on
 * the plaque, the level name and progress-to-next below.
 *
 * Renders banner-only when `serverRank` is available (the 7-tier
 * backend ladder drives the emblem_key → art lookup). The
 * `rankInfo` / `nextBadge` props are kept on the surface so the
 * existing callsites (Home + Dashboard) don't need to change;
 * `rankInfo` is used as the fallback label + progress while the
 * server rank object is still null on first paint.
 */

const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';
const CARD_BG     = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';

interface NextBadgeProgress {
  badge: Badge;
  current: number;
  target: number;
}

interface Props {
  rankInfo: RankForXP;
  // Kept on the API for compat — the new banner card no longer
  // surfaces next-badge inline (the Badges tab owns that). Pass
  // null from callsites that don't need it.
  nextBadge: NextBadgeProgress | null;
  onPress: () => void;
}

export default function RankStrip({ rankInfo, onPress }: Props) {
  const displayName = useOnboardingStore((s) => s.displayName);
  const serverRank  = useXpStore((s) => s.serverRank);

  // The backend's emblem_key is now an authoritative RankId
  // ('paper' | 'unprofitable' | … | 'funded'). Prefer it; fall back
  // to the local rankInfo.rank so the first paint isn't blank.
  const rankKey: RankId = (serverRank?.emblem_key as RankId)
    ?? rankInfo.rank;

  const levelName = serverRank?.level_name ?? rankInfo.label;
  const isMax     = serverRank?.is_max ?? (rankInfo.next == null);

  // Progress 0–1. Prefer server-authoritative xp_into_level /
  // (xp_into_level + xp_for_next); fall back to local rankInfo.
  const ratio = (() => {
    if (isMax) return 1;
    if (serverRank) {
      const span = serverRank.xp_into_level + serverRank.xp_for_next;
      return span > 0 ? Math.min(1, serverRank.xp_into_level / span) : 0;
    }
    return rankInfo.xpNeededForNext > 0
      ? Math.min(1, rankInfo.xpInTier / rankInfo.xpNeededForNext)
      : 0;
  })();

  const xpInto = serverRank?.xp_into_level ?? rankInfo.xpInTier;
  const xpSpan = serverRank
    ? serverRank.xp_into_level + serverRank.xp_for_next
    : rankInfo.xpNeededForNext;

  const banner = BANNER_SRC[rankKey];
  const usernameColor = USERNAME_TEXT_COLOR[rankKey];

  // Pure banner-only render — no card frame, no rank-name caption,
  // no progress bar, no XP label. Just the wood-framed plate with
  // the username overlaid. Still tappable to nav into the Ranks tab
  // (the parent passes `onPress`). The `ratio` / `xpInto` / `xpSpan`
  // / `isMax` / `levelName` values above remain computed so the
  // accessibility label stays informative and so the file is ready
  // to drop the chrome back in later if asked.
  void ratio; void xpInto; void xpSpan; void isMax;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${levelName} — tap to view Journey`}
    >
      <View style={styles.bannerWrap}>
        <Image source={banner} resizeMode="cover" style={styles.bannerImg} />
        <View style={styles.bannerTextWrap} pointerEvents="none">
          <View style={styles.bannerTextInner}>
            <Text
              style={[styles.bannerText, { color: usernameColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {displayName || 'TRADER'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bannerWrap: {
    width: '100%',
    // Shortened from 3:1 to 4:1 — the source PNG has empty padding
    // top + bottom, so a flatter box clips that dead space without
    // touching the artwork. Combined with the image scale-up below
    // the plate fills the visible area cleanly.
    aspectRatio: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    // Scale-up zooms past the empty padding around the cartouche so
    // the plate dominates the box. The wings get gently cropped flush
    // to the card edges. 1.7 was tuned against banner_1_paper.png's
    // ~40%-of-width cartouche; the other plates use the same layout.
    transform: [{ scale: 1.7 }],
  },
  bannerTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tightened from 46% → 30% so the username stays squarely inside
  // the (now-larger) cartouche. Bleeding past the white plate onto
  // the wood frame was making dark paper-rank text vanish into the
  // card background. adjustsFontSizeToFit handles long names.
  bannerTextInner: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.0,
    textAlign: 'center',
    // Strong dark halo gives the now-uniformly-light text weight
    // against each plate's dark interior. Tuned so cream/white text
    // on paper still pops, and gold text on the funded/disciplined
    // plates gets enough contrast to feel deliberate, not floaty.
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  rankLabel: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  barWrap: {
    marginTop: 6,
    paddingHorizontal: 12,
  },
  xpLabel: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 12,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  maxPill: {
    marginTop: 6,
    marginBottom: 10,
    marginLeft: 12,
    alignSelf: 'flex-start',
    backgroundColor: GOLD,
    paddingHorizontal: 10,
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
