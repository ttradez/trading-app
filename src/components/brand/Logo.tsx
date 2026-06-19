import React from 'react';
import { Image, View, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';

interface Props {
  width?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Pip logo lockup — gold P-mark (the full assets/logo.png, which now
 * contains only the mark on a transparent background) + "PIP" wordmark
 * rendered as text. The earlier version of this component cropped a
 * legacy "POCKET TRADE" wordmark out of the source PNG — that crop is
 * no longer needed because logo.png itself has been replaced with the
 * mark-only asset (see assets/_backup/ for the original).
 */
export default function Logo({ width = 220, style }: Props) {
  const wordmarkSize = Math.round(width * 0.22);
  const tracking     = wordmarkSize * 0.12;
  const markSize     = width * 0.85;
  const gap          = width * 0.04;

  return (
    <View style={[{ width, alignItems: 'center' }, style as any]}>
      <Image
        source={require('../../../assets/logo.png')}
        style={{ width: markSize, height: markSize, resizeMode: 'contain' }}
      />
      <Text
        style={[
          styles.wordmark,
          { fontSize: wordmarkSize, marginTop: gap, letterSpacing: tracking },
        ]}
        allowFontScaling={false}
      >
        PIP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    color: '#D4A24A', // gold matching the P-mark fill
    fontWeight: '900',
    textAlign: 'center',
  },
});
