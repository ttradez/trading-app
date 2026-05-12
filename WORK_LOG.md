# Pocket Trade — Work Log

Running record of completed tasks, ordered newest first. Each entry should
note what shipped, what files changed, and what was deferred.

---

## 2026-05-12 — Onboarding screen 2: center content + replace lone candle with bearish row

Two tweaks per user feedback after the visual-upgrade smoke test.

### 1. Vertical centering
- Removed the fixed 80 px `topSpacer` and added
  `justifyContent: 'center'` to `styles.content`.
- Hero "95%" + supporting headline + body block now centers in the
  space ABOVE the CTA (the CTA lives outside the flex container so it
  remains anchored at the bottom).
- Result: balanced layout, no dead space below the body.

### 2. Lone candle → bearish row
Picked **option A (row)** — the additional code over the lone candle
was small (one component, one prop), and the row reads as deliberate
where a single candle read as a bug.

- Deleted `CandleSilhouette` (single off-frame candle).
- New `BearishCandleRow({ width })` — inline `react-native-svg`, 6
  candles, heights `[44, 38, 32, 36, 26, 20]` (downtrend + one
  retrace). Each candle: 18 px body + 6 px upper wick + 4 px lower
  wick, brand red `#FF4757`.
- Row width pulled from `useWindowDimensions()` so it spans full
  screen on any device.
- Positioned `position: absolute, bottom: 0, left/right: 0`; opacity
  driven by `Animated.multiply(bgOpacity, 0.07)` (so the existing
  300 ms fade-in on mount still works, and the resting opacity sits
  in the 6-8% target band).
- z-index layering: `candleRow` z 0, `content` z 1, `ctaWrap` z 2 (+
  matching `elevation` for Android). The opaque gold button hides the
  section of the row directly beneath it; the wick tips peek above
  the button's top edge and to its sides.
- `pointerEvents="none"` — pure decoration, never blocks the CTA.

### Files touched
- `src/screens/OnboardingPremiseScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-12 — Onboarding screen 2: visual upgrade — hero 95% with tick-up + bg candle

Visual upgrade to The Premise — copy unchanged, layout transformed.
The "95%" becomes the visual anchor; everything else supports it.

### What shipped (`src/screens/OnboardingPremiseScreen.tsx`)
- **Hero number** — 150 px gold (`#FFB800`), bold, tabular-nums so the
  width stays stable while counting. Animated tick-up from `0` to `95`
  over **1200 ms** with `Easing.out(Easing.cubic)` after a **200 ms**
  delay. The `%` sign renders static beside the number at 80 px.
- **Supporting headline** — was the headline; now 23 px bold white,
  centered: *"of new traders blow their account in their first year."*
- **Body** (copy identical) — 17 px regular white 0.85, line-height 26
  (~1.5×).
- **Background candle silhouette** — inline `react-native-svg`
  (`<Line>` wick + `<Rect>` body + `<Line>` wick), brand red
  (`#FF4757`) at **8% opacity** via `Animated.multiply(bgOpacity, 0.08)`.
  Positioned `right: -30, bottom: 110` so it reads as "falling out of
  frame." `pointerEvents="none"` — it's texture, not a control.
- **CTA** — unchanged ("I'm in", gold, 56 px, 12 px radius, light
  haptic, safe-area-aware).

### Entrance timeline (built with `Animated.parallel` + `Animated.sequence`)
- **t=0** → candle fades in (300 ms).
- **t=200 ms** → counter ticks 0 → 95 (1200 ms, ease-out cubic).
- **t=1500 ms** → supporting headline + body fade in (350 ms).

