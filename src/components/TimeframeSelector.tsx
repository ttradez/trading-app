import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import NumericText from './NumericText';
import { Timeframe } from '../lib/equitySeries';
import { borders } from '../theme';

/**
 * Timeframe selector — 6 equal-width pill chips (1D / 1W / 1M /
 * 3M / 1Y / ALL) pinned beneath the equity sparkline.
 *
 * Selected: gold@16% bg + gold@60% border, gold@100% label.
 * Unselected: transparent bg + `borders.card` outline,
 * white@60% label.
 *
 * NOT a reuse of `FilterChip` (which fills with solid gold for
 * selected) — the timeframe selector lives directly under a gold
 * equity line, where a solid-gold selected pill would compete
 * with the chart for attention. The tinted-fill treatment reads
 * as a quieter member of the same family.
 *
 * Labels render via NumericText so the digits sit on
 * JetBrains Mono / tabular-nums and don't jitter when the
 * selected pill swaps.
 */

const GOLD = '#FFB800';

const TIMEFRAMES: ReadonlyArray<Timeframe> = [
  '1D', '1W', '1M', '3M', '1Y', 'ALL',
];

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export default function TimeframeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {TIMEFRAMES.map((tf) => {
        const selected = tf === value;
        return (
          <Pressable
            key={tf}
            onPress={() => onChange(tf)}
            style={({ pressed }) => [
              styles.pill,
              selected ? styles.pillSelected : styles.pillUnselected,
              pressed && !selected && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tf} timeframe`}
          >
            <NumericText
              style={[
                styles.label,
                selected ? styles.labelSelected : styles.labelUnselected,
              ]}
            >
              {tf}
            </NumericText>
          </Pressable>
        );
      })}
    </View>
  );
}

const HEIGHT = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flex: 1,
    height: HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pillSelected: {
    backgroundColor: 'rgba(255, 184, 0, 0.16)',
    borderColor: 'rgba(255, 184, 0, 0.60)',
  },
  pillUnselected: {
    backgroundColor: 'transparent',
    borderColor: borders.card,
  },
  pressed: { opacity: 0.7 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  labelSelected:   { color: GOLD },
  labelUnselected: { color: 'rgba(255,255,255,0.6)' },
});
