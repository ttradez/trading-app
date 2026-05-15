import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * StreakBadge — fire-icon-plus-count visual for the user's training
 * streak. Renders identically anywhere in the app; the consumer picks
 * `size` based on context (dashboard header → small, future
 * celebration screen → large).
 *
 * Five visual states (per the `status` prop):
 *  - 'active'    — gold filled flame + white count
 *  - 'milestone' — orange-gold flame with glow + sparkle + gold count
 *  - 'at_risk'   — hollow flame outline at 50% opacity + faded count
 *  - 'frozen'    — gold filled flame + snowflake overlay + white count
 *  - 'broken'    — grey flame + red X overlay + grey "0"
 *
 *  'new' (a brand-new user with no streak) renders identically to
 *  'at_risk' — it's still "your streak is at 0, train today to start"
 *  rather than "you broke a streak you never had".
 *
 * Icon library: lucide-react-native isn't installed in the project;
 * `@expo/vector-icons` is. Nearest MaterialCommunityIcons equivalents:
 *  - Flame (filled)   → `fire`
 *  - Snowflake        → `snowflake`
 *  - X mark           → `close-thick`
 *  - Sparkle          → `star-four-points`
 *
 * MCI doesn't expose a `fire-outline` glyph (verified against the
 * type definitions). For the `'at_risk'` state we render the filled
 * `fire` glyph at low opacity (~0.35) to read as a "ghosted"
 * flame — matches the intent ("streak alive but dim, train today")
 * without inventing an icon.
 */

export type StreakStatus =
  | 'active'
  | 'milestone'
  | 'at_risk'
  | 'frozen'
  | 'broken'
  | 'new';

export type StreakSize = 'small' | 'large';

interface Props {
  count: number;
  status: StreakStatus;
  size?: StreakSize;
}

const GOLD            = '#FFB800';
const MILESTONE_ORANGE = '#FF9500';
const SNOW             = '#87CEEB';
const RED              = '#FF4757';
const GREY             = '#666666';

interface SizeConfig {
  flame: number;
  count: number;
  overlay: number;
  sparkle: number;
  gap: number;
}

const SIZES: Record<StreakSize, SizeConfig> = {
  small: { flame: 24, count: 14, overlay: 11, sparkle: 10, gap: 2 },
  large: { flame: 48, count: 24, overlay: 20, sparkle: 18, gap: 4 },
};

export default function StreakBadge({ count, status, size = 'small' }: Props) {
  // 'new' has no distinct visual — same look as at_risk.
  const effective: Exclude<StreakStatus, 'new'> =
    status === 'new' ? 'at_risk' : status;
  const cfg = SIZES[size];

  let iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = 'fire';
  let iconColor: string = GOLD;
  let iconOpacity = 1;
  let flameShadow: TextStyle = {};
  let countText = String(count);
  let countColor: string = '#FFFFFF';
  let countOpacity = 1;
  let overlay: React.ReactNode = null;
  let sparkle: React.ReactNode = null;

  switch (effective) {
    case 'active':
      // gold filled flame, white count — the everyday look.
      break;

    case 'milestone': {
      iconColor = MILESTONE_ORANGE;
      countColor = GOLD;
      // `textShadow*` lives on the underlying Text element MCI renders
      // — that's how we get a cross-platform glow without a new dep.
      flameShadow = {
        textShadowColor: 'rgba(255,149,0,0.65)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
      };
      sparkle = (
        <View
          pointerEvents="none"
          style={[
            styles.sparkle,
            { top: -cfg.sparkle / 4, right: -cfg.sparkle / 4 },
          ]}
        >
          <MaterialCommunityIcons
            name="star-four-points"
            size={cfg.sparkle}
            color={GOLD}
          />
        </View>
      );
      break;
    }

    case 'at_risk':
      // Ghosted flame — no `fire-outline` glyph in MCI, so we lean on
      // opacity to convey "streak alive but dim". Slightly lower than
      // the count opacity so the flame fades back more than the digit.
      iconOpacity = 0.35;
      countOpacity = 0.5;
      break;

    case 'frozen':
      // gold filled flame + snowflake corner overlay
      overlay = (
        <View
          pointerEvents="none"
          style={[
            styles.overlay,
            { bottom: -cfg.overlay / 5, right: -cfg.overlay / 5 },
          ]}
        >
          <MaterialCommunityIcons
            name="snowflake"
            size={cfg.overlay}
            color={SNOW}
          />
        </View>
      );
      break;

    case 'broken':
      iconColor = GREY;
      countColor = GREY;
      countText = '0';
      overlay = (
        <View
          pointerEvents="none"
          style={[
            styles.overlay,
            { bottom: -cfg.overlay / 5, right: -cfg.overlay / 5 },
          ]}
        >
          <MaterialCommunityIcons
            name="close-thick"
            size={cfg.overlay}
            color={RED}
          />
        </View>
      );
      break;
  }

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`${countText}-day streak, ${effective}`}
    >
      <View style={styles.flameWrap}>
        <MaterialCommunityIcons
          name={iconName}
          size={cfg.flame}
          color={iconColor}
          style={[{ opacity: iconOpacity }, flameShadow as ViewStyle]}
        />
        {sparkle}
        {overlay}
      </View>
      <Text
        style={[
          styles.count,
          {
            fontSize: cfg.count,
            color: countColor,
            opacity: countOpacity,
            marginTop: cfg.gap,
          },
        ]}
        allowFontScaling={false}
      >
        {countText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameWrap: {
    // Positioning anchor for the sparkle / snowflake / X overlays.
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
  },
  sparkle: {
    position: 'absolute',
  },
  count: {
    fontWeight: '800',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
});
