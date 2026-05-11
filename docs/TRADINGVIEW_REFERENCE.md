# TradingView Drawing Tools — Implementation Reference

Reference spec for ten drawing tools used by Pocket Trade (React Native + Expo, replay-trading futures simulator). Values reflect TradingView's web charting UI as documented by TradingView Help and corroborated by TradingView blog/idea posts. Where a default isn't published explicitly by TradingView, it is marked **(observed)**.

Conventions used throughout:
- "Anchor" = a user-positioned point that can be dragged after placement.
- "Tap-tap" = first tap to start, second tap to finish (mobile equivalent of click-click).
- "Tap-drag" = press and drag from start to end without lifting.
- Line widths shown as TradingView's dropdown values (1, 2, 3, 4 px).
- On mobile, "long press" replaces right-click for context menus; "single tap" replaces single click for selection.

---

## 1. Trend Line

### Placement
- **Desktop:** Click once at start anchor, move mouse (live preview line follows cursor), click again at end anchor. A "magnet" mode (off by default) snaps to OHLC.
- **Mobile:** Tap at start anchor, tap at end anchor. A live preview line is rendered between the placed first anchor and the current finger/cursor position.
- **Anchor points:** 2 anchors — Point A (start, time + price) and Point B (end, time + price).
- **Preview/ghost:** Yes. After the first tap/click, a dashed-style ghost line follows the cursor/finger to the second anchor. The committed line uses the configured style (solid by default).

### Default Visual Style
- **Default color:** `#2962FF` (TradingView blue) **(observed)**.
- **Default line style:** Solid.
- **Default thickness:** 1 px (the first option in the 1/2/3/4 dropdown).
- **Default opacity:** 100% (alpha 1.0).
- **Default labels/markers:** No price labels, no left/right extension, no arrow heads, no middle point dot.

### Settings Panel — Full List of Options
- **Line color** — color picker — default blue `#2962FF` — affects stroke color.
- **Line opacity** — slider (0–100%) — default 100% — affects stroke alpha.
- **Line thickness** — dropdown (1 / 2 / 3 / 4 px) — default 1 — affects stroke width.
- **Line style** — dropdown (Solid / Dashed / Dotted) — default Solid — affects dash pattern.
- **Left end style** — dropdown (Normal / Arrow) — default Normal — adds an arrowhead at point A when set to Arrow.
- **Right end style** — dropdown (Normal / Arrow) — default Normal — adds an arrowhead at point B when set to Arrow.
- **Extend left** — toggle — default Off — extends the line infinitely toward earlier bars.
- **Extend right** — toggle — default Off — extends the line infinitely toward later bars.
- **Middle point** — toggle — default Off — renders a visible dot at the midpoint between A and B.
- **Show label** — toggle — default Off — turns on a text label attached to the line.
- **Text** — text input — default empty — label text content.
- **Font** — dropdown (Default + system fonts) — default "Default" — affects label typeface.
- **Font size** — dropdown (10 / 11 / 12 / 14 / 16 / 20 / 24 / 32 / 40 / 60 / 80) — default 14 — label text size.
- **Bold** — toggle — default Off — bolds the label.
- **Italic** — toggle — default Off — italicizes the label.
- **Text color** — color picker — default matches line color — label text color.
- **Background** — toggle + color picker — default Off / white — fills label background when enabled.
- **Border** — toggle + color picker — default Off — outlines the label.
- **Horizontal alignment** — dropdown (Left / Center / Right) — default Center — label horizontal position relative to line.
- **Vertical alignment** — dropdown (Top / Middle / Bottom) — default Top — label vertical position relative to line.
- **Show angle** — toggle — default Off — displays the line's angle in degrees.
- **Show price range** — toggle — default Off — shows price delta between A and B.
- **Show bars range** — toggle — default Off — shows number of bars between A and B.
- **Show date/time range** — toggle — default Off — shows time delta.
- **Show distance** — toggle — default Off — shows distance percentage.
- **Coordinates** — Price/Bar inputs — manual numeric entry for both anchors.
- **Visibility on timeframes** — multi-checkbox set (1s, 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W, 1M, Ranges, Ticks) — all enabled by default — toggles visibility per timeframe.
- **Lock** — toggle — default Off — prevents the drawing from being moved or edited.
- **Disable selection** — toggle — default Off — prevents the drawing from being clicked.
- **Snap to bar** — toggle — default Off — forces anchors to bar grid.

