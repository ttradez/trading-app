import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Defs, ClipPath, Rect, Line, Circle, Path, G,
  Text as SvgText, TSpan,
} from 'react-native-svg';
import { colors } from '../theme';

/**
 * RankBanner — pure-SVG rank banner rendered at the per-tool vibrant
 * color. No PNG asset; each banner is a unique design generated from
 * primitives so we can iterate on visuals without art assets.
 *
 * Per rank: vibrant outline, subtle textured pattern inside (stripes
 * for Gambler, mini-candles for Paper Hands, scan + crosshair for
 * Sniper, jagged skyline for Inside Trader, dot grid for Market Maker),
 * an icon glyph on the left, a vertical divider, and the rank label.
 *
 * The background is pure black so the banner blends seamlessly into
 * the #000000 screen — only the colored elements (outline, pattern,
 * glyph, label) pop.
 *
 * Reusable: future profile / leaderboard / achievement screens drop
 * this in and pass the rank.
 */

export type Rank =
  | 'gambler'
  | 'paper_hands'
  | 'sniper'
  | 'inside_trader'
  | 'market_maker';

interface RankDesign {
  label: string;
  /** Vibrant accent — border, pattern, glyph, label. */
  color: string;
  /** Pattern style key. */
  pattern: 'stripes' | 'candles' | 'scan' | 'skyline' | 'grid';
  /** Glyph key for the left-side icon. */
  glyph: 'spade' | 'crumple' | 'crosshair' | 'door' | 'monogram';
}

const DESIGN: Record<Rank, RankDesign> = {
  gambler:       { label: 'GAMBLER',       color: colors.rankGambler,      pattern: 'stripes',  glyph: 'spade'     },
  paper_hands:   { label: 'PAPER HANDS',   color: colors.rankPaperHands,   pattern: 'candles',  glyph: 'crumple'   },
  sniper:        { label: 'SNIPER',        color: colors.rankSniper,       pattern: 'scan',     glyph: 'crosshair' },
  inside_trader: { label: 'INSIDE TRADER', color: colors.rankInsideTrader, pattern: 'skyline',  glyph: 'door'      },
  market_maker:  { label: 'MARKET MAKER',  color: colors.rankMarketMaker,  pattern: 'grid',     glyph: 'monogram'  },
};

// SVG drawing coordinates. 1000 wide × 200 tall = 5:1 aspect — fits the
// "60-80 px on mobile" height target when rendered at typical screen
// widths (340-390 → 68-78 px tall).
const VB_W = 1000;
const VB_H = 200;
const BORDER_W = 4;
const CORNER_R = 18;
const ICON_BOX = 130;   // icon area on the left

// ── Patterns ───────────────────────────────────────────────────────────────
// Each pattern renders inside a clipPath that matches the rounded
// banner shape, so nothing bleeds outside the outline.

function StripesPattern({ color }: { color: string }) {
  // Diagonal lines top-left → bottom-right, very subtle.
  const stripes = [];
  for (let i = -200; i < VB_W + 200; i += 60) {
    stripes.push(
      <Line key={i} x1={i} y1={-50} x2={i + VB_H + 100} y2={VB_H + 50}
            stroke={color} strokeWidth={14} strokeOpacity={0.08} />
    );
  }
  return <G>{stripes}</G>;
}

function CandlesPattern({ color }: { color: string }) {
  // Tiny ascending green-candle bodies behind the text.
  const candles = [
    { x: 380, h: 50,  y: 130 },
    { x: 430, h: 70,  y: 110 },
    { x: 480, h: 60,  y: 120 },
    { x: 530, h: 90,  y: 90  },
    { x: 580, h: 80,  y: 100 },
    { x: 630, h: 110, y: 70  },
    { x: 680, h: 95,  y: 85  },
    { x: 730, h: 130, y: 50  },
    { x: 780, h: 110, y: 70  },
    { x: 830, h: 150, y: 30  },
  ];
  return (
    <G opacity={0.18}>
      {candles.map((c, i) => (
        <Rect key={i} x={c.x} y={c.y} width={20} height={c.h} fill={color} />
      ))}
    </G>
  );
}

