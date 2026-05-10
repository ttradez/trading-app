# Pocket Trade — Work Log

Running record of completed tasks, ordered newest first. Each entry should
note what shipped, what files changed, and what was deferred.

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
