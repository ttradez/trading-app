# Icon usage rules

Two icon families coexist in Pocket Trade. They are NOT
interchangeable — picking the wrong family is a visual-language
bug, not a stylistic preference.

## When to use which

### `@expo/vector-icons` (Ionicons + MaterialCommunityIcons) — utility, single line weight

Use for every "this is just a control" affordance:

- Settings list rows (gear, info, sign-out, etc.)
- Back arrows, forward chevrons
- Search bar magnifier
- Info bubbles, dismiss X
- Section-header eyebrow icons (the small crosshair next to
  "Daily Challenges", the calendar next to "Weekly Recaps", etc.)
- Header utility icons (settings cog, streak flame)

Color: white at 50 – 70 % opacity unless a semantic state
(gold accent, green success, red error) demands otherwise.

### `phosphor-react-native` — hero glyphs only

Use ONLY where the icon is a hero element of its surface, and
the line single-weight feels thin. Filled / duotone / bold
variants tier visually so tiers read at a glance.

Current Phosphor sites:

| Surface | Icon | Weight | Color |
|---|---|---|---|
| Today's Mission tip | Lightbulb | `fill` | gold@90% |
| Daily Challenge tile | ArrowsClockwise / Crosshair / Notebook / Compass / CalendarCheck (per category) | `fill` | gold@80% |
| Long-term weekly card | Crosshair (fixed — tier signal, not per-category) | `bold` | gold |
| Long-term monthly card | Compass (fixed — tier signal, not per-category) | `bold` | gold |

Bottom-nav tab icons are deliberately on Ionicons line (the
Lucide-equivalent utility set), NOT Phosphor. Active-tab feel
is signaled by a gold-tint pill behind the icon
(`rgba(255,184,0,0.10)`) plus the gold icon color — no filled
variant swap. See `tabStyles.iconWrapActive` in App.tsx.

## Never

- Mix Ionicons and Phosphor in the same row / inline group. Pick
  one family per surface.
- Use Phosphor for "just a button" affordances (chevrons, dismiss,
  etc.) — that's what the utility set is for.
- Introduce a new icon library. Two is the limit; a third creates
  drift that compounds across screens.

## Adding a Phosphor icon

```ts
// Note: import the *Icon suffix names — the bare names are
// deprecated in phosphor-react-native v3.
import { CompassIcon } from 'phosphor-react-native';
```

`weight` accepts: `'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'`.
`duotone` additionally takes `duotoneColor` + `duotoneOpacity`.

## Custom illustrated badges / rank emblems

Out of scope for both icon families above. The achievement
badges (`badges.ts`), rank stripe banners, and onboarding
illustrations are bespoke artwork. Do not replace them with
Phosphor or Ionicons "for consistency" — they belong to a
separate visual layer.