### Driver split
- Candle opacity + text opacity → **native driver**.
- Counter value → **JS driver** (its `addListener` updates `displayed`
  state, which can't run on the native thread). The animations don't
  conflict — `Animated.parallel` accepts a mix.

### Dependencies
No new packages. `react-native-svg` was already a dep (used by
`DashboardCharts` + `DrawingFavoritesBar`). `expo-haptics` was already
a dep.

### Files touched
- `src/screens/OnboardingPremiseScreen.tsx` (rewritten — was already
  the real screen as of `c8bde16`; this layers in the hero + bg
  candle + staggered timeline).
- `WORK_LOG.md`

---

## 2026-05-12 — Onboarding screen 2: The Premise

Per `docs/ONBOARDING_RETENTION_RESEARCH.md` §D2 (fear-naming / trust-
building) — be honest about how hard trading is. Competitors won't say
this; we do.

### What shipped
- **`src/screens/OnboardingPremiseScreen.tsx`** — was the "Screen 2
  placeholder"; now the real screen:
  - Pure black `#000000` bg (brand-locked).
  - Headline (bold 34px, line-height 41, letter-spacing -0.5):
    *"95% of new traders blow their account in their first year."*
  - Body (regular 19px, line-height 27, white at 0.85 opacity for
    hierarchy beneath the bold headline):
    *"You're not weak for being nervous. You're smart."*
    *"Pocket Trade is where you fail 1,000 times — without losing a dollar."*
  - Text block vertically centered with 32 px horizontal padding.
  - 400 ms fade-in via `Animated.Value` on mount. No other motion.
  - Single gold CTA pinned to the bottom (24 px gutters, 56 px tall,
    12 px radius, `#FFB800` bg, `#000000` bold 17px text, "I'm in").
  - Safe-area-aware bottom padding via `useSafeAreaInsets()`.
  - `Haptics.impactAsync(Light)` on press (expo-haptics already in deps).
  - `accessibilityRole="button"` + `accessibilityLabel="I'm in"`.
- **`src/screens/OnboardingArchetypeScreen.tsx`** (new) — placeholder
  "Screen 3 placeholder" on pure black, white bold. Lands here on tap
  of "I'm in".
- **`App.tsx`** — added `OnboardingArchetype` to the imports and the
  `FORCE_ONBOARDING_FLOW` stack. Set `gestureEnabled: false` on both
  `OnboardingPremise` and `OnboardingArchetype` so iOS edge-swipe can't
  retreat through the funnel (the user's first real choice is "I'm in"
  — they don't get to undo it via gesture).

### Out of scope (deliberate)
- Screen 3 logic beyond the placeholder.
- Skip button (this screen is mandatory).
- Localization, analytics events.

### Verified
- Type-check clean.
- Flow wired: splash → premise → archetype-placeholder.

### Files touched
- `src/screens/OnboardingPremiseScreen.tsx` (rewritten)
- `src/screens/OnboardingArchetypeScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

---

## 2026-05-12 — Brand standard: pure black backgrounds + white bold text + clean sans-serif

User feedback after screen-1 smoke test: app backgrounds are **pure
black `#000000`** (NOT navy `#0A0E1A`). Text is **white `#FFFFFF`,
bold default**. Font is a **clean modern sans-serif (Inter preferred,
system fallback)**. The brand accents (gold `#FFB800`, gain green
`#00D395`, loss red `#FF4757`) are locked.

PROJECT_CONTEXT.md had already documented the accent palette correctly
but the code drifted (theme used `#D4AF37` / `#22C55E` / `#EF4444`).
This commit makes code match doc, plus the navy → pure-black flip.

### Token changes (`src/theme/index.ts`)
- `gold: '#D4AF37'` → **`'#FFB800'`**
- `green: '#22C55E'` → **`'#00D395'`**
- `red: '#EF4444'` → **`'#FF4757'`**
- `textInverse: '#0A0E1A'` → **`'#000000'`** (text-on-gold-buttons)
- `rankMarketMaker: '#D4AF37'` → **`'#FFB800'`** (consistency with gold accent)
- Font comment updated to mention Inter preference + system fallback.
  `font.sans` / `font.sansBold` still resolve to `'System'` (San Francisco
  on iOS, Roboto on Android) until Inter is bundled via `expo-font`.

### Onboarding bg flipped to pure black
- `src/screens/OnboardingSplashScreen.tsx`: `ONBOARDING_BG '#0A0E1A'` → `'#000000'`
- `src/screens/OnboardingPremiseScreen.tsx`: same flip; placeholder text
  bumped to `fontWeight: '700'` (brand default bold).
- `App.tsx`: onboarding `contentStyle.backgroundColor '#0A0E1A'` → `'#000000'`
- Logo now blends seamlessly with the app bg (no navy edge around the
  logo card).

### Chart semantic colors (`src/components/chart/TradingChart.tsx`)
- `DEFAULT_CHART_THEME`: `upColor`, `downColor`, `slColor`, `tpColor`
  swapped to brand greens/reds.
- Inline pnl text fill: `#22C55E` / `#EF4444` → `#00D395` / `#FF4757`.

### Out of scope (deliberately untouched)
- `CHART_THEME_PRESETS` — user-pickable alt themes; not the brand default.
- `ChartSettingsModal` / `DrawingSettingsModal` user-pickable swatch
  palettes — these are intentional color choices, not brand tokens.
- `JournalScreen` mood-tag colors and `utils/ranks.ts` rank colors —
  semantic-but-narrow, not the brand-accent role. Leaving for now to
  avoid scope creep; can sync in a follow-up if requested.
- `theme/index.ts` `greenDim` / `redDim` / `goldDim` — companion dimmed
  variants; values left as-is.

### Verified
- `grep -rn "#0A0E1A" src App.tsx` → no matches. Navy is gone from code.
- Type-check clean.

### Files touched
- `src/theme/index.ts`
- `src/components/chart/TradingChart.tsx`
- `src/screens/OnboardingSplashScreen.tsx`
- `src/screens/OnboardingPremiseScreen.tsx`
- `App.tsx`
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-12 — Onboarding screen 1: logo splash + FORCE_ONBOARDING_FLOW boot-into-onboarding

Kicking off the 12-screen onboarding rebuild. Source of truth for design
decisions: `docs/ONBOARDING_RETENTION_RESEARCH.md` (user is dropping the
file in next).

### What shipped
- **`src/screens/OnboardingSplashScreen.tsx`** — full-screen `#0A0E1A`
  background, centered `assets/logo.png` (240×240, contain), 300 ms
  fade-in via `Animated.Value`, auto-advances to `OnboardingPremise`
  after 1500 ms total. No skip button (per research D1).
- **`src/screens/OnboardingPremiseScreen.tsx`** — placeholder "Screen 2
  placeholder" with the same dark `#0A0E1A` background. Real content in
  the next prompt.
- **`App.tsx`** — extended the existing `FORCE_ONBOARDING_FLOW` dev flag
  (added in `9c4116f`). When true, the App component now short-circuits
  BEFORE the loading-splash / disclaimer / auth gates and returns an
  onboarding-only stack with `initialRouteName: 'OnboardingSplash'`.
  Reload Expo Go → splash → 1.5 s → premise placeholder. With the flag
  false, the existing flow (loading splash + disclaimer + auth gates +
  `AccountSetup` / `Login` / `FeatureTour` / `MainTabs`) is unchanged.

### Flag location
[`App.tsx`](App.tsx) line 31:
```ts
const FORCE_ONBOARDING_FLOW = true;
```

### Out of scope (deliberate)
- Screen 2 content (placeholder only)
- Other onboarding screens (next prompts)
- Real logo asset creation (using existing `assets/logo.png`)
- Sound / complex animations / analytics events

### Files touched
- `src/screens/OnboardingSplashScreen.tsx` (new)
- `src/screens/OnboardingPremiseScreen.tsx` (new)
- `App.tsx` (FORCE_ONBOARDING_FLOW short-circuit + 2 imports)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-12 — Add FORCE_ONBOARDING_FLOW dev flag to bypass auto-login

Onboarding work needs the welcome / sign-up / feature-tour screens
visible, but Firebase's AsyncStorage persistence (configured in
`src/services/firebase.ts` via `getReactNativePersistence`) auto-signs
returning users back in on app launch, routing them straight to
`MainTabs`.

### Implementation
Single boolean at the top of [App.tsx](App.tsx) — `FORCE_ONBOARDING_FLOW`,
defaulting to `true`. Inside the existing `onAuthStateChanged` listener,
when the flag is true and Firebase emits a persisted user, we call
`signOut(auth)` and return early — the second emission fires with
`user=null`, falls into the existing `!user` branch, and the app boots
into the onboarding stack (`AccountSetup` / `Login` / `FeatureTour`).

No deletion / refactor of the auto-login path. With the flag set
`false`, the listener runs exactly as before.

### Files touched
- `App.tsx` — flag constant (lines 31–37 area) + signOut import + 6-line
  interception inside the auth listener.
- `WORK_LOG.md`

### Flip when shipping
Toggle `FORCE_ONBOARDING_FLOW = false` in `App.tsx` to restore normal
auto-login behavior for returning users.

---

## 2026-05-12 — TradingView Advanced Charts application SUBMITTED

Application went in today. Now in TradingView's 3–10 business day
review queue.

### Submission details (for reference if TradingView reaches out)
- Product: **TradingView Advanced Charts** (private GitHub repo access)
- Signatory: **Zachary James Titus**
- Contact email: **ben@sitesbyben.ca**
- Website URL submitted: **https://pockettrade.sitesbyben.ca**

### Critical follow-up
The submitted URL must actually load when TradingView reviews —
**user is building the landing page on Lovable now** and will deploy
to the `pockettrade.sitesbyben.ca` subdomain. If TradingView hits a
404 / parked page when they review, the application may be rejected.

### Status flip in PROJECT_CONTEXT.md
"application pending submission" → "application SUBMITTED — awaiting
3–10 business day approval response."

### While waiting
Next task picks from: deploy Lovable site, start News button
(Forex Factory), or another non-drawings feature. Drawing-related work
stays paused.

### Files touched
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-12 — Pause custom drawing work — switching to TradingView Charting Library

**Decision:** retire the custom SVG drawing system. User has applied for
the **TradingView Charting Library** (3-10 business days for approval)
and will use its built-in drawing tools instead.

### Why
The custom system kept failing on the surface area we needed:
- Tap-anywhere placement broken (could only place on candles)
- Drawings couldn't be tapped + dragged
- No double-tap → settings panel
- The full rebuild from spec (`docs/TRADINGVIEW_REFERENCE.md`) was on
  course but each step introduced new regressions. Cumulative ROI of
  keeping the homegrown system below the cost of swapping to a vetted
  library purpose-built for this.

### Snapshots
- **`pre-charting-library-switch`** — current state, immediately before
  the switch. Recover with `git checkout pre-charting-library-switch`.
- **`drawings-before-reset`** — pre-reset implementations (trendline +
  horizontal_line TradingView-parity v1 etc.).
- **`feature/klinechart-spike`** branch — earlier attempted swap to
  KLineChart Pro, parked.

DO NOT delete any of those — they may inform the new-library migration.

### What's preserved in code
The custom drawing files stay on disk (no deletion yet) until the new
library is in hand and we can verify the migration plan. Specifically:
- `src/types/drawings.ts`
- `src/store/drawingsStore.ts`
- `src/components/chart/TradingChart.tsx` (the SVG-overlay + touch
  dispatcher portions)
- `src/components/chart/DrawingFavoritesBar.tsx`
- `src/components/chart/DrawingSettingsModal.tsx`
- `src/components/chart/DrawingToolbar.tsx`
- `src/components/chart/MagnetToggle.tsx`
- `docs/TRADINGVIEW_REFERENCE.md`
- `docs/MOBILE_DRAG_RESEARCH.md`
- `docs/BLOCK_17_DRAWING_TOOLS_SPEC.md`
- `docs/DRAWING_TOOLS_AUDIT.md`

### While waiting for approval
Pivoting to: news data source, trade card polish, Firebase walkthrough,
ToS / Privacy markdown, logo placeholder, beta test plan. No
drawing-related work.

### Files touched (this commit)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-11 — Step 1.5 follow-ups: revert z-order + remove banner

User reported "can't place a drawing now" and "banner comes off the top
of my screen, I don't want it." Two commits walked back the most-recent
changes that broke things or annoyed:

### `3530654` — Revert Fix A (drawings back on top of candles)
The previous split (`#drawings-below` z 1 / `#chart` z 2 / `#overlay` z 9999)
correctly stacked drawings below the chart in the DOM, but
lightweight-charts paints an **opaque** background canvas
(`layout.background.color = #000000`) as the bottom of its internal
canvas stack. Net effect: drawings at z 1 sat behind that opaque bg
canvas — completely invisible. Placement was working all along; the
line just couldn't be seen.

True "drawings between bg and candles" needs the lightweight-charts
**Primitives API**, which v4.1.3 doesn't expose (added in 4.2 / 5.x).
To revisit "behind candles" we'd have to upgrade the chart library or
run a custom canvas inside lightweight-charts's render stack — both
much bigger changes than this step. Until then, drawings render above
candles; the "lines cut through candle bodies" tradeoff is accepted.

### `502cbaa` — Remove PlacementBanner entirely
The "PLACING HORIZONTAL LINE" pill at `top: 8` was hitting the device's
status-bar / notch area on some phones, reading as a stray UI artifact.
The favorites-bar pill already turns gold when the tool is active,
which is enough placement-mode indication. Killed
`src/components/chart/PlacementBanner.tsx`, the import in
`TradingScreen.tsx`, and its render call. If we ever want a placement
indicator again, the gold-pill state already does it without occupying
extra screen real estate.

### Files touched
- `src/components/chart/TradingChart.tsx` (z-order revert)
- `src/components/chart/PlacementBanner.tsx` (deleted)
- `src/screens/TradingScreen.tsx` (removed import + render)

---

## 2026-05-11 — Horizontal Line: step 1.5 (z-order + icon fix)

Two small fixes before step 2.

### Fix A — render behind candles (`513fb4e`)
Drawings used to render on top of candles because the overlay SVG had
`z-index: 9999` and held `drawingsLayer` alongside the pending-order
elements. Lines visibly cut through candle bodies.

Split the overlay into two SVGs by z-index:
- `#drawings-below` (z 1): `plotClip` + `drawingsLayer`. Drawings paint
  here, beneath the chart canvas.
- `#chart` (z 2): lightweight-charts canvases (`position: relative` +
  `z-index: 2` stacks above `#drawings-below`).
- `#overlay` (z 9999): `hitBg` + `pendingLayer`. Pending order pills,
  hit targets, banners still paint above candles.

`document.getElementById('drawingsLayer')` and `'plotClipRect'` keep
resolving — IDs are unique across the document regardless of which SVG
holds them.

**Architectural flag:** when selection / hit areas come back (step 2+),
touch listeners need to attach to `#drawings-below` too. Currently
they're only on `#overlay`, which is fine for step 1 (drawings have
`pointer-events: 'none'`).

