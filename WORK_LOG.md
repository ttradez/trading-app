# Pocket Trade — Work Log

Running record of completed tasks, ordered newest first. Each entry should
note what shipped, what files changed, and what was deferred.

---

## 2026-05-10 — Smoke-test fixes 4+5: rectangle + fib placement (atomic 2-point message)

**Status:** Code complete on `master`. Type-check clean.

Both issues had the same root cause. The drag-to-draw fast path in the WebView
posted TWO back-to-back `drawing_point` messages (start + end). React's
`handleDrawingPoint` reads `pendingPoints` from a destructured Zustand value
captured at render time. Both messages arrive between renders, so:
- msg 1: `[...[], {start}]` → length 1 < 2 → appendPendingPoint({start})
- msg 2: `[...[], {end}]`   → length 1 < 2 → appendPendingPoint({end})
                                ^ stale closure, store update from msg 1 not seen

Result: `pendingPoints` ends up `[start, end]` but the drawing is never
committed and the tool stays active. On the next tap the OLD start+end leak
into the new drawing.

### Fix
- WebView placement-drag commit now sends ONE message: `drawing_place` with
  a `points: [start, end]` array. Tap-tap path (single tap → drawing_point)
  is unchanged; it doesn't have the back-to-back problem.
- React side: new `drawing_place` handler bypasses `pendingPoints` entirely,
  calls `addDrawing` once with both points, then `resetPending` +
  `setActiveTool('cursor_cross')`.

### Files touched
- `src/components/chart/TradingChart.tsx` (WebView placementDrag commit + RN handler)

### Behavior contract
- Drag-to-draw rectangle: immediate commit on touchend, returns to cursor mode.
- Drag-to-draw fib: same.
- Tap-tap placement still works (unchanged code path).

---

## 2026-05-10 — Smoke-test fix 3: smooth handle drag (detach + local mutation)

**Status:** Code complete on `master`. Type-check clean.

Handle drag was laggy + occasionally dropped touch capture. Two root causes:
1. Every `touchmove` posted to React → `setState` → re-render → `setDrawings`
   → `renderDrawings()` → `drawingsLayer.innerHTML = ''` → the touched handle
   element was destroyed mid-drag, breaking touch capture.
2. The bridge round-trip per frame added perceptible lag.

### Fix (same architectural pattern as body-drag's transform trick)
- **touchstart** (handle/corner branch): detach the touched circle from
  `drawingsLayer` and re-parent it to `overlay` (which is the parent SVG).
  Both share the same SVG coord system. The element survives every subsequent
  `drawingsLayer.innerHTML = ''` because it's no longer a child of it.
- **touchmove**: mutate `drawingsList[i].points` LOCALLY (no React round-trip
  per frame). For rectangle corners, ported the bbox reshape + re-normalize
  math from React. Call `renderDrawings()` to redraw geometry. Update the
  floating handle's `cx`/`cy` to mirror the finger.
- **touchend**: post one `drawing_drag_final` with the final points array.
  Remove the floating handle from `overlay`. Re-render so the canonical
  handle (at the new anchor position) takes over. `touchcancel` does the
  same cleanup.
- **React side**: removed `drawing_drag` and `drawing_drag_corner` handlers,
  replaced with unified `drawing_drag_final` that calls `updateDrawing` once.

### Files touched
- `src/components/chart/TradingChart.tsx` (touchstart already had the
  detach; this commit completes touchmove + touchend + React handler)

### Behavior contract
- Handle drag is now buttery smooth (no React round-trip per frame).
- Rectangle corner drag still keeps the diagonal fixed (math ported, not changed).
- Drawing position is committed once on touchend → AsyncStorage write happens once per drag.

### Still pending in this fix batch
- Issue 4: rectangle placement broken
- Issue 5: fib placement broken
- Issue 6: gesture arbitration (tap-place, single-drag = chart pan, multi-touch through)

---

## 2026-05-09 — Smoke-test fix 2: kill Drawing Actions popup, footer buttons in settings sheet

**Status:** Code complete on `master`. Type-check clean.

User saw two panels stacking on tap (the long-press alert + the
settings sheet) and only wants the settings sheet. Moved Lock /
Duplicate / Delete actions into the settings sheet's footer.

### What changed
- WebView: removed the long-press timer arming (`setTimeout`) that
  fired `drawing_longpress`. Timer machinery + `clearLongPress()`
  retained as a no-op so existing drag paths can still call it safely.
  Removed `longPressFired` flag + its check in touchend.