### Interaction Behaviors
- **Single tap:** Selects the line. Handles appear at both anchors (and optionally the middle point) as filled circles.
- **Double tap:** Opens the settings panel for the line.
- **Long press:** Opens the context menu (Edit, Clone, Pin to chart, Lock, Visibility, Bring to front/back, Hide, Remove).
- **Handles when selected:** Two circular drag handles at points A and B; an optional middle handle if "Middle point" is enabled.
- **Dragging:** Tap-and-drag a handle moves that anchor only. Tap-and-drag the line body (not a handle) moves the whole drawing rigidly.
- **Snap-to-OHLC:** Available via global Magnet mode (off by default). Magnet has two modes — "Weak Magnet" snaps to the nearest OHLC when the cursor is close to a bar; "Strong Magnet" always snaps to the nearest OHLC.

### Special Behaviors / Edge Cases
- Trend lines persist across timeframe changes; anchor times are stored as absolute timestamps so the line still spans the same time range on different timeframes, even when intermediate bars don't exist.
- On zoom, the line scales with the chart's price/time axes; rendered angle changes because the scale changes (price-per-pixel and time-per-pixel are independent).
- By default, drawings are bound to a specific symbol and do NOT persist across symbol changes unless the user enables "Sync drawings across charts" or pins the drawing.
- Holding **Shift** while placing constrains the line to 0°/45°/90° angles (desktop only).

**Sources:**
- TradingView Help — "Trendline drawing tool": https://www.tradingview.com/support/solutions/43000516908-trendline-drawing-tool/
- TradingView Help — "Drawing tools available on TradingView": https://www.tradingview.com/support/solutions/43000482865-drawing-tools-available-on-tradingview/

---

## 2. Horizontal Line

### Placement
- **Desktop:** Single click anywhere on the chart. The line is placed at the y-coordinate of the click and spans the entire visible (and beyond) x-axis.
- **Mobile:** Single tap anywhere on the chart.
- **Anchor points:** 1 anchor (price only — time component is decorative/anchor-for-label-positioning).
- **Preview/ghost:** Yes — a horizontal guideline follows the cursor before commit.

### Default Visual Style
- **Default color:** `#2962FF` blue **(observed)**.
- **Default line style:** Solid.
- **Default thickness:** 1 px.
- **Default opacity:** 100%.
- **Default labels/markers:** Price value label shown at the right end on the price scale (the standard "axis tag"). No text label.

### Settings Panel — Full List of Options
- **Line color** — color picker — default blue `#2962FF` — affects stroke.
- **Line opacity** — slider (0–100%) — default 100%.
- **Line thickness** — dropdown (1 / 2 / 3 / 4 px) — default 1.
- **Line style** — dropdown (Solid / Dashed / Dotted) — default Solid.
- **Show price label on price scale** — toggle — default On — shows the colored price tag on the right axis.
- **Show label** — toggle — default Off — adds a text label on the line.
- **Text** — text input — default empty.
- **Font / Font size / Bold / Italic / Text color** — same set as Trend Line; font default 14 px.
- **Horizontal alignment** — dropdown (Left / Center / Right) — default Right — places the text label.
- **Vertical alignment** — dropdown (Top / Middle / Bottom) — default Top.
- **Background** — toggle + color picker — default Off.
- **Border** — toggle + color picker — default Off.
- **Price** — numeric input — manual price for the anchor.
- **Visibility on timeframes** — multi-checkbox — all on by default.
- **Lock / Disable selection** — toggles — default Off.

### Interaction Behaviors
- **Single tap:** Selects; one drag handle appears at the anchor point.
- **Double tap:** Opens settings.
- **Long press:** Opens context menu.
- **Handles when selected:** A single circular handle at the anchor x; the rest of the line shows a thin "selected" highlight.
- **Dragging:** Dragging anywhere on the line moves it vertically only (price-only). The x-anchor can be moved horizontally by dragging its handle, but this is purely cosmetic for label positioning.
- **Snap-to-OHLC:** Honors Magnet mode for the initial price.