### Fix B — replace ambiguous icon (commit below)
**Diagnosis of the "floating '−' pill":** it's the `DrawingFavoritesBar`
positioned at `top: 56, alignItems: center` with a dark
`rgba(15,15,18,0.85)` background and rounded corners — showing one tool
(`horizontal_line`) via Ionicons `remove-outline`, which is visually
indistinguishable from a minus glyph. Intentional UI (the placement
entry point), but unrecognizable.

Fix: render a custom inline SVG icon (`horizontal line + anchor dot at
the left end`) for `horizontal_line` per the step 1 spec. Other tools
keep their Ionicons mapping via a new `ToolIcon` shim that falls back
to `TOOL_BY_ID[id].icon`. `react-native-svg` was already a dependency
(used by `DashboardCharts.tsx`).

### Files touched
- `src/components/chart/TradingChart.tsx` (z-order split)
- `src/components/chart/DrawingFavoritesBar.tsx` (`ToolIcon` shim)

---

## 2026-05-11 — Horizontal Line: step 1 (placement + render)

First tool back online post-reset. Step 1 scope is intentionally tight:
placement + render + persistence only. Selection, drag, settings, delete,
long-press are all explicitly out of scope and will arrive in later
steps. Spec: `docs/TRADINGVIEW_REFERENCE.md` §2.

