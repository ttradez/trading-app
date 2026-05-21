import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import RankBanner from './RankBanner';
import { RankForXP } from '../data/rankConfig';
import { Badge } from '../data/badges';
import { colors as DT } from '../theme/tokens';

/**
 * Slim ~64pt rank strip (DESIGN_AUDIT §3.1). Replaces the legacy
 * stacked rank card + Next Badges grid with a single dense row:
 * the diagonal-stripe rank chip on the left, the current rank +
 * XP-to-next text, and a "Next: <badge>" inline progress on the
 * right side.
 *
 * The diagonal-stripe rank visual is one of the more distinctive
 * elements in the app — this gives it a smaller dedicated home
 * without making it the page's lead.
 */

const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';

interface NextBadgeProgress {
  badge: Badge;
  current: number;
  target: number;
}

interface Props {
  rankInfo: RankForXP;
  nextBadge: NextBadgeProgress | null;
  onPress: () => void;
}

export default function RankStrip({ rankInfo, nextBadge, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.strip, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={
        nextBadge
          ? `${rankInfo.label}, next badge ${nextBadge.badge.name} ${nextBadge.current} of ${nextBadge.target}`
          : `${rankInfo.label}`
      }
    >
      <View style={styles.chipWrap}>
        <RankBanner rank={rankInfo.rank} width={56} subTier={rankInfo.subTier} />
      </View>

      <View style={styles.middle}>
        <Text style={styles.rankLabel} numberOfLines={1}>{rankInfo.label}</Text>
        <Text style={styles.xpLabel} numberOfLines={1}>
          {rankInfo.next
            ? `${rankInfo.xpInTier}/${rankInfo.xpNeededForNext} XP to ${rankInfo.next.label}`
            : 'Max rank reached'}
        </Text>
      </View>

      {nextBadge && (
        <View style={styles.badgeWrap}>
          <MaterialCommunityIcons
            name={nextBadge.badge.icon}
            size={16}
            color="rgba(255,184,0,0.7)"
          />
          <View style={styles.badgeText}>
            <Text style={styles.badgeEyebrow}>NEXT</Text>
            <Text style={styles.badgeName} numberOfLines={1}>
              {nextBadge.badge.name} ({nextBadge.current}/{nextBadge.target})
            </Text>
          </View>
        </View>
      )}

      <Ionicons
        name="chevron-forward"
        size={16}
        color="rgba(255,255,255,0.3)"
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: DT.hairlineHighlight,
    borderRadius: 14,
  },
  chipWrap: {
    marginRight: 10,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  rankLabel: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  xpLabel: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 130,
    marginLeft: 8,
  },
  badgeText: {
    marginLeft: 6,
    minWidth: 0,
    flexShrink: 1,
  },
  badgeEyebrow: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badgeName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