- React-side: removed the `drawing_longpress` `Alert.alert` handler.
  Removed the now-unused `Alert` import + `duplicateDrawing` from the
  store destructure (used only by the popup).
- DrawingSettingsModal: replaced the inline "Lock" toggle row at the
  bottom of the ScrollView with a proper action footer below the
  ScrollView, containing three buttons:
    [ LOCK / LOCKED ] [ DUPLICATE ] [ DELETE (red) ]
  Tapping outside the sheet still closes it (the existing backdrop
  Pressable handles that — Cancel button isn't needed).

### Files touched
- `src/components/chart/TradingChart.tsx`
- `src/components/chart/DrawingSettingsModal.tsx`

---

## 2026-05-09 — Phase 2A smoke-test fix 1: revert tap behavior

**Status:** Code complete on `master`. Type-check clean.

User changed mind on tap semantics post-smoke-test. **Reverses Phase 2A.1**.
Final tap behavior:
- **Single tap** on drawing → select + show all handles + allow drag
  (settings sheet stays closed)
- **Double tap** on drawing → open settings sheet

### What changed
- `drawingsStore.setSelected(id)`: back to "deselect closes, re-select
  preserves settingsOpen" (was: id != null forces settingsOpen=true).
- WebView `handleTap` + touchend: `lastDrawingTapId` / `lastDrawingTapTime`
  detection restored. Posts `drawing_open_settings` only on the second
  tap within 350ms.
- React-side `drawing_open_settings` handler restored.

### Files touched
- `src/store/drawingsStore.ts`
- `src/components/chart/TradingChart.tsx`

---

## 2026-05-09 — Phase 2A.3: fib retracement honors user-set lineWidth (audit B2)

**Status:** Code complete on `master`. Type-check clean.

Audit Issue B2: the fib retracement renderer hard-coded
`'stroke-width': 1` for every level line, ignoring the user's
`style.lineWidth` (which the settings panel exposes 1-6).

### What changed
- `TradingChart.tsx` fib_retracement render branch: `'stroke-width': 1`
  → `'stroke-width': sw` (the per-drawing computed line width that all
  other tools already use).

One-line change. Audit-issue B2 closed.

### Files touched
- `src/components/chart/TradingChart.tsx`

---

## 2026-05-09 — Phase 2A.2: rectangle 4-corner handles + reshape

**Status:** Code complete on `master`. Type-check clean.

Rectangle previously rendered only 2 visual handles (one per stored
anchor). TradingView shows all 4 corners. This commit adds the missing 2.

### What changed
- Renderer (TradingChart.tsx): when `d.type === 'rectangle' && pts.length === 2`,
  emit handles at all 4 corners of the bounding box instead of at the 2
  anchor points. Each corner carries a `data-corner="TL|TR|BR|BL"` attr.
- Touch handler: dispatch on `data-handle` (existing path) OR `data-corner`
  (new path). Corner drags post a new `drawing_drag_corner` message.
- React-side handler: `drawing_drag_corner` reshapes the bbox by axis,
  re-normalizes to canonical `[TL, BR]` after every update so the next
  drag sees consistent anchor order. The dragged corner moves to the
  finger; the diagonal corner stays fixed naturally.
- User can drag past the diagonal (cross over); axes re-min/max so the
  rectangle never inverts.

### Files touched
- `src/components/chart/TradingChart.tsx` — handle render + touch handler
  + RN-side message dispatch

### Behavior contract
| Action | Result |
|---|---|
| Tap rectangle | Select + 4 corner handles + settings (from 2A.1) |
| Drag any corner | Diagonal corner stays; rectangle reshapes |
| Drag body (not on a handle) | Whole rectangle translates |
| Drag past the diagonal | Rectangle re-normalizes, doesn't flip-render |

Affects only `rectangle`. Other tools keep the 1-handle-per-anchor
behavior. Phase 2A.3 (fib stroke-width) follows.

---

## 2026-05-09 — Phase 2A.1: single-tap opens settings + shows handles

**Status:** Code complete on `master`. Type-check clean.

Reverses the prior locked decision (single-tap = handles only, double-tap
= settings) per the new TradingView-parity spec from this session.

### What changed
- `setSelected(id)` in drawingsStore now sets `settingsOpen = (id != null)`
  in one shot. Selecting a drawing opens its settings sheet automatically;
  deselecting closes it.
- Removed the WebView's double-tap detection (`lastDrawingTapId` /
  `lastDrawingTapTime` state + the `drawing_open_settings` postBack +
  the React-side handler for it). All gone. `drawing_select` is now
  the canonical "user wants to interact with this drawing" event.
