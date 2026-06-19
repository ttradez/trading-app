import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type Icon,
  ArrowsClockwiseIcon,
  CrosshairIcon,
  NotebookIcon,
  CompassIcon,
  CalendarCheckIcon,
} from 'phosphor-react-native';
import { ChallengeInstance } from '../store/challengeStore';
import { getTemplate } from '../data/challengePool';
import ProgressBar from './ProgressBar';
import NumericText from './NumericText';
import { colors } from '../theme';

/**
 * Phosphor mapping for each challenge category — hero glyph at
 * weight="fill" + gold@80%. Names match the spec's per-challenge
 * suggestions (place trades → ArrowsClockwise, win in a row →
 * Crosshair, different symbols → Compass).
 *
 *   volume       → ArrowsClockwise (place N trades, cycle of reps)
 *   skill        → Crosshair       (precision / aim — "win in a row")
 *   process      → Notebook        (journaling / checklist)
 *   discovery    → Compass         (explore / new symbols)
 *   consistency  → CalendarCheck   (daily-cadence streaks)
 */
const CATEGORY_ICON: Record<string, Icon> = {
  volume:      ArrowsClockwiseIcon,
  skill:       CrosshairIcon,
  process:     NotebookIcon,
  discovery:   CompassIcon,
  consistency: CalendarCheckIcon,
};

/**
 * Square-ish ~140 × 140pt tile for the Daily Challenges horizontal
 * scroller. Filled icon top-left, h2 title, gold XP label, and a
 * 2pt progress bar pinned to the bottom edge.
 *
 * Done state (polish pass): a gold check medallion overhangs the
 * top-right corner (slight ~8pt overhang via an outer wrapper
 * with overflow visible); the inner tile content fades to 60%
 * opacity so the achievement reads "settled" without losing the
 * title. The progress bar still fills to 100% gold underneath.
 */

// Responsive tile sizing — was hardcoded 140dp, which only fit one full
// tile on a 320dp Galaxy A05s and made the horizontal scroll affordance
// invisible. Use min(140, 38% of screen) so 2+ tiles peek on every
// device class. Height stays in lockstep so the tile aspect ratio is
// preserved.
const TILE_W   = Math.min(140, Dimensions.get('window').width * 0.38);
const TILE_H   = TILE_W;
const GOLD     = colors.gold;
// Daily Challenge tiles are secondary surfaces — L1 in the layered
// system. They sit alongside the Today's Mission hero (L2/L3).
const CARD_BG  = '#0A0A0A';
const BORDER   = '#1F1F1F';

interface Props {
  inst: ChallengeInstance;
  onSwap?: () => void;
  swapAvailable?: boolean;
  /** Tap-to-claim handler. Provided by the parent — typically calls
   *  `claimChallenge(id)` from challengeStore then navigates to the
   *  Ranks tab so the user can watch their XP bar animate. */
  onClaim?: () => void;
}

export default function DailyChallengeTile({
  inst, onSwap, swapAvailable, onClaim,
}: Props) {
  const t = getTemplate(inst.challengeId);
  if (!t) return null;
  const pct = Math.min(1, inst.target > 0 ? inst.progress / inst.target : 0);
  const completed = inst.completed;
  const claimable = completed && !inst.claimed && !!onClaim;

  // Wrap the tile in a Pressable when claimable so the whole face
  // becomes the claim affordance. Otherwise the tile is passive.
  const Outer: React.ComponentType<any> = claimable ? Pressable : View;
  const outerProps: any = claimable
    ? {
        onPress: onClaim,
        accessibilityRole: 'button',
        accessibilityLabel: `Claim +${inst.xpReward} XP for ${t.name}`,
        style: ({ pressed }: { pressed: boolean }) => [
          styles.wrap,
          pressed && { transform: [{ scale: 0.97 }] },
        ],
      }
    : { style: styles.wrap };

  return (
    // Outer wrapper has overflow:'visible' so the check medallion
    // can overhang the tile's rounded edge. The inner tile keeps
    // its overflow:hidden so the progress bar still clips cleanly.
    <Outer {...outerProps}>
      <View style={[
        styles.tile,
        completed && styles.tileDone,
        claimable && styles.tileClaimable,
      ]}>
        {/* Inner content fades to 60% when complete — title stays
            full opacity for legibility (next sibling). Claim state
            keeps content at full opacity so the call-to-action reads. */}
        <View style={[
          styles.topRow,
          completed && !claimable && styles.fadedBlock,
        ]}>
          {(() => {
            const Glyph = CATEGORY_ICON[t.category] ?? CrosshairIcon;
            return <Glyph size={22} weight="fill" color="rgba(255,184,0,0.8)" />;
          })()}
          {onSwap && !completed && swapAvailable && (
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
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {t.name}
        </Text>

        <View style={[
          styles.metaRow,
          completed && !claimable && styles.fadedBlock,
        ]}>
          {claimable ? (
            <NumericText bold style={styles.claimLabel} allowFontScaling={false}>
              CLAIM +{inst.xpReward} XP
            </NumericText>
          ) : (
            <NumericText bold style={styles.xp} allowFontScaling={false}>
              +{inst.xpReward} XP
            </NumericText>
          )}
          {!completed && (
            <NumericText bold style={styles.progLabel} allowFontScaling={false}>
              {Math.floor(inst.progress)}/{inst.target}
            </NumericText>
          )}
        </View>

        <View style={styles.barWrap} pointerEvents="none">
          <ProgressBar
            progress={pct}
            size="md"
            variant={completed ? 'gold' : 'gold'}
          />
        </View>
      </View>

      {completed && !claimable && (
        <View style={styles.checkOverlay} pointerEvents="none">
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </View>
      )}
      {claimable && (
        <View style={styles.claimBadgeOverlay} pointerEvents="none">
          <Ionicons name="gift" size={14} color="#000000" />
        </View>
      )}
    </Outer>
  );
}

const styles = StyleSheet.create({
  // Wrap allows the check medallion to overhang the tile edge.
  wrap: {
    width: TILE_W,
    height: TILE_H,
    position: 'relative',
    // No overflow declared → visible by default, so the check
    // medallion's -8/-8 offset reads as a proper overhang.
  },
  tile: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    overflow: 'hidden',
  },
  tileDone: { borderColor: 'rgba(255,184,0,0.6)' },
  // Claimable: louder gold border so the call-to-action pops out
  // of the horizontal scroller next to its completed siblings.
  tileClaimable: {
    borderColor: GOLD,
    backgroundColor: 'rgba(255,184,0,0.08)',
  },
  claimLabel: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  // Gold gift-box medallion (replaces the green check) when XP is
  // sitting unclaimed — visually distinct from the "settled" state.
  claimBadgeOverlay: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  // Faded sub-blocks on completion — title stays at 100% so the
  // tile remains scannable.
  fadedBlock: { opacity: 0.6 },
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

  // Completion medallion — gold-filled circle with a white check,
  // overhanging the tile by 8pt on the top-right.
  checkOverlay: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle dark ring lifts the medallion off the L1 surface and
    // off the green completion accent.
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});
