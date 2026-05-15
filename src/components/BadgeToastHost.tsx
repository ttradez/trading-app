import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Animated, PanResponder, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBadgeToastStore } from '../store/badgeToastStore';
import { getBadge, RARITY_COLOR } from '../data/badges';
import { maybeHaptic } from '../store/settingsStore';

/**
 * Drains the badge-toast queue one at a time. Each toast slides
 * down from the top, holds ~3 s, then slides out; a ~1 s gap
 * separates sequential toasts. Swipe up to dismiss early.
 *
 * Implemented as a transparent Modal so it renders in the native
 * overlay layer (above the tab navigator and any plain-View
 * content). Trade-close badge checks are deliberately fired AFTER
 * the journal modal is dismissed, so a toast never has to fight
 * that modal for the top layer.
 */

const HOLD_MS = 3000;
const SLIDE_MS = 280;
const GAP_MS = 1000;

export default function BadgeToastHost() {
  const insets = useSafeAreaInsets();
  const queueLen = useBadgeToastStore((s) => s.queue.length);

  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  const translateY = useRef(new Animated.Value(-160)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    Animated.timing(translateY, {
      toValue: -160, duration: SLIDE_MS, useNativeDriver: true,
    }).start(() => {
      setActive(null);
      // Gap before the next toast — pickNext re-fires via the
      // queue-length / active effect after this clears.
      setTimeout(() => {
        if (!activeRef.current) pickNext();
      }, GAP_MS);
    });
  };

  const pickNext = () => {
    if (activeRef.current) return;
    const id = useBadgeToastStore.getState().dequeue();
    if (!id) return;
    setActive(id);
    translateY.setValue(-160);
    Animated.timing(translateY, {
      toValue: 0, duration: SLIDE_MS, useNativeDriver: true,
    }).start();
    maybeHaptic();
    hideTimer.current = setTimeout(beginHide, HOLD_MS);
  };

  // Kick the queue whenever items arrive and nothing is showing.
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
      onPanResponderRelease: (_, g) => {
        if (g.dy < -20) beginHide();
      },
    }),
  ).current;

  if (!active) return null;
  const badge = getBadge(active);
  if (!badge) return null;
  const accent = RARITY_COLOR[badge.rarity];

  return (
    <Modal visible transparent animationType="none" onRequestClose={beginHide}>
      <View pointerEvents="box-none" style={styles.root}>
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.card,
            {
              marginTop: insets.top + 8,
              borderColor: accent,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.iconWrap, { borderColor: accent }]}>
            <MaterialCommunityIcons name={badge.icon} size={24} color={accent} />
          </View>
          <View style={styles.textWrap}>
            <Text style={[styles.unlockedLabel, { color: accent }]}>UNLOCKED</Text>
            <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '90%',
    maxWidth: 420,
    // Float above content; the Modal handles the native layer.
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: { flex: 1 },
  unlockedLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  badgeName: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
