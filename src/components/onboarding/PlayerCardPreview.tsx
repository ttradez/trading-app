import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RankBanner, { Rank } from '../RankBanner';
import { FirstTradeBadge } from '../../store/onboardingStore';

/**
 * Live player-card preview used on the trader-name screen and reused
 * on later screens that show the user's identity (e.g. screen 11's
 * "save your progress" recap). Renders the user's rank banner
 * (custom artwork), display name, @handle, and optionally a small
 * earned-badge pill.
 *
 * No card border / background — the banner artwork's black blends
 * straight into the screen's pure black so the rank reads as
 * standalone, not boxed.
 */

const BADGE_INFO: Record<FirstTradeBadge, { label: string; color: string }> = {
  first_strike: { label: 'FIRST STRIKE', color: '#FFB800' },
  first_blood:  { label: 'FIRST BLOOD',  color: '#FF4757' },
  first_step:   { label: 'FIRST STEP',   color: '#FFB800' },
};

interface Props {
  rank?: Rank;
  displayName: string;
  handle: string;
  /** Optional earned badge (from screen 9). Renders a small pill
   *  below the @handle line in the badge's color. */
  badge?: FirstTradeBadge | null;
  /** Whether to render the "← YOU" indicator next to the rank banner.
   *  Default true; pass false for read-only contexts like the auth
   *  recap on screen 11 where it'd read as out-of-place. */
  showYouIndicator?: boolean;
}

export default function PlayerCardPreview({
  rank = 'gambler', displayName, handle, badge, showYouIndicator = true,
}: Props) {
  const isNameEmpty   = displayName.trim().length === 0;
  const isHandleEmpty = handle.trim().length === 0;
  const badgeInfo = badge ? BADGE_INFO[badge] : null;

  return (
    <View style={styles.wrap}>
      <RankBanner rank={rank} showYouIndicator={showYouIndicator} />

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

      {badgeInfo && (
        <View style={[styles.badgePill, { backgroundColor: badgeInfo.color }]}>
          <Text style={styles.badgeText}>{badgeInfo.label}</Text>
        </View>
      )}
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
  badgePill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
  },
  badgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