### What shipped
- **Type registry** (`src/types/drawings.ts`):
  - `DrawingType` union extended with `'horizontal_line'`.
  - `TOOL_CATALOG` row added: label "Horizontal line", icon
    `remove-outline`, category `lines`, `pointsRequired: 1`,
    `drawable: true`.
  - New `HLINE_DEFAULT_STYLE`: `#2962FF`, `lineWidth: 1`, solid,
    full opacity.
- **Default style switch** (`TradingChart.tsx` `handleDrawingPoint`):
  picks `HLINE_DEFAULT_STYLE` when the tool is `horizontal_line`;
  everything else still uses `DEFAULT_STYLE`.
- **Render branch** (`TradingChart.tsx` `renderDrawings`):
  new `if (d.type === 'horizontal_line')` block. Reads anchor from
  `points[0]`, projects via `timeToCoordinate` + `priceToCoordinate`,
  draws an SVG line from `max(0, anchorX)` to the chart's right edge.
  Anchor before view → renders from `x=0` so the price level stays
  visible; anchor after view → skips entirely (line hasn't begun yet
  from POV). `pointer-events: 'none'` — no hit area, no selection
  capture in step 1.
- **Placement banner** (`PlacementBanner.tsx`):
  `BANNER_LABELS.horizontal_line = 'PLACING HORIZONTAL LINE'`. Banner
  lights up while the tool is active.
- **Default favorites** (`drawingsStore.ts`):
  `new Set(['horizontal_line'])` so the icon appears in the favorites
  bar on first launch without requiring a favorites-toggle UI.

