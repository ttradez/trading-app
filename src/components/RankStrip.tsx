import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import RankBanner from './RankBanner';
import NumericText from './NumericText';
import ProgressBar from './ProgressBar';
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
// Rank strip is a secondary tile — L1 in the layered surface system.
const CARD_BG     = '#0A0A0A';
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

// XP-count animation timing — staggered 200ms after the XpBurst
// spawn so the user reads "+N XP" first, then sees the strip
// respond.
const XP_ANIM_DELAY_MS = 200;
const XP_ANIM_DURATION = 400;

export default function RankStrip({ rankInfo, nextBadge, onPress }: Props) {
  // Animated value driving the displayed xpInTier integer. When
  // rankInfo.xpInTier changes, schedule a 200ms-delayed 400ms
  // timing animation that the listener interpolates back into
  // the rendered count via setState.
  const targetXp = rankInfo.xpInTier;
  const xpAnim = useRef(new Animated.Value(targetXp)).current;
  const [displayedXp, setDisplayedXp] = useState(targetXp);
  const prevTargetRef = useRef(targetXp);

  useEffect(() => {
    if (targetXp === prevTargetRef.current) return;
    prevTargetRef.current = targetXp;

    const id = xpAnim.addListener(({ value }) => {
      setDisplayedXp(Math.round(value));
    });
    const animation = Animated.sequence([
      Animated.delay(XP_ANIM_DELAY_MS),
      Animated.timing(xpAnim, {
        toValue: targetXp,
        duration: XP_ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      xpAnim.removeListener(id);
    };
  }, [targetXp, xpAnim]);

  // Ratio is computed from the animated value so the bar fills
  // in sync with the count text. ProgressBar's internal spring
  // smooths the transition.
  const ratio = rankInfo.xpNeededForNext > 0
    ? Math.min(1, displayedXp / rankInfo.xpNeededForNext)
    : 1;

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
        {rankInfo.next ? (
          <>
            <NumericText style={styles.xpLabel} numberOfLines={1}>
              {displayedXp}/{rankInfo.xpNeededForNext} XP to {rankInfo.next.label}
            </NumericText>
            <View style={styles.barWrap}>
              <ProgressBar
                progress={ratio}
                size="sm"
                variant="gold"
                animated
              />
            </View>
          </>
        ) : (
          <Text style={styles.xpLabel} numberOfLines={1}>Max rank reached</Text>
        )}
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
            {/* Mixed prose + digits — keep the Text wrapper for the
                badge name and nest a NumericText for the fraction so
                only the digits get JBM. */}
            <Text style={styles.badgeName} numberOfLines={1}>
              {nextBadge.badge.name} (
              <NumericText style={styles.badgeName}>
                {nextBadge.current}/{nextBadge.target}
              </NumericText>
              )
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
  barWrap: {
    marginTop: 6,
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