function ScanPattern({ color }: { color: string }) {
  // Horizontal scan-lines + a faint crosshair circle behind the text.
  return (
    <G>
      <G opacity={0.1}>
        {[30, 70, 130, 170].map((y) => (
          <Line key={y} x1={200} y1={y} x2={VB_W - 30} y2={y}
                stroke={color} strokeWidth={1} />
        ))}
      </G>
      <G opacity={0.18}>
        <Circle cx={760} cy={100} r={70} fill="none" stroke={color} strokeWidth={2} />
        <Circle cx={760} cy={100} r={45} fill="none" stroke={color} strokeWidth={1.5} />
        <Line x1={760} y1={20}  x2={760} y2={180} stroke={color} strokeWidth={1} />
        <Line x1={680} y1={100} x2={840} y2={100} stroke={color} strokeWidth={1} />
      </G>
    </G>
  );
}

function SkylinePattern({ color }: { color: string }) {
  // Jagged building silhouette along the bottom.
  const d =
    'M 200 200 L 200 150 L 240 150 L 240 130 L 280 130 L 280 110 L 320 110 ' +
    'L 320 90 L 360 90 L 360 120 L 400 120 L 400 80 L 440 80 L 440 100 ' +
    'L 480 100 L 480 60 L 520 60 L 520 90 L 560 90 L 560 70 L 600 70 ' +
    'L 600 100 L 640 100 L 640 80 L 680 80 L 680 110 L 720 110 L 720 90 ' +
    'L 760 90 L 760 130 L 800 130 L 800 110 L 840 110 L 840 140 L 880 140 ' +
    'L 880 120 L 920 120 L 920 150 L 970 150 L 970 200 Z';
  return (
    <G opacity={0.22}>
      <Path d={d} fill={color} />
    </G>
  );
}

function GridPattern({ color }: { color: string }) {
  // Dot grid covering the banner area.
  const dots = [];
  for (let y = 30; y < VB_H - 10; y += 30) {
    for (let x = 220; x < VB_W - 20; x += 30) {
      dots.push(<Circle key={`${x},${y}`} cx={x} cy={y} r={1.6} fill={color} fillOpacity={0.28} />);
    }
  }
  return <G>{dots}</G>;
}

function Pattern({ kind, color }: { kind: RankDesign['pattern']; color: string }) {
  switch (kind) {
    case 'stripes':  return <StripesPattern color={color} />;
    case 'candles':  return <CandlesPattern color={color} />;
    case 'scan':     return <ScanPattern color={color} />;
    case 'skyline':  return <SkylinePattern color={color} />;
    case 'grid':     return <GridPattern color={color} />;
  }
}

// ── Glyphs ─────────────────────────────────────────────────────────────────

function SpadeGlyph({ color }: { color: string }) {
  // Classic playing-card spade. Drawn around a 100×100 origin and
  // centered in the icon box via outer transform.
  const d =
    'M 50 0 ' +
    'C 50 25, 100 35, 100 65 ' +
    'C 100 85, 80 95, 65 90 ' +
    'C 70 92, 70 100, 60 100 ' +
    'L 40 100 ' +
    'C 30 100, 30 92, 35 90 ' +
    'C 20 95, 0 85, 0 65 ' +
    'C 0 35, 50 25, 50 0 Z';
  return <Path d={d} fill={color} />;
}

function CrumpleGlyph({ color }: { color: string }) {
  // Stack of slightly-rotated rectangles, no fill — like crumpled
  // paper outlines.
  return (
    <G fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round">
      <Path d="M 15 35 L 70 20 L 95 60 L 80 95 L 25 90 L 5 60 Z" />
      <Path d="M 25 45 L 60 35 L 80 65 L 65 85 L 30 80 L 18 60 Z" />
      <Path d="M 40 30 L 55 40 L 50 55 L 35 50 Z" />
    </G>
  );
}

function CrosshairGlyph({ color }: { color: string }) {
  return (
    <G stroke={color} strokeWidth={3} fill="none">
      <Circle cx={50} cy={50} r={45} />
      <Circle cx={50} cy={50} r={28} />
      <Line x1={50} y1={5}  x2={50} y2={30} />
      <Line x1={50} y1={70} x2={50} y2={95} />
      <Line x1={5}  y1={50} x2={30} y2={50} />
      <Line x1={70} y1={50} x2={95} y2={50} />
      <Circle cx={50} cy={50} r={4} fill={color} />
    </G>
  );
}

