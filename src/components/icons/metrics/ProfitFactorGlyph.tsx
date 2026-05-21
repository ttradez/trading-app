import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface Props { size?: number; color?: string }

/** Minimal balance scale — single horizontal beam, central post,
 *  two pan strokes. Reads as "weighing wins against losses." */
export default function ProfitFactorGlyph({
  size = 24, color = 'rgba(255,255,255,0.9)',
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* beam */}
      <Line x1={3} y1={8} x2={21} y2={8} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* central post + base */}
      <Line x1={12} y1={8} x2={12} y2={20} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={8} y1={20} x2={16} y2={20} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* left pan */}
      <Path d="M3 8 L1 13 L5 13 Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" fill="none" />
      {/* right pan */}
      <Path d="M21 8 L19 13 L23 13 Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
