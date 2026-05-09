/**
 * Drawing tool catalog — matches the seven submenus in the TradingView screenshots:
 *  Cursors / Lines / Fib & Gann / Patterns / Forecasting+Volume+Measurers /
 *  Brushes / Text. Nothing else.
 */

export type DrawingCategory =
  | 'cursors'
  | 'lines'
  | 'fib'
  | 'patterns'
  | 'forecasting'
  | 'brushes'
  | 'text';

export type DrawingType =
  // Cursors
  | 'cursor_cross' | 'cursor_dot' | 'cursor_arrow' | 'demonstration' | 'eraser'
  // Lines (incl. shapes that pair naturally with line tools)
  | 'trendline' | 'ray' | 'info_line' | 'extended_line' | 'trend_angle'
  | 'hline' | 'hray' | 'vline' | 'cross_line'
  | 'rectangle' | 'circle' | 'arrow' | 'parallel_channel'
  // Fibonacci
  | 'fib_retracement' | 'fib_extension' | 'fib_channel' | 'fib_time_zone'
  | 'fib_speed_fan' | 'fib_trend_time' | 'fib_circles' | 'fib_spiral'
  | 'fib_speed_arcs' | 'fib_wedge' | 'pitchfan'
  // Gann
  | 'gann_box' | 'gann_square_fixed' | 'gann_square' | 'gann_fan'
  // Patterns
  | 'xabcd' | 'cypher' | 'head_shoulders' | 'abcd' | 'triangle' | 'three_drives'
  // Forecasting
  | 'position_forecast' | 'bar_pattern' | 'ghost_feed' | 'sector'
  // Volume-based
  | 'anchored_vwap' | 'fixed_range_volume_profile' | 'anchored_volume_profile'
  // Measurers
  | 'price_range' | 'date_range' | 'date_price_range'
  // Brushes
  | 'brush' | 'highlighter'
  // Text
  | 'text' | 'note' | 'price_note' | 'pin' | 'table' | 'callout' | 'comment';

export interface ToolDef {
  id: DrawingType;
  label: string;
  icon: string;
  category: DrawingCategory;
  /** Optional subsection header within the category submenu (Fibonacci / Gann / Volume-based / etc). */
  subsection?: string;
  pointsRequired: number;
  drawable: boolean;
}