- Removed the now-unused `setSettingsOpen` from TradingChart's store
  destructure.

### Files touched
- `src/store/drawingsStore.ts` — `setSelected` semantics
- `src/components/chart/TradingChart.tsx` — touch handler + RN-side
  message dispatch

### Behavior contract going forward
| Action | Result |
|---|---|
| Tap drawing | Select + handles + settings sheet (one tap) |
| Tap empty area | Deselect + close settings |
| Drag drawing body | Translate (still works, unchanged) |
| Drag handle | Move single anchor (still works, unchanged) |
| Long-press drawing | Quick-action menu (still works, unchanged) |

Applies to all 6 existing keep-list tools (trendline, hline, vline,
rectangle, fib_retracement, text). Phase 2A.2 follows for the rectangle
4-corner handles.

---

## 2026-05-09 — Drawing tools pruned to 10 essentials (TASK 1)

**Status:** Code complete on `master`. Type-check clean.

Removed 15 drawing tool types from `DrawingType` union + catalog +
renderer + settings panel: `ray`, `info_line`, `extended_line`,
`trend_angle`, `hray`, `cross_line`, `circle`, `arrow`,
`parallel_channel`, `fib_extension`, `price_range`, `date_range`,
`date_price_range`, `note`, `price_note`. Plus all `drawable: false`
fluff (`cursor_dot`, `cursor_arrow`, `demonstration`, all gann/pattern/
forecasting/volume variants, `highlighter`, `pin`/`table`/`callout`/
`comment`).

Final type union is exactly the 10-tool KEEP list + `cursor_cross` +
`eraser`. Catalog has 12 entries total (10 tools + 2 cursor modes).

### Side effect: B1 (rectangle selection) fixed incidentally
TradingChart.tsx had two `else if (d.type === 'rectangle')` branches.
The first (legacy `'rect'` alias) was reachable but lacked
`data-id` / `pointer-events: 'all'`. The second was unreachable but
correct. Deleting the legacy branch resolved the duplication — the
remaining branch is the one with proper selection wiring.

### B2 (fib `stroke-width: 1` hardcode) NOT fixed in this pass
The hard-coded `'stroke-width': 1` in the fib renderer is untouched.
Queued as the next surgical commit per audit's fix order step 3, once
user confirms the smoke test.

### Files touched
- `src/types/drawings.ts` — type union + TOOL_CATALOG + CATEGORY_BUTTONS
- `src/store/drawingsStore.ts` — favorites default + hydrate-time filter
  for unknown stored types
- `src/components/chart/TradingChart.tsx` — 11 renderer branches removed
  (~280 lines off)
- `src/components/chart/DrawingSettingsModal.tsx` — per-tool conditionals
  narrowed to the 10 keep-tools
- `docs/BLOCK_17_DRAWING_TOOLS_SPEC.md` — tool list updated to 10
- `PROJECT_CONTEXT.md` — new "Drawing tool catalog" section

### Untouched intentionally
- `DrawingToolbar.tsx` — drives off `CATEGORY_BUTTONS` +
  `TOOL_CATALOG.filter(byCategory)`. Picks up the prune for free.
- `DrawingFavoritesBar.tsx` — already filters via `TOOL_BY_ID[id]`
  membership; old stale favorites auto-stripped on render.

### Missing implementations (KEEP list, renderer pending)
Catalog entries marked `drawable: false`; UI hides them until renderers
ship. Order to build per audit:
1. `brush` (N-point freehand path)
2. `gann_box` (2-anchor geometric grid)
3. `long_position` (3-anchor entry/stop/target)
4. `short_position` (same shape, inverted)

### TASK 2 — blocked on architecture conflict
TASK 2 prompt mandates `react-native-gesture-handler` for ALL touch
handling and `Reanimated` shared values for drag. This directly
contradicts the locked decision in
`docs/BLOCK_17_DRAWING_TOOLS_SPEC.md` Section 2 (Option A — overlay
inside WebView; explicitly rejected Option B — RN-side overlay with
gesture handler — as "laggy during pan/zoom"). Drawings live INSIDE
the WebView; RN gesture handler cannot reach into the WebView. The
realistic TradingView-parity implementation uses the WebView's DOM
touch events (the existing pattern). Awaiting user confirmation
before proceeding.

