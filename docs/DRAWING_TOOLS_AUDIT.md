# Drawing Tools Audit — master @ d53ed65

Audit of the custom SVG drawing system on `master`. No code edits performed —
this is the inventory + recommended fix order. KLineChart Pro spike abandoned;
all work continues on the existing custom system.

Sources audited:
- [src/types/drawings.ts](../src/types/drawings.ts) — catalog (45 entries)
- [src/components/chart/TradingChart.tsx](../src/components/chart/TradingChart.tsx) — renderer (`renderDrawings()` ~lines 320-720)
- [src/store/drawingsStore.ts](../src/store/drawingsStore.ts) — state + persistence
- [src/components/chart/DrawingToolbar.tsx](../src/components/chart/DrawingToolbar.tsx) — left RN sidebar
- [src/components/chart/DrawingFavoritesBar.tsx](../src/components/chart/DrawingFavoritesBar.tsx) — floating top bar
- [src/components/chart/DrawingSettingsModal.tsx](../src/components/chart/DrawingSettingsModal.tsx) — bottom-sheet editor
- [WORK_LOG.md](../WORK_LOG.md) — `2026-05-09 — Drawing tools` entry

---

## Tool inventory

| ID | Label | Anchors | `drawable` flag | Renderer present? | Status |
|---|---|---:|---:|---:|---|
| `cursor_cross` / `cursor_dot` / `cursor_arrow` / `demonstration` / `eraser` | Cursors | 0 | false | n/a | Not drawings; stay |
| `trendline` | Trendline | 2 | true | ✓ | Working |
| `ray` | Ray | 2 | true | ✓ | Working |
| `info_line` | Info line | 2 | true | ✓ shared branch | Working |
| `extended_line` | Extended line | 2 | true | ✓ shared branch | Working |
| `trend_angle` | Trend angle | 2 | true | ✓ shared branch | Working |
| `hline` | Horizontal line | 1 | true | ✓ | Working |
| `hray` | Horizontal ray | 1 | true | ✓ | Working |
| `vline` | Vertical line | 1 | true | ✓ | Working |
| `cross_line` | Cross line | 1 | true | ✓ | Working |
| `rectangle` | Rectangle | 2 | true | ✓ | **BROKEN — see B1** |
| `circle` | Circle | 2 | true | ✓ | Working |
| `arrow` | Arrow | 2 | true | ✓ | Working |
| `parallel_channel` | Parallel channel | 3 | true | ✓ | Working |
| `fib_retracement` | Fib retracement | 2 | true | ✓ | **BROKEN — see B2** |
| `fib_extension` | Trend-based fib extension | 3 | true | ✓ | Working |
| `fib_channel` / `fib_time_zone` / `fib_speed_fan` / `fib_trend_time` / `fib_circles` / `fib_spiral` / `fib_speed_arcs` / `fib_wedge` / `pitchfan` | Fib variants | 2-3 | false | ✗ | Disabled; never built |
| `gann_box` | Gann box | 2 | false | ✗ | **MISSING — needs implementation per KEEP** |
| `gann_square_fixed` / `gann_square` / `gann_fan` | Gann variants | 2 | false | ✗ | Disabled; never built |
| `xabcd` / `cypher` / `head_shoulders` / `abcd` / `triangle` / `three_drives` | Patterns | 3-5 | false | ✗ | Disabled; never built |
| `position_forecast` / `bar_pattern` / `ghost_feed` / `sector` | Forecasting | 2-3 | false | ✗ | Disabled; never built |
| `anchored_vwap` / `fixed_range_volume_profile` / `anchored_volume_profile` | Volume-based | 1-2 | false | ✗ | Disabled; never built |
| `price_range` | Price range | 2 | true | ✓ | Working |
| `date_range` | Date range | 2 | true | ✓ | Working |
| `date_price_range` | Date and price range | 2 | true | ✓ | Working |
| `brush` | Brush | 2 | false | ✗ | **MISSING — needs implementation per KEEP** |
| `highlighter` | Highlighter | 2 | false | ✗ | Disabled; never built |
| `text` | Text | 1 | true | ✓ shared branch | Working |
| `note` | Note | 1 | true | ✓ shared branch | Working |
| `price_note` | Price note | 1 | true | ✓ shared branch | Working |
| `pin` / `table` / `callout` / `comment` | Text variants | 1 | false | ✗ | Disabled; never built |
| **NOT IN CATALOG:** Long position drawing | — | — | — | ✗ | **MISSING — net-new tool per KEEP** |
| **NOT IN CATALOG:** Short position drawing | — | — | — | ✗ | **MISSING — net-new tool per KEEP** |