### Re-render plumbing (already in place from reset)
- `chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleRender)`
  — re-renders on pan/zoom.
- `priceProjectionTick` rAF — re-renders on price-scale shifts when no
  drag is in flight.
- `drawingsStore.persistDrawings` writes to AsyncStorage (`@pocket_trade_drawings_v2`)
  on every change; `hydrate()` restores on mount.

### Explicitly NOT shipped (per step 1 prompt)
- Selection (no handles on tap, no highlight, no drawing_select postBack triggered)
- Body or handle drag
- Double-tap → settings panel
- Color / style customization (defaults only — no settings panel branches)
- Delete, duplicate, long-press menu

Taps on an existing horizontal line are a no-op in step 1: the visible
line has `pointer-events: 'none'`, so touches fall through to the chart
canvas (which just pans normally).

### Files touched
- `src/types/drawings.ts`
- `src/components/chart/TradingChart.tsx`
- `src/components/chart/PlacementBanner.tsx`
- `src/store/drawingsStore.ts`

### Architectural notes
- The render branch reads `lineWidth`, `lineStyle`, `strokeOpacity` from
  `drawing.style` (the framework's existing shape), with the user-facing
  data-model concepts (color, lineWidth, lineStyle, opacity) all mapped
  one-to-one. Time + price live in `points[0]` per the framework
  convention so future drag steps can mutate uniformly.
- The reset's `void priceTag; void hitRect;` lines still keep those
  helpers from being tree-shaken. The horizontal_line branch doesn't
  use them yet — they'll come back when step 2+ adds price label /
  hit area.

---

## 2026-05-11 — Drawing tools full reset

Single commit. After multiple iterations on trendline + horizontal_line
accumulated bugs, dead code paths, and half-implemented behaviors, we
deleted ALL per-tool implementations and kept only the framework. Each
tool will be rebuilt one at a time from `docs/TRADINGVIEW_REFERENCE.md`
plus upcoming Claude Remote research.

### Backup
- Local git tag `drawings-before-reset` preserves the pre-reset state.
  Push deferred per the prompt ("only if you have push access").

### Deleted (per-tool implementations)
- `src/types/drawings.ts` — TRENDLINE_DEFAULT_STYLE, HLINE_DEFAULT_STYLE,
  FibLevelConfig + FIB_LEVELS + FIB_LEVEL_DEFAULTS + resolveFibLevel.
  DrawingType union narrowed to `'cursor_cross' | 'eraser'` (cursor
  modes only). TOOL_CATALOG holds those two entries — no drawables.
- `src/components/chart/TradingChart.tsx`:
  - All per-tool render branches in `renderDrawings` (trendline,
    horizontal_line, vline, fib_retracement, rectangle, text).
  - Fib helpers: `FIB_LEVELS_ALL`, `FIB_HIDDEN_BY_DEFAULT`,
    `fibLevelEffective`.
  - Per-tool drag math: rectangle corner reshape, horizontal_line
    time-lock (handle drag), horizontal_line x-lock (body drag
    touchmove), horizontal_line dt=0 (body drag touchend commit).
  - Per-tool handle visuals: the `isRich` flag (color-matched
    trendline/horizontal_line handles).
  - Per-tool default style switch in `handleDrawingPoint` — now uses
    generic `DEFAULT_STYLE` for any drawing that gets created.
- `src/components/chart/DrawingSettingsModal.tsx`:
  - All per-tool branches: `isTextual`, `hasFill`, `isFib`,
    `isTrendline`, `isHLine`, `useRichSettings`, `canExtend`,
    `canShowPriceLbl`, `widthOptions`, `palette`, `handleDelete`
    confirm-dialog.
  - Per-tool sections: extend toggles, price-label toggle, fill
    opacity, fib per-level config, text/font controls.
  - Tool-specific palette (`TRENDLINE_COLORS`), fib color cycle.
  - Imports of `FIB_LEVELS`, `FIB_LEVEL_DEFAULTS`, `FibLevelConfig`,
    `TextInput`, `Alert`.
- `src/components/chart/PlacementBanner.tsx` — emptied
  `BANNER_LABELS`. Shell stays.
- `src/store/drawingsStore.ts` — default favorites Set emptied.

### Kept (framework)
- The whole touch dispatcher: handleTap, touchstart/touchmove/touchend
  branches for pendingPosition drag, placementTap, drawingDragState
  (handle drag, transform-only mutation), drawingBodyDrag (transform
  pattern), drawingPan (chart pan fall-through).
- Selection state machine + `drawing_select` / `drawing_deselect`
  postBack flow.
- `chart.subscribeClick` empty-canvas-tap deselect.
- `chart.subscribeCrosshairMove` SHOW/HIDE log + force-clear hook
  (`clearCrosshair()` called from drawing taps).
- `trackingMode.exitMode = OnTouchEnd` chart option.
- Renderer entry points: `renderDrawings()` shell, generic handle
  rendering (one circle per anchor, black-with-white-stroke until a
  tool overrides), generic body-drag wrap-in-`<g>` pattern.
- Generic helpers: `hitLine`, `hitRect`, `dashFor`, `px`, `svg`,
  `priceTag` (kept for future tools; explicitly `void`d so JS doesn't
  tree-shake).
- Settings modal shell: header (hide / duplicate / delete / close),
  Color / Line style / Line width / Line opacity controls,
  `OpacitySlider` (PanResponder-based, no new dep), Lock / Duplicate /
  Delete footer.
- `drawingsStore` API: all CRUD, magnet, sticky, favorites, hydrate,
  duplicateDrawing.
- `DrawingFavoritesBar` (renders null while favorites is empty).
- `PlacementBanner` (renders null while no tool has a label).
- AsyncStorage persistence — STORAGE_KEY and FAV_KEY bumped to `_v2`
  so prior user-drawn data is orphaned cleanly.

### Outside drawings — UNTOUCHED
- Chart engine (lightweight-charts), candles, indicators, sessions,
  replay controller, TP/SL pending order layer, pan/zoom math.
- `docs/TRADINGVIEW_REFERENCE.md` (authoritative spec — preserved).
- All non-drawing screens, navigation, Firebase, IAP, backend.

### Files touched
- `src/types/drawings.ts`
- `src/components/chart/TradingChart.tsx`
- `src/components/chart/DrawingSettingsModal.tsx`
- `src/components/chart/PlacementBanner.tsx`
- `src/store/drawingsStore.ts`
- `PROJECT_CONTEXT.md`

### Architectural flags
- AsyncStorage `_v2` migration is intentionally lossy — prior records
  are not converted; they're just unreachable from the new keys.
- The drag-state `drawingDragState.corner` payload type still exists
  in WebView JS (it's not typed), but nothing constructs it now that
  the rectangle 4-handle path was removed. The branch was deleted in
  touchmove. Future tools that want corner-style drags will re-add it.
- `priceTag` and `hitRect` helpers reference `void` to prevent
  tree-shaking until tools reach for them. Drop the `void` calls
  whenever the first tool re-uses them.

---

## 2026-05-11 — Horizontal Line: 4 follow-up fixes after smoke test

Four issues from smoke test, one commit per issue (in order):

### `b731831` — Issue 1: rename Horizontal Ray → Horizontal Line
User kept the right-only ray behavior but wanted the "Horizontal Line"
label everywhere. Renamed type id `hray` → `horizontal_line`, label
"Horizontal ray" → "Horizontal line", constant `HRAY_DEFAULT_STYLE` →
`HLINE_DEFAULT_STYLE`, banner "PLACING HORIZONTAL RAY" → "PLACING
HORIZONTAL LINE", `isHRay` → `isHLine`, docs/TRADINGVIEW_REFERENCE.md
§2 title back to "Horizontal Line" with a prominent divergence note
(we intentionally differ from TradingView's both-ways behavior).
Second lossy AsyncStorage migration in a row — drawings persisted as
`hray` get filtered out on hydrate (unknown type). Accepted; no
migration shim.

### `37d62bf` — Issue 2: crosshair leak + auto-hide
1. `trackingMode.exitMode = OnTouchEnd` on the chart — the
   lightweight-charts default `OnNextTap` was the "stuck crosshair"
   root cause; finger-up dismisses now.
2. `clearCrosshair()` (wraps `chart.clearCrosshairPosition()`) called
   from every handleTap branch that captures a drawing tap (handle,
   corner, eraser, body select). Defensive belt-and-braces — even if
   a stale crosshair is somehow visible, drawing taps blow it away.
3. Diagnostic log: `subscribeCrosshairMove` + state-transition log
   `crosshair: SHOW` / `crosshair: HIDE` (fires only when
   `param.time` defined ↔ undefined transitions, so the RN console
   stays readable). Expected output during normal use: SHOW on
   long-press, HIDE on touchend, NO log when tapping a drawing.

### `4ca95c6` — Issue 3: body drag from any point on the line
The hitLine spanning the full ray already armed body-drag on any
touch along the line, but the (dx, dy) translate moved the anchor in
both axes. Locked x to 0 for `horizontal_line` in three places:
- touchmove body-drag: `tx = 0` on the group's translate transform
- touchend body-drag: `dt = 0` in the (startCoord, endCoord) → delta
  commit math
- touchmove handle-drag: anchor's `time` stays at original (only
  `price` follows finger); the floating handle's `cx` also stays put
  so visual feedback is vertical-only

Net behavior: ANY touch on the line (handle or body) = price drag,
time stays fixed. Matches the spec exactly.

### `f4c9265` — Issue 4: selection highlight not clearing
Real root cause: when not in placement mode, both `overlay` and
`hitBg` have `pointer-events: none`, so empty-area taps fall through
to the chart canvas. That meant the `drawing_deselect` postBack at
the end of `handleTap` was unreachable from the "tap empty"
gesture. Fix: `chart.subscribeClick(...)` — lightweight-charts only
fires this for clicks on the canvas (not for SVG-captured drawing
taps). When it fires AND `drawingSelectedId` is set → postBack
`drawing_deselect` → RN clears selection → next render drops the
`isSel` underlay.

Side effect: trendline now also deselects-on-tap-empty (it had the
same bug, but the highlight there was a short segment between two
anchors and easy to miss).

### Files touched (all four commits)
- `src/types/drawings.ts`
- `src/components/chart/TradingChart.tsx`
- `src/components/chart/DrawingSettingsModal.tsx`
- `src/components/chart/PlacementBanner.tsx`
- `src/store/drawingsStore.ts`
- `docs/TRADINGVIEW_REFERENCE.md`
- `PROJECT_CONTEXT.md`

### Architectural flags
- The `subscribeClick` deselect path doesn't trigger when the user
  starts a pan/zoom — lightweight-charts distinguishes click from
  drag. So selection survives pan/zoom, matching TradingView. If
  users complain that a 2-finger zoom should also deselect, we'd need
  to listen to touch events differently.
- `clearCrosshair()` is `try/catch`-wrapped because
  `chart.clearCrosshairPosition()` was added in a relatively recent
  lightweight-charts version; the wrapper is a no-op on older builds
  rather than throwing.

---

## 2026-05-10 — Horizontal Ray TradingView-parity v1 (replaces Horizontal Line)

**Status:** Code complete on `master`. Type-check clean. Hray-only; no other
drawing tool touched (handle visual + opacity slider + 16-color palette were
already gated behind a per-tool flag from the trendline pass and now opt in
hray too).

Authoritative spec: `docs/TRADINGVIEW_REFERENCE.md` §2 (renamed from
"Horizontal Line" → "Horizontal Ray" in commit `5b5d206`).

### What replaced `hline`
- DrawingType union, TOOL_CATALOG entry, and default favorites set all
  migrated from `hline` → `hray`. Existing `hline` records in AsyncStorage
  are filtered out gracefully on hydrate (unknown type) — known minor
  regression: anyone with persisted hlines from before this commit loses
  them on first launch. Accepted per the prompt ("delete the old, build
  the new").

### Defaults (Part A)
- New `HRAY_DEFAULT_STYLE` constant in `src/types/drawings.ts` —
  `#2962FF`, lineWidth 1, solid, 100% opacity, `showPriceLabel: true`.
- `handleDrawingPoint` switches on `tool` for per-tool defaults:
  `trendline → TRENDLINE_DEFAULT_STYLE`, `hray → HRAY_DEFAULT_STYLE`,
  everything else → `DEFAULT_STYLE`.

### Placement (Part B)
- `PlacementBanner` now reads a `BANNER_LABELS` lookup and displays the
  matching label while active. `hray → "PLACING HORIZONTAL RAY"`.
- Tap-tap placement and auto-deactivate already in place (Issue 6 +
  handleDrawingPoint). No sticky mode.

### Rendering (Part C)
- New `d.type === 'hray'` branch in the WebView renderer. Starts at
  `timeToCoordinate(anchor.time)`, extends to `W`. When the anchor's
  time is BEFORE the visible chart, falls back to `startX = 0` so the
  ray still fills the visible width. When the anchor is AFTER the
  visible chart, the ray skips rendering entirely.
- Anchor marker: small 3 px color-filled dot with 1 px white border at
  the ray's left end, drawn only when the anchor is in view.
- Selected highlight: extra underlay stroke at `lineWidth + 4`, 25%
  opacity (same treatment as trendline §1).

### Interaction (Parts D–E)
- Anchor-handle drag updates the point in BOTH dimensions (existing
  generic handle-drag flow already does this — vertical → price,
  horizontal → time). No special hray code needed.
- Body-drag (transform-only during touchmove, commit on touchend)
  translates the single anchor by the same (dt, dp). Already wired.
- Handle visual: extended the `isRich` flag in the renderer to
  include `hray` (12 px color-matched filled circle + 2 px white
  border + 25 px hit ring). Other tools keep the legacy handle.

### Settings panel (Part F)
- New `useRichSettings = isTrendline || isHRay` flag in the modal.
  Both tools now get: 16-color palette (`TRENDLINE_COLORS`), the
  inline `OpacitySlider`, 1/2/3/4 width pills, and the confirm dialog
  on Delete (label adapts: "Delete horizontal ray?" / "Delete trendline?").
- `canShowPriceLbl` narrowed to `isHRay` — trendline doesn't expose it
  (deferred per §1); hray defaults it On and exposes the toggle.

### Drawing actions popup (Part G)
- Already removed (smoke-test fix 2); confirmed during the trendline pass.

### Persistence (Part H)
- Hray anchor stored as absolute `(time, price)`. Reproject every frame
  via `timeToCoordinate` / `priceToCoordinate`. AsyncStorage persistence
  already covered by `drawingsStore.persistDrawings`.

### Files touched
- `src/types/drawings.ts` (DrawingType, TOOL_CATALOG entry, HRAY_DEFAULT_STYLE)
- `src/components/chart/TradingChart.tsx` (renderer, default switch, handle, exemption)
- `src/components/chart/DrawingSettingsModal.tsx` (isHRay, useRichSettings, canShowPriceLbl)
- `src/components/chart/PlacementBanner.tsx` (BANNER_LABELS lookup)
- `src/store/drawingsStore.ts` (default favorites)
- `PROJECT_CONTEXT.md` (catalog row 2)

### Deferred (not in v1)
- Label text / font / size / bold / italic / color / background / border /
  horizontal alignment / vertical alignment
- Coordinates numeric input (manual price + time entry)
- Visibility on timeframes
- Extend-left toggle (would turn the ray into a full horizontal line —
  separate feature)

### Architectural flags
- The off-chart-pts exemption in the renderer used to include `'hline'`;
  swapped to `'hray'` since hline no longer exists in the type system.
  `'cross_line'` is still in the exemption list as dead code from a
  pre-prune tool — left untouched (out of scope; can be cleaned in a
  future pass).
- AsyncStorage migration is lossy by design — no shim to convert old
  hline records to hray. If we ever want non-lossy migration, the
  hydrate filter in `drawingsStore.ts` is the place to do it.

---

## 2026-05-10 — Trendline TradingView-parity v1

**Status:** Code complete on `master`. Type-check clean. Trendline-only;
no other drawing tool touched.

Authoritative spec: `docs/TRADINGVIEW_REFERENCE.md` §1.

### Defaults (Part A)
- New `TRENDLINE_DEFAULT_STYLE` constant in `src/types/drawings.ts` —
  `#2962FF`, lineWidth 1, solid, 100% opacity, no extend, no label.
- `handleDrawingPoint` in TradingChart.tsx picks per-tool defaults: trendline
  uses `TRENDLINE_DEFAULT_STYLE`; everything else still uses `DEFAULT_STYLE`.

### Placement flow (Part B)
- New `PlacementBanner` component renders a centered top pill
  ("PLACING TRENDLINE", #2962FF) only while `activeTool === 'trendline'`.
  `pointerEvents="none"` so it never eats touches.
- Tap-tap placement + auto-deactivate to `cursor_cross` was already wired
  (Issue 6 + handleDrawingPoint). No sticky mode for trendline (none of the
  pruned tools opt-in to stickyMode).

### Selection / drag (Parts C–D)
- Single-tap select + double-tap settings was already in place (smoke-test
  fix 1). Body-drag = transform-only, handle-drag = detach-and-reparent
  with local mutation (smoke-test fix 3) — both apply uniformly.
- Trendline-only handle visuals: 12 px diameter circle filled with line
  color + 2 px white border + 25 px transparent hit ring. Other tools keep
  the legacy black-with-white-stroke handle.
- Trendline-only selected highlight: when selected, render an extra
  underlay stroke at `lineWidth + 4` and 25% opacity for a subtle glow.

### Settings panel (Part E)
- `DrawingSettingsModal` branches on `isTrendline = drawing.type === 'trendline'`:
  - **Color:** spec's exact 16-color palette (`TRENDLINE_COLORS`); other
    tools keep `QUICK_COLORS`.
  - **Line opacity:** new inline `OpacitySlider` (PanResponder + measured
    track, no new dep) showing live `%` value. Other tools keep the
    25/50/75/100 pill quartet.
  - **Line width:** restricted to 1/2/3/4 px (TradingView dropdown). Other
    tools keep 1–6.
  - **Line style:** Solid/Dashed/Dotted (unchanged, already met spec).
  - **Extend left/right:** unchanged, already trendline-gated by `canExtend`.
  - **Show price label:** removed for trendline (deferred per v1 spec);
    `canShowPriceLbl` narrowed to hline only.
  - **Lock / Duplicate / Delete:** footer buttons retained. Delete on
    trendline now opens an `Alert.alert` confirm; other tools delete
    immediately as before.

### Drawing actions popup (Part F)
- Already removed in smoke-test fix 2 (`drawing_longpress` handler + alert
  deleted). Only no-op timer machinery remains for safe drag-path calls.
  Verified via grep.

### Persistence (Part G)
- Trendline anchors are stored as absolute `(time, price)` and reproject
  every frame via `chart.timeScale().timeToCoordinate` /
  `series.priceToCoordinate`. AsyncStorage persistence already handled by
  `drawingsStore.persistDrawings`. No changes needed.

### Files touched
- `src/types/drawings.ts`
- `src/components/chart/TradingChart.tsx`
- `src/components/chart/DrawingSettingsModal.tsx`
- `src/components/chart/PlacementBanner.tsx` (new)
- `src/screens/TradingScreen.tsx`

### Deferred (not in v1)
- Arrow heads, middle point, label/text/font/bold/italic/background/border
- Show angle / price range / bars range / date-time range / distance
- Coordinates numeric input
- Visibility on timeframes
- Snap-to-bar (separate from existing magnet mode)

### Architectural flag
- The opacity slider is custom (PanResponder + locationX). On Android,
  `nativeEvent.locationX` is occasionally jittery during fast moves —
  fine for this slider's coarse purpose, but if smoke test reports
  drift consider switching to a measured `pageX` + `measure()` flow.

---

## 2026-05-10 — Smoke-test fix 6: gesture arbitration (tap-place + drag-to-pan)

**Status:** Code complete on `master`. Type-check clean.

Drag-to-draw was disabled. In placement mode the WebView now treats a
single-finger gesture as either:
- **Stationary tap** (< 8px movement before release) → places one point.
  2-point tools (rectangle, fib_retracement) use classic tap-tap.
- **Drag** (≥ 8px movement before release) → drives a chart pan via the
  existing `drawingPan` mechanism. No drawing is placed.

### Implementation
- Touchstart in placement mode arms BOTH `placementTap` (candidate tap) and
  `drawingPan` (candidate pan).
- Touchmove kills `placementTap` once the finger moves > 8px. The
  `drawingPan` handler then drives `chart.timeScale().setVisibleLogicalRange`
  to shift the visible window as the finger moves.
- Touchend posts `drawing_point` only if `placementTap` survived the move.

### Removed
- `placementDrag` state variable + its touchmove preview + its touchend
  commit (deleted the entire drag-to-draw code path).
- `TWO_POINT_TOOLS` lookup table and `PLACEMENT_PREVIEW_ID` sentinel.
- `drawing_place` React-side handler (atomic 2-point message no longer
  needed — drag-to-draw was its only sender; tap-tap doesn't have the
  stale-closure problem because each tap is a separate user event with a
  React render in between).

### Files touched
- `src/components/chart/TradingChart.tsx`

### Known limitation
- Multi-touch pinch in placement mode is NOT yet routed to chart zoom. The
  overlay still captures the touches. Revisit if user reports it.

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