### Special Behaviors / Edge Cases
- Always extends across the entire visible chart and continues to do so when scrolling left/right.
- Survives timeframe changes (price is constant across timeframes).
- Bound per-symbol by default.
- A separate but visually similar tool exists: **Horizontal Ray** — single price anchor that only extends in one direction. Don't confuse these.

**Sources:**
- TradingView Help — "Horizontal line drawing tool": https://www.tradingview.com/support/solutions/43000516927/
- TradingView Help — "Drawing tools available on TradingView": https://www.tradingview.com/support/solutions/43000482865-drawing-tools-available-on-tradingview/

---

## 3. Vertical Line

### Placement
- **Desktop:** Single click. Line is placed at the x-coordinate (time) of the click and spans the full y-axis.
- **Mobile:** Single tap.
- **Anchor points:** 1 anchor (time only).
- **Preview/ghost:** Yes — vertical guideline follows the cursor.

### Default Visual Style
- **Default color:** `#2962FF` blue **(observed)**.
- **Default line style:** Solid.
- **Default thickness:** 1 px.
- **Default opacity:** 100%.
- **Default labels/markers:** Time value tag shown at the bottom on the time scale.

### Settings Panel — Full List of Options
- **Line color** — color picker — default blue — affects stroke.
- **Line opacity** — slider — default 100%.
- **Line thickness** — dropdown (1 / 2 / 3 / 4) — default 1.
- **Line style** — dropdown (Solid / Dashed / Dotted) — default Solid.
- **Show time label on time scale** — toggle — default On — shows a colored tag on the bottom (time) axis.
- **Show label** — toggle — default Off.
- **Text / Font / Font size / Bold / Italic / Text color / Background / Border** — same shared label block as above. Font default 14 px.
- **Horizontal alignment** — dropdown (Left / Center / Right) — default Center (about the line itself).
- **Vertical alignment** — dropdown (Top / Middle / Bottom) — default Top — places label near top of chart.
- **Date / Time** — date+time input — manual anchor.
- **Visibility on timeframes** — multi-checkbox — all on.
- **Lock / Disable selection** — toggles — default Off.

### Interaction Behaviors
- **Single tap:** Selects; one handle appears at the anchor.
- **Double tap:** Opens settings.
- **Long press:** Context menu.
- **Handles when selected:** One circular drag handle (typically rendered near the middle of the visible vertical extent).
- **Dragging:** Drag anywhere along the line to translate it horizontally (time-only). Cannot be moved vertically (price has no meaning).
- **Snap-to-OHLC:** N/A for the time axis directly, but Magnet snaps the time component to the nearest bar.

### Special Behaviors / Edge Cases
- Always spans the entire visible price range.
- Anchor is stored as an absolute timestamp; on lower timeframes it lands inside the corresponding bar.
- On weekend/holiday gaps for stock symbols, the line is rendered at the nearest available bar.
- Bound per-symbol by default.

**Sources:**
- TradingView Help — "Vertical line drawing tool": https://www.tradingview.com/support/solutions/43000516945/
- TradingView Help — "Drawing tools available on TradingView": https://www.tradingview.com/support/solutions/43000482865-drawing-tools-available-on-tradingview/

---

## 4. Fib Retracement

### Placement
- **Desktop:** Click at the start (swing point A), drag or move to the end (swing point B), click to commit. Two-click placement; mid-placement preview shows the levels in real time.
- **Mobile:** Tap at A, tap at B (or tap-drag).
- **Anchor points:** 2 anchors (A = 0% or 100% depending on direction, B = the opposite). Levels are computed automatically between.
- **Preview/ghost:** Yes — full level grid renders live during placement.

### Default Visual Style
- **Default trend line:** Light gray, 1 px, solid.
- **Default level lines:** 1 px solid; each level has its own color (see below).
- **Default opacity:** 100% for lines, ~25% (0.25 alpha) for background fills between adjacent levels.
- **Default labels:** Each level shows its ratio (e.g. `0.618`) and its corresponding price (e.g. `0.618 (41250.50)`), placed on the right side by default.

### Settings Panel — Full List of Options

