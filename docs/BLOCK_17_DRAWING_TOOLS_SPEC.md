# Block 17 — Drawing Tools Spec

Status: SPEC LOCKED on 3/4 open questions. Section 3 gesture-forwarding (option A vs B) still awaiting Claude Code's final write-up before implementation can begin.

## Scope

Five tools on a transparent overlay above `src/components/chart/TradingChart.tsx` (Lightweight Charts WebView): horizontal line, trendline, rectangle, fib retracement, text label. Per-session lifetime — wiped when `sessionStore.endSession()` or `reset()` runs. No backend.

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

## 3. Touch handling — STILL OPEN

State machine driven by `activeTool`. The creation/select/delete logic is locked, but gesture forwarding is undecided.

**Tool active (creation):**
- Horizontal line, text label: single tap → commit at tap point.
- Trendline, rectangle, fib: first tap places anchor 1 (preview line follows finger), second tap commits anchor 2. Tap-and-drag also works — touchstart = anchor 1, touchmove previews, touchend = anchor 2. Long press cancels.
- After commit, auto-revert to select mode (`activeTool = null`).

**Select mode (no active tool):**
- Hit-test on tap. Hit zones: line/trendline = within 8px of segment, rectangle = on edge or inside, fib = on any level line, text = bounding box.
- Tap empty → deselect; chart pan/zoom resumes.
- Tap drawing → select, render handles (endpoints + midpoint).
- Drag handle → moves that anchor only. Drag body → translates all anchors equally.
- Two-finger pinch on a selected drawing → ignored (forward to chart, don't scale drawings).

**Delete:** floating delete button in toolbar slot when `selectedId !== null`; tap removes from `drawings`.

**OPEN: gesture forwarding.** Lightweight Charts has no API to re-dispatch a swallowed touch back to itself. Two candidate approaches:
- **A) Always-on canvas:** hit-test on `pointerdown`; on miss with no active tool, manually drive `chart.timeScale().scrollToPosition()` from `pointermove` deltas to fake the pan.
- **B) Three-layer stack:** chart, drawing canvas (`pointer-events: none`), gesture-router div on top that decides re-dispatch destination.

Claude Code on the web is finalizing this and will rewrite section 3 concretely with the chosen approach.

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
