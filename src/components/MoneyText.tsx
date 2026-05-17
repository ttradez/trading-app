import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

/**
 * MoneyText — renders a USD P&L value with a designed hierarchy:
 * the sign at 80% and the "$" at 70% of the number's size, the
 * digits full size. Makes "+$839.68" read as typeset, not typed.
 *
 * Color / weight / shadow come from `style` (the digits inherit
 * them); only the relative font sizes are managed here.
 */

interface Props {
  value: number;
  /** Base font size of the digits. Sign = 80%, "$" = 70%. */
  size: number;
  style?: StyleProp<TextStyle>;
  allowFontScaling?: boolean;
}

export default function MoneyText({
  value, size, style, allowFontScaling = false,
}: Props) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <Text
      style={[{ fontSize: size, fontVariant: ['tabular-nums'] }, style]}
      allowFontScaling={allowFontScaling}
      numberOfLines={1}
    >
      {sign ? (
        <Text style={{ fontSize: Math.round(size * 0.8) }}>{sign}</Text>
      ) : null}
      <Text style={{ fontSize: Math.round(size * 0.7) }}>$</Text>
      {abs}
    </Text>
  );
}