**Levels (defaults shown — there are 24 configurable level rows total in TradingView's panel, of which the following 11 are visible by default):**

| Level   | Default visible | Default line color                  |
|---------|-----------------|-------------------------------------|
| 0       | ✅              | `#787B86` (gray)                    |
| 0.236   | ✅              | `#F44336` (red)                     |
| 0.382   | ✅              | `#81C784` (light green)             |
| 0.5     | ✅              | `#4CAF50` (green)                   |
| 0.618   | ✅              | `#009688` (teal)                    |
| 0.786   | ✅              | `#64B5F6` (light blue)              |
| 1       | ✅              | `#787B86` (gray)                    |
| 1.272   | ❌ (hidden)     | `#2962FF` (blue)                    |
| 1.414   | ❌ (hidden)     | `#F23645` (dark red)                |
| 1.618   | ✅              | `#2962FF` (blue)                    |
| 2.618   | ✅              | `#F23645` (dark red)                |
| 3.618   | ✅              | `#9C27B0` (purple)                  |
| 4.236   | ✅              | `#E91E63` (pink)                    |
| 0.114, 0.214, 0.5, 0.886, 1.13, 2.0, 2.272, 3.14, 4.5 | ❌ (hidden), user-configurable rows | gray defaults |

(Colors are TradingView's defaults as observed in the web app; treat the exact hex values above as approximate — match by eye in your UI if you want pixel-parity.)

**Per-level controls (each row):**
- **Visibility checkbox** — toggle — visibility per the table above.
- **Ratio** — numeric input — editable.
- **Color** — color picker — defaults per the table.
- **Line width** — dropdown (1 / 2 / 3 / 4) — default 1.
- **Line style** — Solid / Dashed / Dotted — default Solid.

**Global Style settings:**
- **Trend line** — toggle (visible) + color picker + width + style — default On, gray, 1 px, solid. Toggles the line drawn between the two anchors.
- **Background** — toggle — default On — fills the bands between consecutive visible levels with a low-alpha version of each level's color.
- **Background transparency** — slider (0–100) — default ~80 (i.e. 20% opacity fill).
- **Labels position** — dropdown (Left / Right) — default Right.
- **Levels-based color** — toggle — default On — uses the per-level color for both the line and its label.
- **Show prices** — toggle — default On — appends price next to each ratio in the label.
- **Show level values** — toggle — default On — shows the ratio number (`0.618`).
- **Show prices for levels** — toggle — default On.
- **Reverse** — toggle — default Off — flips 0% and 100% (i.e. swap top/bottom anchors).
- **Extend lines left** — toggle — default Off.
- **Extend lines right** — toggle — default Off.
- **Font / Font size / Bold / Italic / Text color** — label typography. Font default 12 px.
- **Coordinates** — Price1/Bar1 + Price2/Bar2 numeric inputs.
- **Visibility on timeframes** — multi-checkbox.
- **Lock / Disable selection** — default Off.

### Interaction Behaviors
- **Single tap:** Selects. Two anchor handles appear (at A and B), plus level rows highlight in their colors.
- **Double tap:** Opens settings.
- **Long press:** Context menu.
- **Handles:** Two large circular handles at points A and B.
- **Dragging:** Dragging an anchor recomputes all levels live. Dragging the body translates the whole grid (preserves the A–B vector).
- **Snap-to-OHLC:** Honors Magnet mode (recommended On for swing-high/low placement).

### Special Behaviors / Edge Cases
- 24 configurable rows total; users can replace any ratio with a custom one. Hidden rows still exist and are persisted with the drawing.
- The 0% and 100% endpoints follow the anchors; all other levels are interpolated/extrapolated linearly from the A–B price range.
- On log price scales the levels remain priced linearly (level lines are NOT remapped to log) unless the chart itself is in log mode and the user explicitly enables "Use log scale" in level math — TradingView's default math is linear.
- Persists across timeframe changes (anchors are absolute time + price).
- Bound per-symbol unless pinned.

**Sources:**
- TradingView Help — "Fib retracement drawing tool": https://www.tradingview.com/support/solutions/43000516884/
- TradingView Help — "Drawing tools available on TradingView": https://www.tradingview.com/support/solutions/43000482865-drawing-tools-available-on-tradingview/

---

## 5. Gann Box

### Placement
- **Desktop:** Click at first corner (top-left), move to opposite corner (bottom-right), click again. Two-click placement with live preview of the entire grid and diagonals.
- **Mobile:** Tap at corner 1, tap at corner 2 (or tap-drag).
- **Anchor points:** 2 anchors that define the diagonally-opposite corners of the box.
- **Preview/ghost:** Yes — the full grid (levels + angles) renders live.

### Default Visual Style
- **Default box outline:** Light gray, 1 px solid.
- **Default level lines:** 1 px solid, color per level (below).
- **Default diagonal/angle rays:** 1 px solid, color per angle.
- **Default opacity:** Lines 100%; fills (if any) ~20–25%.
- **Default labels:** Each level shows its ratio (e.g. `0.5`); each angle shows its ratio (e.g. `1/1`).

### Settings Panel — Full List of Options

**Levels tab (price levels — horizontal dividers within the box):**

| Level   | Default visible | Default color                |
|---------|-----------------|------------------------------|
| 0       | ✅              | `#787B86` (gray)             |
| 0.25    | ✅              | `#F44336` (red)              |
| 0.382   | ✅              | `#81C784` (light green)      |
| 0.5     | ✅              | `#4CAF50` (green)            |
| 0.618   | ✅              | `#009688` (teal)             |
| 0.75    | ✅              | `#64B5F6` (light blue)       |
| 1       | ✅              | `#787B86` (gray)             |

(Additional level rows are available for custom ratios; default 7 levels visible. Confirmed by TradingView tutorials enumerating `0.25, 0.382, 0.5, 0.618, 0.75`.)

Per level: **Visibility toggle**, **Ratio (numeric)**, **Color**, **Line width** (1/2/3/4 px, default 1), **Line style** (Solid/Dashed/Dotted, default Solid).

**Angles tab (diagonal rays through the box):**

| Angle (price:time) | Default visible | Default color           |
|--------------------|-----------------|-------------------------|
| 1/8                | ❌              | gray                    |
| 1/4                | ❌              | red                     |
| 1/3                | ❌              | orange                  |
| 1/2                | ✅              | yellow / green          |
| 1/1                | ✅              | `#2962FF` blue (primary diagonal) |
| 2/1                | ✅              | green                   |
| 3/1                | ❌              | orange                  |
| 4/1                | ❌              | red                     |
| 8/1                | ❌              | gray                    |

(Defaults: 1/2, 1/1, 2/1 visible. 1/1 is the principal Gann angle.)

Per angle: **Visibility**, **Color**, **Width**, **Style**, **Reverse** toggle (mirrors the angle).

**Style tab — global controls:**
- **Show levels** — toggle — default On.
- **Show angles** — toggle — default On (for the three default-visible angles).
- **Show labels** — toggle — default On — renders ratio labels next to each level/angle.
- **Background fill** — toggle — default Off — fills the bands between adjacent visible levels with low-alpha color.
- **Background color** — color picker — default light gray.
- **Reverse** — toggle — default Off — flips level 0 and 1.
- **Font / Font size / Bold / Italic / Text color** — typography. Font default 12 px.
- **Coordinates** — Price1/Bar1 + Price2/Bar2 numeric inputs.
- **Visibility on timeframes** — multi-checkbox.
- **Lock / Disable selection** — default Off.

### Interaction Behaviors
- **Single tap:** Selects; corner anchors visible.
- **Double tap:** Opens settings.
- **Long press:** Context menu.
- **Handles:** Two circular handles at the two diagonally-opposite anchor corners. Some builds expose a third (mid-edge) handle for re-proportioning.
- **Dragging:** Anchor handle resizes the box. Body drag translates the whole box. The diagonals and level grid update in real time.
- **Snap-to-OHLC:** Honors Magnet mode for initial corner placement.

### Special Behaviors / Edge Cases
- Time/price grid: levels are evenly spaced in price between the two anchor prices (using the level ratios); angles are computed from the box's diagonal as the 1/1 reference, with 1/2 angles half-rising-per-unit-time and 2/1 angles double-rising-per-unit-time.
- On log price scales, level spacing remains linear in price by default.
- Persists across timeframe changes.
- Bound per-symbol.

**Sources:**
- TradingView Help — "Gann box drawing tool": https://www.tradingview.com/support/solutions/43000516159-gann-box/
- TradingView Help — "Drawing tools available on TradingView": https://www.tradingview.com/support/solutions/43000482865-drawing-tools-available-on-tradingview/

---

## 6. Long Position

### Placement
- **Desktop:** Click at the **Entry** price/bar, then click again at the **Stop** price/bar; the **Target** is auto-placed at the default risk/reward distance (default R:R = 2 in TradingView). Some builds use a three-click flow: Entry → Stop → Target.
- **Mobile:** Same — tap entry, tap stop; target placed at default R/R, then all three handles are draggable.
- **Anchor points:** 3 — Entry (price + start bar), Stop (price, below entry for Long), Target (price, above entry for Long). The horizontal extent is defined by the entry bar and an end bar (the right edge of the colored zones).
- **Preview/ghost:** Yes — the green target zone and red stop zone render live during placement.

### Default Visual Style
- **Entry line:** White/gray dashed horizontal segment at entry price, with a price tag.
- **Stop zone:** Filled rectangle between Entry and Stop prices, **red** with ~30% opacity. Outline ~1 px red.
- **Target zone:** Filled rectangle between Entry and Target prices, **green** with ~30% opacity. Outline ~1 px green.
- **Default thickness:** 1 px outlines.
- **Default opacity:** ~30% fill, 100% outlines and labels.
- **Default labels:** Two info tags by default —
  - Target tag (top): `Profit: $XXX (X.XR)` — e.g., `Profit: 2,000.00 USD (2.00 R, 2.00%)`.
  - Stop tag (bottom): `Loss: $XXX (X.XR)`.
  - Entry tag (middle): shows entry price and position size (Qty).

### Settings Panel — Full List of Options

**Inputs (calculation):**
- **Account size** — numeric input — default `1,000,000` (TradingView's published default for the long/short position tool) — used to compute position size and PnL percentages.
- **Lot size** — numeric input — default `1` — multiplier for the quantity (use this for futures contract size).
- **Risk** — numeric input with % toggle — default `1.00%` of account — defines max loss the calculator targets at stop.
- **Entry Price** — numeric input — auto-filled from the entry anchor.
- **Leverage** — numeric input — default `1` — divides margin used.
- **Profit Level** — numeric input (ticks or price) — auto-filled from target anchor.
- **Stop Level** — numeric input (ticks or price) — auto-filled from stop anchor.
- **Ticks** — toggle — default Off — display profit/stop as ticks instead of price.

**Computed (read-only displays):**
- **Quantity (Qty)** — derived as `Risk / (Entry − Stop)`.
- **Risk/Reward ratio** — derived from target distance ÷ stop distance.
- **PnL at target** — `(Target − Entry) × Qty`.
- **PnL at stop** — `(Stop − Entry) × Qty` (negative).
- **Distances** — in price, %, ticks.

**Style:**
- **Stop level color (fill)** — color picker — default red `#F44336` with low alpha — affects stop zone fill.
- **Stop level border** — color picker + width — default red, 1 px — outlines the stop band.
- **Profit level color (fill)** — color picker — default green `#26A69A` (TradingView green) — target zone fill.
- **Profit level border** — color + width — default green, 1 px.
- **Entry line color** — color picker — default white/gray dashed — entry separator.
- **Entry line style** — Solid / Dashed / Dotted — default Dashed.
- **Risk/reward labels visibility** — toggle — default On.
- **Compact stats mode** — toggle — default Off — shortens labels (e.g. `+$2,000`).

<!-- TRUNCATED: Section 6 (Long Position) is partial — Style section ends mid-spec; Interaction Behaviors and Special Behaviors / Edge Cases still missing.
Pending sections (Claude Remote is producing these now):
  - Rest of Section 6 — Long Position (Style continued, Interaction Behaviors, Special Behaviors / Edge Cases)
  - Section 7 — Short Position
  - Section 8 — Text Label
  - Section 9 — Brush
  - Section 10 — Rectangle
This file will be appended to when Claude Remote completes the research. -->
