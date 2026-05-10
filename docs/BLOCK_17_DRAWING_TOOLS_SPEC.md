# Block 17 — Drawing Tools Spec

Status: SPEC LOCKED. Implemented on `master`. Tool list expanded from the original 5 to 10 after KLineChart Pro spike was abandoned and the audit was done — see `docs/DRAWING_TOOLS_AUDIT.md` and `PROJECT_CONTEXT.md` "Drawing tool catalog".

## Scope

10 tools on a transparent SVG overlay rendered inside the WebView above `src/components/chart/TradingChart.tsx` (Lightweight Charts):

1. Trendline (2 anchors)
2. Horizontal line (1 anchor, extends both ways)
3. Vertical line (1 anchor, extends both ways)
4. Rectangle (2 corner anchors)
5. Fib retracement (2 anchors, 7 default visible levels)
6. Gann box (2 anchors, geometric grid) — **renderer pending**
7. Long position (3 anchors: entry / stop / target — TradingView-style visual) — **renderer pending**
8. Short position (3 anchors: entry / stop / target, inverted) — **renderer pending**
9. Brush (freehand N-point path) — **renderer pending**
10. Text label (1 anchor + text input)

Drawings persist via AsyncStorage globally (per-symbol persistence deferred). Old persisted drawings of pruned types are filtered out gracefully on hydrate (see `drawingsStore.hydrate()`).

## 1. State location — new `drawingStore`

Don't pollute sessionStore. Create `src/store/drawingStore.ts`:

```ts
interface DrawingState {
  drawings: Drawing[];
  activeTool: ToolType | null;        // null = "select" mode
  selectedId: string | null;
  inProgress: PartialDrawing | null;  // mid-gesture, two-tap tools
  add, update, remove, clear, setTool, select
}
```

Wired to sessionStore via two side effects in TradingScreen (or a single subscription in App.tsx):
- On `sessionId` change → `drawingStore.clear()`
- On `endSession()` / `reset()` → `drawingStore.clear()`

No AsyncStorage. No persistence anywhere. Locked decision = per-session only.

## 2. Coordinate mapping — overlay → chart price/time

This is the hard part. Drawings must stay glued to bar/price as the user pans/zooms.

**Anchor model:** every drawing stores `{barIndex, price}` pairs (chart-space), never `{x, y}` pixels. The overlay re-renders on every chart viewport change.

**Why bar-index, not timestamp:** the chart's time axis is already bar (see `TradingChart.tsx:14`), and real timestamps are deliberately hidden from the client. Bar index is the right unit.

**The bridge:** Lightweight Charts exposes `chart.timeScale().timeToCoordinate(bar)`, `coordinateToTime(x)`, `series.priceToCoordinate(price)`, `coordinateToPrice(y)`. These live inside the WebView, the overlay lives in React Native. Two options were considered:

- **Option A (chosen):** overlay inside the WebView. Add an absolutely-positioned `<canvas>` layer in `buildHTML()` above the chart div, draw with the same conversion functions natively, and pipe touch events back via `window.ReactNativeWebView.postMessage`. Conversion is synchronous and pixel-accurate; no IPC per frame.
- **Option B (rejected):** RN-side overlay. Subscribe to viewport changes and post coordinates to RN on every change. RN does the math and renders an `<Svg>` over the WebView. Simpler touch handling but laggy during pan/zoom — every frame is a postMessage round-trip.

**Picked Option A.** Render shapes on a canvas inside the WebView, subscribed to `subscribeVisibleLogicalRangeChange` + `subscribeVisibleTimeRangeChange` for redraws. Touches captured on the canvas, normalized to `{barIndex, price}` before being posted to RN.

**Message protocol additions to `TradingChart.tsx:84`:**
- RN → WV: `{type: 'drawings', drawings}`, `{type: 'tool', tool}`, `{type: 'select', id}`
- WV → RN: `{type: 'drawing_committed', drawing}`, `{type: 'drawing_updated', id, anchors}`, `{type: 'drawing_tapped', id}`, `{type: 'tap_empty'}`

**Off-screen behavior:** if a drawing's anchors fall outside the visible range, clip rather than skip — a horizontal line must still render across the full visible width even when its defining bar is off-screen.

## 3. Touch handling

State machine driven by `activeTool`. Single canvas captures all pointer events; chart pan/zoom is driven manually from pointer deltas when no draw/select interaction is in progress.

**Tool active (creation):**

* Horizontal line, text label: single tap → commit at tap point.
* Trendline, rectangle, fib: first tap places anchor 1 (preview follows finger), second tap commits anchor 2. Tap-and-drag also works — `pointerdown` = anchor 1, `pointermove` previews, `pointerup` = anchor 2. Long press cancels and clears `inProgress`.
* After commit, auto-revert to select mode (`activeTool = null`).

**Select mode (no active tool):**

* Hit-test on `pointerdown`. Hit zones: line/trendline = within 8px of segment, rectangle = on edge or inside, fib = on any level line, text = bounding box.
* Tap empty → deselect, then the same gesture is interpreted as a chart pan (see "Gesture forwarding" below). No re-dispatch needed because the canvas owns the gesture from the start.
* Tap drawing → select, render handles (endpoints + midpoint).
* Drag handle → moves that anchor only. Drag body → translates all anchors equally.
* Two-finger pinch on a selected drawing → ignored as a drawing transform; both pointers feed the chart zoom path (see below).

**Delete:** floating delete button in toolbar slot when `selectedId !== null`; tap removes from `drawings`.

**Gesture forwarding — chosen approach: Option A (always-on canvas, manual pan/zoom).**

