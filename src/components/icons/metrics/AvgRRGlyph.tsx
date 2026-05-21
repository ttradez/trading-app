import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

interface Props { size?: number; color?: string }

/** 1:N ratio glyph — small filled dot on the left, larger filled
 *  dot on the right, connected by a thin horizontal line. */
export default function AvgRRGlyph({
  size = 24, color = 'rgba(255,255,255,0.9)',
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={12} x2={18} y2={12} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={6}  cy={12} r={2}   fill={color} />
      <Circle cx={18} cy={12} r={4.5} fill={color} />
    </Svg>
  );
}
