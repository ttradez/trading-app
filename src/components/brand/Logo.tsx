import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface Props {
  width?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Pocket Trade logo lockup — gold P-mark + "POCKET TRADE" wordmark on dark.
 * Image already contains both the mark and wordmark; render whole.
 * Square-ish image (~1:1 aspect including wordmark space).
 */
export default function Logo({ width = 220, style }: Props) {
  return (
    <Image
      source={require('../../../assets/logo.png')}
      style={[{ width, height: width, resizeMode: 'contain' }, style]}
    />
  );
}
