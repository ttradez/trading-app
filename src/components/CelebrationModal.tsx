import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, Animated, Easing, StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SnowflakeIcon, FlameIcon } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';

import RankBanner from './RankBanner';
import Button from './ui/Button';
import { getBadge } from '../data/badges';
import { CelebrationEvent } from '../store/celebrationQueueStore';
import { maybeHaptic } from '../store/settingsStore';
import { colors, typography } from '../theme';

/**
 * Full-screen interstitial celebration for the three biggest reward
 * moments — badge unlock, rank up, streak milestone (DESIGN_AUDIT
 * retention benchmark, "Celebration moments").
 *
 * Pure visual layer: caller is responsible for what to enqueue and
 * when to dismiss. One Continue button at the bottom; achievement
 * element scale-bounces in on mount. Pure-black scrim, brand gold
 * applied ONLY on the achievement glyph + Continue button.
 *
 * Haptic policy: a medium impact fires once on mount via
 * `maybeHaptic` (respects the user's haptic-feedback setting). No
 * audio in this task.
 */

const GOLD = colors.gold;

interface Props {
  event: CelebrationEvent;
  onDismiss: () => void;
}

export default function CelebrationModal({ event, onDismiss }: Props) {
  // Scale 0.85 → 1.0 (slight bounce) + fade 0 → 1, ~250 ms.
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 140,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
    maybeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.center}>
          <Animated.View
            style={{
              opacity,
              transform: [{ scale }],
              alignItems: 'center',
            }}
          >
            {event.kind === 'badge' && <BadgeContent event={event} />}
            {event.kind === 'rank' && <RankContent event={event} />}
            {event.kind === 'streak' && <StreakContent event={event} />}
            {event.kind === 'freeze' && <FreezeContent />}
          </Animated.View>
        </View>

        <View style={styles.ctaWrap}>
          <Button
            label="Continue"
            variant="primary"
            onPress={onDismiss}
            accessibilityLabel="Continue"
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Per-mode content ──────────────────────────────────────────────

function BadgeContent({
  event,
}: { event: Extract<CelebrationEvent, { kind: 'badge' }> }) {
  const badge = getBadge(event.badgeId);
  if (!badge) return null;
  return (
    <>
      <Text style={styles.eyebrow}>BADGE UNLOCKED</Text>
      <View style={styles.badgeIconRing}>
        <MaterialCommunityIcons name={badge.icon} size={56} color={GOLD} />
      </View>
      <Text style={[typography.display, styles.title]} numberOfLines={2}>
        {badge.name}
      </Text>
      <Text style={[typography.body, styles.body]}>{badge.description}</Text>
    </>
  );
}

function RankContent({
  event,
}: { event: Extract<CelebrationEvent, { kind: 'rank' }> }) {
  return (
    <>
      <Text style={styles.eyebrow}>RANK UP</Text>
      <View style={styles.rankBannerWrap}>
        <RankBanner rank={event.rank} width={220} subTier={event.subTier} />
      </View>
      <Text style={[typography.display, styles.title]}>{event.label}</Text>
      {event.xpEarned > 0 && (
        <Text style={[typography.body, styles.body]}>
          +{event.xpEarned} XP earned
        </Text>
      )}
    </>
  );
}

function FreezeContent() {
  // Snowflake-over-flame layered glyph. Flame sits beneath as the
  // existing streak metaphor; snowflake-fill in white@90% lands on
  // top to convey "this protects the flame." Positive framing only
  // — the body copy never references missing days as a threat.
  return (
    <>
      <Text style={styles.eyebrow}>STREAK FREEZE EARNED</Text>
      <View style={styles.layerRing}>
        <View style={StyleSheet.absoluteFill as any}>
          <View style={styles.layerFlame}>
            <FlameIcon size={56} weight="fill" color="rgba(255,184,0,0.9)" />
          </View>
        </View>
        <View style={styles.layerSnowflake}>
          <SnowflakeIcon size={36} weight="fill" color="rgba(255,255,255,0.95)" />
        </View>
      </View>
      <Text style={[typography.display, styles.title]}>Freeze ready</Text>
      <Text style={[typography.body, styles.body]}>
        Use it to protect a missed day.
      </Text>
    </>
  );
}

function StreakContent({
  event,
}: { event: Extract<CelebrationEvent, { kind: 'streak' }> }) {
  return (
    <>
      <Text style={styles.eyebrow}>STREAK MILESTONE</Text>
      <View style={styles.flameRing}>
        <Ionicons name="flame" size={56} color={GOLD} />
      </View>
      <Text style={[typography.display, styles.title]} allowFontScaling={false}>
        {event.count}-day streak
      </Text>
      <Text style={[typography.body, styles.body]}>
        {event.nextMilestone
          ? `Next milestone: ${event.nextMilestone} days`
          : 'You have reached the top streak milestone — keep going.'}
      </Text>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Locked typography eyebrow token (color applied separately).
  eyebrow: {
    ...typography.eyebrow,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 18,
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 20,
    maxWidth: 320,
  },
  body: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 320,
  },
  badgeIconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  rankBannerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  flameRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  // Freeze layered glyph — flame beneath, snowflake on top.
  layerRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  layerFlame: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.55, // dimmer underlay so the snowflake reads on top
  },
  layerSnowflake: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrap: {},
});
