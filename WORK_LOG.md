# Pocket Trade — Work Log

Running record of completed tasks, ordered newest first. Each entry should
note what shipped, what files changed, and what was deferred.

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
