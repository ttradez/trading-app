import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, Animated, Easing, StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import RankBanner from './RankBanner';
import { useCelebrationStore, CelebrationItem } from '../store/celebrationStore';
import { useBadgeToastStore } from '../store/badgeToastStore';
import { useChallengeToastStore } from '../store/challengeToastStore';
import {
  RANK_PROMOTION_COPY, RANK_THEME_COLOR, RankId, SubTier,
} from '../data/rankConfig';
import { maybeHaptic, maybeNotificationHaptic } from '../store/settingsStore';

/**
 * Drains the rank-up celebration queue. Ordering: the host waits
 * until the badge + challenge toast queues are empty (+ a short
 * grace) before showing, so a rank-up — the biggest moment — is
 * never upstaged. The journal popup is always first because XP
 * is granted only AFTER it's dismissed (so the promo is enqueued
 * after the modal is gone).
 *
 *  - 'sub_tier' (I→II, II→III): compact modal, pip scale-bounce.
 *  - 'rank'     (e.g. Gambler→Paper Hands): full-screen takeover
 *    — gold flash → particle burst → banner spring-in → name →
 *    copy → Continue.
 *
 * No new dependency: particles are plain Animated.Views on random
 * trajectories.
 */

const GOLD = '#FFB800';
const PIP_HOLLOW = '#333333';
const RANK_NAME: Record<RankId, string> = {
  gambler: 'Gambler',
  paper_hands: 'Paper Hands',
  sniper: 'Sniper',
  inside_trader: 'Inside Trader',
  market_maker: 'Market Maker',
};
const ROMAN: Record<SubTier, string> = { 1: 'I', 2: 'II', 3: 'III' };

// ── Animated pip row (RN, not the SVG banner pips) ─────────────────────────

function PipRow({
  subTier, animateIndex, size = 12,
}: { subTier: SubTier; animateIndex: number | null; size?: number }) {
  // The pip at `animateIndex` bounces from hollow → gold on mount.
  const scale = useRef(new Animated.Value(animateIndex == null ? 1 : 0.2)).current;
  useEffect(() => {
    if (animateIndex == null) return;
    Animated.spring(scale, {
      toValue: 1, tension: 140, friction: 5, useNativeDriver: true,
    }).start();
  }, [animateIndex, scale]);

  return (
    <View style={styles.pipRow}>
      {[0, 1, 2].map((i) => {
        const earned = i < subTier;
        const isAnim = i === animateIndex;
        const dot = (
          <View
            style={[
              {
                width: size, height: size, borderRadius: size / 2,
                borderWidth: 2,
              },
              earned
                ? { backgroundColor: GOLD, borderColor: GOLD }
                : { backgroundColor: 'transparent', borderColor: PIP_HOLLOW },
            ]}
          />
        );
        return (
          <View key={i} style={styles.pipWrap}>
            {isAnim ? (
              <Animated.View style={{ transform: [{ scale }] }}>{dot}</Animated.View>
            ) : dot}
          </View>
        );
      })}
    </View>
  );
}

// ── Particle burst ─────────────────────────────────────────────────────────

function ParticleBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }).map(() => ({
        angle: Math.random() * Math.PI * 2,
        dist: 90 + Math.random() * 110,
        size: 6 + Math.random() * 4,
        delay: Math.random() * 80,
      })),
    [],
  );
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1, duration: 850, easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [p]);

  return (
    <View pointerEvents="none" style={styles.particleField}>
      {particles.map((pt, i) => {
        const tx = p.interpolate({
          inputRange: [0, 1], outputRange: [0, Math.cos(pt.angle) * pt.dist],
        });
        const ty = p.interpolate({
          inputRange: [0, 1], outputRange: [0, Math.sin(pt.angle) * pt.dist],
        });
        const opacity = p.interpolate({
          inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: pt.size, height: pt.size, borderRadius: pt.size / 2,
              backgroundColor: GOLD,
              opacity,
              transform: [{ translateX: tx }, { translateY: ty }],
            }}
          />
        );
      })}
    </View>
  );
}

// ── Sub-tier modal ─────────────────────────────────────────────────────────

function SubTierCelebration({
  item, onClose,
}: { item: CelebrationItem; onClose: () => void }) {
  useEffect(() => {
    maybeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
  }, []);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.subBackdrop}>
        <View style={styles.subCard}>
          <Text style={styles.rankUpLabel}>RANK UP</Text>
          <View style={styles.subBannerWrap}>
            <RankBanner rank={item.newRank} width={220} />
          </View>
          <PipRow
            subTier={item.newSubTier}
            animateIndex={item.newSubTier - 1}
          />
          <Text style={styles.subRankName}>
            {RANK_NAME[item.newRank]} {ROMAN[item.newSubTier]}
          </Text>
          <Text style={styles.subXp}>+{item.xpEarned} XP</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Main-rank full-screen ──────────────────────────────────────────────────

