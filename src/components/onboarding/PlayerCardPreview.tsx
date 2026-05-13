import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RankBanner, { Rank } from '../RankBanner';

/**
 * Live player-card preview used on the trader-name screen (and
 * reusable on later screens that show the user's identity). Renders
 * the user's rank banner (custom artwork), display name, and @handle.
 * Display name and handle update in real time as the user types in
 * the trader-name inputs.
 *
 * Today only Gambler is wired up. Pass other Rank ids on future
 * screens (Paper Hands / Sniper / Inside Trader / Market Maker).
 *
 * No card border / background — the banner artwork's black blends
 * straight into the screen's pure black so the rank reads as
 * standalone, not boxed.
 */

interface Props {
  rank?: Rank;
  displayName: string;
  handle: string;
}

export default function PlayerCardPreview({
  rank = 'gambler', displayName, handle,
}: Props) {
  const isNameEmpty   = displayName.trim().length === 0;
  const isHandleEmpty = handle.trim().length === 0;

  return (
    <View style={styles.wrap}>
      <RankBanner rank={rank} showYouIndicator />

      <Text
        style={[styles.displayName, isNameEmpty && styles.placeholder]}
        numberOfLines={1}
      >
        {isNameEmpty ? 'Your Name' : displayName}
      </Text>
      <Text
        style={[styles.handleLine, isHandleEmpty && styles.placeholder]}
        numberOfLines={1}
      >
        {isHandleEmpty ? '@your.handle' : '@' + handle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // No bg / border / radius — banner artwork's black blends with the
  // screen background; display name + handle float beneath.
  wrap: {
    width: '100%',
  },
  displayName: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  handleLine: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  placeholder: {
    color: 'rgba(255,255,255,0.3)',
  },
});
