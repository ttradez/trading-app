import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Design tokens — the single source of truth for the Pocket Trade
 * visual system. Every magic number in the app should resolve to a
 * token here. Created as the foundation for the design-system
 * upgrade; screens are wired to these in a follow-up (this file is
 * not consumed yet).
 *
 * Note: this is additive and does NOT replace `src/theme/index.ts`
 * (the existing `colors`/`spacing`/etc.). The wiring pass migrates
 * call sites; until then both coexist.
 */

export const colors = {
  // Three-tier surface system
  bg: '#000000',
  surface: '#0F0F0F',
  surfaceElevated: '#141414', // hero cards (Today's Mission)
  surfacePressed: '#1A1A1A',

  // Borders
  border: '#1F1F1F',
  borderSubtle: '#141414',
  borderStrong: '#2A2A2A',
  hairlineHighlight: 'rgba(255,255,255,0.04)', // 1px top-edge magic

  // Brand
  gold: '#FFB800',
  goldBright: '#FFD24D',
  goldDim: '#8A6500',
  goldGlow: 'rgba(255,184,0,0.25)',
  goldTint: 'rgba(255,184,0,0.10)',

  // Semantic
  pnlGreen: '#00D395',
  pnlRed: '#FF4757',
  uiGreen: '#5BC894', // non-P&L green (difficulty pills, etc.)

  // Text — 4-tier opacity system
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.75)',
  textTertiary: 'rgba(255,255,255,0.55)',
  textQuaternary: 'rgba(255,255,255,0.35)',
} as const;

export const radii = {
  pill: 999,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

/**
 * Typography ramp. `satisfies` keeps each entry literally typed
 * while guaranteeing every value is a valid RN `TextStyle`.
 */
export const type = {
  displayLg:   { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: colors.textPrimary },
  displayMd:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, color: colors.textPrimary },
  sectionHeader: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.textPrimary },
  eyebrow:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textTertiary },
  bodyLg:      { fontSize: 16, fontWeight: '500', color: colors.textSecondary },
  body:        { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  bodySm:      { fontSize: 13, fontWeight: '500', color: colors.textTertiary },
  numericHero: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'], color: colors.textPrimary },
  numericLg:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'], color: colors.textPrimary },
  numeric:     { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'], color: colors.textPrimary },
  micro:       { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: colors.textTertiary },
  caption:     { fontSize: 12, fontWeight: '500', color: colors.textTertiary },
} satisfies Record<string, TextStyle>;

/**
 * Elevation + glow presets. `card` is the neutral lift; the three
 * glow variants tint the shadow with the semantic accent.
 */
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  goldGlow: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  greenGlow: {
    shadowColor: colors.pnlGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  redGlow: {
    shadowColor: colors.pnlRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
} satisfies Record<string, ViewStyle>;

/**
 * Motion constants. `pressIn`/`pressOut` drive the universal
 * tactile press; `shimmer` is one full sweep of the ProgressBar
 * highlight.
 */
export const motion = {
  pressIn:  { duration: 80,   scale: 0.985 },
  pressOut: { duration: 120,  scale: 1.0 },
  shimmer:  { duration: 6000 },
} as const;

/** Convenience aggregate so a consumer can `import { tokens }`. */
export const tokens = { colors, radii, spacing, type, shadows, motion };

export type Tokens = typeof tokens;
