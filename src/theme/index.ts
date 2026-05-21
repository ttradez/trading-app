/**
 * Pocket Trade design system — single source of truth.
 * Match every value here against the mockup before changing.
 */

/**
 * Layered dark-surface system (DESIGN_AUDIT polish pass).
 *
 *   L0 — app background (true black)
 *   L1 — secondary cards / tiles (slight lift off bg)
 *   L2 — primary content cards (Account hero, Today's Mission)
 *   L3 — elevated: modals, bottom sheets, pressed states
 *
 * Brand-safe — all four are neutral grays inside the existing
 * palette, no new hue introduced. The point of the four-step ramp
 * is hierarchy by *contrast*: when L1 cards drop below the
 * existing card color, L2 hero cards read as primary without
 * needing a louder background.
 */
export const surface = {
  l0: '#000000',
  l1: '#0A0A0A',
  l2: '#0F0F0F',
  l3: '#141414',
} as const;

/**
 * Border / divider tokens. `hairline` is the 1px list-row divider;
 * `card` is the optional faint outline on a card edge.
 */
export const borders = {
  hairline: 'rgba(255, 255, 255, 0.06)',
  card:     'rgba(255, 255, 255, 0.03)',
} as const;

/**
 * Data-viz palette (CRAFT_RESEARCH.md). Shared across every chart
 * so the visual language stays consistent — equity sparkline today,
 * calendar heatmap / per-setup bars / P&L histogram next.
 *
 *  - equityStroke: ALWAYS gold for the equity line itself, even on
 *    a loss day. The fill underneath carries the gain / loss signal;
 *    the line stays a single brand color.
 *  - gainFill / lossFill: linear-gradient stops below the line.
 *  - referenceLine: the dashed baseline at startingBalance.
 *  - crosshair: reserved for the future scrub-to-value interaction.
 *  - gridLine: reserved for axis-bearing charts (heatmap, histogram).
 */
export const chart = {
  equityStroke:    '#FFB800',
  gainFillTop:     'rgba(0, 211, 149, 0.24)',
  gainFillBottom:  'rgba(0, 211, 149, 0)',
  lossFillTop:     'rgba(255, 71, 87, 0.24)',
  lossFillBottom:  'rgba(255, 71, 87, 0)',
  referenceLine:   'rgba(255, 255, 255, 0.20)',
  crosshair:       'rgba(255, 255, 255, 0.80)',
  gridLine:        'rgba(59, 130, 246, 0.08)',
  // Calendar-heatmap intensity tiers — opacity ramps on the brand
  // green / red. Magnitude thresholds live in src/lib/dailyPnL.ts.
  gainTier1: 'rgba(0, 211, 149, 0.10)',
  gainTier2: 'rgba(0, 211, 149, 0.20)',
  gainTier3: 'rgba(0, 211, 149, 0.30)',
  gainTier4: 'rgba(0, 211, 149, 0.40)',
  lossTier1: 'rgba(255, 71, 87, 0.10)',
  lossTier2: 'rgba(255, 71, 87, 0.20)',
  lossTier3: 'rgba(255, 71, 87, 0.30)',
  lossTier4: 'rgba(255, 71, 87, 0.40)',
} as const;

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

/**
 * Loaded-font family tokens (bundled via @expo-google-fonts/inter
 * and @expo-google-fonts/jetbrains-mono — see App.tsx useFonts).
 *
 *  - `body` family is Inter at the relevant weight, used for prose,
 *    titles, labels, and button text.
 *  - `heading` is also Inter Bold/Black today. The original spec
 *    called for an Inter DISPLAY optical variant, but
 *    `@expo-google-fonts/inter` doesn't expose Display weights as
 *    a separate sub-family — so heading deliberately reuses Inter
 *    Bold/Black at display sizes. Swap to a real Display family
 *    here if it becomes available.
 *  - `mono` is JetBrains Mono, used for every numeric value in the
 *    app (equity, P&L, XP, progress fractions, rank thresholds).
 *    Wrapped by `<NumericText>` so call sites stay terse.
 */
export const fonts = {
  body:        'Inter_400Regular',
  bodyMedium:  'Inter_500Medium',
  bodySemi:    'Inter_600SemiBold',
  bodyBold:    'Inter_700Bold',
  heading:     'Inter_700Bold',
  headingBlack:'Inter_900Black',
  mono:        'JetBrainsMono_500Medium',
  monoBold:    'JetBrainsMono_700Bold',
} as const;

/** Legacy alias kept for older call sites that reference `font.*`
 *  (none in tree at the time of the typography upgrade). Prefer
 *  `fonts` above for new code. */
export const font = {
  sans:     fonts.body,
  sansBold: fonts.bodyBold,
  mono:     fonts.mono,
  monoBold: fonts.monoBold,
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

/**
 * Locked 6-step typography scale (DESIGN_AUDIT §2.3).
 *
 * The single source of truth for font size + line height + weight
 * + letter spacing. **Color is NOT baked in** — consumers apply
 * `color` via the style array so type and color stay separate
 * concerns:
 *
 *   <Text style={[typography.h1, { color: colors.textPrimary }]}>
 *
 * Steps (size / line-height / weight):
 *  - display:  28 / 32 bold     — screen titles
 *  - h1:       22 / 28 bold     — card titles
 *  - h2:       17 / 22 semibold — row titles
 *  - body:     15 / 22 regular  — paragraphs
 *  - label:    13 / 18 medium   — sublabels, captions
 *  - eyebrow:  11 / 14 medium, uppercase, letterSpacing 0.8 —
 *              every tracked section header / eyebrow
 *
 * Don't invent a 7th step — surface the mismatch instead.
 */
// Cast helper: RN's TextStyle expects a *mutable* FontVariant[],
// so a `readonly` tuple from `as const` is rejected. This single
// shared array satisfies the type once instead of casting at every
// call site.
const TABULAR: Array<'tabular-nums'> = ['tabular-nums'];

export const typography = {
  // Display + h1 use the heading family (Inter Bold/Black today;
  // swap to a real Inter Display optical variant if one is added).
  display: {
    fontFamily: fonts.headingBlack,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    fontVariant: TABULAR,
  },
  h1: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    fontVariant: TABULAR,
  },
  h2: {
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
    fontVariant: TABULAR,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
    fontVariant: TABULAR,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
    fontVariant: TABULAR,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    fontVariant: TABULAR,
  },
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
