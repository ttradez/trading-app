import React from 'react';
import { View, Image, Text, StyleSheet, ImageStyle } from 'react-native';

/**
 * RankBanner — renders one rank's banner artwork by cropping it out
 * of the stacked `assets/ranks/rank_banners.png` source.
 *
 * Approach (per spec — single source image, no per-rank files):
 *  - The source PNG is 1774 × 887 px (2:1 total aspect). 5 banners
 *    stacked vertically; each banner is roughly 10:1 wide:tall.
 *  - We wrap the Image in an overflow:hidden container at the
 *    per-banner aspect ratio (10:1). The image inside is positioned
 *    absolutely at full width with its native 2:1 aspect, then
 *    pushed up by `rankIndex * 100%` (= one banner height) so the
 *    appropriate slice shows.
 *
 * Reusable: future profile / leaderboard / achievement screens can
 * drop this in and pass the rank.
 */

export type Rank =
  | 'gambler'
  | 'paper_hands'
  | 'sniper'
  | 'inside_trader'
  | 'market_maker';

const RANK_INDEX: Record<Rank, number> = {
  gambler:       0,
  paper_hands:   1,
  sniper:        2,
  inside_trader: 3,
  market_maker:  4,
};

const BANNER_ASPECT = 10;   // per-banner width / height
const SOURCE_ASPECT = 2;    // total source-image width / height (1774 / 887)

interface Props {
  rank: Rank;
  /** If provided, fixes the banner display width in px. Otherwise the
   *  banner stretches to fill the parent (flex:1) and aspectRatio sets
   *  the height. */
  width?: number;
  /** When true, renders a small "← YOU" label to the right of the
   *  banner, vertically centered, ~8 px gap. */
  showYouIndicator?: boolean;
}

export default function RankBanner({ rank, width, showYouIndicator = false }: Props) {
  const cropperStyle = width
    ? { width, height: width / BANNER_ASPECT, overflow: 'hidden' as const }
    : { flex: 1, aspectRatio: BANNER_ASPECT, overflow: 'hidden' as const };

  // `top` accepts a percentage string in RN — relative to the parent's
  // height (one banner height in our container). -100% per rank index
  // moves the image up by exactly one banner slice.
  const imageStyle: ImageStyle = {
    position: 'absolute',
    left: 0,
    width: '100%',
    aspectRatio: SOURCE_ASPECT,
    top: (`${-RANK_INDEX[rank] * 100}%` as unknown) as number,
  };

  return (
    <View style={styles.row}>
      <View style={cropperStyle}>
        <Image
          source={require('../../assets/ranks/rank_banners.png')}
          style={imageStyle}
          resizeMode="cover"
          accessibilityLabel={`${rank.replace('_', ' ')} rank banner`}
        />
      </View>
      {showYouIndicator && (
        <Text style={styles.youText}>← YOU</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  youText: {
    marginLeft: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
