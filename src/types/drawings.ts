/**
 * Drawing tool catalog — RESET on 2026-05-11. Backup tag:
 * `drawings-before-reset` preserves the previous implementations
 * (trendline, horizontal_line/ray, rectangle, fib_retracement, text,
 * etc.) for reference.
 *
 * Current state: the framework lives here (types, store, settings shell,
 * renderer hook points), but no DRAWING tools are registered. Only the
 * two cursor pointer modes remain so the active-tool state machine has
 * a default. Tools will be added back one at a time following the
 * authoritative spec in docs/TRADINGVIEW_REFERENCE.md.
 */

export type DrawingCategory =
  | 'cursors'
  | 'lines'
  | 'studies'
  | 'positions'
  | 'brushes'
  | 'text';

/**
 * Drawing tool type union. Cursor modes are NOT drawings — they're
 * pointer states for the toolbar. As real drawing tools come back
 * online, extend this union (e.g. `| 'trendline'`). Any persisted
 * drawing whose `type` is missing from this union is filtered out on
 * hydrate, so the union doubles as the canonical "known tools" list.
 */
export type DrawingType =
  // Cursors (not drawings; pointer modes)
  | 'cursor_cross' | 'eraser'
  // Drawings (post-reset rebuild — one tool at a time)
  | 'horizontal_line';

export interface ToolDef {
  id: DrawingType;
  label: string;
  icon: string;
  category: DrawingCategory;
  /** Optional subsection header within the category submenu. */
  subsection?: string;
  pointsRequired: number;
  drawable: boolean;
}

export const TOOL_CATALOG: ToolDef[] = [
  // ── Cursors ────────────────────────────────────────────────────────────────
  { id: 'cursor_cross', label: 'Cross',  icon: 'add-outline',       category: 'cursors', pointsRequired: 0, drawable: false },
  { id: 'eraser',       label: 'Eraser', icon: 'trash-bin-outline', category: 'cursors', pointsRequired: 0, drawable: false },

  // ── Drawings (post-reset rebuild) ──────────────────────────────────────────
  // Horizontal line (TRADINGVIEW_REFERENCE.md §2) — single anchor, extends
  // right only from the anchor's (time, price). Step 1: placement + render
  // only; selection / drag / settings come in later steps.
  { id: 'horizontal_line', label: 'Horizontal line', icon: 'remove-outline', category: 'lines', pointsRequired: 1, drawable: true },
];

export const TOOL_BY_ID: Record<DrawingType, ToolDef> =
  Object.fromEntries(TOOL_CATALOG.map((t) => [t.id, t])) as any;

// Toolbar buttons — one per category. Categories stay so the toolbar
// UI keeps its structure; submenus will populate as tools come back.
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

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  /** Stroke alpha (0–1). Renderer treats undefined as 1 (fully opaque). */
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  fontSize?: number;
  /** Extend the line past its anchor(s) infinitely (per-tool concept; only
   *  certain tools will honor these flags). */
  extendLeft?: boolean;
  extendRight?: boolean;
  /** Show the y-price as a small tag at the right end of the line. */
  showPriceLabel?: boolean;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  locked?: boolean;
  hidden?: boolean;
}

/** Generic default style. Per-tool defaults (e.g. TradingView-parity
 *  blue for trendlines) will live next to each tool's implementation
 *  when those tools come back. */
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
};

/** TradingView-parity defaults for horizontal_line (docs/TRADINGVIEW_REFERENCE.md §2).
 *  Right-only line: blue #2962FF, 1 px, solid, full opacity. */
export const HLINE_DEFAULT_STYLE: DrawingStyle = {
  ...DEFAULT_STYLE,
  color: '#2962FF',
  lineWidth: 1,
  lineStyle: 'solid',
  strokeOpacity: 1,
};
