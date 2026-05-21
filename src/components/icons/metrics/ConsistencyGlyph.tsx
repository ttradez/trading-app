import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props { size?: number; color?: string }

/** Minimal heartbeat / ECG line — four peaks, two flatline endcaps.
 *  Reads as steady cadence, not a generic pulse icon. */
export default function ConsistencyGlyph({
  size = 24, color = 'rgba(255,255,255,0.9)',
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 12 L5 12 L7 8 L9 16 L11 6 L13 18 L15 8 L17 12 L22 12"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
