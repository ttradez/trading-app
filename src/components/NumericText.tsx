import React from 'react';
import { Text, TextProps, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { fonts } from '../theme';

/**
 * Numeric-text wrapper that gives the app financial-terminal
 * authority on every digit. Uses JetBrains Mono and enforces
 * `tabular-nums` so columns don't jitter on count-up animations
 * or when comparing rows of numbers.
 *
 * Style merging: caller's style overrides the defaults EXCEPT
 * `fontFamily` and `fontVariant`, which are always enforced (the
 * whole point of the wrapper is to make those two non-negotiable).
 *
 *   <NumericText style={typography.display}>$50,000</NumericText>
 */

interface Props extends TextProps {
  /** Use the heavier 700 weight when the surrounding type wants
   *  bold numerals (default 500 Medium reads with calm authority). */
  bold?: boolean;
  style?: StyleProp<TextStyle>;
}

export default function NumericText({
  bold = false,
  style,
  children,
  ...rest
}: Props) {
  const family = bold ? fonts.monoBold : fonts.mono;
  // Flatten so we can RE-impose the locked family + fontVariant
  // after any caller-style mergers. Order: caller's first, ours win.
  const merged = StyleSheet.flatten([style, {
    fontFamily: family,
    fontVariant: ['tabular-nums'] as Array<'tabular-nums'>,
  }]);
  return (
    <Text {...rest} style={merged}>
      {children}
    </Text>
  );
}
