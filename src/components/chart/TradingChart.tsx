import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SessionCandle, SessionPosition } from '../../store/sessionStore';
import { useDrawingsStore } from '../../store/drawingsStore';
import { TOOL_BY_ID, DEFAULT_STYLE, HLINE_DEFAULT_STYLE, Drawing, DrawingType } from '../../types/drawings';

export interface ChartTheme {
  background:    string;
  textColor:     string;
  gridColor:     string;
  borderColor:   string;
  upColor:       string;
  downColor:     string;
  // Optional per-part overrides — fall back to up/down body color if undefined.
  borderUpColor?:   string;
  borderDownColor?: string;
  wickUpColor?:     string;
  wickDownColor?:   string;
  entryColor:    string;
  slColor:       string;
  tpColor:       string;
  // Visibility toggles — undefined treated as `true`
  showBorders?:   boolean;
  showWicks?:     boolean;
  showGrid?:      boolean;
  showEntryLine?: boolean;
  showSlLine?:    boolean;
  showTpLine?:    boolean;
}

export const DEFAULT_CHART_THEME: ChartTheme = {
  background:  '#000000',
  textColor:   '#c9d1d9',
  gridColor:   '#1a1a1a',
  borderColor: '#2a2a2a',
  upColor:     '#22C55E',
  downColor:   '#EF4444',
  entryColor:  '#58a6ff',
  slColor:     '#EF4444',
  tpColor:     '#22C55E',
};

export const CHART_THEME_PRESETS: { name: string; theme: ChartTheme }[] = [
  { name: 'Default Dark', theme: DEFAULT_CHART_THEME },
  { name: 'TradingView Classic', theme: {
      background: '#131722', textColor: '#d1d4dc',
      gridColor: '#2a2e39', borderColor: '#363c4e',
      upColor: '#26a69a', downColor: '#ef5350',
      entryColor: '#2962ff', slColor: '#ef5350', tpColor: '#26a69a',
  }},
  { name: 'High Contrast', theme: {
      background: '#000000', textColor: '#ffffff',
      gridColor: '#222222', borderColor: '#444444',
      upColor: '#00ff00', downColor: '#ff0000',
      entryColor: '#00ffff', slColor: '#ff0000', tpColor: '#00ff00',
  }},
  { name: 'Inverted (Red Up)', theme: {
      background: '#000000', textColor: '#c9d1d9',
      gridColor: '#1a1a1a', borderColor: '#2a2a2a',
      upColor: '#EF4444', downColor: '#22C55E',
      entryColor: '#FFB800', slColor: '#22C55E', tpColor: '#EF4444',
  }},
  { name: 'Light Mode', theme: {
      background: '#ffffff', textColor: '#1a1a1a',
      gridColor: '#e0e0e0', borderColor: '#cccccc',
      upColor: '#22C55E', downColor: '#EF4444',
      entryColor: '#2962ff', slColor: '#EF4444', tpColor: '#22C55E',
  }},
];

export interface PendingPosition {
  side: 'buy' | 'sell';
  entry: number;
  /** null = inactive (only the small floating button is shown). */
  tp: number | null;
  /** null = inactive (only the small floating button is shown). */
  sl: number | null;
  /** Dollar value of one full price point at the user's current lot size.
   *  Used to render live profit/loss next to active TP/SL. */
  dollarPerPoint: number;
}

interface Props {
  candles: SessionCandle[];
  positions: SessionPosition[];
  currentPrice: number;
  theme?: ChartTheme;
  timeframe?: string;
  /** IANA tz name used to format the chart x-axis + crosshair. Display-only —
   *  candle timestamps and seek logic stay UTC. */
  displayTz?: string;
  pendingPosition?: PendingPosition | null;
  onPendingDrag?: (kind: 'tp' | 'sl', price: number) => void;
}

// Resolve a chart x-axis time for a candle. Prefer the real unix timestamp
// from the backend (so the date axis is accurate); fall back to a synthetic
// epoch + bar*tf only if the backend didn't include a time.
const TF_SECONDS: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '4h': 14400, '1D': 86400, '1W': 604800,
};
const FAKE_EPOCH_SECONDS = 1577836800; // 2020-01-01 00:00:00 UTC
function candleTime(c: SessionCandle, tf?: string): number {
  if (typeof c.time === 'number') return c.time;
  const step = TF_SECONDS[tf ?? '1D'] ?? 86400;
  return FAKE_EPOCH_SECONDS + c.bar * step;
}

/**
 * Build the WebView HTML ONCE per theme change. The chart starts EMPTY and is
 * populated via postMessage. This way the WebView never reloads on candle
 * updates and the user's pan/zoom is preserved.
 */
function buildHTML(t: ChartTheme): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${t.background}; overflow: hidden; }
  #chart { width: 100vw; height: 100vh; }
</style>
</head>
<body>
<div id="chart"></div>
<svg id="overlay" xmlns="http://www.w3.org/2000/svg"
     style="position:absolute;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;">
  <defs>
    <!-- Clips drawings to the chart's plot area so they don't bleed onto
         the price scale (right) or time scale (bottom). -->
    <clipPath id="plotClip">
      <rect id="plotClipRect" x="0" y="0" width="100%" height="100%" />
    </clipPath>
  </defs>
  <!-- hitBg catches empty taps in placement mode (so they register as
       drawing points instead of falling through to chart pan). -->
  <rect id="hitBg" x="0" y="0" width="100%" height="100%" fill="transparent" pointer-events="none" />
  <!-- All drawings live inside this clipped group. -->
  <g id="drawingsLayer" clip-path="url(#plotClip)"></g>
  <!-- Pending order (BUY/SELL preview) lives on its own layer so dragging
       TP/SL never touches the drawings layer. Elements are built once and
       mutated in place during drag for 60fps movement. -->
  <g id="pendingLayer"></g>
