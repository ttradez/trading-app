import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface Props { size?: number; color?: string }

/** Bullseye target — two concentric rings + a filled center dot.
 *  Reads as accuracy, not a generic crosshair. */
export default function WinRateGlyph({
  size = 24, color = 'rgba(255,255,255,0.9)',
}: Props) {
  const s = size;
  const c = s / 2;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Circle cx={c} cy={c} r={10} stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx={c} cy={c} r={6}  stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx={c} cy={c} r={2}  fill={color} />
    </Svg>
  );
}
