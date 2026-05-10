/**
 * Drawing tool catalog — pruned to 10 essential tools per
 * docs/DRAWING_TOOLS_AUDIT.md. Anything that used to exist (ray, info
 * line, extended line, trend angle, cross line, hray, circle, arrow,
 * parallel channel, fib extension, all patterns / forecasting / volume,
 * date/price range measurers, note / price-note text variants, etc.) is
 * intentionally absent — DELETED, not just hidden. Old drawings of those
 * types persisted in AsyncStorage are filtered out gracefully on hydrate.
 */

export type DrawingCategory =
  | 'cursors'
  | 'lines'
  | 'studies'
  | 'positions'
  | 'brushes'
  | 'text';

export type DrawingType =
  // Cursors (not drawings; pointer modes)
  | 'cursor_cross' | 'eraser'
  // Lines & shapes — 4 keep tools
  | 'trendline' | 'hline' | 'vline' | 'rectangle'
  // Studies — 2 keep tools
  | 'fib_retracement' | 'gann_box'
  // Positions — 2 keep tools (TradingView-style entry/stop/target visuals)
  | 'long_position' | 'short_position'
  // Brushes — 1 keep tool
  | 'brush'
  // Text — 1 keep tool
  | 'text';

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
  { id: 'cursor_cross', label: 'Cross',  icon: 'add-outline',       category: 'cursors', pointsRequired: 0, drawable: false },
  { id: 'eraser',       label: 'Eraser', icon: 'trash-bin-outline', category: 'cursors', pointsRequired: 0, drawable: false },

  // ── Lines & shapes ─────────────────────────────────────────────────────────
  { id: 'trendline', label: 'Trendline',       icon: 'trending-up-outline', category: 'lines', pointsRequired: 2, drawable: true },
  { id: 'hline',     label: 'Horizontal line', icon: 'remove-outline',      category: 'lines', pointsRequired: 1, drawable: true },
  { id: 'vline',     label: 'Vertical line',   icon: 'reorder-two-outline', category: 'lines', pointsRequired: 1, drawable: true },
  { id: 'rectangle', label: 'Rectangle',       icon: 'square-outline',      category: 'lines', pointsRequired: 2, drawable: true },

  // ── Studies ────────────────────────────────────────────────────────────────
  { id: 'fib_retracement', label: 'Fib retracement', icon: 'list-outline', category: 'studies', pointsRequired: 2, drawable: true  },
  // gann_box renderer pending; declared as drawable: false until implemented.
  { id: 'gann_box',        label: 'Gann box',        icon: 'grid-outline', category: 'studies', pointsRequired: 2, drawable: false },

  // ── Positions (TradingView-style entry/stop/target visuals) ────────────────
  // Renderers pending; declared as drawable: false until implemented.
  { id: 'long_position',  label: 'Long position',  icon: 'arrow-up-circle-outline',   category: 'positions', pointsRequired: 3, drawable: false },
  { id: 'short_position', label: 'Short position', icon: 'arrow-down-circle-outline', category: 'positions', pointsRequired: 3, drawable: false },

  // ── Brushes ────────────────────────────────────────────────────────────────
  // brush is a freehand N-point path; renderer pending implementation.
  { id: 'brush', label: 'Brush', icon: 'brush-outline', category: 'brushes', pointsRequired: 2, drawable: false },

  // ── Text ───────────────────────────────────────────────────────────────────
  { id: 'text', label: 'Text', icon: 'text-outline', category: 'text', pointsRequired: 1, drawable: true },
];

export const TOOL_BY_ID: Record<DrawingType, ToolDef> =
  Object.fromEntries(TOOL_CATALOG.map((t) => [t.id, t])) as any;

// Toolbar buttons — one per category. 6 buttons total after pruning.
export const CATEGORY_BUTTONS: { category: DrawingCategory; icon: string; label: string }[] = [
  { category: 'cursors',   icon: 'add-outline',                   label: 'Cursor'    },
  { category: 'lines',     icon: 'trending-up-outline',           label: 'Lines'     },
  { category: 'studies',   icon: 'list-outline',                  label: 'Studies'   },
  { category: 'positions', icon: 'arrow-up-circle-outline',       label: 'Positions' },
  { category: 'brushes',   icon: 'brush-outline',                 label: 'Brushes'   },
  { category: 'text',      icon: 'text-outline',                  label: 'Text'      },
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
