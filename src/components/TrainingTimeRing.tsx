import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle, Defs, LinearGradient, Stop,
} from 'react-native-svg';

/**
 * Premium daily time-goal ring. Gradient-stroked arc (gold →
 * warmer gold) on a near-invisible track, with an Apple-Activity
 * indicator dot riding the leading edge while in progress.
 *
 * Lives in the DashboardHeader at 36pt diameter (since the
 * standalone Home card was retired). Same component works at any
 * size — the indicator dot scales with `stroke`.
 */

const GOLD       = '#FFB800';
const GOLD_WARM  = '#FFD466';
// White-at-8% track — used to be the L3 surface color, but a
// faint white track reads better against the various screen
// surfaces the ring can sit on (header / future inline contexts).
const TRACK      = 'rgba(255,255,255,0.08)';

interface Props {
  minutes: number;
  goal: number;
  size?: number;
  stroke?: number;
}

export default function TrainingTimeRing({
  minutes, goal, size = 36, stroke = 8,
}: Props) {
  const safeGoal = Math.max(1, goal);
  const ratio    = Math.min(1, minutes / safeGoal);
  const radius   = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - ratio);
  const done = ratio >= 1;

  // Indicator dot at the arc leading edge. Arc starts at -90°
  // (top) and sweeps clockwise; the dot rides the gold stroke.
  const angle = -Math.PI / 2 + ratio * 2 * Math.PI;
  const dotX = cx + radius * Math.cos(angle);
  const dotY = cy + radius * Math.sin(angle);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="timeArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD} />
            <Stop offset="1" stopColor={GOLD_WARM} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={TRACK} strokeWidth={stroke} fill="none"
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="url(#timeArc)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {ratio > 0 && !done && (
          <Circle cx={dotX} cy={dotY} r={stroke / 2 - 1} fill={GOLD_WARM} />
        )}
      </Svg>
      {done && (
        <Ionicons name="checkmark" size={Math.round(size * 0.42)} color={GOLD} />
      )}
    </View>
  );
}
