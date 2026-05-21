import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ChallengeInstance } from '../store/challengeStore';
import { getTemplate, challengeIcon } from '../data/challengePool';
import ProgressBar from './ProgressBar';
import NumericText from './NumericText';
import { colors } from '../theme';

/**
 * Square-ish ~140 × 140pt tile for the Daily Challenges horizontal
 * scroller (DESIGN_AUDIT §3.1). Filled icon top-left, h2 title,
 * gold XP label, and a 2pt progress bar pinned to the bottom edge.
 *
 * Done state: 1px green border + a small checkmark replacing the
 * progress count. Swap button stays — same 1-per-week semantics
 * the compact list card had.
 */

const TILE_W   = 140;
const TILE_H   = 140;
const GOLD     = colors.gold;
const GREEN    = colors.green;
const CARD_BG  = '#0F0F0F';
const BORDER   = '#1F1F1F';

interface Props {
  inst: ChallengeInstance;
  onSwap?: () => void;
  swapAvailable?: boolean;
}

export default function DailyChallengeTile({ inst, onSwap, swapAvailable }: Props) {
  const t = getTemplate(inst.challengeId);
  if (!t) return null;
  const pct = Math.min(1, inst.target > 0 ? inst.progress / inst.target : 0);

  return (
    <View
      style={[
        styles.tile,
        inst.completed && styles.tileDone,
      ]}
    >
      <View style={styles.topRow}>
        <MaterialCommunityIcons
          name={challengeIcon(t.category) as any}
          size={22}
          // 80% gold per spec — has presence without crowding the
          // tile against the Today's Mission CTA.
          color="rgba(255,184,0,0.8)"
        />
        {onSwap && !inst.completed && swapAvailable && (
          <Pressable
            onPress={onSwap}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={`Swap challenge ${t.name}`}
          >
            <Ionicons name="refresh" size={14} color={GOLD} />
          </Pressable>
        )}
        {inst.completed && (
          <Ionicons name="checkmark-circle" size={16} color={GREEN} />
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {t.name}
      </Text>

      <View style={styles.metaRow}>
        <NumericText bold style={styles.xp} allowFontScaling={false}>
          +{inst.xpReward} XP
        </NumericText>
        {!inst.completed && (
          <NumericText bold style={styles.progLabel} allowFontScaling={false}>
            {Math.floor(inst.progress)}/{inst.target}
          </NumericText>
        )}
      </View>

      <View style={styles.barWrap} pointerEvents="none">
        <ProgressBar
          progress={pct}
          size="md"
          variant={inst.completed ? 'green' : 'gold'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_W,
    height: TILE_H,
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    overflow: 'hidden',
  },
  tileDone: { borderColor: GREEN },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swapBtn: { padding: 2 },
  // h2 token (17 / 22 semibold). Tight letter-spacing to keep
  // 2-line titles legible at tile width.
  title: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  metaRow: {
    marginTop: 'auto',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  xp: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // Progress bar pinned to the bottom edge of the tile.
  barWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 6,
  },
});
