/**
 * Pocket Trade design system — single source of truth.
 * Match every value here against the mockup before changing.
 */

export const colors = {
  // Backgrounds — pure black to match the logo's black square
  bg:        '#000000',  // app background — true black
  bgElev:    '#0A0A0A',  // slight lift (rare use)
  card:      '#0F0F0F',  // primary card surface — barely lifted off black
  cardAlt:   '#1A1A1A',  // hover/pressed state
  border:    '#1F1F1F',  // default border
  borderSubtle: '#2A2A2A',

  // Brand accents — locked 2026-05-12
  gold:      '#FFB800',  // primary accent — buttons, active states, premium feel
  goldDim:   '#8A6D14',  // pressed/disabled gold

  // Semantic
  green:     '#00D395',  // gains, BUY
  greenDim:  '#0E5C32',
  red:       '#FF4757',  // losses, SELL
  redDim:    '#7F1D1D',

  // Text — white bold by default; backgrounds are pure black.
  textPrimary:   '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary:  '#6B7280',
  textInverse:   '#000000',  // text on gold buttons

  // Rank badges — vibrant palette matching the rank artwork.
  // Each rank has its own saturated identity color used for the
  // banner border, pattern, glyph, and label.
  rankGambler:      '#C0C0C0',   // silver
  rankPaperHands:   '#00D395',   // brand green
  rankSniper:       '#3B82F6',   // electric blue
  rankInsideTrader: '#A855F7',   // royal purple
  rankMarketMaker:  '#FFB800',   // brand gold
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const font = {
  // Sans-serif: Inter preferred when loaded, system default fallback
  // (San Francisco on iOS, Roboto on Android — both modern sans-serifs).
  // Inter isn't bundled via expo-font yet; switch these to 'Inter' /
  // 'Inter-Bold' once the family is registered.
  sans:     'System',
  sansBold: 'System',
  // Monospace — used for ALL numbers (prices, P&L, percentages, balances).
  mono:     'SpaceMono-Regular',
  monoBold: 'SpaceMono-Bold',
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 36,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,
};

// Letter-spacing for SECTION HEADER UPPERCASE labels (matches mockup)
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 1.2,
  ultraWide: 2,
} as const;

// Standard label component style for "ACCOUNT SETUP" / "STARTING BALANCE" headers
export const labelStyle = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
  letterSpacing: letterSpacing.ultraWide,
  color: colors.textSecondary,
  textTransform: 'uppercase' as const,
};

// Reusable shadow recipes
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goldGlow: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