function MainRankCelebration({
  item, onClose,
}: { item: CelebrationItem; onClose: () => void }) {
  const flash    = useRef(new Animated.Value(0)).current;
  const bannerSc = useRef(new Animated.Value(0.5)).current;
  const bannerOp = useRef(new Animated.Value(0)).current;
  const nameOp   = useRef(new Animated.Value(0)).current;
  const copyOp   = useRef(new Animated.Value(0)).current;
  const ctaOp    = useRef(new Animated.Value(0)).current;

  const theme = RANK_THEME_COLOR[item.newRank];
  const copy = RANK_PROMOTION_COPY[item.newRank];

  useEffect(() => {
    Animated.sequence([
      // a. gold flash
      Animated.timing(flash, {
        toValue: 1, duration: 120, useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0, duration: 220, useNativeDriver: true,
      }),
    ]).start();

    // c. banner spring-in (+ Medium haptic on land)
    Animated.parallel([
      Animated.timing(bannerOp, {
        toValue: 1, duration: 300, delay: 250, useNativeDriver: true,
      }),
      Animated.spring(bannerSc, {
        toValue: 1, tension: 60, friction: 6, delay: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      maybeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    });

    // e. name fade
    Animated.timing(nameOp, {
      toValue: 1, duration: 400, delay: 850, useNativeDriver: true,
    }).start();

    // f. copy fade (+ Success haptic)
    Animated.timing(copyOp, {
      toValue: 1, duration: 400, delay: 1250, useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        maybeNotificationHaptic(Haptics.NotificationFeedbackType.Success);
      }
    });

    // g. CTA fade
    Animated.timing(ctaOp, {
      toValue: 1, duration: 350, delay: 1700, useNativeDriver: true,
    }).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.mainRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.goldFlash, { opacity: flash.interpolate({
            inputRange: [0, 1], outputRange: [0, 0.15],
          }) }]}
        />

        <View style={styles.mainCenter}>
          <ParticleBurst />
          <Animated.View
            style={{
              opacity: bannerOp,
              transform: [{ scale: bannerSc }],
            }}
          >
            <RankBanner rank={item.newRank} width={300} />
          </Animated.View>

          <PipRow subTier={item.newSubTier} animateIndex={null} size={14} />

          <Animated.Text
            style={[styles.mainRankName, { color: theme, opacity: nameOp }]}
            allowFontScaling={false}
          >
            {RANK_NAME[item.newRank].toUpperCase()}
          </Animated.Text>

          {copy && (
            <Animated.Text style={[styles.mainCopy, { opacity: copyOp }]}>
              {copy}
            </Animated.Text>
          )}
        </View>

        <Animated.View style={[styles.mainCtaWrap, { opacity: ctaOp }]}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Host ───────────────────────────────────────────────────────────────────

export default function RankUpCelebrationHost() {
  const celebLen = useCelebrationStore((s) => s.queue.length);
  const badgeLen = useBadgeToastStore((s) => s.queue.length);
  const challLen = useChallengeToastStore((s) => s.queue.length);

  const [active, setActive] = useState<CelebrationItem | null>(null);
  const activeRef = useRef<CelebrationItem | null>(null);
  activeRef.current = active;

  useEffect(() => {
    if (active || celebLen === 0) return;
    if (badgeLen > 0 || challLen > 0) return; // let toasts clear first
    // Grace so an in-flight (already-dequeued) toast finishes its
    // ~3 s display before the rank-up takes over.
    const id = setTimeout(() => {
      if (activeRef.current) return;
      if (
        useBadgeToastStore.getState().queue.length > 0 ||
        useChallengeToastStore.getState().queue.length > 0
      ) return;
      const next = useCelebrationStore.getState().dequeue();
      if (next) setActive(next);
    }, 900);
    return () => clearTimeout(id);
  }, [celebLen, badgeLen, challLen, active]);

  if (!active) return null;
  const onClose = () => setActive(null);

  return active.type === 'rank'
    ? <MainRankCelebration item={active} onClose={onClose} />
    : <SubTierCelebration item={active} onClose={onClose} />;
}

const styles = StyleSheet.create({
  // shared CTA
  cta: {
    backgroundColor: GOLD,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rankUpLabel: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },

  pipRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  pipWrap: {
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sub-tier modal
  subBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  subCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F0F0F',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  subBannerWrap: { marginTop: 16 },
  subRankName: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subXp: {
    marginTop: 6,
    color: GOLD,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Main-rank full screen
  mainRoot: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  goldFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GOLD,
  },
  mainCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleField: {
    position: 'absolute',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainRankName: {
    marginTop: 22,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  mainCopy: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  mainCtaWrap: {},
});