Lightweight Charts has no API to re-dispatch a touch the canvas swallowed. Option B (three-layer stack with a router div) was rejected: deciding pan-vs-draw requires the *first* hit-test result, which means the router must duplicate the canvas's hit-test logic and stay in sync with it; once `pointerdown` is consumed by either layer, the other can't pick the gesture up cleanly mid-stroke; and z-order edge cases (toolbar, modals) multiply. Option A keeps all gesture decisions in one place at the cost of reimplementing pan/zoom against the public chart API — which is small, well-defined work.

The canvas sits above the chart with `pointer-events: auto` and owns every touch. On `pointerdown`:

1. Capture the pointer with `target.setPointerCapture(e.pointerId)` so `pointermove`/`pointerup` are guaranteed to fire on the canvas even if the finger leaves it. Without capture, fast pans drop frames when the pointer crosses the toolbar or screen edge.
1. Record `{pointerId, startX, startY, startBarIndex, startPrice, startLogicalRange}`. `startLogicalRange = chart.timeScale().getVisibleLogicalRange()`. If `activeTool` is set, branch into create-mode handlers and skip pan logic entirely. Otherwise run the hit-test.
1. If the hit-test returns a drawing, branch into select/drag handlers (translate-anchor or translate-all), and the chart does not pan for this gesture.
1. If the hit-test misses, this gesture is a chart pan. Stay on the canvas.

On `pointermove` for a pan gesture: derive bar spacing dynamically — do **not** rely on `chart.timeScale().options().barSpacing`, since TradingChart.tsx calls `fitContent()` after `setData` and `scrollToRealTime()` on append, both of which can mutate effective spacing without updating the options object. Instead compute `barSpacingPx = chart.timeScale().logicalToCoordinate(L + 1) - chart.timeScale().logicalToCoordinate(L)` for any visible logical index `L` (e.g. the floor of `startLogicalRange.from`) at the start of each gesture, then `dxBars = (currentX - startX) / barSpacingPx`, then call `chart.timeScale().setVisibleLogicalRange({ from: startLogicalRange.from - dxBars, to: startLogicalRange.to - dxBars })`. Vertical drag is ignored — Lightweight Charts auto-fits the price scale, matching its native pan behavior.

On `pointerup` / `pointercancel`: release capture, drop the pointer record. If exactly two pointers were active during the gesture, treat it as pinch-zoom: track the distance between the two pointers across moves, compute `scale = currentDistance / startDistance`, and apply via `setVisibleLogicalRange` by scaling `(to - from)` around the gesture midpoint's bar index. Use the same start-snapshot pattern (snapshot bar spacing and logical range at gesture start) so the math stays stable across a single pinch. Pinch on a selected drawing follows the same path — drawing scale-transforms are out of v1.

Edge cases:

* Toolbar taps: the toolbar is a sibling RN view, not part of the WebView, so its taps never reach the canvas. No conflict.
* WebView scroll: TradingChart's WebView must have `scrollEnabled={false}` and the canvas must call `e.preventDefault()` in `pointerdown` to suppress browser scroll/zoom inside the WebView.
* Momentum/inertia after pan release: not implemented in v1 — pan stops when the finger lifts. Matches the honest, no-fake-polish tone of the rest of the app.

## 4. UI — toolbar (in RN, not WebView)

**Placement:** vertical strip pinned to right edge of `TradingScreen.tsx`, ~44px wide. Floats above the chart, semi-transparent dark background (`#141B2D` at 90% alpha).

**Contents (top to bottom):**
1. Select/cursor (default, no tool)
2. Horizontal line
3. Trendline
4. Rectangle
5. Fib retracement
6. Text label
7. Divider
8. Trash icon — disabled unless `selectedId !== null`
9. Clear-all (long-press confirm)

**Active-tool indicator:** active button gets gold border + gold tint (`#FFB800`). Tap an active tool again to deactivate.

**Collapse:** single chevron button collapses the toolbar to a single icon when not in use. Default expanded.

## 5. JSON shape per drawing type

Discriminated union keyed on `type`. All anchors in chart space.

```ts
type Anchor = { bar: number; price: number };

interface DrawingBase {
  id: string;            // uuid
  type: DrawingType;
  color: string;         // hex; default brand gold #FFB800
  lineWidth: number;     // default 2
  createdAt: number;     // Date.now(), for z-order
}

type Drawing =
  | (DrawingBase & { type: 'hline';      anchor: Anchor })
  | (DrawingBase & { type: 'trendline';  a: Anchor; b: Anchor })
  | (DrawingBase & { type: 'rect';       a: Anchor; b: Anchor; fill?: string; fillOpacity?: number })
  | (DrawingBase & { type: 'fib';        a: Anchor; b: Anchor; levels: number[] })
  | (DrawingBase & { type: 'text';       anchor: Anchor; text: string; fontSize: number });
```

Notes:
- `hline.anchor.bar` retained even though render ignores it — keeps shape uniform, lets a future "ray" tool reuse it.
- Default fib levels: `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`.
- No `extendLeft`/`extendRight` flags in v1.

## 6. Backend implications

None. Pure client-side. No new endpoints, no schema changes, no payload additions.

## Locked decisions

- Canvas (not SVG) inside WebView, with manual hit-test.
- Toolbar in React Native (not WebView).
- No snap-to-OHLC in v1 — defer.
- Per-session only — wiped on session end.
- No backend involvement.

## Still open (blocking implementation)

- Section 3 gesture-forwarding: pick A or B, justify, rewrite section 3 concretely.
