import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import XpBurst from './XpBurst';
import { useXpStore } from '../store/xpStore';

/**
 * Global "+N XP" orchestrator. Subscribes to `xpStore.currentXP`,
 * spawns an XpBurst on every positive delta. Anchored to the
 * top-right of the screen so the chips read as floating out from
 * where the streak flame lives in the header.
 *
 * Multiple bursts can be alive simultaneously. Bursts that arrive
 * within ~150ms of each other are staggered so they stack instead
 * of overlapping. Caps at MAX_CONCURRENT — additional bursts
 * are dropped silently (the XP store still increments; the user
 * just doesn't get the extra visual ding).
 *
 * Mount once at the app root alongside CelebrationHost.
 */

const MAX_CONCURRENT  = 5;
const STAGGER_MS      = 150;
const ANCHOR_OFFSET_X = 20; // from right edge
const ANCHOR_OFFSET_Y = 64; // below the safe-area inset

interface ActiveBurst {
  id: number;
  amount: number;
  delayMs: number;
}

export default function XpBurstHost() {
  const insets = useSafeAreaInsets();
  const [bursts, setBursts] = useState<ActiveBurst[]>([]);

  // Subscriber state — kept in refs so closures stay stable across
  // store updates without re-creating subscriptions.
  const nextId       = useRef(0);
  const lastSpawnRef = useRef(0); // ms timestamp

  useEffect(() => {
    let prevXP = useXpStore.getState().currentXP;
    const unsub = useXpStore.subscribe((s) => {
      const cur = s.currentXP;
      const delta = cur - prevXP;
      prevXP = cur;
      if (delta <= 0) return;

      const now = Date.now();
      // Stagger spawns so a flurry of XP adds reads as a sequence
      // rather than overlapping chips. We compute the delay
      // relative to the most recent scheduled spawn — if it's
      // already in the future, push this one to lastSpawn + 150.
      const target = Math.max(now, lastSpawnRef.current + STAGGER_MS);
      const delayMs = target - now;
      lastSpawnRef.current = target;

      setBursts((prev) => {
        if (prev.length >= MAX_CONCURRENT) return prev;
        return [
          ...prev,
          { id: nextId.current++, amount: delta, delayMs },
        ];
      });
    });
    return unsub;
  }, []);

  const onComplete = (id: number) =>
    setBursts((prev) => prev.filter((b) => b.id !== id));

  if (bursts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        { top: insets.top + ANCHOR_OFFSET_Y, right: ANCHOR_OFFSET_X },
      ]}
    >
      {bursts.map((b) => (
        <XpBurst
          key={b.id}
          amount={b.amount}
          spawnDelayMs={b.delayMs}
          onComplete={() => onComplete(b.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
});