---

## 2026-05-09 — KLineChart Pro spike abandoned, returning to master

**Decision:** Stop the KLineChart Pro spike. Return to the custom SVG
drawing system on `master` (commit `258f5ae`) and smoke-test it before
touching any drawing code.

### Why
- 7 iterations on `feature/klinechart-spike` (commits `f8a5803` →
  `3f5f458`) couldn't reach a clean simultaneous state — every fix
  reintroduced a different problem (pan/zoom vs layout, indicators vs
  overlays vs popup vs axis drag).
- Couldn't determine which API path was usable without device-side log
  access; defensive path-A/path-B code was the workaround but accumulated
  complexity faster than results.
- The custom SVG system on master had already been validated by the user
  in earlier sessions; the spike was solving a problem that wasn't
  blocking anything yet.

### What stays
- `feature/klinechart-spike` branch is preserved (NOT deleted). Latest
  commit `3f5f458` includes a useful in-WebView debug log overlay and
  the locale/theme/CDN setup that could inform a future swap.
- All 7 iter commits remain on the branch as a research artifact.

### What's next
- User to reload `master` on device and smoke-test the existing custom
  drawing system end-to-end (checklist in the next entry below).
- Surgical fixes only — do NOT rewrite anything until the smoke test
  produces a concrete defect list.

---

## 2026-05-09 — Drawing tools (TradingView parity, intra-session)

**Status:** Code complete. Manual smoke test pending on device.

### Type system
- `DrawingStyle` extended with: `strokeOpacity`, `extendLeft`, `extendRight`,
  `showPriceLabel`, `fibLevels`, `fibBgOpacity`.
- New `FibLevelConfig` interface for per-level overrides.
- `FIB_LEVEL_DEFAULTS` table — 7 standard levels visible, 3 extensions
  (1.272 / 1.414 / 1.618) hidden by default.
- `resolveFibLevel()` helper merges override + default.

### Renderer (WebView)
- Stroke opacity threaded through every line type (trendline, ray,
  extended_line, hline, hray, vline, cross_line, fib levels).
- Trendline supports independent extend-left and extend-right (projects to
  chart edges, same math as `extended_line`).
- Ray supports extend-left toggle (right is the ray direction by default).
- Trendline / ray / hline / hray render an optional price tag at the right
  end via the new `priceTag()` SVG helper.
- Fib retracement renderer rebuilt to honor per-level visibility/color and
  uses the editable `fibBgOpacity`.

### Settings panel
- 16-color palette (was 12).
- New "Line opacity" row (25 / 50 / 75 / 100%).
- Extend L/R toggles, conditional on trendline/ray.
- Price-label toggle, conditional on trendline/ray/hline/hray.
- Fib levels block: per-level eye toggle + tap-to-cycle color dot.
- Fib "Background fill" row (OFF / 4 / 10 / 20%).

### Interaction
- Drag drawing body — only triggers when the touched drawing is the
  currently-selected one. Translates every anchor by the (time, price)
  delta uniformly. New `drawing_translate` message.
- Long-press (500ms still) on any drawing fires `drawing_longpress` →
  React-side `Alert.alert` with Delete / Duplicate / Lock options.
- Long-press timer cancels on movement, anchor drag, and touchend.
- Locked drawings: short-circuit (no menu, no drag, settings still readable).

### Files touched
- `src/types/drawings.ts`
- `src/components/chart/TradingChart.tsx`
- `src/components/chart/DrawingSettingsModal.tsx`

### Honored prior decisions (NOT changed)
- Settings panel still opens on **double-tap** (single-tap = select handles only).
- No "PLACING [TOOL]" banner.
- Drawings persist **globally** across symbols (per-symbol deferred).

### Manual verification still required
- [ ] Trendline + extend right + price label end-to-end
- [ ] Fib defaults show 7 levels; toggling 1.272 reveals it
- [ ] Per-level color cycle works
- [ ] Body-drag of selected drawing translates all anchors
- [ ] Long-press menu opens with Delete/Duplicate/Lock
- [ ] Locked drawing cannot be moved or quick-menu'd
