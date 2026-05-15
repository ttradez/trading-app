import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Animated, PanResponder, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useChallengeToastStore, ChallengeToast } from '../store/challengeToastStore';
import { maybeHaptic } from '../store/settingsStore';

/**
 * Challenge-completion toast. Same slide-down / hold / swipe-up
 * pattern + native-overlay Modal as BadgeToastHost, with a green
 * "MISSION COMPLETE" accent and the XP earned. Drains its own
 * queue sequentially; mounted in MainTabs.
 */

const GREEN = '#00D395';
const HOLD_MS = 3000;
const SLIDE_MS = 280;
const GAP_MS = 1000;

export default function ChallengeToastHost() {
  const insets = useSafeAreaInsets();
  const queueLen = useChallengeToastStore((s) => s.queue.length);

  const [active, setActive] = useState<ChallengeToast | null>(null);
  const activeRef = useRef<ChallengeToast | null>(null);
  activeRef.current = active;

  const translateY = useRef(new Animated.Value(-160)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    Animated.timing(translateY, {
      toValue: -160, duration: SLIDE_MS, useNativeDriver: true,
    }).start(() => {
      setActive(null);
      setTimeout(() => { if (!activeRef.current) pickNext(); }, GAP_MS);
    });
  };

  const pickNext = () => {
    if (activeRef.current) return;
    const t = useChallengeToastStore.getState().dequeue();
    if (!t) return;
    setActive(t);
    translateY.setValue(-160);
    Animated.timing(translateY, {
      toValue: 0, duration: SLIDE_MS, useNativeDriver: true,
    }).start();
    maybeHaptic();
    hideTimer.current = setTimeout(beginHide, HOLD_MS);
  };

  useEffect(() => {
    if (!active && queueLen > 0) pickNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueLen, active]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6,
      onPanResponderRelease: (_, g) => { if (g.dy < -20) beginHide(); },
    }),
  ).current;

  if (!active) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={beginHide}>
      <View pointerEvents="box-none" style={styles.root}>
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.card,
            { marginTop: insets.top + 8, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="check-bold" size={22} color={GREEN} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.completeLabel}>MISSION COMPLETE</Text>
            <Text style={styles.name} numberOfLines={1}>
              {active.name}
            </Text>
          </View>
          <Text style={styles.xp}>+{active.xp} XP</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: { flex: 1 },
  completeLabel: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  name: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  xp: {
    marginLeft: 12,
    color: '#FFB800',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