export const TOOL_CATALOG: ToolDef[] = [
  // ── Cursors ────────────────────────────────────────────────────────────────
  { id: 'cursor_cross',  label: 'Cross',         icon: 'add-outline',         category: 'cursors', pointsRequired: 0, drawable: false },
  { id: 'cursor_dot',    label: 'Dot',           icon: 'ellipse',             category: 'cursors', pointsRequired: 0, drawable: false },
  { id: 'cursor_arrow',  label: 'Arrow',         icon: 'arrow-up-outline',    category: 'cursors', pointsRequired: 0, drawable: false },
  { id: 'demonstration', label: 'Demonstration', icon: 'play-circle-outline', category: 'cursors', pointsRequired: 0, drawable: false },
  { id: 'eraser',        label: 'Eraser',        icon: 'trash-bin-outline',   category: 'cursors', pointsRequired: 0, drawable: false },

  // ── Lines ──────────────────────────────────────────────────────────────────
  { id: 'trendline',     label: 'Trendline',      icon: 'trending-up-outline',   category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'ray',           label: 'Ray',            icon: 'arrow-forward-outline', category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'info_line',     label: 'Info line',      icon: 'information-outline',   category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'extended_line', label: 'Extended line',  icon: 'swap-horizontal-outline', category: 'lines', pointsRequired: 2, drawable: true },
  { id: 'trend_angle',   label: 'Trend angle',    icon: 'analytics-outline',     category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'hline',         label: 'Horizontal line',icon: 'remove-outline',        category: 'lines', pointsRequired: 1, drawable: true  },
  { id: 'hray',          label: 'Horizontal ray', icon: 'arrow-forward',         category: 'lines', pointsRequired: 1, drawable: true  },
  { id: 'vline',         label: 'Vertical line',  icon: 'reorder-two-outline',   category: 'lines', pointsRequired: 1, drawable: true  },
  { id: 'cross_line',    label: 'Cross line',     icon: 'add',                   category: 'lines', pointsRequired: 1, drawable: true  },
  { id: 'rectangle',     label: 'Rectangle',      icon: 'square-outline',        category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'circle',        label: 'Circle',         icon: 'ellipse-outline',       category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'arrow',         label: 'Arrow',          icon: 'arrow-up-outline',      category: 'lines', pointsRequired: 2, drawable: true  },
  { id: 'parallel_channel', label: 'Parallel channel', icon: 'reorder-three-outline', category: 'lines', pointsRequired: 3, drawable: true  },

  // ── Fibonacci (subsection) ─────────────────────────────────────────────────
  { id: 'fib_retracement',label:'Fib retracement',                 icon: 'list-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: true  },
  { id: 'fib_extension', label: 'Trend-based fib extension',       icon: 'list-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 3, drawable: true  },
  { id: 'fib_channel',   label: 'Fib channel',                     icon: 'list-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 3, drawable: false },
  { id: 'fib_time_zone', label: 'Fib time zone',                   icon: 'list-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: false },
  { id: 'fib_speed_fan', label: 'Fib speed/resistance fan',        icon: 'list-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: false },
  { id: 'fib_trend_time',label: 'Trend-based fib time',            icon: 'list-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 3, drawable: false },
  { id: 'fib_circles',   label: 'Fib circles',                     icon: 'ellipse-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: false },
  { id: 'fib_spiral',    label: 'Fib spiral',                      icon: 'sync-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: false },
  { id: 'fib_speed_arcs',label: 'Fib speed/resistance arcs',       icon: 'ellipse-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: false },
  { id: 'fib_wedge',     label: 'Fib wedge',                       icon: 'triangle-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 2, drawable: false },
  { id: 'pitchfan',      label: 'Pitchfan',                        icon: 'git-branch-outline', category: 'fib', subsection: 'Fibonacci', pointsRequired: 3, drawable: false },

  // ── Gann (subsection) ──────────────────────────────────────────────────────
  { id: 'gann_box',          label: 'Gann box',          icon: 'grid-outline',   category: 'fib', subsection: 'Gann', pointsRequired: 2, drawable: false },
  { id: 'gann_square_fixed', label: 'Gann square fixed', icon: 'square-outline', category: 'fib', subsection: 'Gann', pointsRequired: 2, drawable: false },
  { id: 'gann_square',       label: 'Gann square',       icon: 'square-outline', category: 'fib', subsection: 'Gann', pointsRequired: 2, drawable: false },
  { id: 'gann_fan',          label: 'Gann fan',          icon: 'git-branch-outline', category: 'fib', subsection: 'Gann', pointsRequired: 2, drawable: false },

  // ── Patterns ───────────────────────────────────────────────────────────────
  { id: 'xabcd',         label: 'XABCD pattern',     icon: 'pulse-outline', category: 'patterns', pointsRequired: 5, drawable: false },
  { id: 'cypher',        label: 'Cypher pattern',    icon: 'pulse-outline', category: 'patterns', pointsRequired: 5, drawable: false },
  { id: 'head_shoulders',label: 'Head and shoulders',icon: 'pulse-outline', category: 'patterns', pointsRequired: 5, drawable: false },
  { id: 'abcd',          label: 'ABCD pattern',      icon: 'pulse-outline', category: 'patterns', pointsRequired: 4, drawable: false },
  { id: 'triangle',      label: 'Triangle pattern',  icon: 'triangle-outline', category: 'patterns', pointsRequired: 3, drawable: false },
  { id: 'three_drives',  label: 'Three drives pattern', icon: 'pulse-outline', category: 'patterns', pointsRequired: 3, drawable: false },

  // ── Forecasting (subsection) ───────────────────────────────────────────────
  { id: 'position_forecast', label: 'Position forecast', icon: 'compass-outline',     category: 'forecasting', subsection: 'Forecasting', pointsRequired: 2, drawable: false },
  { id: 'bar_pattern',       label: 'Bar pattern',       icon: 'bar-chart-outline',   category: 'forecasting', subsection: 'Forecasting', pointsRequired: 2, drawable: false },
  { id: 'ghost_feed',        label: 'Ghost feed',        icon: 'cloud-outline',       category: 'forecasting', subsection: 'Forecasting', pointsRequired: 2, drawable: false },
  { id: 'sector',            label: 'Sector',            icon: 'pie-chart-outline',   category: 'forecasting', subsection: 'Forecasting', pointsRequired: 3, drawable: false },

  // ── Volume-based (subsection) ──────────────────────────────────────────────
  { id: 'anchored_vwap',                label: 'Anchored VWAP',               icon: 'analytics-outline',    category: 'forecasting', subsection: 'Volume-based', pointsRequired: 1, drawable: false },
  { id: 'fixed_range_volume_profile',   label: 'Fixed range volume profile',  icon: 'stats-chart-outline',  category: 'forecasting', subsection: 'Volume-based', pointsRequired: 2, drawable: false },
  { id: 'anchored_volume_profile',      label: 'Anchored volume profile',     icon: 'stats-chart-outline',  category: 'forecasting', subsection: 'Volume-based', pointsRequired: 1, drawable: false },

  // ── Measurers (subsection) ─────────────────────────────────────────────────
  { id: 'price_range',      label: 'Price range',          icon: 'resize-outline',   category: 'forecasting', subsection: 'Measurers', pointsRequired: 2, drawable: true  },
  { id: 'date_range',       label: 'Date range',           icon: 'calendar-outline', category: 'forecasting', subsection: 'Measurers', pointsRequired: 2, drawable: true  },
  { id: 'date_price_range', label: 'Date and price range', icon: 'apps-outline',     category: 'forecasting', subsection: 'Measurers', pointsRequired: 2, drawable: true  },

  // ── Brushes ────────────────────────────────────────────────────────────────
  { id: 'brush',         label: 'Brush',           icon: 'brush-outline',      category: 'brushes', pointsRequired: 2, drawable: false },
  { id: 'highlighter',   label: 'Highlighter',     icon: 'create-outline',     category: 'brushes', pointsRequired: 2, drawable: false },

  // ── Text ───────────────────────────────────────────────────────────────────
  { id: 'text',          label: 'Text',            icon: 'text-outline',          category: 'text', pointsRequired: 1, drawable: true  },
  { id: 'note',          label: 'Note',            icon: 'document-text-outline', category: 'text', pointsRequired: 1, drawable: true  },
  { id: 'price_note',    label: 'Price note',      icon: 'cash-outline',          category: 'text', pointsRequired: 1, drawable: true  },
  { id: 'pin',           label: 'Pin',             icon: 'location-outline',      category: 'text', pointsRequired: 1, drawable: false },
  { id: 'table',         label: 'Table',           icon: 'grid-outline',          category: 'text', pointsRequired: 1, drawable: false },
  { id: 'callout',       label: 'Callout',         icon: 'chatbubble-outline',    category: 'text', pointsRequired: 1, drawable: false },
  { id: 'comment',       label: 'Comment',         icon: 'chatbox-outline',       category: 'text', pointsRequired: 1, drawable: false },
];

export const TOOL_BY_ID: Record<DrawingType, ToolDef> =
  Object.fromEntries(TOOL_CATALOG.map((t) => [t.id, t])) as any;

// Toolbar buttons (one per category, in screenshot order).
export const CATEGORY_BUTTONS: { category: DrawingCategory; icon: string; label: string }[] = [
  { category: 'cursors',     icon: 'add-outline',           label: 'Cursor' },
  { category: 'lines',       icon: 'trending-up-outline',   label: 'Lines' },
  { category: 'fib',         icon: 'list-outline',          label: 'Fib & Gann' },
  { category: 'patterns',    icon: 'pulse-outline',         label: 'Patterns' },
  { category: 'forecasting', icon: 'arrow-up-outline',      label: 'Forecasting' },
  { category: 'brushes',     icon: 'brush-outline',         label: 'Brushes' },
  { category: 'text',        icon: 'text-outline',          label: 'Text' },
];

// ── Drawing instances on the chart ─────────────────────────────────────────────
export interface DrawingPoint { time: number; price: number; }

/** Per-level config for fib retracement / extension drawings. The renderer
 *  resolves these against FIB_LEVEL_DEFAULTS — anything missing falls back
 *  to the default for that ratio. Keeps persisted drawings forward-compatible. */
export interface FibLevelConfig {
  value: number;            // 0, 0.236, …
  visible?: boolean;        // omitted = use default
  color?: string;           // omitted = use the drawing's main color
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  /** Stroke alpha (0–1). Separate from fillOpacity so users can dim a line
   *  without affecting any rectangle/circle/fib fill. Renderer treats
   *  undefined as 1 (full opacity). */
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  fontSize?: number;
  /** Trendline/ray/hline: extend the line past its anchor(s) infinitely. */
  extendLeft?: boolean;
  extendRight?: boolean;
  /** Show the y-price as a small tag at the right end of the line. */
  showPriceLabel?: boolean;
  /** Per-level overrides (fib retracement / extension). Sparse array — only
   *  contains entries the user has touched. Defaults from FIB_LEVEL_DEFAULTS. */
  fibLevels?: FibLevelConfig[];
  /** Editable background-fill opacity for fib retracement (0–1). */
  fibBgOpacity?: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  locked?: boolean;
  hidden?: boolean;
}

export const DEFAULT_STYLE: DrawingStyle = {
  color: '#58a6ff',
  lineWidth: 2,
  lineStyle: 'solid',
  strokeOpacity: 1,
  fillColor: '#58a6ff',
  fillOpacity: 0.15,
  fontSize: 12,
  extendLeft: false,
  extendRight: false,
  showPriceLabel: false,
  fibBgOpacity: 0.04,
};

/** Full set of fib levels the renderer supports. */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618];

/** Defaults applied to fib levels when a drawing has no per-level overrides
 *  for that ratio. The 3 extension levels start hidden so a fresh fib looks
 *  like the standard 7-level retracement. */
export const FIB_LEVEL_DEFAULTS: Record<number, { visible: boolean }> = {
  0:     { visible: true  },
  0.236: { visible: true  },
  0.382: { visible: true  },
  0.5:   { visible: true  },
  0.618: { visible: true  },
  0.786: { visible: true  },
  1:     { visible: true  },
  1.272: { visible: false },
  1.414: { visible: false },
  1.618: { visible: false },
};

/** Resolve effective config for one fib level (merge user override + default). */
export function resolveFibLevel(
  level: number,
  overrides: FibLevelConfig[] | undefined,
  fallbackColor: string,
): { value: number; visible: boolean; color: string } {
  const override = overrides?.find((o) => o.value === level);
  const def = FIB_LEVEL_DEFAULTS[level] ?? { visible: true };
  return {
    value: level,
    visible: override?.visible ?? def.visible,
    color:   override?.color   ?? fallbackColor,
  };
}