function DoorGlyph({ color }: { color: string }) {
  // Doorway rectangle with a small figure silhouette inside.
  return (
    <G>
      <Path
        d="M 20 5 L 80 5 L 80 95 L 20 95 Z"
        fill="none" stroke={color} strokeWidth={3}
      />
      {/* figure silhouette */}
      <Circle cx={50} cy={32} r={8} fill={color} />
      <Path d="M 38 45 L 62 45 L 60 78 L 40 78 Z" fill={color} />
    </G>
  );
}

function MonogramGlyph({ color }: { color: string }) {
  // "M" inside a circle (Market Maker monogram).
  return (
    <G>
      <Circle cx={50} cy={50} r={45} fill="none" stroke={color} strokeWidth={3} />
      <SvgText
        x={50} y={68}
        fill={color}
        fontSize={56}
        fontWeight="900"
        textAnchor="middle"
        fontFamily="System"
      >
        M
      </SvgText>
    </G>
  );
}

function Glyph({ kind, color }: { kind: RankDesign['glyph']; color: string }) {
  switch (kind) {
    case 'spade':     return <SpadeGlyph color={color} />;
    case 'crumple':   return <CrumpleGlyph color={color} />;
    case 'crosshair': return <CrosshairGlyph color={color} />;
    case 'door':      return <DoorGlyph color={color} />;
    case 'monogram':  return <MonogramGlyph color={color} />;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  rank: Rank;
  /** Fixes the banner display width in px. If omitted, the banner
   *  stretches to fill its parent (flex:1) and the SVG aspectRatio
   *  drives the height. */
  width?: number;
  /** Render a small "← YOU" label to the right of the banner. */
  showYouIndicator?: boolean;
}

export default function RankBanner({ rank, width, showYouIndicator = false }: Props) {
  const d = DESIGN[rank];

  const cropperStyle: ViewStyle = width
    ? { width, aspectRatio: VB_W / VB_H }
    : { flex: 1, aspectRatio: VB_W / VB_H };

  const clipId = `clip-${rank}`;

  return (
    <View style={styles.row}>
      <View style={cropperStyle}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <ClipPath id={clipId}>
              <Rect
                x={BORDER_W / 2}
                y={BORDER_W / 2}
                width={VB_W - BORDER_W}
                height={VB_H - BORDER_W}
                rx={CORNER_R}
                ry={CORNER_R}
              />
            </ClipPath>
          </Defs>

          {/* Solid black fill — blends with screen bg. */}
          <Rect
            x={0} y={0} width={VB_W} height={VB_H}
            rx={CORNER_R + BORDER_W / 2}
            ry={CORNER_R + BORDER_W / 2}
            fill="#000000"
          />

          {/* Pattern, clipped to the rounded interior. */}
          <G clipPath={`url(#${clipId})`}>
            <Pattern kind={d.pattern} color={d.color} />
          </G>

          {/* Glyph — left-side icon box, scaled from 100×100 origin. */}
          <G transform={`translate(${(ICON_BOX - 80) / 2 + 20}, ${(VB_H - 100) / 2}) scale(1)`}>
            <Glyph kind={d.glyph} color={d.color} />
          </G>

          {/* Vertical divider between glyph and label. */}
          <Line
            x1={ICON_BOX + 25} y1={40}
            x2={ICON_BOX + 25} y2={VB_H - 40}
            stroke={d.color} strokeOpacity={0.5} strokeWidth={2}
          />

          {/* Label. */}
          <SvgText
            x={ICON_BOX + 50} y={132}
            fill={d.color}
            fontSize={86}
            fontWeight="900"
            fontFamily="System"
          >
            <TSpan letterSpacing={4}>{d.label}</TSpan>
          </SvgText>

          {/* Outer border on top of everything. */}
          <Rect
            x={BORDER_W / 2}
            y={BORDER_W / 2}
            width={VB_W - BORDER_W}
            height={VB_H - BORDER_W}
            rx={CORNER_R}
            ry={CORNER_R}
            fill="none"
            stroke={d.color}
            strokeWidth={BORDER_W}
          />
        </Svg>
      </View>

      {showYouIndicator && <Text style={styles.youText}>← YOU</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  youText: {
    marginLeft: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