</svg>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<script>
  const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    width: window.innerWidth,
    height: window.innerHeight,
    layout: { background: { color: '${t.background}' }, textColor: '${t.textColor}' },
    grid: {
      vertLines: { color: '${t.gridColor}', visible: ${t.showGrid !== false} },
      horzLines: { color: '${t.gridColor}', visible: ${t.showGrid !== false} },
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    // Crosshair on mobile activates via long-press; dismiss on touchend so
    // it doesn't get stuck (lightweight-charts default is OnNextTap which
    // means a stray crosshair survives until the next tap somewhere).
    trackingMode: { exitMode: LightweightCharts.TrackingModeExitMode.OnTouchEnd },
    rightPriceScale: { borderColor: '${t.borderColor}' },
    timeScale: {
      borderColor: '${t.borderColor}',
      timeVisible: true,
      secondsVisible: false,
      shiftVisibleRangeOnNewBar: false,
      lockVisibleTimeRangeOnResize: true,
      // Empty space on the right so new bars appear into existing room without
      // re-laying out the time axis labels.
      rightOffset: 10,
    },
  });

  // Display timezone — replaces the browser-default formatting on the
  // x-axis tick marks AND the crosshair tooltip. Updated via displayTz msg.
  let displayTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function fmtHM(unixSec) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: displayTz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(unixSec * 1000));
  }
  function fmtMonthDay(unixSec) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: displayTz, month: 'short', day: '2-digit',
    }).format(new Date(unixSec * 1000));
  }
  function fmtMonthYear(unixSec) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: displayTz, month: 'short', year: 'numeric',
    }).format(new Date(unixSec * 1000));
  }
  function fmtYear(unixSec) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: displayTz, year: 'numeric',
    }).format(new Date(unixSec * 1000));
  }
  function applyDisplayTzFormatters() {
    chart.applyOptions({
      localization: {
        // Crosshair / hover tooltip time.
        timeFormatter: function (t) { return fmtMonthDay(t) + '  ' + fmtHM(t); },
      },
      timeScale: {
        // tickMarkType: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds
        tickMarkFormatter: function (time, tickMarkType) {
          if (tickMarkType === 4 || tickMarkType === 3) return fmtHM(time);
          if (tickMarkType === 2) return fmtMonthDay(time);
          if (tickMarkType === 1) return fmtMonthYear(time);
          return fmtYear(time);
        },
      },
    });
  }
  applyDisplayTzFormatters();

  const series = chart.addCandlestickSeries({
    upColor:         '${t.upColor}',
    downColor:       '${t.downColor}',
    borderVisible:   ${t.showBorders !== false},
    borderUpColor:   '${t.borderUpColor   ?? t.upColor}',
    borderDownColor: '${t.borderDownColor ?? t.downColor}',
    wickVisible:     ${t.showWicks !== false},
    wickUpColor:     '${t.wickUpColor     ?? t.upColor}',
    wickDownColor:   '${t.wickDownColor   ?? t.downColor}',
    // Hide the moving last-price indicator + dashed line so the price scale
    // doesn't visibly twitch every time a new bar closes at a slightly
    // different value. The static price labels stay; only the "current price"
    // indicators are removed.
    lastValueVisible: false,
    priceLineVisible: false,
  });

  // Track active price lines so we can replace them when positions change
  let activeLines = [];
  function setPriceLines(lines) {
    activeLines.forEach((l) => series.removePriceLine(l));
    activeLines = lines.map(({ price, color, title, style }) =>
      series.createPriceLine({ price, color, lineWidth: 2, lineStyle: style, axisLabelVisible: true, title })
    );
  }

  // ── Crosshair tracking ───────────────────────────────────────────────────
  // Diagnostics + force-hide hook. trackingMode.exitMode=OnTouchEnd (set
  // above) is what actually auto-dismisses the crosshair on touchend.
  // The log fires on state transitions only (not every move) so the RN
  // console stays readable. clearCrosshair() is called from handleTap when
  // a touch lands on a drawing, so the crosshair never overlaps a selection.
  let crosshairVisible = false;
  chart.subscribeCrosshairMove(function (param) {
    const isVisible = param && param.time !== undefined && param.point !== undefined;
    if (isVisible !== crosshairVisible) {
      crosshairVisible = isVisible;
      postBack({ type: 'log', msg: 'crosshair: ' + (isVisible ? 'SHOW' : 'HIDE') });
    }
  });
  function clearCrosshair() {
    try { chart.clearCrosshairPosition(); } catch (err) {}
  }

  // Empty-canvas tap → deselect any active drawing. The SVG overlay has
  // pointer-events:none in cursor mode (so chart pan/zoom works), which
  // means taps on empty area never bubble to our handleTap and the
  // drawing_deselect path can't fire from there. subscribeClick fills the
  // gap — lightweight-charts only fires this for clicks on the chart
  // canvas itself, NOT for taps that an SVG drawing element captured.
  chart.subscribeClick(function () {
    if (drawingSelectedId) {
      postBack({ type: 'drawing_deselect' });
    }
  });

  // ── Drawings (overlay SVG) ───────────────────────────────────────────────────
  // Drawings come from React Native as { id, type, points: [{time, price}, …], style }.
  // We convert each point's chart-coordinates into pixel-coordinates using the
  // chart's timeScale + price scale, then build SVG primitives.
  let drawingsList = [];
  let drawingActiveTool = 'cursor_cross';
  let drawingSelectedId = null;
  let drawingPendingPoints = [];
  let drawingDragState = null;
  let magnetMode = 'off';
  let pendingPosition = null;       // { side, entry, tp, sl }
  let pendingDragKind = null;       // 'tp' | 'sl' while user is dragging
  // Timestamp of the last drawable-tool activation. Floating UI pills (the
  // favorites bar sits ON the chart) can leak a phantom chart tap right
  // after the pill press, which would land as the first placement point at
  // the pill's x/y. We swallow chart taps for ~200ms after activation.
  let toolActivatedAt = 0;

  const overlay        = document.getElementById('overlay');
  const hitBg          = document.getElementById('hitBg');
  const drawingsLayer  = document.getElementById('drawingsLayer');
  const pendingLayer   = document.getElementById('pendingLayer');
  const plotClipRect   = document.getElementById('plotClipRect');

  /** Resize the clip rect to match the chart's actual plot area so drawings
   *  stop at the price-scale and time-scale boundaries. Called on every
   *  render so pan/zoom/timeframe-switch keep it in sync. */
  function updatePlotClip() {
    const priceW = (chart.priceScale('right').width && chart.priceScale('right').width()) || 60;
    const timeH  = (chart.timeScale().height && chart.timeScale().height()) || 28;
    plotClipRect.setAttribute('width',  Math.max(0, window.innerWidth  - priceW));
    plotClipRect.setAttribute('height', Math.max(0, window.innerHeight - timeH));
  }

  function svg(tag, attrs, children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (children) for (const c of children) el.appendChild(c);
    return el;
  }
  /** Invisible 24px-wide hit target — sits under the visible drawing element so
   *  fingers don't have to land exactly on a 2px line to select / drag it.
   *  Larger than the visible stroke so taps near the line still register. */
  function hitLine(x1, y1, x2, y2, id) {
    return svg('line', {
      x1, y1, x2, y2,
      stroke: 'transparent', 'stroke-width': 24,
      'data-id': id, 'pointer-events': 'stroke',
    });
  }
  function hitRect(x, y, w, h, id) {
    return svg('rect', {
      x: x - 12, y: y - 12, width: w + 24, height: h + 24,
      fill: 'transparent', stroke: 'transparent', 'stroke-width': 24,
      'data-id': id, 'pointer-events': 'all',
    });
  }
  function dashFor(style) {
    if (style === 'dashed') return '6,4';
    if (style === 'dotted') return '2,3';
    return null;
  }
  function px(point) {
    const x = chart.timeScale().timeToCoordinate(point.time);
    const y = series.priceToCoordinate(point.price);
    return (x == null || y == null) ? null : { x, y };
  }

  // Tiny right-axis price tag helper. Kept as a generic utility for the
  // tools that will come back online (trendline, horizontal_line, etc.).
  function priceTag(yy, color, txt) {
    const W = window.innerWidth;
    const tw = Math.max(40, txt.length * 7 + 8);
    const g = svg('g', { 'pointer-events': 'none' });
    g.appendChild(svg('rect', {
      x: W - tw - 4, y: yy - 9, width: tw, height: 18, rx: 3,
      fill: color, 'pointer-events': 'none',
    }));
    g.appendChild(svg('text', {
      x: W - tw / 2 - 4, y: yy + 4, fill: '#000',
      'font-size': 11, 'font-family': 'system-ui', 'font-weight': '700',
      'text-anchor': 'middle', 'pointer-events': 'none',
    }, [document.createTextNode(txt)]));
    return g;
  }
  // Reference unused vars so JS engines don't tree-shake them prematurely
  // when no tools are registered. priceTag + hitRect will be used again as
  // tools come back online.
  void priceTag; void hitRect;

  function renderDrawings() {
    drawingsLayer.innerHTML = '';
    updatePlotClip();

    // ── Drawing tool renderer (RESET) ────────────────────────────────────
    // All per-tool render branches were deleted in the 2026-05-11 reset.
    // The renderer SHELL stays so the framework (touchstart/move/end
    // dispatch, body-drag transform, handle-drag detach, selection sync)
    // remains testable. As tools come back online, each appends its own
    // SVG elements here per drawing in drawingsList — see the backup tag
    // 'drawings-before-reset' for prior implementations.
    const W = window.innerWidth;
    drawingsList.forEach((d) => {
      if (d.hidden) return;
      const isSel = d.id === drawingSelectedId;
      const stroke = d.style.color;
      const sw = d.style.lineWidth || 1;
      const strokeOp = (d.style.strokeOpacity == null) ? 1 : d.style.strokeOpacity;
      const dash = dashFor(d.style.lineStyle);

      const elements = [];

      // ── horizontal_line (step 1: placement + render only) ────────────────
      // TRADINGVIEW_REFERENCE.md §2 — extends right only from the anchor.
      // Anchor before view → render from left edge. Anchor after view →
      // skip rendering entirely (line hasn't started yet from POV).
      // No hit area, no selection, no handle — those come in later steps.
      if (d.type === 'horizontal_line') {
        const y = series.priceToCoordinate(d.points[0].price);
        if (y == null) return;
        const xRaw = chart.timeScale().timeToCoordinate(d.points[0].time);
        if (xRaw == null) return;
        if (xRaw > W) return;
        const startX = Math.max(0, xRaw);
        elements.push(svg('line', {
          x1: startX, y1: y, x2: W, y2: y,
          stroke, 'stroke-width': sw, 'stroke-dasharray': dash || '',
          'stroke-opacity': strokeOp,
          'pointer-events': 'none',
        }));
      }

      // Wrap each drawing in a <g> with data-drawing-id so body-drag's
      // transform-translate pattern keeps working without changes when
      // tools return.
      const group = svg('g', { 'data-drawing-id': d.id });
      elements.forEach((el) => {
        if (!el.getAttribute('data-id')) el.setAttribute('data-id', d.id);
        if (isSel) el.setAttribute('opacity', '1');
        group.appendChild(el);
      });

      // Generic handle rendering — one per anchor — when the drawing is
      // selected. Per-tool handle visuals (e.g. trendline's color-matched
      // ring) will move next to their respective render branches.
      if (isSel) {
        const pts = d.points.map(px);
        pts.forEach((p, idx) => {
          if (!p) return;
          group.appendChild(svg('circle', {
            cx: p.x, cy: p.y, r: 14,
            fill: 'transparent',
            'data-handle': idx, 'data-id': d.id,
            'pointer-events': 'all',
          }));
          group.appendChild(svg('circle', {
            cx: p.x, cy: p.y, r: 5,
            fill: '#000', stroke: '#FFF', 'stroke-width': 2,
            'pointer-events': 'none',
          }));
        });
      }
      // Reference 'stroke' so future per-tool branches can pick it up; the
      // void keeps JS happy until a tool actually paints.
      void stroke;
      drawingsLayer.appendChild(group);
    });

    // Pending points for an in-progress placement (generic — works for any
    // multi-tap tool that comes back online).
    drawingPendingPoints.forEach((pt) => {
      const c = px(pt);
      if (!c) return;
      drawingsLayer.appendChild(svg('circle', { cx: c.x, cy: c.y, r: 4, fill: '#FFD700' }));
    });
  }

  // ── Pending order layer (BUY/SELL preview) ──────────────────────────────
  // Built once when a pending order appears or its side changes; mutated in
  // place during TP/SL drag (no SVG rebuild). Buttery 60fps movement because
  // we update only y / textContent attributes — never touch React, never
  // re-render the rest of the chart.
  let pendingElems = null;

  function buildPendingPosition() {
    pendingLayer.innerHTML = '';
    pendingElems = null;
    stopPriceWatcher();
    if (!pendingPosition) return;
    const W       = window.innerWidth;
    const isBuy   = pendingPosition.side === 'buy';

    const PILL_W   = 38;
    const CHIP_W   = 78;
    const TOTAL_W  = PILL_W + CHIP_W;
    const ROW_H    = 22;
    const HALF_H   = ROW_H / 2;
    const RADIUS   = 5;
    const groupX   = W - TOTAL_W;
    const FONT     = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", system-ui, sans-serif';

    const ENTRY_C = isBuy ? '#2962FF' : '#EF5350';
    const TP_C    = '#089981';
    const SL_C    = '#FF9800';

    // Inactive-state float button geometry (TP/SL only — entry has no inactive state).
    // Both buttons sit ON the entry line (same Y), immediately to the LEFT of
    // the entry pill. TP closer to entry, SL one slot further left.
    const FLOAT_W = 34, FLOAT_H = 18, FLOAT_R = 5;
    const FLOAT_GAP = 4;
    // floatX is per-kind — TP gets the slot adjacent to the entry pill, SL one beyond.
    const floatXFor = (kind) => kind === 'tp'
      ? groupX - FLOAT_W - FLOAT_GAP
      : groupX - FLOAT_W * 2 - FLOAT_GAP * 2;

    const buildRow = (color, leftLabel, kind, textColor) => {
      // ── ACTIVE state visuals (line + pill + price chip) ──
      const line = svg('line', {
        x1: 0, y1: 0, x2: groupX, y2: 0,
        stroke: color, 'stroke-width': 2,
        opacity: 0.95, 'shape-rendering': 'geometricPrecision',
        'pointer-events': 'none',
      });
      const bg = svg('rect', {
        x: groupX, y: -HALF_H, width: TOTAL_W, height: ROW_H,
        rx: RADIUS, ry: RADIUS, fill: color,
        'pointer-events': 'none',
      });
      const divider = svg('line', {
        x1: groupX + PILL_W, x2: groupX + PILL_W,
        y1: -HALF_H + 5, y2: HALF_H - 5,
        stroke: textColor, 'stroke-width': 1, opacity: 0.22,
        'pointer-events': 'none',
      });
      const pillText = svg('text', {
        x: groupX + PILL_W / 2, y: 0,
        fill: textColor, 'font-size': 11,
        'font-family': FONT, 'font-weight': '800',
        'letter-spacing': '0.5',
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'pointer-events': 'none',
      }, [document.createTextNode(leftLabel)]);
      const chipText = svg('text', {
        x: groupX + PILL_W + CHIP_W / 2, y: 0,
        fill: textColor, 'font-size': 12,
        'font-family': FONT, 'font-weight': '700',
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-variant-numeric': 'tabular-nums',
        'pointer-events': 'none',
      }, [document.createTextNode('0')]);

      // ── Live P&L label for ACTIVE TP/SL (sits on the line, just left of the pill) ──
      // Black background box so the number stays readable on any chart background.
      let pnlBg = null, pnlText = null;
      if (kind === 'tp' || kind === 'sl') {
        pnlBg = svg('rect', {
          x: groupX - 6, y: -9, width: 0, height: 18, rx: 3, ry: 3,
          fill: '#000', opacity: '0.88',
          'pointer-events': 'none',
        });
        pnlText = svg('text', {
          x: groupX - 12, y: 0,
          fill: '#fff', 'font-size': 11,
          'font-family': FONT, 'font-weight': '700',
          'text-anchor': 'end', 'dominant-baseline': 'central',
          'font-variant-numeric': 'tabular-nums',
          'pointer-events': 'none',
        }, [document.createTextNode('')]);
      }

      // ── INACTIVE state visuals (small button on the entry line, left of entry pill) ──
      let floatBtn = null, floatText = null;
      const floatX = (kind === 'tp' || kind === 'sl') ? floatXFor(kind) : 0;
      if (kind === 'tp' || kind === 'sl') {
        floatBtn = svg('rect', {
          x: floatX, y: -FLOAT_H / 2, width: FLOAT_W, height: FLOAT_H,
          rx: FLOAT_R, ry: FLOAT_R, fill: color,
          'pointer-events': 'none',
        });
        floatText = svg('text', {
          x: floatX + FLOAT_W / 2, y: 0,
          fill: textColor, 'font-size': 10,
          'font-family': FONT, 'font-weight': '800',
          'letter-spacing': '0.5',
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'pointer-events': 'none',
        }, [document.createTextNode(leftLabel)]);
      }

      // ── Hit band (always present for tp/sl — moves with whichever state is shown) ──
      let band = null;
      if (kind === 'tp' || kind === 'sl') {
        band = svg('rect', {
          x: 0, y: -30, width: W, height: 60,
          fill: 'transparent', 'data-pending': kind, 'pointer-events': 'all',
        });
      }

      pendingLayer.appendChild(line);
      pendingLayer.appendChild(bg);
      pendingLayer.appendChild(divider);
      pendingLayer.appendChild(pillText);
      pendingLayer.appendChild(chipText);
      if (pnlBg)     pendingLayer.appendChild(pnlBg);
      if (pnlText)   pendingLayer.appendChild(pnlText);
      if (floatBtn)  pendingLayer.appendChild(floatBtn);
      if (floatText) pendingLayer.appendChild(floatText);
      if (band)      pendingLayer.appendChild(band);
      return { line, bg, divider, pillText, chipText, pnlBg, pnlText, floatBtn, floatText, band, halfH: HALF_H, floatX, floatW: FLOAT_W };
    };

    pendingElems = {
      entry: buildRow(ENTRY_C, isBuy ? 'BUY' : 'SELL', 'entry', '#fff'),
      tp:    buildRow(TP_C,    'TP',                    'tp',    '#fff'),
      sl:    buildRow(SL_C,    'SL',                    'sl',    '#000'),
    };
    repositionPending();
    startPriceWatcher();
  }

  // Continuous rAF-driven loop that re-anchors pending TP/SL/entry to their
  // PRICES every frame. lightweight-charts only exposes time-axis subscription,
  // so vertical pans (and any other price-scale change) need a polling loop to
  // keep priceToCoordinate fresh. Cheap: only mutates DOM when y actually moves.
  let priceWatcherRAF = null;
  let lastY = { entry: null, tp: null, sl: null };
  function priceWatcherTick() {
    if (!pendingPosition || !pendingElems) {
      priceWatcherRAF = null;
      return;
    }
    const ey = series.priceToCoordinate(pendingPosition.entry);
    const ty = pendingPosition.tp != null ? series.priceToCoordinate(pendingPosition.tp) : null;
    const sy = pendingPosition.sl != null ? series.priceToCoordinate(pendingPosition.sl) : null;
    if (ey !== lastY.entry || ty !== lastY.tp || sy !== lastY.sl) {
      repositionPending();
      lastY.entry = ey; lastY.tp = ty; lastY.sl = sy;
    }
    priceWatcherRAF = requestAnimationFrame(priceWatcherTick);
  }
  function startPriceWatcher() {
    if (priceWatcherRAF != null || !pendingPosition || !pendingElems) return;
    lastY.entry = lastY.tp = lastY.sl = null;
    priceWatcherRAF = requestAnimationFrame(priceWatcherTick);
  }
  function stopPriceWatcher() {
    if (priceWatcherRAF != null) cancelAnimationFrame(priceWatcherRAF);
    priceWatcherRAF = null;
  }

  /** Set the y-coords of a pending element. price==null means inactive (TP/SL
   *  not yet created — shows the small floating "+ TP / + SL" button anchored
   *  near the entry line; user drags it to create the level). */
  function positionPendingRow(kind, price) {
    if (!pendingElems) return;
    const row = pendingElems[kind];
    if (!row) return;
    const isInactive = (kind === 'tp' || kind === 'sl') && (price == null);
    if (isInactive) {
      // Hide active visuals
      row.line.setAttribute('opacity', '0');
      row.bg.setAttribute('opacity', '0');
      row.divider.setAttribute('opacity', '0');
      row.pillText.setAttribute('opacity', '0');
      row.chipText.setAttribute('opacity', '0');
      if (row.pnlText) row.pnlText.setAttribute('opacity', '0');
      if (row.pnlBg)   row.pnlBg.setAttribute('opacity', '0');
      // Inactive button sits ON the entry line itself (same Y as entry).
      const entryY = series.priceToCoordinate(pendingPosition.entry);
      if (entryY == null) return;
      const fy = entryY;
      row.floatBtn.setAttribute('opacity', '1');
      row.floatText.setAttribute('opacity', '1');
      row.floatBtn.setAttribute('y', fy - 9);
      row.floatText.setAttribute('y', fy);
      // Hit band is scoped to the float button area only.
      if (row.band) {
        row.band.setAttribute('x', row.floatX - 8);
        row.band.setAttribute('width', row.floatW + 16);
        row.band.setAttribute('y', fy - 18);
        row.band.setAttribute('height', 36);
      }
      return;
    }
    // Active state
    const y = series.priceToCoordinate(price);
    if (y == null) return;
    const h = row.halfH;
    row.line.setAttribute('opacity', '0.95');
    row.bg.setAttribute('opacity', '1');
    row.divider.setAttribute('opacity', '0.22');
    row.pillText.setAttribute('opacity', '1');
    row.chipText.setAttribute('opacity', '1');
    if (row.floatBtn)  row.floatBtn.setAttribute('opacity', '0');
    if (row.floatText) row.floatText.setAttribute('opacity', '0');
    row.line.setAttribute('y1', y);
    row.line.setAttribute('y2', y);
    row.bg.setAttribute('y', y - h);
    row.divider.setAttribute('y1', y - h + 5);
    row.divider.setAttribute('y2', y + h - 5);
    row.pillText.setAttribute('y', y);
    row.chipText.setAttribute('y', y);
    row.chipText.textContent = price.toFixed(2);
    if (row.band) {
      row.band.setAttribute('x', 0);
      row.band.setAttribute('width', window.innerWidth);
      row.band.setAttribute('y', y - 30);
      row.band.setAttribute('height', 60);
    }
    // Live $ P&L for active TP/SL: dollars = (price - entry) * direction * dollarPerPoint
    if (row.pnlText && row.pnlBg && (kind === 'tp' || kind === 'sl')) {
      const dir = pendingPosition.side === 'buy' ? 1 : -1;
      const dpp = pendingPosition.dollarPerPoint || 0;
      const pnl = (price - pendingPosition.entry) * dir * dpp;
      const sign = pnl >= 0 ? '+' : '-';
      const abs  = Math.abs(pnl);
      row.pnlText.textContent = sign + '$' + abs.toFixed(2);
      row.pnlText.setAttribute('fill', pnl >= 0 ? '#22C55E' : '#EF4444');
      row.pnlText.setAttribute('y', y);
      row.pnlText.setAttribute('opacity', '1');
      // Auto-size the black background box to wrap the current text width.
      // Text is right-anchored at x = (groupX - 12). Box adds 6px padding on each side.
      const tw = row.pnlText.getComputedTextLength ? row.pnlText.getComputedTextLength() : 64;
      const padX = 6;
      const textRightX = parseFloat(row.pnlText.getAttribute('x'));
      const boxW = tw + padX * 2;
      row.pnlBg.setAttribute('x', textRightX + padX - boxW);
      row.pnlBg.setAttribute('width', boxW);
      row.pnlBg.setAttribute('y', y - 9);
      row.pnlBg.setAttribute('opacity', '0.88');
    }
  }

  /** Reposition all pending elements (chart pan/zoom triggers this). */
  function repositionPending() {
    if (!pendingPosition || !pendingElems) return;
    positionPendingRow('entry', pendingPosition.entry);
    positionPendingRow('tp',    pendingPosition.tp);
    positionPendingRow('sl',    pendingPosition.sl);
  }

  function setDrawings(list, tool, selId, pending, magnet) {
    // Note when a drawable tool was just activated — used by handleTap to
    // ignore phantom chart taps that follow a tap on the on-chart favorites
    // bar (the touch can leak through to the WebView at the pill's coords).
    const incomingTool = tool || 'cursor_cross';
    const isDrawable = !!incomingTool && incomingTool.indexOf('cursor_') !== 0
                       && incomingTool !== 'demonstration' && incomingTool !== 'eraser';
    if (isDrawable && incomingTool !== drawingActiveTool) {
      toolActivatedAt = Date.now();
    }
    // While a body-drag is in flight, the WebView is the source of truth
    // for the dragged drawing's points — preserve our locally-mutated copy.
    // The incoming list still gets adopted for non-dragged drawings (and for
    // type/style changes on the dragged one).
    if (drawingBodyDrag && Array.isArray(list)) {
      const dragged = drawingsList.find(function (x) { return x.id === drawingBodyDrag.id; });
      if (dragged) {
        const merged = list.map(function (incoming) {
          return incoming.id === drawingBodyDrag.id
            ? Object.assign({}, incoming, { points: dragged.points })
            : incoming;
        });
        list = merged;
      }
    }

    drawingsList = list;
    drawingActiveTool = tool || 'cursor_cross';
    drawingSelectedId = selId || null;
    drawingPendingPoints = pending || [];
    magnetMode = magnet || 'off';
    // Pointer arbitration: ONLY catch taps when a drawable tool / eraser is
    // selected. Otherwise the hitBg lets every touch pass through to the
    // chart's own pan/zoom handlers — that's the TradingView default flow.
    const isPlacing = !!drawingActiveTool && drawingActiveTool.indexOf('cursor_') !== 0
                    && drawingActiveTool !== 'demonstration';
    // Container always 'none' so empty taps fall through to chart pan/zoom.
    // hitBg + drawing children have explicit pointer-events to catch their
    // own taps (works in all modern WebKit/Chromium WebViews).
    overlay.style.pointerEvents = 'none';
    hitBg.setAttribute('pointer-events', isPlacing ? 'all' : 'none');
    // Skip the full SVG rebuild during a body-drag — local mutation in the
    // drag handler is already keeping the drawing visually in sync.
    if (!drawingBodyDrag) renderDrawings();
  }

  // Re-render when chart pans/zooms — coalesce to one paint per frame so
  // dragging across hundreds of pan events doesn't tank the framerate.
  let renderRAF = null;
  function scheduleRender() {
    if (renderRAF != null) return;
    renderRAF = requestAnimationFrame(() => {
      renderRAF = null;
      renderDrawings();
      repositionPending();   // pending order rows track the new visible range
    });
  }
  chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleRender);
  series.subscribeDataChanged && series.subscribeDataChanged(scheduleRender);

  // ── Price-axis change detector ──────────────────────────────────────────────
  // lightweight-charts only fires range-change events for the TIME axis. When
  // the user pans VERTICALLY the price→pixel projection shifts silently, so
  // SVG-rendered drawings keep their old screen Y while candles slide. Poll a
  // sentinel price each frame; if its projected y moved, re-render. Cheap —
  // one priceToCoordinate call per frame, render only when something changed.
  let priceProjectionRAF = null;
  let lastSentinelY = null;
  function priceProjectionTick() {
    // Skip while ANY touch interaction is in flight — re-rendering the SVG
    // would detach the element under the finger and kill the gesture.
    const dragInFlight = drawingBodyDrag || drawingDragState || pendingDragKind || placementTap;
    if (!dragInFlight) {
      const data = series.data();
      const last = data && data.length ? data[data.length - 1] : null;
      if (last) {
        const y = series.priceToCoordinate(last.close);
        if (y != null && y !== lastSentinelY) {
          lastSentinelY = y;
          renderDrawings();
          repositionPending();
        }
      }
    }
    priceProjectionRAF = requestAnimationFrame(priceProjectionTick);
  }
  priceProjectionRAF = requestAnimationFrame(priceProjectionTick);

  // Tap → if a drawable tool is active, sample chart coordinates and
  // forward to React Native to add/extend the drawing.
  function chartCoordsAt(clientX, clientY) {
    const t = chart.timeScale().coordinateToTime(clientX);
    const p = series.coordinateToPrice(clientY);
    if (t == null || p == null) return null;
    if (magnetMode === 'off') return { time: t, price: p };
    // Magnet — snap to the OHLC of the candle nearest to the tap.
    const data = series.data();
    if (!data || !data.length) return { time: t, price: p };
    // Binary search for the candle whose time is closest to t.
    let lo = 0, hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (data[mid].time < t) lo = mid + 1; else hi = mid;
    }
    const candidates = [];
    if (lo > 0) candidates.push(data[lo - 1]);
    candidates.push(data[lo]);
    if (lo + 1 < data.length) candidates.push(data[lo + 1]);
    const candle = candidates.reduce((best, c) =>
      Math.abs(c.time - t) < Math.abs(best.time - t) ? c : best, candidates[0]);
    // Snap to whichever of {open, high, low, close} is closest to tap price.
    const levels = [candle.open, candle.high, candle.low, candle.close];
    const snappedPrice = levels.reduce((best, lv) =>
      Math.abs(lv - p) < Math.abs(best - p) ? lv : best, levels[0]);
    // In strong mode always snap; in weak mode only if the target is within
    // a generous tolerance (a quarter of the candle's range).
    if (magnetMode === 'weak') {
      const range = Math.max(candle.high - candle.low, 0.0001);
      if (Math.abs(snappedPrice - p) > range * 0.25) {
        return { time: candle.time, price: p };  // snap time only, not price
      }
    }
    return { time: candle.time, price: snappedPrice };
  }

  // Track single-finger pan that started ON a drawing (so we can forward
  // it as a chart pan, since the chart canvas itself won't see the touch).
  let drawingPan = null;
  // Drag-the-whole-drawing state. Activates only when the touched drawing is
  // ALREADY selected (matches TradingView: tap once to select, then drag to
  // move). Tracks the last (time, price) so we send delta-translates to RN
  // and translate every anchor uniformly server-side.
  let drawingBodyDrag = null;
  // Candidate placement tap. Set on touchstart in placement mode. If the
  // finger moves > 8px before release, the tap is cancelled and the existing
  // drawingPan path drives a chart pan instead. If the finger stays put,
  // touchend posts a drawing_point. Drag-to-draw was removed — every point
  // is placed by an individual stationary tap (tap-tap for 2-point tools).
  let placementTap = null;
  // Long-press timer machinery is retained for safe no-op clearing from
  // existing drag paths, but never armed — Lock/Duplicate/Delete moved
  // into the settings sheet as buttons (DrawingSettingsModal footer).
  let longPressTimer = null;
  function clearLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
  // Double-tap detection: settings sheet opens only when two consecutive
  // taps land on the SAME drawing within 350ms.
  let lastDrawingTapTime = 0;
  let lastDrawingTapId = null;

  function handleTap(clientX, clientY, target, _eventName, e) {
    // Pending position handle (tp / sl) — start dragging its price.
    const pendingKind = target && target.getAttribute && target.getAttribute('data-pending');
    if (pendingKind === 'tp' || pendingKind === 'sl') {
      pendingDragKind = pendingKind;
      e && e.preventDefault && e.preventDefault();
      return;
    }

    // Drag handle for an already-selected drawing's anchor → resize.
    // Two flavors:
    //   data-handle=<idx>     anchor index, used by every tool except rectangle
    //   data-corner=TL|TR|BR|BL  rectangle's 4 visual corners (2 derived)
    //
    // We DETACH the touched handle from drawingsLayer and re-parent it to
    // overlay. drawingsLayer.innerHTML='' during touchmove rebuilds the
    // geometry but doesn't kill our floating handle, so the touch capture
    // survives the drag. On touchend the handle is removed and a fresh
    // render reattaches the canonical handle inside drawingsLayer.
    const handleIdx = target && target.getAttribute && target.getAttribute('data-handle');
    if (handleIdx != null) {
      const id = target.getAttribute('data-id');
      drawingDragState = { id: id, idx: parseInt(handleIdx, 10), handleEl: target };
      overlay.appendChild(target);
      clearCrosshair();
      e && e.preventDefault && e.preventDefault();
      return;
    }
    const cornerCode = target && target.getAttribute && target.getAttribute('data-corner');
    if (cornerCode) {
      const id = target.getAttribute('data-id');
      drawingDragState = { id: id, corner: cornerCode, handleEl: target };
      overlay.appendChild(target);
      clearCrosshair();
      e && e.preventDefault && e.preventDefault();
      return;
    }

    const hitId = target && target.getAttribute && target.getAttribute('data-id');
    const isPlacing = !!drawingActiveTool && drawingActiveTool.indexOf('cursor_') !== 0
                    && drawingActiveTool !== 'eraser' && drawingActiveTool !== 'demonstration';

    // Eraser: tap drawing to delete.
    if (hitId && drawingActiveTool === 'eraser') {
      clearCrosshair();
      postBack({ type: 'drawing_erase', id: hitId });
      e && e.preventDefault && e.preventDefault();
      return;
    }

    // Cursor mode + tap landed on a drawing.
    if (!isPlacing && hitId && hitId !== 'hitBg') {
      // Drawing taps must never leave a stale crosshair on screen.
      clearCrosshair();
      // Find the drawing; bail if it's locked (no drag, no menu).
      const dHit = drawingsList.find(function (x) { return x.id === hitId; });
      if (dHit && dHit.locked) return;

      // Single-tap UX: select the drawing immediately so handles appear and
      // the user can drag right away. Settings stay closed; double-tap on
      // the same drawing toggles the settings sheet open.
      if (hitId !== drawingSelectedId) {
        postBack({ type: 'drawing_select', id: hitId });
      }

      // Long-press popup intentionally disabled — Lock/Duplicate/Delete now
      // live as buttons inside the settings sheet (opened via double-tap).

      // Arm body-drag with the touch's start position. The translate-on-move
      // logic in touchmove only fires once the finger has moved more than
      // 8px from the start, so a stationary tap does NOT shift the drawing.
      const coord = chartCoordsAt(clientX, clientY);
      if (coord) {
        drawingBodyDrag = {
          id: hitId,
          startX: clientX, startY: clientY,
          lastTime: coord.time, lastPrice: coord.price,
          moved: false,
        };
      }

      // Track this tap for double-tap-to-open-settings detection on touchend.
      const range = chart.timeScale().getVisibleLogicalRange();
      drawingPan = {
        startX: clientX,
        lastX: clientX,
        drawingId: hitId,
        moved: false,
        startRange: range,
      };
      e && e.preventDefault && e.preventDefault();
      return;
    }

    // Cursor mode + tap on empty space: deselect any currently-selected
    // drawing (closes its handles, hides settings) and let the touch fall
    // through to chart pan/zoom.
    if (!isPlacing) {
      if (drawingSelectedId) postBack({ type: 'drawing_deselect' });
      return;
    }

    // Placement mode: tap-tap placement only. Drag-to-draw was disabled —
    // a finger that moves while in placement mode now drives a chart pan
    // (via the existing drawingPan path) instead of a drag-to-draw preview.
    // The point only commits if the finger stays put until release.
    //
    // Suppress the very first tap that lands within 200ms of a tool
    // activation — that's almost certainly the phantom touch that leaked
    // through from a tap on the on-chart favorites bar.
    if (Date.now() - toolActivatedAt < 200) {
      e && e.preventDefault && e.preventDefault();
      return;
    }
    const coord = chartCoordsAt(clientX, clientY);
    if (!coord) return;
    // Arm BOTH a candidate placement-tap AND a chart pan. touchmove resolves
    // the ambiguity: > 8px of movement kills placementTap; touchend with
    // !drawingPan.moved commits the placement.
    placementTap = { coord, startX: clientX, startY: clientY };
    const range = chart.timeScale().getVisibleLogicalRange();
    drawingPan = {
      startX: clientX,
      lastX: clientX,
      drawingId: null,
      moved: false,
      startRange: range,
    };
    e && e.preventDefault && e.preventDefault();
  }

  // Three different event paths — different React Native WebView versions
  // fire different ones first. We listen to all and dedupe by timestamp.
  let lastTapTime = 0;
  function dispatchTap(clientX, clientY, target, name, e) {
    const now = Date.now();
    if (now - lastTapTime < 80) return;   // dedupe rapid duplicates
    lastTapTime = now;
    handleTap(clientX, clientY, target, name, e);
  }

  overlay.addEventListener('touchstart', (e) => {
    if (!e.touches[0]) return;
    const tc = e.touches[0];
    dispatchTap(tc.clientX, tc.clientY, e.target, 'touchstart', e);
  }, { passive: false });

  overlay.addEventListener('pointerdown', (e) => {
    dispatchTap(e.clientX, e.clientY, e.target, 'pointerdown', e);
  });

  overlay.addEventListener('click', (e) => {
    dispatchTap(e.clientX, e.clientY, e.target, 'click', e);
  });

  overlay.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    const tc = e.touches[0];

    // Pending position TP/SL drag — direct DOM mutation, NO render. Just
    // update the y attrs of the dragged row's elements. 1:1 with the finger.
    // Throttled postBack keeps React's pendingPosition close to live so the
    // CONFIRM button never reads stale values if tapped right after release.
    if (pendingDragKind) {
      let raw = series.coordinateToPrice(tc.clientY);
      if (raw != null && pendingPosition) {
        // Clamp by side so TP is always on the profit side and SL on the loss side:
        //   buy:  TP > entry, SL < entry
        //   sell: TP < entry, SL > entry
        const TICK = 0.25;
        const entry = pendingPosition.entry;
        const isBuy = pendingPosition.side === 'buy';
        if (pendingDragKind === 'tp') {
          if (isBuy && raw <= entry) raw = entry + TICK;
          if (!isBuy && raw >= entry) raw = entry - TICK;
        } else if (pendingDragKind === 'sl') {
          if (isBuy && raw >= entry) raw = entry - TICK;
          if (!isBuy && raw <= entry) raw = entry + TICK;
        }
        pendingPosition[pendingDragKind] = raw;
        positionPendingRow(pendingDragKind, raw);
        const now = Date.now();
        if (now - (window.__lastPendingSync || 0) > 60) {
          window.__lastPendingSync = now;
          postBack({ type: 'pending_position_drag', kind: pendingDragKind, price: raw });
        }
      }
      e.preventDefault();
      return;
    }

    // Candidate-tap → pan transition. If a placement-mode finger moves more
    // than 8px from where it started, kill the placementTap so the rest of
    // the gesture becomes a chart pan via drawingPan (handled below).
    if (placementTap) {
      const ddx = tc.clientX - placementTap.startX;
      const ddy = tc.clientY - placementTap.startY;
      if (ddx * ddx + ddy * ddy >= 8 * 8) {
        placementTap = null;
      }
    }

    // Anchor drag (selected drawing's handle).
    // Two flavors based on what landed in drawingDragState during touchstart:
    //   { id, idx, handleEl }    → standard anchor drag, single point updated
    //   { id, corner, handleEl } → rectangle corner drag (TL/TR/BR/BL), both
    //                              anchors recomputed so the diagonal stays fixed
    //
    // Mutates drawingsList LOCALLY each frame (no React round-trip per move) and
    // re-renders the drawing's geometry. The handle element was detached to
    // overlay during touchstart, so renderDrawings()'s innerHTML clear doesn't
    // kill our touch capture. Floating handle's cx/cy is updated to mirror the
    // finger. Final points are posted once on touchend.
    if (drawingDragState) {
      clearLongPress();
      const coord = chartCoordsAt(tc.clientX, tc.clientY);
      if (!coord) return;
      const dIdx = drawingsList.findIndex(function (x) { return x.id === drawingDragState.id; });
      if (dIdx < 0) { e.preventDefault(); return; }
      const d = drawingsList[dIdx];
      // RESET: generic anchor drag — single point updated to (coord.time,
      // coord.price). Per-tool drag specializations (rectangle corner
      // reshape, horizontal_line time-lock, etc.) were removed in the
      // 2026-05-11 reset; each tool re-adds its branch here when it comes
      // back. drawingDragState.corner is no longer set anywhere (rectangle
      // 4-corner handle path was deleted), so we don't branch on it.
      d.points = d.points.map(function (p, i) {
        return i === drawingDragState.idx ? { time: coord.time, price: coord.price } : p;
      });
      renderDrawings();
      // Move the floating handle to mirror the finger.
      const px = chart.timeScale().timeToCoordinate(coord.time);
      const py = series.priceToCoordinate(coord.price);
      if (px != null && py != null && drawingDragState.handleEl) {
        drawingDragState.handleEl.setAttribute('cx', String(px));
        drawingDragState.handleEl.setAttribute('cy', String(py));
      }
      e.preventDefault();
      return;
    }

    // Body drag — TRANSFORM-ONLY. Apply translate() to the drawing's <g>
    // group during the drag. No SVG rebuild, no innerHTML reset, no React
    // roundtrip. The touch target stays attached throughout. On touchend
    // we convert the pixel delta into a time/price delta and commit once.
    if (drawingBodyDrag) {
      const ddx = tc.clientX - drawingBodyDrag.startX;
      const ddy = tc.clientY - drawingBodyDrag.startY;
      const moveThresholdPx2 = 8 * 8;
      const movedEnough = drawingBodyDrag.moved || (ddx * ddx + ddy * ddy) >= moveThresholdPx2;
      if (!movedEnough) {
        // Still a candidate tap — preventDefault so the chart doesn't pan
        // out from under the finger before we know the user's intent.
        e.preventDefault();
        return;
      }
      if (!drawingBodyDrag.moved) {
        clearLongPress();
        drawingPan = null;
        drawingBodyDrag.moved = true;
      }
      const group = drawingsLayer.querySelector('g[data-drawing-id="' + drawingBodyDrag.id + '"]');
      if (group) {
        // RESET: generic 2-axis translate. Per-tool axis locks (e.g.
        // horizontal_line's lockX=0) are removed; they'll come back with
        // each tool's implementation.
        group.setAttribute('transform', 'translate(' + ddx + ',' + ddy + ')');
      }
      e.preventDefault();
      return;
    }

    // Pan forwarded from a touch that started on a drawing — shift the
    // chart's visible logical range manually so the chart still moves.
    if (drawingPan) {
      const dx = tc.clientX - drawingPan.lastX;
      if (Math.abs(tc.clientX - drawingPan.startX) > 6) {
        drawingPan.moved = true;
        clearLongPress();
      }
      if (drawingPan.moved) {
        const range = chart.timeScale().getVisibleLogicalRange();
        const bs = chart.timeScale().options().barSpacing || 6;
        const shift = -dx / bs;
        if (range) {
          chart.timeScale().setVisibleLogicalRange({
            from: range.from + shift,
            to:   range.to   + shift,
          });
        }
        drawingPan.lastX = tc.clientX;
      }
      e.preventDefault();
    }
  }, { passive: false });

  overlay.addEventListener('touchend', () => {
    // Anchor/corner drag end — drawingsList was mutated locally during the
    // move. Ship the final points to React in one shot; remove the floating
    // handle so the canonical (re-rendered) handle is the only one shown.
    if (drawingDragState) {
      const dragId = drawingDragState.id;
      const handleEl = drawingDragState.handleEl;
      drawingDragState = null;
      const d = drawingsList.find(function (x) { return x.id === dragId; });
      if (d) {
        postBack({ type: 'drawing_drag_final', id: dragId, points: d.points });
      }
      if (handleEl && handleEl.parentNode === overlay) {
        overlay.removeChild(handleEl);
      }
      renderDrawings();
      return;
    }
    // Placement tap commit — only fires if the finger never moved enough to
    // cancel the candidate tap. If the user dragged, placementTap was nulled
    // by touchmove and the gesture became a chart pan instead.
    if (placementTap) {
      const tap = placementTap;
      placementTap = null;
      // If the pan path also fired (movement happened then), bail — but
      // touchmove would already have nulled placementTap in that case.
      postBack({ type: 'drawing_point', tool: drawingActiveTool,
                 time: tap.coord.time, price: tap.coord.price });
    }
    // Body-drag end: read the pixel translate the drag accumulated, convert
    // to a (time, price) delta against the current chart projection, apply
    // to the drawing's anchors locally, then send the final points to RN.
    if (drawingBodyDrag) {
      const wasMove = drawingBodyDrag.moved;
      const dragId  = drawingBodyDrag.id;
      const startX  = drawingBodyDrag.startX;
      const startY  = drawingBodyDrag.startY;
      drawingBodyDrag = null;
      clearLongPress();
      if (wasMove) {
        const group = drawingsLayer.querySelector('g[data-drawing-id="' + dragId + '"]');
        let dx = 0, dy = 0;
        if (group) {
          const t = group.getAttribute('transform') || '';
          const m = t.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
          if (m) { dx = parseFloat(m[1]); dy = parseFloat(m[2]); }
        }
        if (dx !== 0 || dy !== 0) {
          // Convert pixel delta to time/price delta by sampling the chart
          // projection at the start position vs the end position.
          const startCoord = chartCoordsAt(startX, startY);
          const endCoord   = chartCoordsAt(startX + dx, startY + dy);
          if (startCoord && endCoord) {
            const d = drawingsList.find(function (x) { return x.id === dragId; });
            if (d) {
              // RESET: generic time+price translation. Per-tool axis
              // locks (e.g. horizontal_line's dt=0) come back with each
              // tool.
              const dt = endCoord.time - startCoord.time;
              const dp = endCoord.price - startCoord.price;
              d.points = d.points.map(function (p) {
                return { time: p.time + dt, price: p.price + dp };
              });
              postBack({ type: 'drawing_translate_final', id: d.id, points: d.points });
            }
          }
        }
        // Clear the transform and rebuild SVG with anchors at their new
        // positions. Safe now — the user's finger is up.
        if (group) group.removeAttribute('transform');
        renderDrawings();
        drawingPan = null;
        return;
      }
    }
    clearLongPress();
    if (pendingDragKind && pendingPosition) {
      // Snap to a 0.25 tick on release, then commit to React.
      // raw can be null if the user touched the float button without dragging
      // (no touchmove fired) — leave the level inactive in that case.
      const raw = pendingPosition[pendingDragKind];
      if (typeof raw === 'number') {
        const snapped = Math.round(raw / 0.25) * 0.25;
        pendingPosition[pendingDragKind] = snapped;
        positionPendingRow(pendingDragKind, snapped);
        postBack({ type: 'pending_position_drag', kind: pendingDragKind, price: snapped });
      }
    }
    pendingDragKind = null;

    // Single tap = already selected on touchstart (handles only).
    // Double-tap on the same drawing within 350ms = open settings sheet.
    if (drawingPan) {
      if (!drawingPan.moved) {
        const now = Date.now();
        if (drawingPan.drawingId === lastDrawingTapId && (now - lastDrawingTapTime) < 350) {
          postBack({ type: 'drawing_open_settings', id: drawingPan.drawingId });
          lastDrawingTapId = null;
          lastDrawingTapTime = 0;
        } else {
          lastDrawingTapId = drawingPan.drawingId;
          lastDrawingTapTime = now;
        }
      }
      drawingPan = null;
    }
  });

  overlay.addEventListener('touchcancel', () => {
    if (drawingDragState && drawingDragState.handleEl &&
        drawingDragState.handleEl.parentNode === overlay) {
      overlay.removeChild(drawingDragState.handleEl);
    }
    drawingDragState = null;
    drawingPan = null;
    drawingBodyDrag = null;
    pendingDragKind = null;
    placementTap = null;
    renderDrawings();
    clearLongPress();
  });

  window.addEventListener('resize', () => {
    chart.resize(window.innerWidth, window.innerHeight);
  });

  // Custom gesture: horizontal swipe on the bottom strip (time axis) zooms
  // the candle width. Right = bars get bigger, left = bars get smaller.
  // (Pinch zoom on the chart body still works via lightweight-charts.)
  const TIME_AXIS_TOUCH_HEIGHT = 48;
  let axisDrag = null;
  document.addEventListener('touchstart', (e) => {
    if (!e.touches[0]) return;
    const t = e.touches[0];
    if (window.innerHeight - t.clientY < TIME_AXIS_TOUCH_HEIGHT) {
      axisDrag = {
        startX: t.clientX,
        startSpacing: chart.timeScale().options().barSpacing || 6,
      };
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!axisDrag || !e.touches[0]) return;
    const dx = e.touches[0].clientX - axisDrag.startX;
    const next = Math.max(2, Math.min(60, axisDrag.startSpacing - dx * 0.025));
    chart.timeScale().applyOptions({ barSpacing: next });
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { axisDrag = null; });
  document.addEventListener('touchcancel', () => { axisDrag = null; });

  function postBack(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  let hasInitialized = false;
  function handleMessage(e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'init') {
        try {
          const oldRange = hasInitialized ? chart.timeScale().getVisibleLogicalRange() : null;
          // If a pending order is active, freeze the price range so the user's
          // TP/SL lines stay at the same screen position across the reinit.
          // Otherwise, briefly auto-fit to the new data on first init only.
          const freezePriceScale = hasInitialized && !!pendingPosition;
          if (!freezePriceScale) {
            chart.priceScale('right').applyOptions({ autoScale: true });
          }
          series.setData(msg.candles);
          if (!hasInitialized) {
            chart.timeScale().fitContent();
            hasInitialized = true;
          } else if (oldRange) {
            chart.timeScale().setVisibleLogicalRange(oldRange);
          }
          if (!freezePriceScale) {
            chart.priceScale('right').applyOptions({ autoScale: false });
          }
          if (msg.priceLines) setPriceLines(msg.priceLines);
          repositionPending();
          postBack({ type: 'log', msg: 'init OK ' + msg.candles.length + ' bars' });
        } catch (err) {
          postBack({ type: 'log', msg: 'init ERROR: ' + err.message });
        }
      }
      if (msg.type === 'append') {
        try {
          // Snapshot the current view, append, then force the same view back —
          // belt and suspenders so neither the time axis nor the price axis
          // can nudge from the new bar.
          const xRange = chart.timeScale().getVisibleLogicalRange();
          msg.candles.forEach((c) => series.update(c));
          if (xRange) chart.timeScale().setVisibleLogicalRange(xRange);
        } catch (err) {
          postBack({ type: 'log', msg: 'append ERROR: ' + err.message });
        }
      }
      if (msg.type === 'pricelines') {
        try { setPriceLines(msg.lines); } catch {}
      }
      if (msg.type === 'drawings') {
        try { setDrawings(msg.drawings || [], msg.activeTool, msg.selectedId, msg.pendingPoints || [], msg.magnet); } catch (err) {
          postBack({ type: 'log', msg: 'drawings ERROR: ' + err.message });
        }
      }
      if (msg.type === 'pending_position') {
        const prevSide = pendingPosition && pendingPosition.side;
        pendingPosition = msg.position;
        // Rebuild only if the side changed (or pending was just shown / hidden).
        // Otherwise just reposition existing elements (much cheaper).
        const needRebuild = !pendingElems
          || !pendingPosition
          || (pendingPosition && pendingPosition.side !== prevSide);
        if (needRebuild) buildPendingPosition();
        else repositionPending();
      }
      if (msg.type === 'displayTz') {
        try {
          displayTz = msg.tz || displayTz;
          applyDisplayTzFormatters();
        } catch (err) {
          postBack({ type: 'log', msg: 'displayTz ERROR: ' + err.message });
        }
      }
      if (msg.type === 'theme') {
        try {
          const t = msg.theme;
          const showGrid = t.showGrid !== false;
          document.body.style.background = t.background;
          chart.applyOptions({
            layout: { background: { color: t.background }, textColor: t.textColor },
            grid: {
              vertLines: { color: t.gridColor, visible: showGrid },
              horzLines: { color: t.gridColor, visible: showGrid },
            },
            rightPriceScale: { borderColor: t.borderColor },
            timeScale:       { borderColor: t.borderColor },
          });
          series.applyOptions({
            upColor:         t.upColor,
            downColor:       t.downColor,
            borderVisible:   t.showBorders !== false,
            borderUpColor:   t.borderUpColor   || t.upColor,
            borderDownColor: t.borderDownColor || t.downColor,
            wickVisible:     t.showWicks !== false,
            wickUpColor:     t.wickUpColor     || t.upColor,
            wickDownColor:   t.wickDownColor   || t.downColor,
          });
        } catch (err) {
          postBack({ type: 'log', msg: 'theme ERROR: ' + err.message });
        }
      }
    } catch (err) {
      postBack({ type: 'log', msg: 'parse ERROR: ' + err.message });
    }
  }

  // RN-WebView posts on 'message' (window) on iOS, document on Android — handle both
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  // Tell RN we're ready
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
</script>
</body>
</html>`;
}

export default function TradingChart({ candles, positions, theme = DEFAULT_CHART_THEME, timeframe, displayTz, pendingPosition, onPendingDrag }: Props) {
  const webviewRef = useRef<WebView>(null);
  const ready = useRef(false);
  const lastCandleCount = useRef(0);
  // Hash of "first candle" — used to detect timeframe switches where bar indices
  // reset to 0 but the actual price data is completely different.
  const lastFirstSig = useRef<string | null>(null);

  const {
    drawings, activeTool, selectedId, pendingPoints, magnet,
    addDrawing, updateDrawing, removeDrawing,
    setSelected, setSettingsOpen, setActiveTool,
    appendPendingPoint, resetPending,
  } = useDrawingsStore();

  // Build HTML ONCE on first mount. Theme updates flow through postMessage so
  // the WebView never reloads and the candles persist.
  const initialThemeRef = useRef(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHTML(initialThemeRef.current), []);

  // Compute price lines for current positions (honoring per-line visibility toggles)
  const priceLines = useMemo(() => {
    return positions.flatMap((p) => {
      const lines: { price: number; color: string; title: string; style: number }[] = [];
      if (theme.showEntryLine !== false) {
        lines.push({ price: p.entry_price, color: theme.entryColor, title: `Entry (${p.side.toUpperCase()})`, style: 0 });
      }
      if (p.stop_loss   && theme.showSlLine !== false) lines.push({ price: p.stop_loss,   color: theme.slColor, title: 'SL', style: 0 });
      if (p.take_profit && theme.showTpLine !== false) lines.push({ price: p.take_profit, color: theme.tpColor, title: 'TP', style: 0 });
      return lines;
    });
  }, [positions, theme]);

  // Build a signature from the first + last candle to detect data replacement.
  // (timeframe switch yields completely different prices at the same bar indices.)
  const sigOf = (cs: SessionCandle[]): string | null => {
    if (cs.length === 0) return null;
    const a = cs[0];
    const b = cs[cs.length - 1];
    return `${a.bar}:${a.close}|${b.bar}:${b.close}|${cs.length}`;
  };

  const sendInit = () => {
    const wv = webviewRef.current;
    if (!wv) return;
    const seriesData = candles.map((c) => ({
      time: candleTime(c, timeframe),
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    wv.postMessage(JSON.stringify({ type: 'init', candles: seriesData, priceLines }));
    lastCandleCount.current = candles.length;
    lastFirstSig.current = sigOf(candles);
  };

  // ── Drawing event handler ─────────────────────────────────────────────────
  const handleDrawingPoint = (tool: DrawingType, time: number, price: number) => {
    const def = TOOL_BY_ID[tool];
    if (!def || !def.drawable) return;
    const points = [...pendingPoints, { time, price }];
    if (points.length >= def.pointsRequired) {
      const id = `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      // Per-tool default style. Tools that haven't shipped a default yet
      // fall through to DEFAULT_STYLE.
      const baseStyle = tool === 'horizontal_line' ? HLINE_DEFAULT_STYLE : DEFAULT_STYLE;
      addDrawing({ id, type: tool, points, style: { ...baseStyle } });
      resetPending();
      // TradingView default: tool always exits after one placement and the
      // chart returns to normal pan/zoom mode.
      setActiveTool('cursor_cross');
    } else {
      appendPendingPoint({ time, price });
    }
  };

  // When ready (initial), send the full data
  const onMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready' && !ready.current) {
        ready.current = true;
        sendInit();
      }
      if (msg.type === 'log') {
        console.log('[CHART]', msg.msg);
      }
      if (msg.type === 'drawing_point') {
        handleDrawingPoint(msg.tool as DrawingType, msg.time, msg.price);
      }
      // Single tap → select (handles visible); does NOT open settings.
      if (msg.type === 'drawing_select') {
        setSelected(msg.id);
        if (activeTool !== 'cursor_cross') setActiveTool('cursor_cross');
      }
      // Double tap on the same drawing within 350ms → open settings sheet.
      if (msg.type === 'drawing_open_settings') {
        if (selectedId !== msg.id) setSelected(msg.id);
        setSettingsOpen(true);
      }
      // Tap on empty chart area while a drawing is selected.
      if (msg.type === 'drawing_deselect') {
        setSelected(null);
      }
      // Unified anchor/corner drag commit. The WebView mutates points
      // locally during touchmove (no per-frame React round-trip) and posts
      // the final points array once on touchend. For rectangles, the WebView
      // already ran the bbox-reshape math and re-normalized to [TL, BR].
      if (msg.type === 'drawing_drag_final') {
        const d = drawings.find((x) => x.id === msg.id);
        if (!d || d.locked) return;
        if (Array.isArray(msg.points)) {
          updateDrawing(d.id, { points: msg.points } as Partial<Drawing>);
        }
      }
      // Body-drag committed on touchend — one-shot snapshot of the final
      // anchor positions. The drag itself was rendered locally in the
      // WebView; this is purely the persistence sync.
      if (msg.type === 'drawing_translate_final') {
        const d = drawings.find((x) => x.id === msg.id);
        if (!d || d.locked) return;
        if (Array.isArray(msg.points)) {
          updateDrawing(d.id, { points: msg.points } as Partial<Drawing>);
        }
      }
      // drawing_longpress popup removed — Lock / Duplicate / Delete now
      // live as buttons in the settings sheet (DrawingSettingsModal footer).
      if (msg.type === 'drawing_erase') {
        removeDrawing(msg.id);
      }
      if (msg.type === 'pending_position_drag' && onPendingDrag) {
        onPendingDrag(msg.kind, msg.price);
      }
    } catch {}
  };

  // Detect changes in candles
  useEffect(() => {
    if (!ready.current || !webviewRef.current) return;
    const newSig = sigOf(candles);
    // If the signature changed but candle count stayed equal/decreased,
    // this is a full data replacement (timeframe switch / market switch).
    const signatureChanged = newSig !== lastFirstSig.current;
    const justAppended = candles.length > lastCandleCount.current
                       && candles.length > 0
                       && lastFirstSig.current !== null
                       && candles[0].close === parseFloat((lastFirstSig.current.split('|')[0] ?? '').split(':')[1] ?? '0');

    if (signatureChanged && !justAppended) {
      // Full replace
      sendInit();
    } else if (candles.length > lastCandleCount.current) {
      // Append-only (next bar)
      const newCandles = candles.slice(lastCandleCount.current).map((c) => ({
        time: candleTime(c, timeframe),
        open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      webviewRef.current.postMessage(JSON.stringify({ type: 'append', candles: newCandles }));
      lastCandleCount.current = candles.length;
      lastFirstSig.current = sigOf(candles);
    }
  }, [candles]);

  // Detect changes in positions → update price lines without rebuilding chart
  useEffect(() => {
    if (!ready.current || !webviewRef.current) return;
    webviewRef.current.postMessage(JSON.stringify({ type: 'pricelines', lines: priceLines }));
  }, [priceLines]);

  // Theme change → push new colors to the WebView without remounting it.
  useEffect(() => {
    if (!ready.current || !webviewRef.current) return;
    webviewRef.current.postMessage(JSON.stringify({ type: 'theme', theme }));
  }, [theme]);

  // Drawings / selection / pending placement → push the whole list whenever
  // anything changes. The WebView re-renders the SVG overlay accordingly.
  useEffect(() => {
    if (!ready.current || !webviewRef.current) return;
    webviewRef.current.postMessage(JSON.stringify({
      type: 'drawings',
      drawings,
      activeTool,
      selectedId,
      pendingPoints,
      magnet,
    }));
  }, [drawings, activeTool, selectedId, pendingPoints, magnet]);

  // Pending position (live BUY/SELL preview) → push to WebView whenever the
  // user changes side / drags TP / drags SL.
  useEffect(() => {
    if (!ready.current || !webviewRef.current) return;
    webviewRef.current.postMessage(JSON.stringify({
      type: 'pending_position',
      position: pendingPosition ?? null,
    }));
  }, [pendingPosition]);

  // Display timezone — push to the WebView so it re-formats axis + crosshair.
  useEffect(() => {
    if (!ready.current || !webviewRef.current || !displayTz) return;
    webviewRef.current.postMessage(JSON.stringify({ type: 'displayTz', tz: displayTz }));
  }, [displayTz]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={[styles.webview, { backgroundColor: theme.background }]}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
});
