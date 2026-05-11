# Pocket Trade — Mobile Drag & Selection Research

Authoritative reference for fixing mobile drag, touch handling, and selection state for drawing tools in Pocket Trade's WebView-based SVG chart.

Source: research session via Claude Remote, citing TradingView OSS `lightweight-charts` source code, MDN, and TradingView mobile tutorials.

> Caveat: TradingView's own help center was not directly reachable in the research session. Where canonical TradingView docs were inaccessible, the doc relies on Google search snippets, third-party tutorials, and the open-source `lightweight-charts` source on GitHub. Anything inferred (vs directly documented) is flagged inline.

---

## Q1 — Exact drag behavior on TradingView mobile

### Q1a — Which axes?
A horizontal line / horizontal ray on TradingView mobile drags **only in the price (Y) axis** when you drag its body or handle. The line stays horizontal during drag; only the price value changes.

- Strongly supported by mobile tutorials (YouTube · I'm here to help you!, Oct 2024; YouTube · Optimus Futures, May 2025)
- Not stated in a single primary TradingView doc
- Treat as: **Y-only is the correct behavior for our Horizontal Line tool**

Body drag vs handle drag: both produce identical Y-only translation for Horizontal Line. For Horizontal Ray on desktop, the anchor handle's time can be moved; mobile behavior here is uncertain — do not assume.

### Q1b — Can the user drag from anywhere along the line?
**Yes** — body drag from anywhere along the line is supported, not just from the handle. The handle exists for hit-targeting on small screens, not to restrict the drag region.

### Q1c — Snapping / stepping?
**Default = 1:1 with finger, no snap, no stepping.** Snapping only occurs if Magnet Mode is enabled (opt-in via magnet icon in drawing toolbar). Default is no snap.

**Any stepping in our implementation is a bug, not a feature.**

### Q1d — Drag beyond visible chart edge?
Not directly documented for mobile. On desktop, dragging a Y-only line past the right edge moves it past the visible area without auto-scroll. Mobile-specific: **uncertain**.

### Q1e — Momentum / inertia after touchend?
**No.** Drawing drags have zero momentum on TradingView mobile. Momentum is only present for chart pan (the chart itself). Line stops exactly where the finger lifts.

---

## Q2 — Selection highlight visual behavior

What can be said with confidence:

- **Selected visual:** the line itself does NOT change color or thickness. Small square/circle handle dots appear at endpoint(s) plus one or two grip dots along the line. No glow, no dashed border, no pulsing animation. Solid, static state.
- **Triggered by:** a single tap on the line (touch hit-test on the line's hit area)
- **Removed by:** tap outside the line, tap on empty chart background, programmatic deselection when another drawing is selected, or settings sheet dismissal that clears selection
- **Render approach (TradingView desktop):** drawings on a separate canvas layer above the chart; handles are part of the drawing layer, drawn conditionally when `selected === true`. NOT a CSS overlay.
- **For our SVG implementation:** render handle dots as additional `<circle>` elements in the same `<g>` group, toggled by a `selected` prop. Don't separate them into a disconnected React component tree.
- **While settings panel open:** drawing stays selected, handles remain visible behind/above the bottom sheet

What's NOT publicly documented:
- Exact colors / sizes of handles — treat as Pocket Trade design decisions (TradingView desktop appears to use ~6–8px brand-blue circles with white stroke)

---

## Q3 — Smooth drag implementation patterns

Confirmed pattern from TradingView's OSS gesture handler at `lightweight-charts/src/gui/mouse-event-handler.ts`:

### Critical implementation details TradingView ships in production

1. **`touchstart` registered as `{ passive: true }`** on the target element — required so iOS Safari doesn't delay the first touch.

2. **`touchmove` registered TWICE.** First as a no-op with `{ passive: false }` on the target:
   ```js
   target.addEventListener('touchmove', () => {}, { passive: false });
   ```
   With the inline comment: *"If mobile Safari doesn't have any touchmove handler with passive=false it treats a touchstart and the following touchmove events as cancelable=false, so we can't prevent them ... And we'll get scroll of the page along with chart's one instead of only chart's scroll."*

   This is the critical mobile-Safari workaround.

3. **The REAL `touchmove` handler is attached to the document root** (inside the `touchStartHandler`) also `{ passive: false }`, so the finger can leave the original target without losing tracking. Calls `preventDefault()` once the manhattan distance threshold is exceeded.

4. **5px manhattan-distance threshold** decides "this is a drag, not a tap" — `Constants.CancelTapManhattanDistance = 5`. Below 5px of accumulated movement, it stays a tap candidate; above it, becomes a drag.

5. **240ms long-tap timer** is started on touchstart: `Delay.LongTap = 240`.

6. **Vertical bias for diagonal drags:** `const correctedXOffset = xOffset * 0.5;` — TradingView biases ambiguous diagonal drags toward vertical because vertical page scroll is more common.

7. **No `requestAnimationFrame` in the input layer.** TradingView dispatches events to the chart model immediately on touchmove. Rendering pipeline coalesces redraws via rAF separately. **Take-away: don't add debounce/throttle to your touchmove handler.**

### Is the "gesture proxy" pattern (transform during touchmove, commit on touchend) standard?

**Yes.** This is the canonical browser-side pattern for SVG element dragging and the right choice for a WebView.

Why: setting React state on every touchmove (~60 events/sec on iOS, ~120 on Android with high-refresh screens) triggers a reconciliation cycle every frame — **the #1 cause of stepped/jerky SVG drag**. Mutating `element.setAttribute('transform', 'translate(0, ${dy})')` directly bypasses React entirely.

Commit on touchend: copy the proxy's transform back into React/Redux/Zustand state. This is what every major library does (Konva, react-konva, fabric.js, react-native-gesture-handler's `PanGestureHandler` + `Animated.Value`).

### Does `lightweight-charts` have a drag/move primitive for drawings?

**No.** The public OSS repo is for plotting series only. Drawing tools (lines, rays, fibs) live in the proprietary TradingView Advanced Charts / Charting Library. The OSS `mouse-event-handler.ts` is the input layer, not the drawing layer.

**Do NOT tell Claude Code to "copy lightweight-charts' drag drawing code" — there isn't any.**

### iOS Safari WebView vs Android WebView differences

**iOS WKWebView:** fires touchmove at display refresh rate (60Hz typical, 120Hz on ProMotion iPads). iPhone Pro 120Hz devices typically still throttle WebView touch events to ~60Hz.

**iOS-specific gotcha:** the cancelable-event quirk documented in TradingView's source above. Without a `{ passive: false }` listener attached at touchstart time, iOS treats subsequent touchmove events as non-cancelable, so `preventDefault()` becomes a no-op and the page scrolls along with your drag. **This is the single most common cause of "drag jumps by a screen-width on iOS."**

**Android Chromium WebView:** respects CSS `touch-action` strictly. If `touch-action` on any ancestor is not `none` (or at least `pan-y` when you want X drag), the gesture is captured by the browser scroller before your handler sees it.

### Performance ordering on a WebView

1. **Direct DOM mutation** (`el.setAttribute('transform', ...)`) inside touchmove — fastest, no reconciler cost, no rAF overhead. **Use this for the proxy phase.**
2. **rAF-batched DOM mutation** — useful only if a single touchmove fires multiple times per frame (rare on mobile). Adds 1 frame of latency.
3. **React state update on every touchmove** — slowest. Even with `React.memo`, the parent that owns the state still re-renders.

---

## Q4 — Common bug: jerky / stepped drag — five causes

### Cause 1 — React re-render thrashing
State updates in `onTouchMove` cause line component (and often whole chart parent) to re-render.

**Diagnosis:** React DevTools profiler, do a drag, look for hundreds of commits clustered around the drag.

**Fix:** Do not call `setState` (or Zustand/Redux dispatch) inside touchmove. Update a ref instead and mutate the SVG transform attribute imperatively. Only commit to state on touchend.

**This is the single most common root cause.**

### Cause 2 — Passive listeners
If `touchmove` is registered with `{ passive: true }`, `preventDefault()` is silently ignored, the page scrolls while the drag also runs, perceived as "stepping" but actually the chart container scrolling underneath.

**Diagnosis:** `console.log(e.cancelable)` in the move handler. If it logs `false`, you have the passive-listener bug.

**Fix:** Register touchmove with `{ passive: false }` and attach a no-op `{ passive: false }` touchmove to the root container at mount time (the TradingView trick).

### Cause 3 — `touch-action` / `pointer-events` misconfiguration
Per MDN: if the touched element or any ancestor has `touch-action: auto` (the default), the browser's built-in pan/zoom gesture wins on ambiguous moves and your handler receives a `pointercancel` mid-drag, producing "stuck at one position" or "jumps in chunks."

**Fix:** Set `touch-action: none` on the SVG drawing layer (or `touch-action: pan-x` if you still want horizontal chart pan to coexist outside drawings).

### Cause 4 — Hit-testing using stale coordinates
If your hit-test uses previous committed coordinates (React state) but the visual uses the new transform (ref-mutated), the user can drag off the hit region after a few pixels and the handler stops receiving moves.

**Fix:** Capture the pointer with `element.setPointerCapture(e.pointerId)`. Or attach the move listener to `document` rather than the SVG element — same trick TradingView uses.

### Cause 5 — Conflicting parent gesture handlers
A wrapping React Native ScrollView / PanResponder / parent `react-native-gesture-handler` `PanGesture` intercepts moves.

**RN-side fix:** Wrap the WebView in `GestureDetector` with `Gesture.Native()` and `.shouldCancelWhenOutside(false)`. Or set the WebView's `scrollEnabled={false}` and let the inner HTML own all gestures.

**WebView-side fix:** Set `overflow: hidden` and `touch-action: none` on the chart container.

### Cause 6 (bonus) — Sub-pixel rounding
Rounding transform values to integers (e.g. `Math.round(dy)`) drops small finger movements below 1px, line appears to "step" by 1px increments.

**Fix:** Pass float values through. SVG transforms accept fractional pixels.

---

## Q5 — Common bug: stuck selection highlight

### Common React state patterns to ensure deselect propagates

**Single source of truth.** Selection ID lives in one store (e.g. Zustand `selectedDrawingId`). Every drawing subscribes with `useStore(s => s.selectedDrawingId === myId)`. Tapping background calls `setSelectedDrawingId(null)`.

**Anti-pattern to avoid:** keeping a local `isSelected` boolean on each drawing component, then trying to clear them all on background tap — easy to miss one.

**Tap-outside handler on the chart root, not on individual drawings.** TradingView's OSS handler does exactly this with its `mouseDownOutsideEvent` callback. Mirror in our WebView:
```js
document.addEventListener('touchstart', (e) => {
  if (!e.target.closest('[data-drawing="true"]')) {
    useDrawings.getState().clear();
  }
}, { passive: true });
```

**Containment checks beat `stopPropagation`.** Use `event.target.closest(...)` checks instead of `stopPropagation()`. More robust — that's what TradingView's source does.

### Known React/SVG quirks where attribute doesn't update after state change

1. **Key reuse across drawings.** Using array index as key — deleting a drawing in the middle leaves the next drawing rendering with the previous one's `selected` prop. **Fix:** use a stable drawing ID as key.

2. **Imperative DOM mutation that React doesn't know about.** During drag you set `transform` via `ref.setAttribute('transform', ...)`. Then on deselect, React's next render re-applies the OLD transform from props/state (because state still holds the pre-drag value if you forgot to commit on touchend), causing the line to jump back. Manifests as "handles disappear but line jumps" — looks like a selection bug, is actually a **commit-on-touchend bug**. Always commit final transform to state in the touchend handler.

3. **Conditional rendering inside `useMemo` with stale deps.** If `<Handles>` is memoized and `selected` is not in the dep array, it won't update. Diagnosis: temporarily remove the `useMemo` and see if the bug disappears.

4. **CSS `pointer-events` on hidden handles.** Toggling handle visibility via `opacity: 0` instead of unmounting — invisible handles still capture taps and re-select the drawing. Either **unmount** or pair `opacity: 0` with `pointer-events: none`.

---

## BUG-FIX RECOMMENDATIONS — three concrete changes

### 1. Fix jerky / stepped drag — gesture-proxy pattern with hardened listeners

Inside the WebView HTML/JS that owns the SVG line:

```js
// On mount, on the SVG chart container:
container.style.touchAction = 'none';            // tell the browser: we own all gestures
container.addEventListener('touchmove', () => {}, { passive: false }); // iOS Safari trick

let dragRef = { startY: 0, startPrice: 0, lineEl: null };

function onTouchStart(e) {
  const t = e.touches[0];
  dragRef.startY = t.clientY;
  dragRef.startPrice = currentPriceOfLine;
  dragRef.lineEl = e.currentTarget;        // the <g> for this horizontal line
  // attach move/end to document so finger can leave the line:
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend',  onTouchEnd,  { passive: false });
}

function onTouchMove(e) {
  e.preventDefault();                       // requires { passive: false } above
  const dy = e.touches[0].clientY - dragRef.startY;
  // imperative mutation — bypass React entirely during the drag:
  dragRef.lineEl.setAttribute('transform', `translate(0, ${dy})`);
}

function onTouchEnd(e) {
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend',  onTouchEnd);
  // commit to state ONCE, here:
  const dy = (lastMoveY ?? 0) - dragRef.startY;
  const newPrice = pixelToPrice(priceToPixel(dragRef.startPrice) + dy);
  dispatchToReact({ type: 'UPDATE_LINE_PRICE', price: newPrice });
  // and clear the transient transform so the next render is clean:
  dragRef.lineEl.setAttribute('transform', 'translate(0,0)');
}
```

On the RN side: set `scrollEnabled={false}` on the WebView. If nested in a ScrollView or gesture-handler view, wrap the WebView in `GestureDetector` with `Gesture.Native().shouldCancelWhenOutside(false)`.

**Why this fixes "stepping":**
- React state no longer set 60×/sec
- `setAttribute` is single GPU-friendly transform update
- `touch-action: none` + `{ passive: false }` removes OS-level scroll competition
- touchmove listener on `document` so finger can drift off thin line without losing gesture

### 2. Fix stuck selection highlight — single store, document-level outside-tap, conditional unmount

```jsx
// Store (Zustand):
const useDrawings = create((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  clear:  ()    => set({ selectedId: null }),
}));

// HorizontalLine.tsx
function HorizontalLine({ id, y }) {
  const selected = useDrawings(s => s.selectedId === id);
  const select   = useDrawings(s => s.select);
  return (
    <g
      data-drawing="true"
      onTouchStart={(e) => { e.stopPropagation(); select(id); /* + start drag */ }}
    >
      <line x1={0} x2='100%' y1={y} y2={y} stroke="..." />
      {selected && <Handles y={y} />}        {/* unmount, do NOT just hide */}
    </g>
  );
}

// Chart root, on mount (inside WebView):
document.addEventListener('touchstart', (e) => {
  if (!e.target.closest('[data-drawing="true"]')) {
    useDrawings.getState().clear();
  }
}, { passive: true });
```

**Key points Claude Code must NOT skip:**
- Handles subtree is **unmounted** when `selected === false`, not hidden with opacity. Hidden handles still hit-test and re-select.
- Outside-tap handler lives on `document`, not on each drawing.
- Selected state is a single `selectedId` in the store, not a per-component boolean. Deselect is one line: `clear()`.
- Use a stable `id` as React key on the drawings array.

### 3. Fix single-axis vs both-axis drag confusion — constrain in the handler, not in the model

For a Horizontal Line, **ignore X delta entirely in `onTouchMove`**. Do not rely on "the model knows it's horizontal so it'll snap" — that's where drift comes from when the model commit happens 1 frame after the visual.

```js
function onTouchMove(e) {
  e.preventDefault();
  const dy = e.touches[0].clientY - dragRef.startY;
  // EXPLICITLY ignore dx — constraint lives in the handler, not the model
  dragRef.lineEl.setAttribute('transform', `translate(0, ${dy})`);
}
```

[Note: the original research output was cut off here mid-explanation; the principle is clear — apply the axis constraint at the touch handler layer, not at the data-commit layer.]

---

## How Claude Code should use this doc

When implementing any drawing tool, reference this file by section:
- Touch listener setup → Q3, Q4 Cause 2, Cause 3, Cause 5
- Drag handler → BUG-FIX RECOMMENDATIONS #1
- Selection state management → BUG-FIX RECOMMENDATIONS #2
- Axis constraint (for Horizontal Line and similar) → BUG-FIX RECOMMENDATIONS #3
- "Should I add rAF / debounce / setState in touchmove?" → Q3 (answer: no)
- "Should I hide handles with opacity or unmount?" → Q5 Quirk #4 (answer: unmount)