---

## Section A — Tools that work (drawable + renderer in place, no known bug)

These render and accept drag-to-draw + tap-tap placement. Selection, drag, double-tap settings, long-press menu, persistence all wired through the shared interaction code.

- `trendline`
- `ray`
- `info_line`, `extended_line`, `trend_angle` (share one renderer with type-specific labels)
- `hline`
- `hray`
- `vline`
- `cross_line`
- `circle`
- `arrow`
- `parallel_channel` (3-anchor)
- `fib_extension` (3-anchor)
- `price_range`
- `date_range`
- `date_price_range`
- `text`, `note`, `price_note` (share one renderer)

WORK_LOG (2026-05-09) lists six manual smoke-test items still UNCHECKED. None of the items in this section have been confirmed working on device for THIS code state — they're "should work per the renderer" not "verified working." Smoke test will move them to verified or B.

## Section B — Tools that are broken

### B1 — `rectangle` selection broken
[TradingChart.tsx:485](../src/components/chart/TradingChart.tsx#L485) and [TradingChart.tsx:525](../src/components/chart/TradingChart.tsx#L525) both have an `else if (d.type === 'rectangle')` branch.

The first branch (line 485, also matches the legacy `'rect'` alias) **renders without `data-id` or `pointer-events: 'all'`** — meaning the rectangle is visible but cannot be selected, dragged, or have its settings opened. The second branch (line 525) has the proper attributes but is **dead code** — JS `else if` chains stop at the first match.

**Symptom:** rectangles render fine but tapping them does nothing. The settings sheet never opens.
**Fix:** delete the dead branch at line 525, add `data-id`/`pointer-events`/hit-rect to the line-485 branch (or just keep line 525 and delete the alias from line 485). Trivial.

### B2 — `fib_retracement` ignores user-set line width + may misrender
[TradingChart.tsx:514](../src/components/chart/TradingChart.tsx#L514): every fib level line is hard-coded to `'stroke-width': 1`, ignoring the drawing's `style.lineWidth` (which the settings sheet exposes 1-6). User changes thickness in settings, fib stays at 1px.

User-reported symptom (verbatim): *"fib retracement is all fucked up when placed."* Specific symptom not yet identified. The hard-coded stroke width is one bug; the body of the fib renderer is otherwise correct (iterates `FIB_LEVELS_ALL`, uses `fibLevelEffective` for visibility/color, draws background fill). Smoke test on device should produce the concrete defect.

**Fix:** swap `'stroke-width': 1` for the drawing's `sw`. After that, smoke-test what's still off.

## Section C — KEEP list (10 tools)

Per user spec. Status is the audit-derived current state on master — what we actually have to work with for each.

| # | Tool | Status on master | Effort to KEEP |
|---:|---|---|---|
| 1 | Trendline (2 anchors) | Section A — working | None (verify on device) |
| 2 | Horizontal line (extends both ways) | Section A — `hline` | None (verify) |
| 3 | Vertical line (extends both ways) | Section A — `vline` | None (verify) |
| 4 | Fib retracement (2 anchors, 7 levels) | Section B2 — broken | 1 line fix + smoke test |
| 5 | Gann box (2 anchors, geometric grid) | Catalog entry exists, `drawable: false`, NO renderer | New renderer (medium) |
| 6 | Long position drawing (entry/stop/target) | NOT IN CATALOG | New tool (medium-large) |
| 7 | Short position drawing (entry/stop/target) | NOT IN CATALOG | New tool (medium-large; mostly mirrors #6) |
| 8 | Text label (1 anchor + text input) | Section A — `text` | None (verify) |
| 9 | Brush (freehand path) | Catalog entry exists, `drawable: false`, NO renderer | New renderer (medium — needs N-point path, not 2-anchor) |
| 10 | Rectangle (2 corner anchors) | Section B1 — broken | Trivial fix |

## Section D — DELETE list

Everything currently `drawable: true` that isn't in KEEP. These have working renderers but the user wants them gone — pure removal work, no design.

- `ray`
- `info_line`
- `extended_line`
- `trend_angle`
- `hray`
- `cross_line`
- `circle`
- `arrow`
- `parallel_channel`
- `fib_extension`
- `price_range`
- `date_range`
- `date_price_range`
- `note` (text variant)
- `price_note` (text variant)

Already disabled (`drawable: false`) but should also leave the catalog for tidiness:
- All other fib variants: `fib_channel`, `fib_time_zone`, `fib_speed_fan`, `fib_trend_time`, `fib_circles`, `fib_spiral`, `fib_speed_arcs`, `fib_wedge`, `pitchfan`
- All other Gann variants: `gann_square_fixed`, `gann_square`, `gann_fan`
- All patterns: `xabcd`, `cypher`, `head_shoulders`, `abcd`, `triangle`, `three_drives`
- All forecasting/volume: `position_forecast`, `bar_pattern`, `ghost_feed`, `sector`, `anchored_vwap`, `fixed_range_volume_profile`, `anchored_volume_profile`
- `highlighter`
- `pin`, `table`, `callout`, `comment`

DELETE work touches: `src/types/drawings.ts` (`DrawingType` union, `TOOL_CATALOG`, `CATEGORY_BUTTONS`), the renderer branches in TradingChart.tsx, and any defaults referencing them in `drawingsStore.ts` (`favorites: new Set([...])` defaults include `arrow` which is going away).

---

## Proposed fix order — momentum first, hard last

Each step is independently shippable. Stop and verify after each.

1. **Smoke test** — reload master on device, walk the WORK_LOG checklist. Record what's actually broken vs. what just needs the trivial fixes below. (Zero code.)
2. **Fix B1** — rectangle selection. Delete dead branch + add `data-id`. ~5 lines. (1 commit.)
3. **Fix B2** — fib stroke width. One token change. Then re-test fib. (1 commit. If it's still broken after this, smoke test produces a concrete next defect.)
4. **DELETE pruning** — remove every Section D drawable from catalog + renderer + favorites defaults. Also strip `drawable: false` entries to declutter the sidebar. Probably 100-200 lines off. (1 commit, well-scoped.)
5. **Add `brush`** — N-point path, not 2-anchor. Touch handler accumulates points during drag; renderer draws an SVG `<path d="M…L…">`. New tool but follows existing patterns. (1 commit.)
6. **Add `gann_box`** — 2-anchor geometric grid. Renderer draws an 8×8 (or configurable) grid between the two anchors with diagonal lines. Pure geometry. (1 commit.)
7. **Add `long_position`** — biggest new tool. Three handles (entry, stop, target). Stacked rectangle with R:R label, $-P&L estimate, percent move. Needs settings panel additions for "size" / "risk %". (1 commit, possibly two.)
8. **Add `short_position`** — mostly mirrors `long_position` with inverted layout. Most code reuses #7. (1 commit.)

Order rationale: trivial fixes first (B1, B2) ship momentum and prove the smoke-test loop works. Pruning before adding new tools means less surface area to update when the new tools touch shared files. Brush before gann_box because brush exercises the multi-point placement path (which we'll need to verify doesn't conflict with body-drag), and gann_box is pure 2-anchor geometry. Position drawings last because they're the largest and most product-design-heavy.

**Stop after the smoke test. Do not start fixes until the user confirms this kill list and fix order.**
