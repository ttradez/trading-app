# Pocket Trade — Work Log

Running record of completed tasks, ordered newest first. Each entry should
note what shipped, what files changed, and what was deferred.

---

## 2026-05-15 — Routing guard: skip onboarding when onboardingComplete is true

Returning users were forced through onboarding every launch
(`FORCE_ONBOARDING_FLOW=true`) AND onboardingStore wasn't even
persisted, so the flag couldn't have worked anyway.

- **onboardingStore**: wrapped in `persist` (AsyncStorage,
  `onboarding-storage-v1`). Actions drop out of JSON; shallow
  merge keeps them — same pattern as the other persisted stores.
- **App.tsx**: deleted `FORCE_ONBOARDING_FLOW`, the
  disclaimer/Firebase-auth-gated legacy render branch, the FORCE
  force-sign-out hack, and the now-unused
  Login/AccountSetup/FeatureTour/Disclaimer imports + AsyncStorage
  disclaimer code. Single guarded stack: gate first paint on
  `useOnboardingStore.persist.hasHydrated()` (+ `onFinishHydration`
  subscription, 2.5 s safety timeout) → `LoadingSplash` until
  rehydrated, then `Stack.Navigator initialRouteName =
  onboardingComplete ? 'Main' : 'OnboardingSplash'`. All
  onboarding screens stay registered (screen-12 + Redo Onboarding
  reset between them). Auth `useEffect` slimmed to only populate
  authStore `uid/username` when a Firebase session exists (no
  routing role, no sign-out).
- **SettingsScreen**: new non-destructive "Redo Onboarding" row
  in Data (between Reset Streak and Reset Everything) — confirm
  alert → `setOnboardingComplete(false)` + `navigation.reset` to
  `OnboardingSplash`; trades/streak/badges untouched.

Type-check clean (only the pre-existing iapService errors).

### Files touched

- `src/store/onboardingStore.ts` (persist)
- `App.tsx` (routing guard, legacy removal, slim auth effect)
- `src/screens/SettingsScreen.tsx` (Redo Onboarding row)
- `PROJECT_CONTEXT.md`, `WORK_LOG.md`

---

## 2026-05-15 — Progression celebrations: rank-up modals + goal-gradient nudge + particle burst

The *feel* layer on top of the XP/challenge engines: celebrate
crossings, manufacture goal-gradient urgency near a threshold
(Kivetz et al. 2006).

### Rank-up copy config — `rankConfig.ts`

`RANK_PROMOTION_COPY` (gambler null — never promoted into;
paper_hands/sniper/inside_trader/market_maker per spec) +
`RANK_THEME_COLOR` (silver/green/blue/purple/gold). Kept beside
the beats so copy edits never touch components.

### New — `src/store/celebrationStore.ts`

Ephemeral FIFO of `{ type, newRank, newSubTier, previousRank,
previousSubTier, xpEarned }`. `xpStore.addXP` enqueues here when
`checkRankUp` returns a promo — done in `addXP` (not
`checkRankUp`) so the triggering `amount` is captured as
`xpEarned`. Not persisted (an unseen celebration isn't worth
replaying; the rank is already in xpStore).

### New — `src/components/RankUpCelebrationHost.tsx` (MainTabs)

**Ordering**: the host only shows the next celebration once
`badgeToastStore` AND `challengeToastStore` queues are empty,
plus a ~900 ms grace so an already-dequeued (on-screen) toast
finishes its ~3 s display. The journal popup is implicitly first
because XP grants (hence the enqueue) only fire AFTER it's
dismissed. → journal → toasts → rank-up, biggest moment last.

**Sub-tier modal** (I→II, II→III): backdrop + card, "RANK UP"
eyebrow, `RankBanner`, an RN `PipRow` where the just-earned pip
(`newSubTier-1`) springs hollow→gold (scale 0.2→1, tension 140),
"<Rank> <Roman>", "+{xpEarned} XP", Success notification haptic
on mount, Continue.

**Main-rank full-screen**: black takeover with a staggered
sequence — (a) gold flash overlay 0→0.15→0 (~340 ms) → (c)
banner `Animated.spring` scale 0.5→1 + fade (delay 250) with a
**Medium impact haptic on land** → pip row (subTier I → pip 1
filled) → (e) rank name in theme colour fades (delay 850) → (f)
`RANK_PROMOTION_COPY` fades (delay 1250) **+ Success
notification haptic** → (g) Continue fades (delay 1700).
**Particle burst**: 18 plain `Animated.View` gold dots on random
angle/distance trajectories, single shared 0→1 driver, fade out
(no new dependency).

Pips are RN Views (`PipRow`), NOT the SVG banner pips —
`RankBanner` is untouched (the per-pip SVG animation would have
been heavy; documented).

### Goal-gradient — `DashboardScreen`

`pct = xpInTier / xpNeededForNext` on the rank bar.
- **≥80 %** → `showPulse`: an `Animated.loop` (0.3↔0.7 opacity,
  750 ms each way) drives a brighter-gold glow layer
  (`rankBarGlow`, slightly taller than the track) over the fill.
  Loop stopped/reset when the condition clears.
- **≥95 %** → `showNudge`: a gold-left-accent card under the
  bar. Gap = `xpNeededForNext − xpInTier`, mapped tightest-first
  (the spec's buckets overlap, so smallest wins): ≤15 → "1
  journaled trade to <next>" → Chart tab; ≤30 → "2 trades to
  <next>" → Chart tab; ≤50 → "1 Daily Setup away from <next>" →
  scroll to top (Daily Mission); else → "<gap> XP to <next>" →
  scroll to bottom (missions). Tap wired via a new `ScrollView`
  ref + `navigation`.

Encouraging, gold (not red). Only renders ≥95 %; 80-95 % is just
the pulse; <80 % the plain bar.

### Wiring

- `App.tsx` MainTabs: `<RankUpCelebrationHost/>` added to the
  overlay fragment after the two toast hosts.
- `xpStore.ts`: import celebrationStore, enqueue in `addXP`
  (removed the stale "celebrations are a later prompt" log
  comment).

### Out of scope (per prompt)

- Celebration sound, shareable rank card, confetti on sub-tier,
  close-to-rank-up push.
- XP values / rank thresholds / challenge rewards unchanged.

### Files touched

- `src/data/rankConfig.ts` (copy + theme maps)
- `src/store/celebrationStore.ts` (new)
- `src/components/RankUpCelebrationHost.tsx` (new)
- `src/store/xpStore.ts` (enqueue on promo)
- `src/screens/DashboardScreen.tsx` (pulse + nudge + scroll ref)
- `App.tsx` (mount host)
- `PROJECT_CONTEXT.md`, `WORK_LOG.md`

---

## 2026-05-15 — Challenge system: daily/weekly/monthly with rotation, detection, rewards, and dashboard UI

Mid-game XP engine (research target ~35-45 % of total XP). 3
daily + 1 weekly + 1 monthly, rank-gated, rotating from pools.

### New — `src/data/challengePool.ts`

**34 templates**: 19 daily / 10 weekly / 5 monthly (node-counted).
`{ id, name, description, type, category, minRank, target,
xpReward, bonusReward?, condition }`. `DETECTABLE_CONDITIONS`
allowlist + `CONDITION_MODE` ('add' default; 'max' for
consecutive_wins / streak_days / unique_symbols /
unique_emotions). `rankAtLeast(userRank,minRank)` via
`RANK_ORDER`. Two daily templates (`new_symbol_today`,
`quick_start`) are kept in the pool but excluded from generation
(not yet reliably detectable offline — no shame UI, so an
un-progressable daily would just sit at 0).

### New — `src/store/challengeStore.ts`

Persist (`challenge-storage-v1`). Instances `{ challengeId,
progress, target, completed, completedAt, xpReward }` ×
activeDailies[3] / activeWeekly / activeMonthly + dailyDate /
weeklyWeek (ISO via `isoWeekId`) / monthlyMonth + skip token.
- `generateDailies/Weekly/Monthly(rank)` — filter pool by
  `minRank ≤ rank` AND `DETECTABLE_CONDITIONS`, shuffle, prefer
  not repeating the previous period's ids (fall back if the
  eligible set is too small).
- `updateProgress(cond,val)` — applies mode to every matching
  un-completed active instance; on `progress ≥ target` →
  completed+timestamp, `xpStore.addXP(reward,'challenge')`,
  `streakStore.grantFreeze()` for `streak_freeze` bonus, enqueue
  challenge toast.
- `skipDaily(i,rank)` — one swap/week of an uncompleted daily.
- `checkExpiry(rank)` — regenerates each elapsed period; skip
  token resets on the weekly boundary; expired-incomplete just
  vanish.
- `updateChallengeProgress(cond,val)` thin export for call sites.

Added `grantFreeze()` to streakStore (capped at FREEZE_CAP) for
the bonus reward — additive, no behaviour change.

### New — toast + rotation

`challengeToastStore` (ephemeral FIFO) + `ChallengeToastHost`
(MainTabs) — BadgeToastHost pattern, green "MISSION COMPLETE" +
name + "+N XP", slide/hold/swipe, native-overlay Modal.
`useChallengeRotation` (MainTabs) runs `checkExpiry(currentRank)`
on mount + every background→foreground.

### Detection — `src/utils/challengeDetection.ts`

Centralised so trigger sites stay one-liners. `detectAfterTradeClose`
(trades_placed, consecutive_wins from badgeStore, hold-bars from
timestamp/timeframe, unique_symbols lifetime, today-windowed
green_day/win_rate_55, month-windowed win_rate_55_monthly),
`detectAfterJournalSave` (journal_count, grade_ab/aplus,
unique_emotions, all_journaled), `detectDailySetupComplete`
(daily_setup + daily_setups). Wired in:
- `TradingScreen` TradeJournalModal `onSave` (+ journal detect)
  / `onSkip`, and the daily-setup close-effect guard — all AFTER
  the badge checks so consecutiveWins is current.
- `useXpWatchers` streak subscription → streak_days (max),
  active_days, time_goal_hit, time_goal_days.
- `useTrainingTimer` tick + partial-flush → minutes_traded.

Windowing v1 simplification documented in-file: unique_symbols is
lifetime-distinct (generous, never punishing).

### Dashboard — "Today's Missions"

Replaces the "Challenges coming soon" placeholder (section +
its 4 styles removed). `MissionsSection`: 3 daily `ChallengeCard`s
(category icon, name/desc, "X / Y" or ✓+XP, gold/green progress
bar, green left-accent + border when done, per-card "Swap a
mission" link when a skip is available), "No swaps remaining
this week" once the token's spent, "All daily missions complete
✓" + dimmed list when all 3 done, then WEEKLY and MONTHLY
tagged cards. Reads challengeStore + `xpStore.currentRank`.

### Wiring

- `App.tsx` MainTabs: `useChallengeRotation()` +
  `<ChallengeToastHost/>` alongside the existing hooks/hosts.
- `SettingsScreen` Reset Everything: + `challengeStore.reset()`
  (10 stores wiped now).

### Out of scope (per prompt)

- Challenge history log, "1 away" nudges, custom challenges,
  rank-up-gated UI, leaderboard/Firebase.
- XP system / rank thresholds from the prior prompt unchanged.

### Files touched

- `src/data/challengePool.ts`, `src/store/challengeStore.ts`,
  `src/store/challengeToastStore.ts`,
  `src/components/ChallengeToastHost.tsx`,
  `src/hooks/useChallengeRotation.ts`,
  `src/utils/challengeDetection.ts` (all new)
- `src/store/streakStore.ts` (+`grantFreeze`)
- `src/screens/TradingScreen.tsx` (detection triggers)
- `src/hooks/useXpWatchers.ts`, `src/hooks/useTrainingTimer.ts`
  (detection triggers)
- `src/screens/DashboardScreen.tsx` (missions UI)
- `App.tsx` (MainTabs), `src/screens/SettingsScreen.tsx` (reset)
- `PROJECT_CONTEXT.md`, `WORK_LOG.md`

---

## 2026-05-15 — XP system + rank sub-tiers: 15-beat progression with XP-per-action wiring

The progression foundation. XP rewards PROCESS over OUTCOME — a
journaled loss earns the same trade-close XP as a win. No decay,
no derank, no prestige (deliberate per research; commented in the
store). Challenge XP is the next prompt (challenges don't exist
yet); this covers every non-challenge source.

### New — `src/data/rankConfig.ts`

15 beats (5 ranks × 3 sub-tiers). `RANK_BEATS` ladder +
`getRankForXP(xp)` pure lookup → `{ rank, subTier, label,
xpInTier, xpNeededForNext, isRankPromotion, next }`. Cumulative
thresholds exactly per spec (0/150/300 · 500/1100/1800 ·
3000/5000/7500 · 10500/15000/20500 · 27500/36500/48500).
`isRankPromotion = subTier === 1` (tier I of a rank = a rank-up).
Node-tested across boundaries: 0→Gambler I, 149→Gambler I,
150→Gambler II, 300→Gambler III (next is a rank promotion),
7500→Sniper III, 48500/60000→Market Maker III capped.

### New — `src/store/xpStore.ts`

Persist (`xp-storage-v1`). `currentXP/Rank/SubTier` + daily
trackers (`tradesToday`, `todayDate`, `dailySetupCompletedToday`,
`firstTradeToday`). Internal `ensureToday()` resets the trackers
on date rollover (reuses `getTodayYMD` from streakStore — single
"today" source, no cycle since streakStore doesn't import xp).
`addXP(amount, source)` → `console.log("+N XP (source)")` then
auto `checkRankUp()`. `checkRankUp()` snaps to
`getRankForXP(currentXP)` so it can cross multiple beats at once;
logs `RANK UP (rank|sub_tier): prev → new` (celebration screens
are a later prompt). `registerTrade()` returns the soft-capped
base (+10, →+5 once `tradesToday >= 20`) and `isFirstOfDay`,
bumping the trackers. `tryClaimDailySetup()` gates the once/day
+50. `getCurrentProgress()` for the dashboard. `reset()` for
Settings. Header comment documents the no-decay design decision.

### XP-per-action wiring (trigger points)

| Source | XP | Where wired |
|---|---|---|
| Place a trade (base) | +10 (→+5 after 20/day) | TradeJournalModal `onSave`/`onSkip` → `registerTrade()` |
| First trade of day | +15 | same, `isFirstOfDay` |
| Win | +5 | same, `closedPnl > 0` |
| Journaled loss | +5 (== win) | `onSave` only, `closedPnl <= 0` |
| Journal a trade | +15 | `onSave` |
| Daily Setup | +50 (1/day) | close effect's once-per-day guard, `tryClaimDailySetup()` |
| Streak: daily goal | +25 | `useXpWatchers` streak subscription |
| Streak: maintain | +10 + min(day,40) | same |
| Streak: milestone d7/14/30/60/100/365 | +100/200/500/1000/2000/5000 | same |
| Badge unlock | +100 each | inside `evaluateBadges` (badgeChecker) |
| Weekly recap viewed | +25 | `useWeeklyRecapTrigger.dismiss` |

`onSave` flow: registerTrade → +base → (+15 first) → (+5 win |
+5 journaled-loss) → +15 journal. `onSkip` flow: same minus the
loss bonus + journal (an unjournaled loss = base only). Both fire
AFTER `setRecentClosedTrade(null)` (same dismiss point as the
badge checks) so XP logs/celebrations don't race the modal.

### New — `src/hooks/useXpWatchers.ts`

Mounted in MainTabs. Subscribes to streakStore; on a
`currentStreak` increase (== one `completeDaily`, always +1 —
freeze-preserved days hold it flat) grants daily-goal + maintain
+ milestone XP. Done as a subscription rather than editing
`streakStore.completeDaily` so streakStore stays free of an
xpStore import (no cycle, no behaviour change).

### RankBanner — sub-tier pips

New optional `subTier?: 1|2|3` prop. When set, 3 SVG `Circle`
pips render below the rank name inside the banner art (filled
gold for earned tiers, hollow `#333` stroke otherwise — e.g.
Sniper II → ●●○). **Opt-in**: omitting `subTier` renders exactly
as before, so the onboarding / auth / plan-summary call sites are
unchanged (no layout regression). The dashboard passes the real
`rankInfo.subTier`. Capability is universal; other call sites can
opt in later.

### Dashboard — real XP progress

The hardcoded "10% toward Paper Hands" + `RANK_PROGRESS_PCT`
constant are gone. Section 4 now reads
`getRankForXP(useXpStore().currentXP)` (memoised on currentXP):
RankBanner gets `rank={rankInfo.rank} subTier={rankInfo.subTier}`,
the bar fills `xpInTier / xpNeededForNext`, and the caption reads
`"{xpInTier} / {xpNeededForNext} XP to {next.label}"` (or "Max
rank reached" at the cap). No other dashboard section changed.

### Settings

`useXpStore.getState().reset()` added to Reset Everything
(9 stores wiped now).

### Out of scope (per prompt)

- Challenge XP (next prompt), rank-up celebration screens,
  goal-gradient nudges, leaderboard/Firebase, season/prestige.
- No existing feature behaviour changed — only additive XP grants
  at the trigger points + the dashboard progress display + the
  opt-in RankBanner pip prop.

### Files touched

- `src/data/rankConfig.ts` (new), `src/store/xpStore.ts` (new),
  `src/hooks/useXpWatchers.ts` (new)
- `src/screens/TradingScreen.tsx` (trade/journal/daily-setup XP)
- `src/utils/badgeChecker.ts` (+100/badge)
- `src/hooks/useWeeklyRecapTrigger.ts` (+25 recap)
- `src/components/RankBanner.tsx` (subTier pips)
- `src/screens/DashboardScreen.tsx` (real progress)
- `App.tsx` (useXpWatchers in MainTabs)
- `src/screens/SettingsScreen.tsx` (reset)
- `PROJECT_CONTEXT.md`, `WORK_LOG.md`

---

## 2026-05-15 — Achievement system: 30 badges + trophy case + unlock detection + celebration toast

Research feature #8 — Zeigarnik / collection-completion (Pokémon
GO / Duolingo / Strava / Apple Fitness). The onboarding First
Strike badge proved the pattern; this gives it depth.

### New — `src/data/badges.ts`

30 badges, pure data. Counts by category: **volume 6, skill 9,
consistency 7, discovery 5, journal 3** (note: the spec grouped
Perfect Day/Green Week/Sharpshooter/Big Catch/Whale under skill →
9 skill; Freeze Saver/Unbreakable under consistency → 7). Each:
`{ id, name, description, category, condition, icon, rarity }`.
Icons are MaterialCommunityIcons (lucide never installed — typed
against the MCI glyph union; `whale`→`cash-multiple` after the
type-checker rejected `whale`). `RARITY_COLOR` map (common white /
uncommon green / rare #4A9EFF / epic #9B59B6 / legendary gold).

### New — `src/store/badgeStore.ts`

Persist (`badge-storage-v1`). Unlock ledger
(`unlockedBadges: { id → ISO }`, idempotent `unlockBadge`) +
stateful counters that can't be re-derived: `consecutiveWins`,
`dailySetupsCompleted`, `freezesUsedTotal`. `useUnlockedCount()`
selector for the dashboard counter + trophy bar.

### New — `src/store/badgeToastStore.ts`

Ephemeral (NOT persisted) FIFO `queue` + `enqueue`/`dequeue`.

### New — `src/utils/badgeChecker.ts`

`buildBadgeContext()` gathers from journal/tradeJournal/streak/
watchlist/badge stores (trade count, win streak, max single P&L,
**perfect-day** = any local day ≥3 trades all green,
**green-week** = any 7 consecutive calendar days each with ≥1
trade and net P&L > 0, win rate, unique symbols, streak, freezes,
daily-setups, watchlist size, journaled count). `BADGE_TESTS`
maps every id → predicate; `evaluateBadges()` unlocks all newly-
satisfied + enqueues toasts + returns new ids — **re-checks all
30 every trigger so nothing is ever missed regardless of which
trigger fired**. `getBadgeProgress(id)` → `{current,target}` for
count-based badges (null for boolean ones) → locked-badge modal.
Named wrappers (`checkTradeCloseBadges` advances/resets
`consecutiveWins` once per close, others delegate to evaluate).
"Global Trader" uses the curated set `[NQ,ES,CL,GC]` (documented
— no offline backend market list).

### New — `src/components/BadgeToastHost.tsx`

Transparent-Modal toast (native overlay layer so it never hides
behind plain content), slides down from the top, 3 s hold + 280 ms
slides + 1 s inter-toast gap, swipe-up to dismiss early,
rarity-coloured icon ring + "UNLOCKED" + name, `maybeHaptic` on
appear. Drains the queue sequentially. Mounted in MainTabs.

### New — `src/hooks/useBadgeWatchers.ts`

Mounted in MainTabs. Runs one full `evaluateBadges()` on entry
(catches anything already earned from persisted data), then
subscribes to streakStore: `currentStreak` ↑ → re-evaluate;
`freezesRemaining` strict-↓ → add the delta to `freezesUsedTotal`
(drives Freeze Saver / Unbreakable) → re-evaluate. (A freeze is
also *earned* every 7 days — only a decrease counts as usage.)
Streak changes never collide with the journal modal, so a
subscription is safe here.

### Trigger wiring (`TradingScreen.tsx`)

- TradeJournalModal `onSave`: capture closed P&L → save grade →
  clear `recentClosedTrade` → `checkTradeCloseBadges(pnl)` +
  `checkJournalBadges()`. `onSkip`: clear → `checkTradeCloseBadges`.
  Fired **after dismiss** so the toast isn't behind the modal
  (the spec's "after journal popup dismissed").
- Close effect's daily-setup match: guarded once-per-day
  (compare `dailySetupStore.lastCompletedSetupDate` to today
  before marking) → `incrementDailySetupsCompleted()` +
  `checkDailySetupBadges()`.
- `confirmSaveBookmark` success → `checkWatchlistBadges()`.

Implemented as call-site triggers + one streak subscription
rather than N store-internal hooks — the least invasive option
(zero streak/store-internal edits; `evaluateBadges` re-checks
everything so partial wiring still can't miss a badge).

### Trophy case (`LeaderboardScreen.tsx` — the Ranks tab)

Top-level "LEADERBOARD | BADGES" segment toggle (reads
`route.params.initialSegment` so the dashboard counter deep-links
to badges). Badges view: "N / 30 unlocked" + gold progress bar,
category-grouped (`CATEGORY_ORDER`) 4-per-row grid. Unlocked =
rarity-bordered colour icon + name; locked = `lock` glyph @ 30 %
+ "???". Tap → `BadgeDetailModal`: unlocked shows icon/name/
rarity pill/description/unlock-date; locked shows lock/"???"/
rarity/condition + numeric progress when `getBadgeProgress`
returns non-null. The existing leaderboard/feed/friends FlatList
is unchanged, just gated behind the rankings segment.

### Dashboard counter (`DashboardScreen.tsx`)

Trophy icon + "N / 30" + "badges" row directly under the Rank
Progression card; tap → `navigation.navigate('Leaderboard', {
initialSegment: 'badges' })`. No existing section changed.

### MainTabs (`App.tsx`)

`useBadgeWatchers()` mounted alongside the other entry hooks;
`<BadgeToastHost/>` added to the overlay-sibling fragment next to
`<WeeklyRecapModal/>`.

### Reset consistency (`SettingsScreen.tsx`)

Added `useBadgeStore.getState().reset()` to Reset Everything
(8 stores wiped now). Same data-deletion-completeness principle
as the watchlist reset.

### Out of scope (deliberate, per prompt)

- > 30 badges, badge sharing (view-shot/dev build),
  per-badge celebration screens, leaderboard/Firebase.
- No existing screen changed beyond trigger hooks, the dashboard
  counter, and the Ranks-tab trophy case (all spec-sanctioned).

### Files touched

- `src/data/badges.ts` (new)
- `src/store/badgeStore.ts` (new)
- `src/store/badgeToastStore.ts` (new)
- `src/utils/badgeChecker.ts` (new)
- `src/components/BadgeToastHost.tsx` (new)
- `src/hooks/useBadgeWatchers.ts` (new)
- `src/screens/TradingScreen.tsx` (trigger wiring)
- `src/screens/DashboardScreen.tsx` (badge counter)
- `src/screens/LeaderboardScreen.tsx` (segment toggle + trophy
  case + detail modal)
- `App.tsx` (watcher + toast host in MainTabs)
- `src/screens/SettingsScreen.tsx` (reset includes badges)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-15 — Custom Watchlist: bookmark setups from chart + dashboard saved section

Research feature #7 — "an artifact that belongs to the user, not
the app" (Spotify-playlist / Watch-Later retention psychology).
"I want to study this day again" is natural trader behavior.

### New — `src/store/watchlistStore.ts`

Persisted (zustand/middleware + AsyncStorage,
`watchlist-storage-v1`). `savedSetups: SavedSetup[]` where
`SavedSetup = { id, symbol, date, timeframe, label, savedAt }`.
- `addSetup(s)` prepends; **returns `false` (no-op) when the 50
  cap is already hit** so the caller surfaces the limit alert —
  the store never does UI.
- `removeSetup(id)`, `reset()`.
- `useSavedSetup(symbol, date)` selector → the matching entry or
  undefined (matches on symbol+date, ignores timeframe — one
  bookmark per day-on-symbol regardless of the TF being viewed).
- `savedSetupStartUnixSeconds(date)` mirrors dailySetups'
  `setupStartUnixSeconds` (14:00 UTC anchor, backend snaps) so a
  saved card preloads the chart **identically to a Daily
  Mission** — same `dailySetup` nav-param mechanism, no
  TradingScreen consume-logic change.

### Chart — bookmark icon + modals (`TradingScreen.tsx`)

- Bookmark `TouchableOpacity` placed in the **topBar, immediately
  right of the symbol button** (the spec's "near the
  symbol/date display"). `useSavedSetup(market.symbol,
  replayDateYMD)` drives the icon: `bookmark-outline` @ white-50 %
  when not saved, solid `bookmark` @ gold when saved. (lucide
  Bookmark unavailable → Ionicons, consistent with the screen.)
- Tap when **not saved** → fade Modal: "Save this session",
  `SYMBOL · YYYY-MM-DD · TF` confirm line, optional 100-char note
  `TextInput`, gold Save + Cancel link. Save →
  `addWatchSetup({...})`; on success `maybeHaptic()` (settings-
  gated — the new helper's first real consumer); on cap-hit it
  closes + `Alert("You've hit the 50 bookmark limit…")`.
- Tap when **saved** → "Remove from saved?" Modal, red Remove +
  Cancel. Remove → `removeSetup(savedSetup.id)`; icon reverts.
- Date captured = `replayDateYMD` (the existing NY-time YMD memo
  of the on-screen bar), timeframe = current `timeframe`.

### Dashboard — "Saved Setups" section (`DashboardScreen.tsx`)

Inserted **between the Daily Mission card and the Daily Training
Progress ring** — no existing section moved. Header "Saved
Setups" + right-aligned "N saved" count (hidden at 0). Horizontal
`ScrollView` of 160 px cards: symbol (bold), `formatSavedDate`
("Sep 13, 2022", string-parsed so no TZ day-shift), single-line
truncated label if present. Tap → `navigation.navigate('Chart',
{ dailySetup: { symbol, timeframe, startTs, date, key } })` — the
exact param shape the Daily Mission uses, so the existing chart
preload effect handles it unchanged. Empty state: dashed
`#2A2A2A` placeholder card, gold-30 % bookmark glyph, "Bookmark
setups from the chart" (not tappable). Per spec, no
swipe-to-delete in the horizontal row — removal is the chart's
filled-bookmark → Remove modal.

### Reset consistency (`SettingsScreen.tsx`)

Added `useWatchlistStore.getState().reset()` to the **Reset
Everything** double-confirm flow. "Delete ALL your data"
semantically includes the watchlist; leaving it behind would be
a data-leak bug in that feature. One line, no behavior change
elsewhere.

### Out of scope (deliberate, per prompt)

- Folders / categories, sharing, sort/filter, full-screen
  watchlist manager.
- Swipe-to-delete in the horizontal row.
- No change to Daily Mission, stats, or other dashboard sections.

### Files touched

- `src/store/watchlistStore.ts` (new)
- `src/screens/TradingScreen.tsx` (bookmark icon + save/remove
  modals + styles)
- `src/screens/DashboardScreen.tsx` (Saved Setups section +
  styles)
- `src/screens/SettingsScreen.tsx` (reset includes watchlist)
- `WORK_LOG.md`

---

## 2026-05-15 — Weekly Performance Recap: Sunday Wrap with auto-modal + Journal section

The research's "Magic 3" weekly-synthesis moment (Strava-style)
— a reason to come back at the end of every week. Auto-generates
a personalized recap, pops on Sunday, and lives permanently in
the Journal for review.

### New — `src/utils/weeklyRecap.ts` (pure, tested)

`generateWeeklyRecap(refDate, allTrades, streak, grades)` — filters
the full closed-trade history to the target week (Mon 00:00 →
Sun 23:59 **local**), returns the recap object: `weekId`
(ISO-8601, zero-padded so it sorts chronologically),
`dateRange` ("May 11 – 18, 2026"), totals, `winRate`
(null < 2 trades), `bestTrade`/`worstTrade`
(`{symbol,pnl,direction}`), training minutes, streak,
`edgeInsight`, `generatedAt`. Also exports `weekBounds` +
`isoWeekId`.

**Edge-insight candidates** (each needs ≥3 trades unless noted;
the applicable candidate with the highest `interest` wins, ties
break toward the earlier-listed one — spec order):
1. **Long vs Short** — win-rate split; interest = |spread|.
2. **Hold duration** — avg winner vs loser minutes; verdict
   "cutting losers fast" / "cut losers faster"; interest =
   |Δminutes|.
3. **Consistency** — distinct trading days /7; interest = days
   (kept modest so stat candidates win when meaningful).
4. **Journal correlation** — A/A+ graded win rate (needs ≥1
   A-grade); interest = |wr−50|+5.
5. **< 3 trades** → "Keep trading to unlock deeper weekly
   insights." (0 trades → null).

Node-smoke-tested via `node --experimental-strip-types`: 5-trade
week → W20, "May 11 – 18, 2026", 3/2, 60 %, +$1350, best CL
+900 long, worst ES −200 short, picked the long-vs-short insight
(100 % vs 0 %, widest spread). 1-trade → winRate null + fallback.
0-trade → totals 0, insight null, best/worst null.

### New — `src/store/recapStore.ts`

Persisted (zustand/middleware + AsyncStorage,
`weekly-recap-storage-v1`), keyed by weekId →
`{ recap, viewedAt }`. `saveRecap` is insert-only (never
clobbers an existing week, so a regenerate can't wipe a
`viewedAt`) and prunes to the most-recent 12 weeks. `markViewed`
stamps dismissal. `useRecapList()` selector returns newest-first
for the Journal list.

### New — `src/components/WeeklyRecapModal.tsx`

Full-screen black, scrollable, reused by the auto-trigger AND
Journal review. Choreography (~1.7 s): container fade (400 ms)
→ hero P&L counts up from $0 over 700 ms (JS-driver
`Animated.Value` + listener → state, the screen-9 First Strike
pattern) → 2×2 stats grid fade → training+streak row →
edge-insight card (3 px gold left accent) slides up from below
→ gold Continue CTA. Win-rate / best / worst colour-keyed;
unavailable stats render "—".

### New — `src/hooks/useWeeklyRecapTrigger.ts`

Runs once per mount (one recap per app open, never stacks).
Hydration-safe: awaits `journalStore.hydrate()` + a generic
`awaitPersist()` on recap/streak/tradeJournal stores
(`persist.hasHydrated()` / `onFinishHydration`, 2 s safety
timeout) so a cold start can't mis-decide off empty state.
Target week: **today is Sunday → current week; Mon–Sat →
`today − 7 days` (previous full week, catch-up)**. Shows only
if that week is unviewed and had ≥1 closed trade. If a recap
was generated-but-unviewed it re-shows the stored snapshot
(preserves `generatedAt`) rather than regenerating. `dismiss()`
→ `markViewed`.

### Wiring

- `App.tsx` / `MainTabs`: `useWeeklyRecapTrigger()` +
  `<WeeklyRecapModal>` rendered as a sibling overlay of the
  `Tab.Navigator` (wrapped the return in a fragment). Sits
  alongside the existing `useStreakManager()` mount hooks.
- `JournalScreen.tsx`: new `RecapsSection` ("WEEKLY RECAPS")
  pinned above the trade list — as the `FlatList`
  `ListHeaderComponent` when trades exist, and inside a
  `ScrollView` above the empty message otherwise (so recaps
  still show when a filter empties the trade list). Compact
  rows (date range · trades · win % · P&L, chevron) → tap
  reopens `WeeklyRecapModal` for that week. Empty →
  "Complete your first week of trading to unlock your Weekly
  Recap."

### `totalTrainingMinutes` limitation (documented)

The streak store only persists *today's* training bucket, not a
per-day history. The hook passes `streak.todayTrainingMinutes`
as the weekly figure — best-effort, will under-report on a
multi-day week. A true weekly accumulator (expand the streak
store) is a follow-up; noted in `weeklyRecap.ts` + PROJECT_CONTEXT.

### Out of scope (deliberate, per prompt)

- Share-as-image (needs view-shot — dev-build feature).
- Sunday push notification (needs notifications/dev build).
- Prev-week comparison ("↑12% from last week") — v2.
- No screen changed beyond the Journal section + the MainTabs
  overlay (Dashboard untouched).

### Files touched

- `src/utils/weeklyRecap.ts` (new)
- `src/store/recapStore.ts` (new)
- `src/components/WeeklyRecapModal.tsx` (new)
- `src/hooks/useWeeklyRecapTrigger.ts` (new)
- `App.tsx` (MainTabs: trigger hook + modal overlay)
- `src/screens/JournalScreen.tsx` (Weekly Recaps section +
  review modal)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-15 — Settings screen: profile + training + preferences + data management + about

No settings surface existed. Adding one telegraphs maturity and
gives the user control; the high-value piece per research is CSV
export for traders who track P&L externally.

### New file — `src/store/settingsStore.ts`

Persisted Zustand (`zustand/middleware` + AsyncStorage, key
`settings-storage-v1`). Fields: `hapticsEnabled` (default true),
`defaultContractSize` (default 1). Exports `maybeHaptic(style)`
and `maybeNotificationHaptic(type)` — enabled-gated wrappers that
read the store via `getState()` so non-React call sites can use
them. **Existing `Haptics.*` call sites are intentionally NOT
refactored onto these** (explicit follow-up, per the prompt).

### `journalStore` — added `reset()`

`AsyncStorage.removeItem(KEY)` + `set({ entries: [] })`. Needed
for Settings → Reset Everything. The other stores already had
resets (`onboardingStore.reset`, `streakStore.reset`,
`tradeJournalStore.reset`, `dailySetupStore.reset`).

### New file — `src/screens/SettingsScreen.tsx`

Pure-black `SafeAreaView` + `ScrollView`. In-screen header with a
back chevron (`navigation.goBack()`), since the stack runs
`headerShown: false`. Reusable `Section` / `Row` / `Separator` /
`SelectModal` primitives.

**Profile** — Display Name (tap → inline `TextInput` with a
Save action → `onboardingStore.setDisplayName`); Handle
(read-only `@handle`, lock icon + "Change requires sign-in" —
editing needs a Firebase uniqueness check, deferred); Archetype
(name + sigil icon, read-only — 4th inline copy of the
ARCHETYPE_META map, convergence still deferred); Rank ("Gambler",
read-only, matches the dashboard's hardcoded post-onboarding
state).

**Training** — Daily Time Goal (SelectModal 15/30/60/90/120 →
`setDailyTimeGoal`), Daily Commitment (SelectModal
light/steady/pro with full descriptive labels → `setDailyCommitment`,
displayed short), Default Contract Size (SelectModal 1-10 →
`settingsStore.setDefaultContractSize`).

**Preferences** — "Haptic feedback" RN `Switch` (gold
`#FFB800` on, `#333` off) + sublabel, bound to
`settingsStore.hapticsEnabled`.

**Data** —
- *Export Trades (CSV)*: joins `journalStore.entries` (trade
  data) with `tradeJournalStore.entries` (grade/emotions/note)
  by `tradeId`. Columns: Date, Symbol, Direction, Entry Price,
  Exit Price, P&L, Duration, Grade, Emotions, Note. RFC-4180
  cell quoting (`csvCell` quotes + doubles internal quotes when
  a cell has `,`/`"`/newline — the free-text note especially).
  Shared via **`Share.share({ message: csv })`** — works in
  Expo Go with zero new deps (a true file share would need
  expo-file-system/expo-sharing; the prompt explicitly chose
  the no-dependency path). Empty history → `Alert('No trades
  to export yet.')`.
- *Reset Streak*: single confirm → `streakStore.reset()`.
- *Reset Everything*: **double** confirm → wipes
  onboarding/streak/settings/journal/tradeJournal/dailySetup
  stores, then `navigation.reset({ routes: [{ name:
  'OnboardingSplash' }] })`.

**About** — Version (`app.json` → `expo.version`, "Pocket Trade
v1.0.0"), Support (`mailto:ben@sitesbyben.ca` via `Linking`),
Terms / Privacy (console.log stubs — real links later).

### Wiring

- `App.tsx`: imported `SettingsScreen`, registered
  `<Stack.Screen name="Settings">` as a sibling of `Main` in
  BOTH the FORCE_ONBOARDING_FLOW stack and the production
  authed stack. From the tab-nested dashboard,
  `navigation.navigate('Settings')` bubbles up to the parent
  stack (React Navigation v6 behavior), so it slides in over
  the tabs with the screen's own back button.
- `DashboardScreen.tsx`: gear icon (`Ionicons settings-outline`,
  20 px, white-50 %) added to the header right side, to the
  right of the `StreakBadge`, inside a new `headerRight` flex
  row. `lucide-react-native` still not installed — Ionicons is
  the substitute (consistent with the rest of the dashboard).

### Out of scope (deliberate, per prompt)

- Handle editing (Firebase uniqueness check).
- Sound toggle (no sound system), notification prefs (dev build).
- Refactoring existing haptic calls onto `maybeHaptic`.
- No screen changed beyond the dashboard gear icon.

### Files touched

- `src/store/settingsStore.ts` (new)
- `src/store/journalStore.ts` (+`reset()`)
- `src/screens/SettingsScreen.tsx` (new)
- `App.tsx` (Settings route ×2 stacks)
- `src/screens/DashboardScreen.tsx` (gear icon)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-15 — Daily Setup of the Day: curated scenarios + dashboard card + completion tracking

The #1 retention recommendation: kill the cold-start problem.
Users open the app, don't know which historical date to replay,
and bounce. One curated daily mission gives them a clear "do this
now" — the Duolingo daily-lesson pattern.

### New file — `src/data/dailySetups.ts`

**30 curated scenarios** (verified count). Each:
`{ id, symbol, date, timeframe, title, description, setupType,
difficulty, tip }`.

Diversity (script-verified):

| Axis | Spread |
|---|---|
| Symbol | NQ ×11, ES ×11, CL ×4, GC ×4 |
| Setup type | News Reaction ×9, Reversal ×6, Trend Day ×6, Breakdown ×5, Opening Range Breakout ×2, Range Day ×1, Gap Fill ×1 (all 7 represented) |
| Difficulty | beginner ×9, intermediate ×10, advanced ×11 |
| Year | all 2022 (backend coverage) |

Descriptions are written to *teach* — each names the structure
to look for; each `tip` is a concrete entry trigger. Several are
anchored to real 2022 macro days (CPI prints, FOMC decisions,
Jackson Hole, the Feb-24 invasion gap) so the replay date lines
up with a genuine catalyst.

Exports:
- `getTodaySetup()` — `DAILY_SETUPS[dayOfYear(now) % 30]`.
  Deterministic per calendar day, zero backend, every device
  agrees on the same calendar day.
- `setupStartUnixSeconds(s)` — the scenario date at 14:00 UTC
  (~9:30 AM ET year-round); backend snaps `start_time` to the
  nearest bar so sub-hour precision is irrelevant.
- `DAILY_SETUP_COUNT` for analytics / smoke checks.

### New file — `src/store/dailySetupStore.ts`

Persisted Zustand store (`zustand/middleware` + AsyncStorage,
key `daily-setup-storage-v1`). Stores ONLY
`lastCompletedSetupDate: string | null`. Since rotation is
deterministic by day-of-year, the completion date alone answers
"is today's mission done?" — no per-scenario history needed.
`markCompletedToday()` writes `getTodayYMD()` (reuses
streakStore's exported helper — single source of truth for
"today"). `useIsTodaySetupComplete()` selector hook re-renders
the card the instant completion lands.

### Dashboard — top card (`DashboardScreen.tsx`)

New "TODAY'S MISSION" card inserted **above** the Daily
Training Progress ring (first thing the user sees; no existing
section changed). Layout per spec:
- Gold "TODAY'S MISSION" eyebrow + right-aligned difficulty
  pill (`DifficultyBadge`: beginner=green, intermediate=gold,
  advanced=red — text + border, transparent fill, pill radius).
- Title (20 px / 800), `SYMBOL · Setup Type` subtitle (60 %
  white), description (75 % white, 1.5 line-height), tip line
  prefixed with 💡 in italic gold-80 %.
- Full-width 48 px gold CTA "Trade this setup".
- Completed state: 3 px green left-accent on the card, CTA
  swaps to a disabled transparent green-bordered "Completed ✓".

CTA `onPress` → `navigation.navigate('Chart', { dailySetup: {
symbol, timeframe, startTs, date, key } })`. `key` is
`${id}-${Date.now()}` so re-tapping the same scenario always
re-triggers a fresh load.

### Chart wiring (`TradingScreen.tsx`)

- Signature `TradingScreen()` → `TradingScreen({ route })` (it's
  a `Tab.Screen` component, so React Navigation passes
  `{ navigation, route }`).
- Two refs: `pendingStartTsRef` (queued historical start time)
  and `consumedSetupKeyRef` (last-handled param key, so the
  effect is idempotent across tab focus / re-render).
- **Setup-consume effect** (`[dailySetup?.key, allMarkets]`):
  on a new key, queue `startTs`, set the market (look up the
  full `Market` in `allMarkets`, else synthesize a minimal one
  from `DEFAULT_MARKET`'s pip/contractSize), set the timeframe,
  and `reset()` any live session so the auto-start effect
  re-fires.
- **Auto-start effect** gained a guard: if a fresh unconsumed
  `dailySetup` param exists, it does NOT start a random session
  — it defers to the setup effect so the user never sees a
  random session flash before the curated one.
- `autoStart()` now reads + clears `pendingStartTsRef` and
  threads it through `startSession(..., startTs)` (the API
  already accepted an optional `start_time`; it was just never
  passed).
- **Completion**: the existing close→`journalStore` auto-persist
  effect now also checks `entry.symbol === todaySetup.symbol`
  and derives the trade's NY-time YMD from `closed_at` via the
  module-level `tzPartsOf` helper (can't reference the
  `replayDateYMD` memo — it's declared further down → TDZ). On a
  match it calls `markCompletedToday()`. Completion is keyed on
  trade **close** (round-trip), not open — a pragmatic choice
  given the close path is already wired; documented as a v1
  limitation.

### Out of scope (deliberate)

- Backend/API for scenarios (static client-side v1).
- Per-archetype/skill personalized selection (day-of-year only).
- > 30 scenarios (expandable later).
- Sharing the daily setup.
- Missed-day punishment (streak system already covers that —
  the card always shows *today's* fresh setup, never yesterday's).
- No existing dashboard section changed — card is purely additive
  at the top.

### Files touched

- `src/data/dailySetups.ts` (new)
- `src/store/dailySetupStore.ts` (new)
- `src/screens/DashboardScreen.tsx` (mission card + badge)
- `src/screens/TradingScreen.tsx` (route props, setup-consume +
  auto-start guard + start-ts plumbing + completion marking)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-15 — Shorten "LEADERBOARD" tab label to "RANKS"

"LEADERBOARD" still truncated even at 4 tabs / 10 px. Added
`options={{ tabBarLabel: 'Ranks' }}` to the Leaderboard
`Tab.Screen` — the existing `textTransform: 'uppercase'` style
renders it "RANKS", which fits. Route name stays `Leaderboard`
so the icon mapping (keyed by `route.name`) and any
`navigation.navigate('Leaderboard')` calls are untouched. Screen
+ icon unchanged. One-line change in `App.tsx`.

---

## 2026-05-14 — Dashboard redesign + remove Challenges tab (4 tabs)

Two coupled fixes: a 5th tab was truncating labels to 6 chars
("CHALLENG...", "LEADERBO..."), and the dashboard's backend
`getAccount` fetch was getting stuck on a "Loading..." spinner
when no Firebase user existed. Both addressed in one pass — the
Challenges tab is retired and its content moves into a placeholder
section inside the rebuilt local-state-only dashboard.

### Tab bar — 5 → 4 (`App.tsx`)

- `<Tab.Screen name="Challenges">` removed from the navigator.
  `ChallengesScreen` import retired with a top-of-file comment so
  the next reader knows the component file is preserved for a
  future re-wire.
- Tab label `fontSize` 8 → **10**, `letterSpacing` 1.2 → 1.0,
  icon size 16 → **18**. With 4 tabs (DASHBOARD / CHART / JOURNAL
  / LEADERBOARD) the labels fit at 10 px without truncation on
  the test devices.
- `initialRouteName` flipped from `Chart` → **`Dashboard`** —
  matches the new dashboard's information-dense first-load and
  the user's expected entry point post-onboarding.

### Trade history persistence (`TradingScreen.tsx`)

Necessary infrastructure so the dashboard has real data to read.

- `journalStore` (`@pocket_trade_journal` in AsyncStorage) was
  already persisting trade entries with the full schema; it was
  just no longer being written to after the trade-journal modal
  redesign retired the manual "Journal Trade" button.
- New `useEffect` on `recentClosedTrade` constructs a
  `JournalEntry` snapshot from the snake_case backend close
  payload and calls `addEntry()` on every close. Defensive
  defaults match the legacy `TradeCardModal` pattern in case the
  auto-close path omits fields. `addEntry` already de-dupes by
  `tradeId`, so a re-render here can't double-write.
- Old-schema fields (`notes`, `mistakes`, `wentWell`, `emotion`,
  `confidence`, `strategy`, `tags`) start empty — they can still
  be filled later via the `EntryEditModal` accessible from the
  Journal tab. The new-schema fields (`grade`, `emotions`,
  `note`) keep flowing into the separate `tradeJournalStore` via
  the journal modal's Save path.
- `useJournalStore.getState().hydrate()` is now ALSO called once
  in `MainTabs`'s mount effect (idempotent — TradingScreen's own
  hydrate stays). Without this, opening the app directly to the
  Dashboard tab would render before the persisted entries
  hydrated.

### DashboardScreen — full rewrite

Replaces the prior account-fetch-then-`if (!account) return`
loading screen with an immediately-painting, store-only layout.

**Five sections** beneath the existing header (archetype identity
left, StreakBadge right — both kept unchanged):

1. **Daily Training Progress** — `react-native-svg` ring
   (120 px / 10 px stroke) with a track + gold dashoffset fill,
   center reads `{minutes} /{goal}`. When `minutesToday >= goal`,
   the center swaps to a gold checkmark and the label flips from
   "minutes today" → **"Goal hit!"**. Reads
   `streakStore.todayTrainingMinutes` + `onboardingStore.dailyTimeGoalMinutes`.
2. **Performance Stats** — 2 × 2 grid via `flexBasis: '48%'` +
   `gap: 10`. Four cards: **Trades** (count), **Win Rate**
   (green ≥ 50 %, red < 50 %), **Total P&L** (green +/red −),
   **Best Trade** (green when positive). Each card 14 px radius,
   `#0F0F0F`/`#1F1F1F` chrome, 20 px / 800-weight tabular value
   with a faded label below. Empty state: `opacity: 0.6` +
   `value: '—'` / `'$0.00'` / `'0'`.
3. **Recent Trades** — section header with **"View all"** gold
   link → Journal tab (only when trades exist). Top 3 entries
   from `journalStore` via a small `RecentTradeRow` wrapper (so
   `useTradeJournalStore` can be called per-row to pull the
   grade pill). Empty state: faded copy + **"Start training"**
   gold outline button → Chart tab.
4. **Rank Progression** — `RankBanner rank="gambler"` at
   `width: 130` (left) + name / 4 px progress bar / "10 % toward
   Paper Hands" caption (right). The 10 % is hardcoded — real
   XP plumbing is a separate follow-up; this matches the
   post-onboarding Rank Reveal screen.
5. **Challenges** — placeholder card with `trophy-outline` gold
   glyph at 0.3 opacity + the copy "Challenges coming soon.
   Compete against other traders in timed events." Lives where
   the retired Challenges TAB's content would have gone.

Bottom padding: `100 px` so the last card clears the tab bar.

### Icon library note

The prompt mentioned `lucide: Trophy`. `lucide-react-native` still
isn't installed; Ionicons `trophy-outline` is the substitute (same
glyph family the existing dashboard already used for the rank
icon).

### What got dropped from the old dashboard

- Backend fetches (`getAccount`, `getTrades`) — replaced by
  in-process store reads, so no "Loading..." stall on first
  paint.
- Big rank XP badge (was at the top below the header) — folded
  into the new compact Rank Progression section.
- Detailed stats rows (Profit Factor / Avg Win / Avg Loss /
  Expectancy / Equity) — out per spec ("a horizontal row of 4
  stat cards"). Will return when an Analytics section is built.
- `DashboardCharts` (EquityCurve / WinLossBar / DailyPnlSpark /
  StreakTracker) — same reason; these belong in an Analytics
  surface, not the dashboard's first screen.
- The previous "View all" → empty navigation target — now wired
  to a real tab.

### Out of scope (deliberate)

- Backend sync of trade history (Firebase pass).
- Real challenges feature (only the placeholder ships here).
- Real XP / rank-progression math (still the hardcoded 10 %).
- Chart / Journal / Leaderboard screens untouched.
- `DashboardCharts.tsx`, `LeaderboardScreen.tsx`, and the
  retired analytics helpers remain in the repo unused for a
  future re-wire.

### Files touched

- `App.tsx` (drop Challenges tab, bump label sizes, switch
  initialRoute, hydrate journalStore from MainTabs)
- `src/screens/TradingScreen.tsx` (auto-persist closed trades
  into `journalStore`)
- `src/screens/DashboardScreen.tsx` (rewritten — 5 sections,
  ProgressRing, local stores only)
- `WORK_LOG.md`

---

## 2026-05-14 — Trade journal: auto-popup on trade close with grade + emotions + notes

Builds the post-trade reflection habit by design: every trade
close auto-opens a modal that captures grade / emotions /
optional note. Low-friction (one required field, two optional);
modal subsumes the older "click to journal" affordance.

### New file — `src/store/tradeJournalStore.ts`

Persisted Zustand store, AsyncStorage-backed, key
`trade-journal-storage-v1`. Shape:

```ts
entries: Record<tradeId, {
  grade: 'A+' | 'A' | 'B' | 'C' | 'F',
  emotions: string[],           // 0-3 entries
  note: string | null,          // max 280 chars
  journaledAt: string,          // ISO datetime
}>
```

Actions: `saveEntry(tradeId, data)` (stamps `journaledAt`),
`getEntry(tradeId)`, `reset()`. The convenience hook
`useTradeJournalGrade(tradeId)` is exported for TradeCard
consumers — selects `entries[id]?.grade` so re-renders are
narrow.

Deliberately **separate from the legacy `journalStore`**, which
still carries the older `notes / mistakes / wentWell / emotion /
confidence / strategy / tags` schema (captured manually via
`EntryEditModal`). Both stores can hold data for the same trade
id; the two will be reconciled when the analytics pass lands.

### New file — `src/components/TradeJournalModal.tsx`

Full-screen overlay (`rgba(0,0,0,0.85)` backdrop, centered card,
`maxWidth: 480`, `maxHeight: 90 %`). `KeyboardAvoidingView` with
`behavior: 'padding'` on iOS so the note input lifts above the
keyboard. Content is wrapped in a `ScrollView` with
`keyboardShouldPersistTaps="handled"` so chip taps work while
the keyboard is up.

Sections (top → bottom):

1. **Trade summary row** — symbol + LONG/SHORT pill + P&L on
   one line. Direction pill matches the TradeCard variant (green
   pill with black text for LONG, red pill with white text for
   SHORT). P&L sized 22 px / 800 weight, color-keyed by sign.
2. **GRADE YOUR EXECUTION** — single-select radio row of 5
   chips (A+ / A / B / C / F). 48 px tall, `flex: 1` so they
   share width. Selected = 2 px gold border; default = 1 px
   `#2A2A2A` border. Setting any grade unlocks Save.
3. **HOW DID YOU FEEL?** — multi-select grid of 8 chips in a
   wrapping row. 4 positive tags accent green when selected;
   4 negative tags accent red. Cap of 3 — tapping a 4th drops
   the oldest selection (no silent dead-end).
4. **QUICK NOTE** — multiline `TextInput`, 80 px min-height,
   `maxLength: 280`. Placeholder "What did you learn?" at 30 %
   white. `selectionColor` set to gold so the cursor matches
   the brand.
5. **Save** (full-width gold CTA, disabled until a grade is
   picked) and **Skip** (centered text link, white at 40 %
   opacity).

Pure-presentation: takes a `trade: TradeSummary | null` (just
`id / symbol / direction / pnl`) plus `onSave / onSkip`
callbacks. Doesn't touch any store directly — the consumer
threads the data into `tradeJournalStore.saveEntry`. State
(grade / emotions / note) resets on every modal open via a
`useEffect` on `visible + trade.id`, so a previous trade's
selections don't bleed into the next one.

### Wiring — `src/screens/TradingScreen.tsx`

- Existing `recentClosedTrade` state (set on both the manual
  close at line 720 and the TP/SL auto-close at line 652) is
  the modal trigger — `visible={!!recentClosedTrade}`.
- The snake_case backend payload (`{ id, symbol, side, pnl, ...}`)
  is adapted to the modal's `TradeSummary` via a `useMemo` —
  defensive defaults match the legacy `TradeCardModal` pattern
  in case the auto-close path omits fields.
- Save handler: `saveTradeJournalEntry(recentClosedTrade.id, ...)`
  then `setRecentClosedTrade(null)`. Skip: just clear the state.
- The legacy `<TradeCardModal trade=... onClose=... />` JSX
  is replaced. The component file `TradeCardModal.tsx` is
  preserved (not deleted) — same pattern as `NewsPanel.tsx`
  earlier; the file is unused now but available for future
  re-wire if the rich-stats panel becomes useful again.
- Onboarding screen 9 never mounts `TradingScreen` (its own
  `OnboardingFirstTradeScreen` renders the activation event +
  result overlay), so the journal modal is structurally
  prevented from firing there.

### Wiring — `src/components/TradeCard.tsx`

- New optional `grade?: TradeGrade` prop.
- Top-right status area now renders a small **gold-bordered
  grade pill** to the left of the "CLOSED" / "OPEN" label
  when `grade` is set (e.g. `[A+] CLOSED`). Unjournaled
  trades render nothing in that slot — explicitly no "missing"
  / shame marker per the spec.
- Pill: `1 px` gold border, `rgba(255,184,0,0.12)` tinted fill,
  11 px / 900 weight gold text, 7 px horizontal / 2 px vertical
  padding. Sized to read as a chip, not a button.

### Wiring — `DashboardScreen.tsx` + `JournalScreen.tsx`

- Both screens grew a small wrapper component
  (`DashboardTradeCard` / `JournalTradeCard`) that takes the
  raw trade row, calls
  `useTradeJournalStore((s) => s.entries[id]?.grade)` exactly
  once per row, and forwards everything else to `TradeCard`.
  Required so each row's hook call is legal — hooks can't run
  inside a `.map` render callback.
- Mapping from the raw row → `TradeCard` props is identical
  to the prior commit (`side → direction`, `lots → contracts`,
  `openedAt → entryTime`, `closedAt → exitTime`); only the
  added `grade` prop is new.

### Out of scope (deliberate)

- Journal analytics (win rate by grade, P&L by emotion) — the
  data lands now, the rollups are a follow-up.
- Editing a journal entry after Save (`saveEntry` overwrites if
  called again, but there's no UI affordance yet).
- Detail view of a journal entry.
- Screen 9 / onboarding journal (the activation event has its
  own result overlay).
- Trade placement / closing logic — only the post-close popup
  trigger was changed.
- Firebase sync — the new store is local-only.

### Files touched

- `src/store/tradeJournalStore.ts` (new)
- `src/components/TradeJournalModal.tsx` (new)
- `src/components/TradeCard.tsx` (optional `grade` prop + pill)
- `src/screens/TradingScreen.tsx` (swap close-modal target,
  adapt the close payload to `TradeSummary`)
- `src/screens/DashboardScreen.tsx` (per-row grade lookup
  wrapper)
- `src/screens/JournalScreen.tsx` (per-row grade lookup
  wrapper)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-14 — Trade card redesign: professional trade history cards

Replaces three different trade-row implementations (inline
dashboard markup, the journal's `EntryRow`, etc.) with a single
shared `TradeCard` component matching the brand and the
"TradeLocker / Tradovate / TopstepX" professional density the
prompt asked for. The visual is information-dense but
scannable, with the P&L number as the unambiguous hero element.

### New file — `src/components/TradeCard.tsx`

One component, both states (open + closed). Reads its data from
explicit props — the call sites do the mapping from
`ClosedTrade` / `JournalEntry` so the underlying trade model is
untouched.

#### Props

```ts
{ symbol: string,
  direction: 'long' | 'short',
  entryPrice: number,
  exitPrice: number | null,         // null = open
  pnl: number,                      // unrealized when open
  entryTime: number,                // unix ms
  exitTime: number | null,
  contracts: number,
  status: 'open' | 'closed',
  onPress?: () => void }
```

`entryTime` / `exitTime` are unix-ms numbers (not ISO strings as
the prompt sketched) — matches the existing `openedAt` /
`closedAt` shape in the project's `ClosedTrade` type. The card
handles all formatting internally.

#### Layout

```
┌─┬────────────────────────────────────────────────┐
│ │ NQ  [LONG]                          🟢 OPEN    │  ← top row
│ │                                                │
│ │ Entry: 15,230.50  →  Exit: 15,260.75           │  ← prices @ 70%
│ │ +$605.00     unrealized                        │  ← hero P&L (24 px)
│ │                                                │
│ │ Sep 13, 2022 · 8:34 AM · 12m 30s    1 contract │  ← metadata
└─┴────────────────────────────────────────────────┘
 │
 └─ 3 px left accent — green / red / gold by P&L sign
```

- Card surface `#0F0F0F`, border `1px #1F1F1F`, 14 px radius.
- 3 px left-edge accent stripe, full card height, keyed to
  `Math.sign(pnl)` (green / red / gold).
- Direction pill — LONG = green pill with black text, SHORT =
  red pill with white text. 11 px / 900 weight / 1 px tracking.
- Status indicator (top-right):
  - **Open** → 8 px green dot pulsing 0.4 ↔ 1.0 opacity every
    700 ms (native-driver loop), "OPEN" label in green.
  - **Closed** → faded "CLOSED" label at 50 % white opacity.
- Prices line: tabular-nums for stable widths during a session.
- P&L: 24 px / 800 weight / -0.5 letter-spacing — the spec's
  hero number. `formatUSD(pnl)` does `+$X.XX` / `-$X.XX` /
  `$0.00`. Color tracks the value (green / red / white).
- Open trades append a small lowercase "unrealized" suffix.
- Metadata row: entry date+time (e.g. "Sep 13, 2022 · 8:34 AM",
  format hand-rolled to avoid `Date.toLocaleString` device
  locale variance), duration (`Xs` / `Xm Ys` / `Xh MMm` / `Xd
  Yh`, "Running" while open), contracts.
- Optional `onPress` wraps the card in a `Pressable`; pressed
  state is 0.85 opacity.

### Wiring — `DashboardScreen.tsx`

- Imported `TradeCard`. Replaced the inline tradeCard markup
  (and all the related `tradeRow1` / `tradeSideBadge` / `badgeLong`
  / etc. styles) with a `<TradeCard ... />` per trade. Mapping:
  - `side: 'buy'` → `direction: 'long'`; `'sell'` → `'short'`.
  - `lots` → `contracts`; `openedAt` → `entryTime`; `closedAt`
    → `exitTime`. Pass through `entryPrice` / `exitPrice` /
    `pnl` / `symbol`. `status="closed"` (the dashboard's
    `trades` list is closed-trades-only from the API).
- 10 px vertical gap between cards via a new `tradeList`
  wrapper with `gap: 10`.
- New empty state: centered, 50 % white opacity, 15 px,
  capped at 280 px width: **"No trades yet. Start a replay
  session to place your first trade."** Replaces the older
  icon + "START TRADING" CTA box (out per spec — "centered
  message"). The icon + button styles were removed.
- All 10 dead `tradeCard` / `tradeRow*` / `tradeSideBadge*` /
  `badgeLong` / `badgeShort` / `tradeSideText` / `tradePnl` /
  `tradeMeta` / `startCta` / `startCtaText` style entries
  deleted to keep the StyleSheet honest.

### Wiring — `JournalScreen.tsx`

- Imported `TradeCard`. Replaced the entire `EntryRow` component
  (and its style block: `row` / `rowWin` / `rowLoss` /
  `rowAccent` / `rowTop` / `rowMid` / `rowSymbol` / `rowSide` /
  `rowDate` / `rowPnl` / `rowR` / `rowNotes` / `delBtn` /
  `emotionTag` / `emotionTagText`) with a `<TradeCard ... />`
  inside `FlatList`'s `renderItem`. Mapping identical to the
  dashboard.
- `ItemSeparatorComponent` renders a 10 px spacer between cards
  (FlatList's separator pattern; `gap` on `contentContainerStyle`
  isn't supported uniformly across versions).
- Tap on the card opens the existing `EntryEditModal` (passed
  via `onPress`) — the modal + edit flow are completely
  unchanged.
- New empty-state copy matches the dashboard's, replacing the
  prior "No entries yet" / "Close a trade and tap…" pair.
- `useJournalStore`'s `removeEntry` is no longer destructured
  here — the row-level trash button is gone with `EntryRow`.
  The store action is unchanged and will be re-wired through
  the journal/notes/grading redesign (the next prompt).

### What the next prompt will need

Stuff temporarily missing from the JournalScreen list as of this
commit (logged so the next prompt knows what to restore):

- Per-row emotion pill, notes preview, R-multiple chip.
- Per-row delete affordance (or a swipe-to-delete pattern).
- Win/loss border-tint variant (currently the 3 px accent
  stripe carries that signal; if the next prompt's design
  wants a fuller tint, it can use the same color computation).

### Out of scope (deliberate)

- Trade journal / notes / grading (next prompt).
- Trade detail screen (tap-to-expand later).
- Filter / sort controls (later).
- Charts on the card (later).
- Trade placement logic + data model unchanged.

### Files touched

- `src/components/TradeCard.tsx` (new)
- `src/screens/DashboardScreen.tsx`
- `src/screens/JournalScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-14 — News button: economic calendar panel + 2022 event dataset

Pocket Trade replays historical dates; without economic-event
context, a 2 % move on CPI day looks identical to a 2 % move on
any other day. Surfacing the day's catalysts on the chart screen
is one of the moves that separates a training app from a toy.

### New file — `src/data/economicCalendar.ts`

**36 hardcoded 2022 events**, all U.S. Eastern time, schema:

```ts
{ date: 'YYYY-MM-DD', time: 'HH:MM', name: string,
  impact: 'high' | 'medium' | 'low', category: string }
```

| Category | Events | Time | Impact |
|---|---:|---|---|
| CPI (Inflation) | 12 monthly | 08:30 ET | high |
| NFP (Employment, first Friday) | 12 monthly | 08:30 ET | high |
| FOMC (Interest Rates) | 8 meetings | 14:00 ET | high |
| GDP Advance (Growth) | 4 quarterly | 08:30 ET | medium |

`getEventsForDate(dateString)` returns a fresh array sorted by
`time` (ascending). Empty array on a miss — callers don't have
to null-check. `ECONOMIC_EVENT_COUNT` constant exposed for
analytics + smoke checks.

Top-of-file comment flags 2022-only coverage; expand to 2021 /
2023 / 2024 as more historical replay scenarios land.

### New file — `src/components/EconomicCalendarPanel.tsx`

Slide-up `Modal` (animationType `'slide'`, `transparent`).
Backdrop tap dismisses; X-button in the header dismisses; the
`onRequestClose` handler covers the Android system back gesture.

Layout:
- Drag-handle pill at the top (visual sheet affordance).
- Header: `'ECONOMIC CALENDAR'` eyebrow + the pretty date
  (`'September 13, 2022'`, format hand-rolled to avoid
  `new Date()` device-timezone surprises) + X close button.
- Each event row: 10 px impact dot left of column (red /
  gold / 40-% white) + time (`'8:30 AM ET'`) + name + small
  category line (`'Inflation'`).
- Empty-day: centered `"No major events scheduled for this date."`
  at 50 % opacity.

Sheet bg `#0F0F0F`, top-border 1 px `#1F1F1F`. Matches the
project's panel chrome.

### Wiring — `src/screens/TradingScreen.tsx`

- The chart screen already had a News button in the top ribbon
  (between MagnetToggle and NEXT BAR). That button used to open
  the legacy `NewsPanel` (backend `/news` headlines, hidden in
  v1 per `PROJECT_CONTEXT`); its destination is now
  `EconomicCalendarPanel`. The `NewsPanel.tsx` component file is
  **preserved** (not deleted) — if a per-symbol headlines source
  becomes useful later, the wiring can be restored without
  rewriting the panel.
- Replay date is derived from `candles[N-1].time` (unix seconds)
  via the in-file `tzPartsOf(unixMs, 'America/New_York')` helper
  → composed into `YYYY-MM-DD`. ET because that's the event
  dataset's native zone, and the chart's session-clock is already
  ET-aligned for futures.
- `hasEventsToday = getEventsForDate(replayDateYMD).length > 0`
  drives a small 7 × 7 gold dot positioned absolutely in the
  top-right corner of the News button. Both `replayDateYMD` and
  `hasEventsToday` are `useMemo`'d on `candles` so each `NEXT
  BAR` re-evaluates if the date crossed midnight.
- Button `accessibilityLabel` flips between "News — economic
  events scheduled for this date" and "News — no events for
  this date" so screen readers convey the indicator's state.

### Icon library note

Spec specified the `Newspaper` glyph from `lucide-react-native`,
which still isn't installed in the project. The chart screen's
existing News button already uses Ionicons `newspaper-outline`
— that glyph stays. No new dependency.

### Out of scope (deliberate)

- Actual / forecast / previous numeric values (richer dataset
  needed — deferred).
- Live / real-time news (this is historical-replay only).
- Backend API for events (static client-side dataset for v1).
- Years other than 2022.
- Replay-date detection beyond the last candle's timestamp —
  the chart's session-time logic owns that; we just read it.

### Files touched

- `src/data/economicCalendar.ts` (new)
- `src/components/EconomicCalendarPanel.tsx` (new)
- `src/screens/TradingScreen.tsx` (import swap, replay-date
  derivation, gold-dot indicator on the News button, panel JSX
  replacement)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-14 — Dashboard: surface archetype identity in header

`docs/ONBOARDING_AUDIT.md` flagged that the archetype is revealed
during the quiz and then essentially forgotten. Identity-based
motivation only works if the identity is invoked repeatedly; the
Plan Summary screen already references it, this commit surfaces
it on the dashboard so the user sees "who they are" every time
they open the app.

### Placement

Top-left of the dashboard header, beneath the `@username` line —
replaces the generic "Your trading dashboard" subtitle that used
to live there. Layout:

```
┌──────────────────────────────────────────────────┐
│  @userhandle                  🔥 0    [ + ]      │
│  ⚡ Day Trader                                    │
└──────────────────────────────────────────────────┘
```

- Sigil glyph (20 px, gold #FFB800) — same `MaterialCommunityIcons`
  glyph each archetype uses on the reveal + Plan Summary screens.
- Archetype name in white 15 px / 700 weight beside it.
- 4 px top margin so it tucks under the handle without crowding.
- `numberOfLines={1}` on the name — paranoia against a future
  archetype with a longer label squeezing the streak badge.
- `headerLeft` gets `flexShrink: 1` + `paddingRight: 12` so a long
  handle can't push the StreakBadge off the screen.

Renders **only if `archetype` is set** — `archetype ?
ARCHETYPE_META[archetype] : null`. If it's somehow unset (broken
state restoration, deep link past onboarding) the header just
shows `@username` alone with no error.

### Icon source

`MaterialCommunityIcons` (already imported elsewhere in the
project via `@expo/vector-icons`) — same 4 glyphs as the
archetype reveal screen and the Plan Summary card:

| Archetype | Glyph |
|---|---|
| Scalper | `lightning-bolt` |
| Day Trader | `clock-outline` |
| Swing Trader | `chart-line-variant` |
| Position Trader | `anchor` |

### DRY note

This is the third inline copy of the archetype `name + icon`
mapping (the others live in `OnboardingArchetypeScreen` and
`OnboardingPlanSummaryScreen`). The prompt explicitly forbids
touching the onboarding screens, so consolidating them all into
a shared `src/data/archetypeMeta.ts` is deliberately deferred.
A short top-of-block comment in `DashboardScreen.tsx` flags the
convergence pass as a known follow-up. The mapping is 4 entries
of 2 fields — small and stable — so the cost of duplication is
low until we touch the archetype screen again.

### Out of scope (deliberate)

- No identity ("The Patient Sniper") here — just the archetype
  per the prompt; archetype is shorter and more personal.
- StreakBadge + add-button position unchanged.
- Rank badge, stats row, and all dashboard content below the
  header untouched.
- Onboarding screens untouched.

### Files touched

- `src/screens/DashboardScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-14 — Streak system: time tracking + daily check + increment/reset + freeze mechanics

The visual layer shipped this morning; this commit fills in the
mechanics. Streak now actually moves: it ticks while the user is
on the chart screen, completes today when they hit the goal, burns
freezes on missed days, resets when they're out of freezes. All
local-state, persisted via `zustand/middleware` + AsyncStorage.

### Expanded — `src/store/streakStore.ts`

Added persistence via `persist` middleware over `AsyncStorage`
(`zustand` is already 5.0.12; `@react-native-async-storage/
async-storage` 2.2.0 was already installed). Storage key
`streak-storage-v1`. Function fields are dropped automatically
by the serializer.

New fields:

| Field | Purpose |
|---|---|
| `todayDate: string` | YYYY-MM-DD that the today-bucket below applies to. Rolled over by both `performDailyCheck` and the first `addTrainingTime` that notices a stale date. |
| `todayTrainingMinutes: number` | Accumulated training time for `todayDate`. Reset on rollover. |
| `frozenToday: boolean` | A freeze was burned during today's daily check; the badge shows 'frozen' until tomorrow's rollover. |

Removed the raw `streakStatus` field — visual status is now
**derived** by `computeDisplayStatus(state)` (exported helper).
Components subscribe via `useStreakStore(computeDisplayStatus)`
which re-runs the selector on every state change.

Precedence inside `computeDisplayStatus` (matters when more than
one rule could fire):

1. `lastCompletedDate === today` →
   `MILESTONE_DAYS.includes(currentStreak)` ? `'milestone'` :
   `'active'`. Completing today always wins; a user who trained
   should never see 'frozen' all day.
2. `frozenToday` → `'frozen'`.
3. `currentStreak === 0 && lastCompletedDate === null` →
   `'new'` (a brand-new user who's never completed a day).
4. `currentStreak === 0` → `'broken'` (had a streak, lost it —
   `lastCompletedDate` stays set after reset so we can tell
   broken apart from new).
5. otherwise → `'at_risk'`.

Milestone days: **`[3, 7, 14, 30, 60, 100, 365]`** (the prompt
expanded the previous set by adding day 3).

Freeze cap: **3**. Freeze earning: every 7 streak days inside
`completeDaily()` — if `newStreak % 7 === 0` and freezes are
below the cap, +1 freeze.

#### Actions

| Action | Behavior |
|---|---|
| `addTrainingTime(minutes, dailyGoalMinutes)` | Rolls over today-bucket if stale, adds minutes, **auto-fires `completeDaily()`** if today's bucket just crossed the goal and today isn't already completed. |
| `completeDaily()` | Increments streak; sets `lastCompletedDate = today`; +1 freeze if streak hit a multiple of 7 (capped). Idempotent — repeats are no-ops. Clears `frozenToday` (completing today supersedes any earlier "freeze saved you" signal). |
| `performDailyCheck()` | Rolls over the today-bucket if stale; if `lastCompletedDate` is in the past (older than yesterday), counts missed days (`daysBetween(last, yesterday)`) and burns freezes one per missed day. If freezes run out mid-loop, streak resets to 0 and `lastCompletedDate` is preserved (so the badge reads 'broken'). |
| `consumeFreeze()` / `resetStreak()` / `reset()` | Manual mutators for dev/QA + onboarding wipe. |

Date helpers (`getTodayYMD`, `getYesterdayYMD`, `daysBetween`)
use device-local time and a `T00:00:00`-suffix midnight pinning
so the day count is DST-safe.

### New hook — `src/hooks/useStreakManager.ts`

Mounted in **`MainTabs`** (so it activates the moment the user
enters the main app post-onboarding; brand-new users in the
onboarding flow don't need it — their daily check is a no-op).

Behavior:
- Calls `performDailyCheck()` on mount.
- Subscribes to `AppState.addEventListener('change', ...)` and
  re-runs the check whenever the app returns to `'active'`.
- Stashes the latest `performDailyCheck` in a ref so the
  AppState handler always sees the live function reference
  without the effect needing to re-mount.

### New hook — `src/hooks/useTrainingTimer.ts`

Mounted in **`TradingScreen`** (the chart / replay screen).

Behavior:
- `setInterval(tick, 10_000)` while the host screen is mounted
  AND the app is foregrounded. Each tick calls
  `addTrainingTime(10/60, dailyGoalMinutes)` — i.e., 0.1667
  minutes (= 10 s) credited per tick.
- Pauses on `AppState.change → background`, resumes on
  `→ active`. Users can't accumulate "training" time while the
  phone is locked.
- Flushes any partial interval (≥1 s, < `MIN_PARTIAL_MS`)
  on stop / unmount so brief visits aren't rounded to zero.
- Reads `dailyTimeGoalMinutes` from `onboardingStore` via a ref
  so a goal change mid-session doesn't require remounting the
  timer.

The store-level `addTrainingTime` is the one that detects
"today's bucket just crossed the goal" and fires
`completeDaily()`, so the hook itself stays a thin tick loop.

### Wiring

- `App.tsx` (`MainTabs`): added `useStreakManager()` at the top.
- `src/screens/TradingScreen.tsx`: added `useTrainingTimer()` at
  the top of the component body.
- `src/screens/DashboardScreen.tsx`: replaced
  `useStreakStore((s) => s.streakStatus)` (the field no longer
  exists) with `useStreakStore(computeDisplayStatus)`. The badge's
  count selector is unchanged; only the status path moved to the
  derived computation.

### Persistence smoke

Verified by inspection: `persist` is wrapping the store factory,
storage key is `'streak-storage-v1'`, AsyncStorage is the backend.
Data fields persist; actions don't (functions aren't serializable).
A bumped key (`-v1` suffix) is in place for the inevitable schema
change once the milestone celebration screens land.

### Out of scope (deferred — see PROJECT_CONTEXT follow-ups)

- Firebase sync of streak data (cross-device + cross-install).
- Milestone celebration screens for day 3/7/14/30/60/100/365.
- Notification reminders tied to the streak (needs a dev build —
  Expo Go can't schedule local notifications under EAS-free).
- Midnight rollover while the app stays foreground all night:
  the next training tick or next AppState wakeup handles it; no
  in-session midnight timer.

### Files touched

- `src/store/streakStore.ts` (rewritten: persistence + new fields
  + actions + `computeDisplayStatus`)
- `src/hooks/useStreakManager.ts` (new)
- `src/hooks/useTrainingTimer.ts` (new)
- `App.tsx` (MainTabs: `useStreakManager()`)
- `src/screens/TradingScreen.tsx` (`useTrainingTimer()`)
- `src/screens/DashboardScreen.tsx` (use derived status)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-14 — Streak visual system: StreakBadge + streakStore + dashboard placement + screen 12 teaser

Ben specifically asked for a fire icon with a day-count; the audit
spec'd 5 visual states. This commit ships the **visual layer**
only — the actual increment / reset / freeze-consumption logic is
deferred (see PROJECT_CONTEXT follow-up #2). Visual is split
across two new files plus two screen edits so the logic follow-up
can hook into a stable component surface.

### New file — `src/components/StreakBadge.tsx`

Reusable component. Props: `count`, `status`, `size`.

Five visual states (`status`):

| State | Flame | Overlay | Count |
|---|---|---|---|
| `'active'` | gold `#FFB800` filled | — | white bold |
| `'milestone'` | orange-gold `#FF9500` filled + `textShadow` glow | gold sparkle (`star-four-points`) top-right | gold bold |
| `'at_risk'` | gold filled @ **0.35 opacity** | — | white @ 0.5 |
| `'frozen'` | gold filled | snowflake (`snowflake`, `#87CEEB`) bottom-right | white bold |
| `'broken'` | grey `#666` | red X (`close-thick`, `#FF4757`) bottom-right | grey `"0"` |

A sixth status `'new'` is an alias that renders identically to
`'at_risk'` — a brand-new user "has" an at-risk streak of 0
("train today to start") rather than a broken streak they never
had.

Two sizes (driven by a single `SIZES` config map at the top of
the file so future call sites can re-skin without forking):

- `'small'` — flame 24 px / count 14 px (dashboard header)
- `'large'` — flame 48 px / count 24 px (future celebration /
  profile)

#### Icon library caveat (recorded so the next reader doesn't trip on it)

The prompt referenced `lucide-react-native` (Flame, Snowflake, X,
Sparkles, Zap). That library is **not installed in this project**
— `@expo/vector-icons` is. Mapped to nearest MaterialCommunityIcons
glyphs:

| Lucide | MCI | Used for |
|---|---|---|
| Flame (filled) | `fire` | active / milestone / frozen / broken |
| Flame (outline) | *(no glyph)* | see below |
| Snowflake | `snowflake` | frozen overlay |
| X mark | `close-thick` | broken overlay |
| Sparkles | `star-four-points` | milestone sparkle |
| Zap | `lightning-bolt` | screen 12 teaser |

MCI doesn't expose `fire-outline` (verified against the type
definitions — TS error: "Did you mean 'file-outline'?"). For the
`'at_risk'` state we render the filled `fire` glyph at opacity
0.35 — reads as "ghosted flame", same intent ("streak alive but
dim, train today"). Documented inline.

#### Milestone glow without a new dep

Native RN doesn't have an icon-glow primitive; `expo-linear-
gradient` would be a new install. Workaround: MCI renders its
glyph as a `<Text>` element under the hood, so `textShadowColor /
textShadowOffset / textShadowRadius` propagate through to it and
produce a cross-platform halo at zero cost. Used here with an
orange-tinted shadow at `radius: 8` for a subtle bloom.

### New file — `src/store/streakStore.ts`

Zustand store, same pattern as `onboardingStore`. State:

```ts
currentStreak: number             // default 0
streakStatus: StreakStatus        // default 'new'
freezesRemaining: number          // default 2 (matches screen-12 copy)
lastCompletedDate: string | null  // default null
```

Plus `setStreak / setFreezes / setLastCompletedDate / reset`
mutators. **No business-logic actions yet** — the daily check /
increment / freeze consumption / milestone detection all live in
the deferred follow-up. The top-of-file doc-comment explicitly
flags this so a future reader doesn't expect them.

### Dashboard placement — `src/screens/DashboardScreen.tsx`

Header is a flex row with `space-between`. The right side
previously held one round gold + button; it's now a `headerRight`
flex row of two children: `<StreakBadge size="small">` (reading
live from `streakStore`) on the left, the existing add button on
the right. 14 px gap between them, vertically centered.

With the default store state (`0` / `'new'`), the dashboard
renders the ghosted flame + faded `0` — first-load reads as
"your streak is at 0, train today to start" rather than something
celebratory the user hasn't earned yet.

### Screen 12 teaser — `src/screens/OnboardingWelcomeScreen.tsx`

Inserted between the DAILY TRAINING GOAL card and the "Enter app"
CTA — a one-row flex with a small gold `lightning-bolt` (16 px,
the Zap equivalent) + "Your streak starts today." in white at 0.5
opacity, 13 px / 500 weight. Shares the existing `buttonOp`
fade-in so it appears at the same beat as the CTA.

**Deliberately NOT a StreakBadge with `"0"`** — per the prompt,
a literal zero count right before the user enters the app for the
first time reads as deflating. The spark + text is the right tone
for "this is about to start".

### Out of scope (deliberate)

- Streak increment / reset / freeze-consumption logic (deferred —
  PROJECT_CONTEXT follow-up #2).
- Milestone celebration screens (separate feature).
- Streak display anywhere beyond the dashboard header (profile,
  leaderboard, etc. — later).
- No new dependencies. (Specifically: no `lucide-react-native`,
  no `expo-linear-gradient`.)

### Files touched

- `src/components/StreakBadge.tsx` (new)
- `src/store/streakStore.ts` (new)
- `src/screens/DashboardScreen.tsx` (header right side)
- `src/screens/OnboardingWelcomeScreen.tsx` (teaser row)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-14 — Polish: splash timing + simulator trust line + auth button hierarchy

Three one-line-level fixes from `docs/ONBOARDING_AUDIT.md`, each
on a different screen with no interactions between them.

### Fix 1 — Splash auto-advance

`OnboardingSplashScreen.tsx`: `SPLASH_DURATION_MS` **1500 → 900**.
The audit flagged 1.5 s as long enough to register as a wait
rather than a brand flash. 900 ms keeps the logo on screen long
enough to read but is short enough to feel like a flash. Fade-in
duration (`FADE_IN_MS = 300`) unchanged — the logo is fully
visible at ~300 ms and holds for ~600 ms before the auto-advance.

### Fix 2 — Simulator trust line on Premise

`OnboardingPremiseScreen.tsx`: added one line of fine-print-
weight copy below the body block, above the "I'm in" CTA:

> Pocket Trade is a simulator. No real money. No accounts. No
> funny business.

Style: white at 0.45 opacity, 13 px / 400 weight / 18 px line
height, centered, 24 px top margin. Shares the body's existing
`textOpacity` fade-in so it doesn't introduce a new animation
beat. Pre-empts the "is this a real brokerage?" objection from
finance-wary users without slowing the pitch above.

### Fix 3 — Auth button hierarchy

`OnboardingAuthScreen.tsx`: demoted "Continue with email" from a
gold-bordered full-width button to a centered text link below
the Apple/Google SSO buttons. Audit rationale: the gold-bordered
email button was visually competing with the SSO options that
convert 15-25 % better — making email a text link concentrates
attention on SSO without removing the email option.

Changes:
- `AuthButton` type narrowed from `'apple' | 'google' | 'email'`
  to `'apple' | 'google'`. The `isEmail` branching, `emailBtn`
  and `emailBtnText` styles, and the dedicated mail icon are
  removed (dead code after the demotion).
- Apple + Google buttons unchanged — same white surface, full
  width, 56 px height, same icons, same mock auth handler.
- 16 px gap below the Google button (vs the 12 px `btnGap`
  between the two SSO buttons) — visually separates the SSO row
  from the demoted email option.
- New `<Pressable>` renders centered gold #FFB800 / 15 px / 600
  weight / underlined text "Continue with email". `hitSlop` of
  10 px on all sides keeps the tap target finger-friendly even
  though the visual footprint is smaller.
- `accessibilityRole="link"` (matches the visual demotion).
- Tap behavior unchanged: still calls `handleAuth('mock-email')`,
  spins for `MOCK_SPIN_MS`, navigates to `OnboardingWelcome`.
- Disabled state during the 500 ms mock spin: link goes to 0.4
  opacity, taps gated by `disabled={loading}` — matches the
  SSO buttons' disabled treatment.

### Out of scope (deliberate)

- Splash logo asset, fade-in duration, layout — unchanged.
- Premise headline, hero number animation, candle row, body
  copy, CTA — unchanged.
- Auth headline, recap, player card, fine print, Terms / Privacy
  link handlers, loading overlay, mock-auth latency — all
  unchanged.
- No new dependencies.

### Files touched

- `src/screens/OnboardingSplashScreen.tsx`
- `src/screens/OnboardingPremiseScreen.tsx`
- `src/screens/OnboardingAuthScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-14 — Screen 9 result: badge stamp + P&L counter + haptic on entry

`docs/ONBOARDING_AUDIT.md` called the First Strike result screen
the strongest moment in the flow and asked for the cheap polish
worth adding on a moment that matters: a stamp animation on the
badge, a haptic at impact, and a number-counter on the P&L. All
three for every outcome (FIRST STRIKE / FIRST BLOOD / FIRST STEP).

Animation library: React Native's built-in `Animated`. No new
dep. Native driver for opacity + transform on the badge / label /
copy / CTA. JS driver for the P&L counter — `Animated.Value`
listeners only fire on the JS thread, so the counter animation
runs on JS and writes each frame's value into React state via
the listener.

### Entrance timeline

All five steps are run inside one `Animated.parallel` with
explicit `Animated.delay`-based start times so each step hands
off cleanly without state machines.

| Step | Element | Start (ms) | Duration (ms) |
|---|---|---:|---:|
| a | "RESULT" eyebrow | 0   | 200 |
| b | Badge name — fade (130 ms) + spring scale 1.25 → 1.0 | 230 | spring |
|   | **Notification haptic at perceived stamp impact (~360 ms)** | 360 | — |
| c | P&L — fade (150 ms) + count 0 → final value | 420 | 600 |
| d | Body copy | 1050 | 250 |
| e | Continue button | 1420 | 240 |

Total ≈ **1.55 s** end-to-end. All timing constants are top-of-
file (`RESULT_T_*` / `RESULT_D_*`) so the choreography is
re-balanceable without hunting through the animation block.

### Badge stamp — the "stamp" feel

- Initial state: `scale: 1.25`, `opacity: 0`.
- Quick 130 ms opacity fade to 1 so the badge becomes visible as
  the spring fires.
- `Animated.spring(badgeScale, { toValue: 1, tension: 140,
  friction: 6 })` — tuned for a sharp settle with a single small
  overshoot. Higher friction made it feel like a slow shrink;
  lower wobbled.
- Native-driven transform — runs on the UI thread.

### Outcome-keyed haptic at impact

`setTimeout` fires at `RESULT_T_BADGE + 130 ms` (the spring's
first downward crossing of 1.0 from 1.25 with the chosen config
— that's the perceived "stamp impact"):

```ts
if (trade.badge === 'first_blood') {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
} else {
  // first_strike (win) + first_step (breakeven)
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
```

Captured + cleared in the effect's cleanup so a fast back-nav
doesn't ping the haptic motor after unmount. `Animated.spring`
`start(...)` callbacks fire at *settle*, not at *impact*, which
would land the haptic ~300 ms after the visible stamp moment —
hence the `setTimeout`.

### P&L counter

- `pnlValue: Animated.Value` animates from `0` → `trade.pnl`
  over 600 ms with `Easing.out(Easing.cubic)`.
- `pnlValue.addListener` writes each frame into React state
  (`displayPnl`); the existing `formatUSD(displayPnl)` formats
  it currency-style so e.g. `599.12 → "+$599.12"` mid-flight.
- The color rule (`trade.pnl > 0 ? GREEN : ...`) reads the
  **final** value, so the digits don't flicker from white to
  green/red as the counter crosses zero on the way up.
- For breakeven (FIRST STEP, `pnl === 0`), the counter is a
  no-op (0 → 0) and the text just shows `$0.00` throughout.
- Loss case (FIRST BLOOD, `pnl < 0`): counter ticks DOWN from
  0 to the negative value — `formatUSD(-599.12) → "-$599.12"`.

### Out of scope (deliberate)

- No sound effect — would require `expo-av`, a new dep, and the
  audit explicitly priced this as "cheap polish".
- Copy, colors, layout, the `formatUSD` formatter, P&L math,
  badge logic, and Continue navigation untouched.
- States A/B/C of screen 9 (intro / awaiting_trade /
  awaiting_advance) untouched.
- No other screen touched.

### Files touched

- `src/screens/OnboardingFirstTradeScreen.tsx` (ResultOverlay
  only — the other phases / sub-components are unchanged)
- `WORK_LOG.md`

---

## 2026-05-14 — Quiz: per-question layout variety (Q4 grid, Q3 poster tiles)

`docs/ONBOARDING_AUDIT.md` flagged quiz monotony: all 5
questions used identical chrome — progress dots, "QUESTION N OF
5" eyebrow, headline, vertical stack of 4 dark rounded cards.
Fix breaks the card layout on the two personality-proxy
questions (Q3, Q4) where the content is cheap to re-render
differently. Q1, Q2, Q5 stay as the vertical stack — their
options are content-heavy and the stack reads cleanly for them.

### Scoring untouched (deliberate, verified)

`OPTION_SCORES` is keyed by `'A' | 'B' | 'C' | 'D'` — the
position index, not the option text — and `handleAnswer(choice:
ArchetypeAnswer)` is called the same way from every layout
(`handleAnswer(OPTIONS[i])`). No change to:

- `OPTION_SCORES` matrix
- The `QUESTIONS[].options` array contents or order
- `computeArchetype` + tiebreakers
- The `archetypeAnswers` payload written to `onboardingStore`
- Per-archetype rarity stats on the reveal screen

The poster view re-titles option strings for *display only* via
a new sidecar `posterMeta` field — the underlying option
strings stay in `Question.options` exactly as before, so any
downstream consumer reading them (accessibility labels,
analytics) sees the unchanged source-of-truth text.

### Architecture — the `layout` field

`Question` now carries a `layout: 'stack' | 'grid' | 'poster'`
field:

| Q | Layout | Why |
|---|---|---|
| 1 — Winning trade still moving | `'stack'` | Long option text, needs full width |
| 2 — 2-day-old trade alert | `'stack'` | Long option text |
| 3 — Pick the show you'd binge | `'poster'` | Streaming-app metaphor begs for poster tiles |
| 4 — Which compliment | `'grid'` | One-word options — chip-friendly |
| 5 — When to be done thinking | `'stack'` | Long option text |

Renderer dispatches on `q.layout` inside the existing question
view — three explicit branches, no fall-through. Headline,
progress dots, "QUESTION N OF 5" eyebrow, fade-on-transition,
and auto-advance-on-selection are layout-agnostic and identical
across all 5 questions.

### Q4 — `'grid'` (2 × 2 chips)

- 2 × 2 grid of square chips, `aspectRatio: 1`.
- One-word options ("Fast.", "Sharp.", "Patient.", "Right.")
  rendered at **26 px / 800 weight / -0.4 letter-spacing** —
  oversize typographic statement that wouldn't fit on Q1/Q2's
  card heights.
- Same selection chrome as the stack: gold #FFB800 border
  on highlight, +1 px width to maintain visual weight.

### Q3 — `'poster'` (2 × 2 streaming-poster tiles)

- 2 × 2 grid of `aspectRatio: 3 / 4` tiles — taller than wide,
  reading as streaming-app thumbnails.
- Each tile renders a **gold sigil glyph** at the top
  (`MaterialCommunityIcons`), a bold **title** (16 px / 800
  weight), and a smaller **descriptor** (12 px / 70% white) at
  the bottom — visually distinct from Q1/Q2's wide cards.
- Title + descriptor split derived from the option text by a
  parallel `posterMeta` array on `QUESTIONS[2]`. Glyphs picked
  to thematically match each show length:

| Option (display only) | Icon | Why |
|---|---|---|
| 22-min Sitcom — "Fast, light, done." | `coffee-outline` | quick, casual |
| 1-hr Procedural — "Case opens and closes in one episode." | `magnify` | investigation |
| 8-ep Drama — "Full arc, satisfying." | `book-open-variant` | story arc |
| 5-season Epic — "In for the long haul." | `infinity` | endless commitment |

  (Originally tried `mountain` for the epic; not in
  `MaterialCommunityIcons` glyph set — replaced with `infinity`
  per the type-checker.)

- Same selection chrome: gold border + 1 px width on highlight.
  Padding shrinks by 1 px on selection to compensate so content
  doesn't shift on tap.
- Strictly on-brand: pure black base (#000), white text, gold
  (#FFB800) accent only. No images, no real show artwork.

### 2 × 2 grid scaffolding

Shared by both `'grid'` and `'poster'` layouts:

```ts
gridContainer: { gap: 10 }                               // row gap
gridRow:       { flexDirection: 'row', gap: 10 }         // col gap
gridCell:      { flex: 1 }                               // equal-width
```

Two explicit `<View style={gridRow}>` rows with two `gridCell`
children each. `flexWrap` would also work but explicit rows make
the layout obvious at a glance.

### Out of scope (deliberate)

- Scoring logic, option order, option text on `Question.options`
- Reveal screen (untouched)
- Q1, Q2, Q5 (still `'stack'` — identical to before)
- Top progress dots + "QUESTION N OF 5" eyebrow + headline
  styling + auto-advance behavior — unchanged
- No new dependencies (`MaterialCommunityIcons` already in via
  `@expo/vector-icons`)

### Files touched

- `src/screens/OnboardingArchetypeScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-14 — Rank Reveal: weighted YOU-indicator drop-in + re-sequenced entrance animation

Per `docs/ONBOARDING_AUDIT.md`, the Rank Reveal screen was the
second-strongest screen in the flow. One upgrade requested: the
"← YOU" indicator should *drop* into the Gambler row with weight
(a "thunk") instead of just fading in with the banner, and the
progress bar should fill **after** the user "arrives" so the
choreography reads as cause-and-effect (you land → your progress
shows).

Animation library: React Native's built-in `Animated` — no new
deps. Native driver for all transforms / opacities; the JS driver
is only used for the progress-bar width (RN can't run width
animations on the native thread).

### Re-sequenced timeline

Everything is parallelized with explicit delays so each step
hands off cleanly. Total runtime ≈ **2.45 s**.

| Step | Element | Start | Duration |
|---|---|---:|---:|
| a | Headline + subheadline | 0 ms | 280 ms |
| b | Gambler banner — opacity + scale (0.94 → 1) | 320 ms | 280 ms |
| c | "← YOU" — quick fade (90 ms) + spring drop | 640 ms | spring |
|   | **Medium haptic fires at first zero-crossing (≈ 790 ms)** | 790 ms | — |
| d | Progress bar — track fades in (120 ms) + fill 0 % → 10 % | 790 ms | 500 ms |
| e | "10 % toward Paper Hands" label | 1330 ms | 220 ms |
| f | Paper Hands → Sniper → Inside Trader → Market Maker (100 ms cascade) | 1550 ms | 220 ms each |
| g | Continue button | 2210 ms | 240 ms |

Trim-friendly: every `T_*` / `D_*` constant lives at the top of
the file so timing can be re-balanced without hunting through
the animation block.

### YOU-indicator drop-in (the "thunk")

The audit specifically called this out, so it's the most
considered part of the file:

- The Gambler row is now composed manually on the screen — a
  flex-row of `<RankBanner rank="gambler">` (no
  `showYouIndicator`) + an `<Animated.View>` wrapping the
  `"← YOU"` text. This lets the YOU label animate independently
  of the banner. `RankBanner` itself is **untouched**.
- The YOU label starts at `translateY: -18 px` + `opacity: 0`,
  then animates:
  - opacity 0 → 1 over 90 ms (so the label appears just as it
    starts dropping, not invisibly during the fall)
  - `Animated.spring(youY, { toValue: 0, tension: 120,
    friction: 7, useNativeDriver: true })` — tuned to a sharp
    drop with a small overshoot and a fast settle. Higher
    friction made the drop feel soft; lower friction wobbled.
- A `setTimeout` fires `Haptics.impactAsync(Medium)` at
  `T_YOU + 150 ms` — the empirical first zero-crossing of the
  spring. `Animated.spring` callbacks only fire at *settle*, so
  using them for the haptic would be too late by ~300 ms.
- The `setTimeout` is captured and cleared in the effect's
  cleanup so a fast back-navigation doesn't ping the haptic
  motor after the screen is gone.

### Progress block

Previously the progress bar started filling at 400 ms while the
Gambler banner was still fading in — premature, given the
"you've arrived" reading the audit wanted. Now the track and
fill don't start animating until the YOU indicator has landed,
and the "10 % toward Paper Hands" caption fades in only after
the fill completes. The label moved from a sibling fade-in to a
nested `Animated.Text` inside the progress block so its opacity
drives independently of the track wrapper's.

### Out of scope (deliberate)

- `RankBanner.tsx` untouched — no signature change, all other
  consumers still work.
- No content, copy, color, or layout changes.
- `handleContinue` still navigates to `OnboardingPlanSummary`.
- No new dependency — pure RN `Animated`.

### Files touched

- `src/screens/OnboardingRankRevealScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-14 — Screen 7: live player card preview + archetype-based handle suggestions

Two `docs/ONBOARDING_AUDIT.md` items on the Trader Name screen:
(1) the player-card preview wasn't reading as live; (2) the
handle suggestions ignored the archetype the user had just been
typed as.

### Change 1 — live player card preview (verified, no code change)

`PlayerCardPreview` was *already* prop-driven (`displayName`,
`handle`, optional `badge`, optional `rank`) and the Trader Name
screen *already* fed it the live store values. Trace:

```tsx
<PlayerCardPreview
  rank="gambler"
  displayName={displayName}  // from useOnboardingStore((s) => s.displayName)
  handle={handle}            // from useOnboardingStore((s) => s.handle)
/>
```

Each `TextInput` writes through to the store on every keystroke
(`onChangeText: (t) => setDisplayName(t)` / `setHandle(t)`),
which re-renders the screen with the new value and re-renders
`PlayerCardPreview` with the new prop. Empty values fall back to
the existing grey placeholder strings inside the preview itself
(`'Your Name'` / `'@your.handle'`).

The audit's "static template" complaint appears to predate the
current implementation. Verified by re-reading
`PlayerCardPreview.tsx` + `OnboardingTraderNameScreen.tsx`:
nothing to change on screen 7's wiring or the component itself.

Other consumers (confirmed by grep):
- `OnboardingAuthScreen` — also feeds the stored values; the
  saved name + handle appear on the auth recap card with the
  optional `firstTrade.badge`.
- `OnboardingRankRevealScreen` — *does NOT* use
  `PlayerCardPreview` (it uses `RankBanner` directly). The audit
  brief listed it as a consumer; not the case in the current
  code. Mentioned only so the next reader doesn't go looking.

Net: PlayerCardPreview stays prop-driven, no signature change,
no behavior change on Auth.

### Change 2 — archetype-tied handle suggestions

The 3-chip suggestions row + refresh button now pulls from a pool
keyed on `onboardingStore.archetype`. Pools are 8 handles each,
all of which already satisfy `isHandleValid` (lowercase
letters / digits / periods, 3-20 chars, no leading/trailing/
consecutive separators) but are filtered through that predicate
defensively at sample time so the validation rule remains the
source of truth.

| Archetype | Pool |
|---|---|
| Scalper | `scalp.07`, `tick.hunter`, `fast.hands`, `quick.draw`, `blade.runner`, `micro.moves`, `knife.edge`, `in.n.out` |
| Day Trader | `tape.reader`, `intraday.ace`, `price.action`, `the.close`, `session.07`, `chart.eyes`, `day.grind`, `market.hours` |
| Swing Trader | `trend.rider`, `swing.state`, `multi.day`, `wave.rider`, `the.swing`, `hold.steady`, `trend.07`, `swing.king` |
| Position Trader | `big.picture`, `long.game`, `the.thesis`, `conviction`, `macro.mind`, `long.haul`, `position.07`, `slow.steady` |

`generateSuggestions(archetype)` shuffles the 8-entry pool and
takes 3. The refresh button calls it again with the same
archetype — each tap shows a different cut (~6.7% chance of
matching the previous set with 8-pick-3 shuffles; the user
sees rotation).

Fallback: if `archetype` is `null` (shouldn't happen — the
archetype quiz runs before this screen — but the type allows
it), the old generic animal+number generator runs so the chip
row is never empty. The fallback also fires if a pool ever fails
the validity filter and drops below 3 entries.

### Files touched

- `src/screens/OnboardingTraderNameScreen.tsx` (suggestion pools +
  archetype plumbing into `generateSuggestions`)
- `WORK_LOG.md`

### Out of scope (deliberate)

- No change to `PlayerCardPreview.tsx` — already prop-driven.
- No change to `OnboardingAuthScreen.tsx` — already feeds props
  from store correctly.
- Headline, subheadline, field labels, helper text,
  `isHandleValid` rules, Continue behavior all untouched.

---

## 2026-05-14 — Onboarding: add Plan Summary screen between Rank Reveal and Auth

Per `docs/ONBOARDING_AUDIT.md`: 10 screens of user input followed
straight by the auth ask, with nothing between them that made the
captured inputs feel *earned*. The audit also called out that the
archetype was "a moment, not a thread" — it appears on screen 3
and is never referenced again. This new screen synthesizes
everything the user told us into one composed card right before
auth, so the auth ask reads as "save the plan we just built" rather
than "give us your email".

Onboarding flow is now **13 screens**. The new screen sits between
**Rank Reveal (10)** and **Auth (was 11, now 12)**.

### New file — `src/screens/OnboardingPlanSummaryScreen.tsx`

Reads-only consumer of `onboardingStore`. Layout:

1. Headline "Your trading plan" + subheadline "Built from everything
   you just told us." (centered, fade-in)
2. One composed summary card (CARD_BG `#0F0F0F`, 1 px `#1F1F1F`
   border, 16 px radius, generous inner padding). Card content,
   top to bottom:
   - **Identity anchor:** displayName (white 20 px bold) + `@handle`
     (white 0.5 opacity, 13 px). Baseline-aligned, wraps.
   - **Identity thread (prominent, gold-accented):**
     - "TRADES LIKE A" label → archetype name + sigil icon
       (`MaterialCommunityIcons`, gold #FFB800, 22 px). Glyphs match
       the archetype reveal screen exactly: `lightning-bolt`,
       `clock-outline`, `chart-line-variant`, `anchor`.
     - "BECOMING" label → identity name (e.g. "The Patient Sniper")
   - Divider (1 px `#1F1F1F`, 18 px vertical breathing room)
   - **Secondary rows** (label left, value right):
     - "Experience" → label from `EXPERIENCE_LABEL`
       (Never traded / Beginner / Intermediate / Experienced)
     - "Evaluation account" → `$50,000` formatted via
       `toLocaleString('en-US')`
     - "Training pace" → `COMMITMENT_LABEL`:
       - `light` → "Light · 3 sessions a week"
       - `steady` → "Steady · 1 session a day"
       - `pro` → "Pro · multiple sessions a day"
   - Divider
   - **Trajectory block:** "TRAJECTORY" label →
     `Gambler  →  Paper Hands` row (Gambler at 0.65 opacity, gold
     arrow, "Paper Hands" in gold #FFB800) → "~N weeks at this pace"
     estimate line (0.65 opacity). Pluralized correctly for `N === 1`.
3. Gold "Continue" CTA pinned to the bottom (standard onboarding
   CTA — 56 px, gold, black bold text, haptic Light on tap).

### Weeks-to-next-rank estimate

The Rank Reveal screen places the user at 10% toward Paper Hands
after the first trade, so ~9 more sessions × ~10% per session ≈ a
full bar. Translated to weeks via:

```ts
const SESSIONS_PER_WEEK = { light: 3, steady: 7, pro: 14 };
const weeks = Math.ceil(9 / SESSIONS_PER_WEEK[commitment]);
```

→ light = 3 weeks, steady = 2 weeks, pro = 1 week.

Pre-XP-system estimate by design. A comment in the file flags that
this should be swapped for actual remaining-XP / per-session-XP
math when the real rank XP system lands.

### Wiring

- `App.tsx`: imported `OnboardingPlanSummaryScreen` and registered
  it as `OnboardingPlanSummary` between `OnboardingRankReveal` and
  `OnboardingAuth` in the `FORCE_ONBOARDING_FLOW` stack.
- `OnboardingRankRevealScreen.tsx`: `handleContinue` now navigates
  to `OnboardingPlanSummary` instead of `OnboardingAuth`. No other
  changes — content and animation unchanged.

### Entrance animation

Staggered fade-in (~400 ms each) using native-driver opacity:
headline → card (180 ms delay) → CTA (420 ms delay). No layout
animation, no slide — kept deliberately quiet so the card itself
carries the moment.

### Data sources & lookups (all inline, in-file)

- `ARCHETYPE_META` — archetype → `{ name, icon }`. Same 4 glyph
  names as the archetype reveal screen. Kept inline rather than
  imported from `OnboardingArchetypeScreen.tsx` to avoid coupling
  the summary screen to that file's internals; the source-of-truth
  is short and stable.
- `IDENTITY_NAME`, `EXPERIENCE_LABEL`, `COMMITMENT_LABEL` —
  literal display strings matching the screens they came from.

### Out of scope (deliberate)

- No "calculating your plan" loading beat (skipped by request — the
  card is the moment; a loader would dilute it).
- Does NOT read or display `dailyTimeGoalMinutes` — that field is
  set on the Welcome screen, which comes *after* Auth.
- No RankBanner on this screen — screens 10 and 12 already use it.
- Rank Reveal screen content untouched, only its `handleContinue`
  navigation target.
- Auth screen untouched.
- No new dependencies (`MaterialCommunityIcons` already in via
  `@expo/vector-icons`).

### Files touched

- `src/screens/OnboardingPlanSummaryScreen.tsx` (new)
- `src/screens/OnboardingRankRevealScreen.tsx` (Continue
  navigation target)
- `App.tsx` (nav stack registration + import)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-14 — Screen 9 stabilization: dedicated chart + pre-baked scenario

The First Trade activation event was the highest-risk screen in
the onboarding flow because it depended on the production
`TradingChart` — a WebView host wired to `sessionStore` /
`positions` / `currentPrice` / backend session endpoints. An
earlier crash here ("Cannot read property 'c' of undefined")
traced to that plumbing reaching for bar data the onboarding flow
didn't have. This stabilization decouples screen 9 entirely:
hardcoded dataset, dedicated SVG chart, bounded reveal counter.
Out-of-bounds access on the activation event is now structurally
impossible.

Shipped in two commits:

### Commit 1 — `c580c74` — data + chart component

**`src/data/firstTradeScenario.ts` (new)** — hand-crafted
NQ-like 5-minute candle data, 33 bars total:
- Indices 0–29: gentle chop in the 11,490–11,520 range. Bar 29
  closes at **11,500** — the entry price.
- Indices 30–32: clean +30-pt **UP** move (11,510 → 11,520 →
  11,530). Exit at bar 32's close.

Move direction inverted from the previous inline dataset (was
DOWN). UP means **BUY → wins → FIRST STRIKE (+$600)** and
**SELL → loses → FIRST BLOOD (−$600)** on 1 NQ contract at
$20/point — meaningful but non-absurd (1.2% move on the default
$50K account).

Exports all scenario constants so the screen reads them by name
instead of magic numbers:

| Export | Value |
|---|---:|
| `FIRST_TRADE_ENTRY_INDEX` | 29 |
| `FIRST_TRADE_TOTAL_ADVANCES` | 3 |
| `FIRST_TRADE_MAX_REVEALED` | 33 |
| `FIRST_TRADE_POINT_VALUE` | 20 |
| `FIRST_TRADE_CONTRACTS` | 1 |
| `FIRST_TRADE_SYMBOL` | `'NQ'` |
| `FIRST_TRADE_DATE_LABEL` | `'2022-09-13 · 5m'` |

**`src/components/onboarding/OnboardingChart.tsx` (new)** —
focused SVG candlestick renderer (~170 lines, `react-native-svg`
which was already in the project — no new deps).

Key API change vs the retired `OnboardingMiniChart`: it accepts
a 1-based `revealedCount` instead of `currentIndex`. The chart
defensively clamps:

```ts
const safeCount = Math.max(0, Math.min(revealedCount, bars.length));
const end = safeCount;
const start = Math.max(0, end - windowSize);
const visible = bars.slice(start, end);
```

→ a `revealedCount` past the end of the array is a no-op slice,
not an undefined-bar crash. `revealedCount <= 0` renders nothing.

Sliding 20-bar window pinned to the latest revealed bar so newly-
revealed bars always appear at the right edge. 8% top/bottom
price padding so candles don't kiss the chart edges. `entryPrice`
included in the Y-axis range so the dashed entry line stays
in view even if visible bars trend past it. Entry line is
direction-tinted by the consumer via `entryColor` (green for
BUY, red for SELL).

Layout uses `onLayout` for the actual pixel width so the chart
works in any flex container without a hard-coded screen width.

### Commit 2 — `70f0729` — screen rewire + cleanup

**`src/screens/OnboardingFirstTradeScreen.tsx`** — rewired to
the new files:
- Inline `CANDLES` array (DOWN move) deleted; imports
  `FIRST_TRADE_BARS` from the scenario module.
- All scenario constants (`SYMBOL`, `DATE_LABEL`, `POINT_VALUE`,
  `CONTRACTS`, `ENTRY_BAR_IDX`, `TOTAL_ADVANCES`,
  `FINAL_BAR_IDX`) replaced with the named exports.
- State variable renamed `barIndex` → `revealedCount` to match
  the chart's API. Initial value is `FIRST_TRADE_ENTRY_INDEX + 1`
  (= 30; 1-based count). `handleNextBar` clamps the increment to
  `FIRST_TRADE_MAX_REVEALED` and bails early if clamping was a
  no-op — a stray 4th tap is now a no-op instead of a crash.
- `OnboardingMiniChart` import replaced with `OnboardingChart`.
  Props passed: `bars`, `revealedCount`, `entryPrice`,
  `entryColor` (green/red based on `tradeAction`), `height`.
- P&L computed from `FIRST_TRADE_BARS[revealedCount - 1].c` at
  the final reveal — direction (`buy: +1, sell: -1`) × point
  value × contracts.
- Badge mapping unchanged (`pnl > 0 → first_strike`,
  `pnl < 0 → first_blood`).
- `entryBadge` color now reads from a single `entryColor`
  variable instead of an inline ternary, since the chart needs
  it too.

**`src/components/onboarding/OnboardingMiniChart.tsx`** —
deleted. Grep confirmed no other code references; only WORK_LOG
+ PROJECT_CONTEXT mentioned it, both rewritten.

**`PROJECT_CONTEXT.md`** — "First Trade chart approach" section
rewritten to document the two-file architecture (scenario +
chart), the `revealedCount` clamping pattern, the prior crash
that motivated the decoupling, and the deliberate non-reuse of
the production `TradingChart`.

### Outcome
- BUY → +$600 → FIRST STRIKE (gold badge)
- SELL → −$600 → FIRST BLOOD (red badge, reframed positively)
- 4th tap on NEXT BAR → no-op (was potential crash)
- Zero coupling to `sessionStore`, `positions`, `currentPrice`,
  or any backend endpoint
- Type-check clean on screen 9; only pre-existing
  `iapService.ts` errors remain (unrelated, `react-native-iap`
  not installed)

### Out of scope (deliberate)
- Production `TradingChart` untouched; will be replaced wholesale
  by TradingView Advanced Charts when that application clears.
- No new dependencies (`react-native-svg` was already in the
  project).
- Visual layout of the screen (header, BUY/SELL buttons, NEXT
  BAR button, tooltip pulse, result overlay) unchanged.

### Files touched
- `src/data/firstTradeScenario.ts` (new)
- `src/components/onboarding/OnboardingChart.tsx` (new)
- `src/components/onboarding/OnboardingMiniChart.tsx` (deleted)
- `src/screens/OnboardingFirstTradeScreen.tsx`
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

---

## 2026-05-13 — Archetype reveal: rarity stat + sigil icon + trait bars + 'This is me' CTA

Four audit fixes from `docs/ONBOARDING_AUDIT.md` on the
archetype-quiz reveal screen. The reveal is the moment the app
tells the user "this is who you are" — used to be text-only; now
carries the visual + statistical weight to match its narrative
role. All new data lives in the existing `ARCHETYPE_INFO` config so
nothing's scattered.

### Change 1 — Rarity stat (computed, not fabricated)
Ran the existing `computeArchetype` scoring across all 4⁵ = 1024
possible answer paths to derive each archetype's natural quiz
distribution:

| Archetype | Paths | Rarity |
|---|---:|---:|
| Scalper | 136 | **13%** |
| Day Trader | 376 | **37%** |
| Swing Trader | 298 | **29%** |
| Position Trader | 214 | **21%** |

Sum = 100%. Hardcoded onto `ARCHETYPE_INFO[*].rarity` with an
inline comment showing the derivation; the script that produced
the numbers is in this commit's transcript so anyone can re-run
when scoring changes. Live user-based rarity is a future swap once
we have a population to count.

Rendered as: *"13% of traders match Scalper"* (white 0.6, 13 px,
600 weight, just below the archetype name).

### Change 2 — Gold sigil icon (above the name)
No `lucide-react-native` in the project (`@expo/vector-icons` is
the icon dep). Used `MaterialCommunityIcons` to match the Identity
screen pattern shipped earlier today.

| Archetype | MCI glyph |
|---|---|
| Scalper | `lightning-bolt` |
| Day Trader | `clock-outline` |
| Swing Trader | `chart-line-variant` |
| Position Trader | `anchor` |

All 40 px, gold `#FFB800`, centered between the eyebrow label and
the archetype name with `marginTop: 14`. All 4 glyphs are
visually distinct.

### Change 3 — 3-trait bar visual
New `TraitBar` subcomponent: 11 px uppercase label, `#1F1F1F`
6 px track with `borderRadius: 3` + `overflow: hidden`, gold fill
animating from `0%` → `value%` over 500 ms with
`Easing.out(Easing.cubic)`. JS driver (width interpolation can't
run on the native thread). Mount-once `useEffect` kicks the
animation. Three bars stacked with `gap: 12`, staggered by 0 /
80 / 160 ms so they cascade.

Trait values stored on `ARCHETYPE_INFO[*].traits`, 0-100 axis,
exact spec values:

| Archetype | Tempo | Patience | Conviction |
|---|---:|---:|---:|
| Scalper | 95 | 15 | 30 |
| Day Trader | 75 | 40 | 50 |
| Swing Trader | 40 | 75 | 70 |
| Position Trader | 15 | 95 | 90 |

### Change 4 — CTA label
*"Continue"* → *"This is me"*. Gold style + behaviour unchanged.
`accessibilityLabel` updated to match.

### Layout (top → bottom)
1. `YOUR CLOSEST MATCH` eyebrow (unchanged)
2. Gold sigil icon (new, 40 px)
3. Archetype name (50 px gold, was 52 — tightened by 2 px to
   accommodate the icon above without overflowing on smaller
   phones)
4. Rarity line (new)
5. Description (unchanged copy, tightened from 18→17 px to
   make room for the new elements below)
6. Trait bars (new)
7. "This is me" CTA (relabelled)

### Out of scope (deliberate)
- Quiz questions + scoring logic untouched — only read by the
  rarity computation.
- Archetype names + descriptions unchanged.
- No other screens touched.
- No new dependencies (uses already-installed `@expo/vector-icons`).

### Files touched
- `src/screens/OnboardingArchetypeScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-13 — Identity Selection: accordion cards + gold icons + scannable traits + Continue label

Four audit fixes from `docs/ONBOARDING_AUDIT.md` on screen 4
(Identity Selection). Same store contract, same navigation —
visual rebuild only.

### Change 1 — Accordion cards
- Collapsed (default for all 5 cards): gold icon (left, 26 px) +
  bold archetype name + one-line trait beneath. Hides the full
  description.
- Selected = expanded: same card gains the 2 px gold border AND
  reveals its full description below the trait. All other cards
  collapse back to the one-liner.
- Selection and expansion are unified — at most one card is ever
  expanded, no separate "tap to expand" affordance to confuse.
- All 5 collapsed cards now fit on iPhone-SE-class screens without
  scrolling (collapsed ≈ 65 px each, 5 + 4 gaps + headline +
  subheadline + CTA fits in ~605 px). ScrollView kept for safety.

### Change 2 — One-line traits (3-6 words, staccato)
- Patient Sniper → *"Waits. Strikes. Wins."*
- Process Machine → *"Same setup. Same size. Every time."*
- Risk Surgeon → *"Tight stops. Never bleeds out."*
- Calm Operator → *"Steady nerves when others panic."*
- Profit Compounder → *"Slow gains. Heavy compound."* (newly
  written to match the rhythm of the others; derived from the
  existing full description's "patience with capital growth"
  framing.)

Full descriptions stay verbatim — they show in the expanded state
when the card is selected.

### Change 3 — Per-archetype gold icons
No `lucide-react-native` in the project. Used
**`MaterialCommunityIcons`** from the already-installed
`@expo/vector-icons` — bundled with the SDK, no new dep. MCI was
chosen over Feather (also bundled) because Feather doesn't have a
`waves` glyph; MCI hits all 5 directly. Icons rendered at 26 px,
gold `#FFB800`, left of the text block with 12 px right-margin and a
1 px `marginTop` nudge to line up with the title's cap-height.

| Archetype | MCI icon |
|---|---|
| Patient Sniper | `crosshairs` |
| Process Machine | `cog` |
| Risk Surgeon | `pulse` |
| Calm Operator | `waves` |
| Profit Compounder | `trending-up` |

(For "Risk Surgeon" the audit suggested a medical/precision icon.
`pulse` — the heart-rate squiggle — conveys "tracking vitals,
doesn't bleed out" better than a literal scalpel would on a 26 px
target.)

### Change 4 — Continue button label
- Disabled (no card selected): label reads *"Pick a path to
  continue"* with the muted `#2A2A2A` bg + 0.5-opacity white text.
- Enabled (card selected): label reads *"Continue"* with full gold.
- `accessibilityLabel` updates in lockstep with the visible label.
- Single `ctaLabel` const computed off `ctaEnabled`; no duplicated
  text in the JSX.

### Out of scope (deliberate)
- Headline "Who do you want to BECOME?" + subheadline unchanged.
- `onboardingStore.identity` + `goalCategory` mapping unchanged —
  selection still saves the same values it did before.
- No accordion expand/collapse animation (instant render swap;
  ScrollView handles any overflow). Add LayoutAnimation later if
  the swap feels too abrupt.
- No other screens touched.
- No new dependencies.

### Files touched
- `src/screens/OnboardingIdentityScreen.tsx` (rewritten)
- `WORK_LOG.md`

---

## 2026-05-13 — Screen 12: forgiveness streak copy + drop 3+hr chip + link to Screen 8 commitment

Three audit fixes from `docs/ONBOARDING_AUDIT.md`, all on the
welcome screen. Copy + chip-list trim only — no store-shape changes
or navigation changes.

### Change 1 — Forgiveness streak copy (highest-impact audit item)
- Old card rule:
  *"Hit this goal in a day → +1 to your streak. Miss a day →
  streak resets to zero."*
- New rule:
  *"Hit your goal → +1 to your streak. Miss a day → a Streak Freeze
  protects it automatically."*
- New subline directly beneath (smaller, white 0.5):
  *"You start with 2 freezes."*
- New `cardBodyDim` style: 12 px regular, line-height 17, white 0.5,
  `marginTop: 6`. Reuses no existing class so the visual hierarchy
  reads "rule → footnote" cleanly.

This is **copy-only**. The Streak Freeze inventory mechanic (grant
2 freezes on signup, auto-apply on missed days, top up over time)
is part of the deferred streak-system follow-up — the on-screen
promise just matches what that system will deliver.

### Change 2 — Drop "3+ hours" chip
- `TIME_OPTIONS` shrank from 6 entries to 5: `15 / 30 / 60 / 90 / 120`.
  The `{ value: 180, label: '3+ hours' }` row was removed entirely.
- 30 min stays the default selection (store default unchanged).
- `dailyTimeGoalMinutes` no longer accepts `180` in practice. The
  store field is still typed as `number` (no enum narrowing — the
  valid set is enforced by the chip list), so no store-side change
  needed. If a stale `180` value ever made it into the store (e.g.
  hot reload during dev), it would round-trip safely — just no
  chip would show as selected.

### Change 3 — Subheadline links to Screen 8 choice
The two captures (frequency on screen 8, duration here) now read
as one coherent contract. Pull `dailyCommitment` from the store
and pick subheadline copy from a `SUBHEAD_BY_COMMITMENT` map:
- `light`  → "You're training 3 days a week. How long should each session be?"
- `steady` → "You're training once a day. How long should each session be?"
- `pro`    → "You're training multiple times a day. How long should each session be?"
- fallback (no commitment somehow set) →
  "How long should each training session be?"

The "You're in." headline above stays unchanged.

### Files touched
- `src/screens/OnboardingWelcomeScreen.tsx`
- `WORK_LOG.md`

### Out of scope (follow-ups)
- Streak Freeze inventory backend mechanic.
- Streak fire-icon visual on the dashboard.
- Time-tracking + actual streak increment / freeze application.
- No other screens touched.

---

## 2026-05-13 — Screen 12 redesign: daily time goal chips (replaces notification reminder)

Notification reminder concept retired entirely. Screen 12 now captures
a daily training time goal that drives a streak system: hit the goal
in a day → +1 streak, miss a day → reset to zero. Streak counter +
dashboard display + actual time-tracking inside the main app are
follow-ups; this screen just captures the goal.

### What changed

**`src/store/onboardingStore.ts`**
- Removed `notificationsEnabled: boolean` field.
- Removed `preferredReminderTime: string` field.
- Removed `setNotifications(enabled, time)` action.
- Removed `DEFAULT_REMINDER_TIME` constant.
- Added `dailyTimeGoalMinutes: number` field (default `30`, one of
  `[15, 30, 60, 90, 120, 180]`).
- Added `setDailyTimeGoal(minutes)` action.
- `reset()` updated.

**`src/screens/OnboardingWelcomeScreen.tsx`** (rewritten)
- "You're in." headline kept.
- Subheadline updated: *"Set your daily training time. Hit your goal
  every day to build your streak."*
- Notification card replaced with daily-goal card:
  - Small-caps `DAILY TRAINING GOAL` label.
  - 3-col × 2-row chip grid: 15 min / 30 min / 60 min / 90 min /
    2 hours / 3+ hours. Each row uses flex:1 chips with `gap: 8` so
    the columns are equal width on any screen.
  - Chip styling: unselected `#1A1A1A` bg + 1 px `#2A2A2A` border,
    selected adds 2 px gold (`#FFB800`) border with 1 px padding
    compensation so the layout doesn't jump on selection. White
    bold 16 px label.
  - **30 min preselected** because the store default is already
    `30` — gold border visible on mount, CTA enabled from the start.
  - Body copy below the chips: *"Hit this goal in a day → +1 to
    your streak. Miss a day → streak resets to zero."*
- Removed the entire time-picker modal + `TIME_OPTIONS` reminder
  list + `formatTime` helper.
- Removed `mockRequestNotificationPermission` function.
- Single full-width gold **"Enter app"** CTA at the bottom. Always
  enabled (a goal is always selected). Medium haptic on tap →
  `setDailyTimeGoal(value)` was written on each chip tap (so the
  current value is already in store) → `setOnboardingComplete(true)`
  → `navigation.reset({ index: 0, routes: [{ name: 'Main' }] })`.
- Removed the "Skip reminders for now" link entirely.
- Staggered fade-ins unchanged: headline → subheadline → card →
  CTA, each 320 ms with delays at t=0/200/400/600.

**`PROJECT_CONTEXT.md`**
- Onboarding follow-up #2 rewritten: "Notification scheduling
  logic" → "**Streak system implementation**". Spelled out as a
  cross-cutting task that touches dashboard + main app, not just
  onboarding. Sub-tasks: time-tracking, per-day increment, miss
  reset, dashboard counter, optional reminder notification.
- Follow-up #4 updated to include `dailyTimeGoalMinutes` in the
  backend-save payload list.

### Final onboardingStore shape after the full flow (screen 12 lands user on MainTabs)
```ts
{
  archetype, archetypeAnswers,
  identity, goalCategory,
  experienceLevel,
  accountSize,
  handle, displayName,
  dailyCommitment,
  firstTrade: { action, entryPrice, exitPrice, pnl, badge },
  authMethod, isAuthed: true,
  dailyTimeGoalMinutes,          // ← new in this commit
  onboardingComplete: true,
}
```
Notification fields are gone.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingWelcomeScreen.tsx` (rewritten)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

### Out of scope (follow-ups)
- Streak counter logic + dashboard display.
- Time-tracking inside the main app.
- Notification scheduling (deferred along with the streak system).
- Screens 1–11 untouched.

---

## 2026-05-13 — Mock notification permission for v1 (real wire-up deferred to Firebase auth follow-up)

The install of `expo-notifications` shipped with the prior screen-12
commit didn't take on the user's device — Metro kept failing to
resolve the module. Since real notification scheduling was already
deferred to the Firebase wire-up follow-up, replacing the permission
ask with a mock unblocks the flow without losing anything that
wasn't already on the deferred list.

### What changed

**`src/screens/OnboardingWelcomeScreen.tsx`**
- Removed `import * as Notifications from 'expo-notifications'`.
- Added `mockRequestNotificationPermission(): Promise<boolean>` — a
  `Promise` that resolves to `true` after 300 ms. Shape matches
  `Notifications.requestPermissionsAsync()` so the call site
  re-wires by swapping one line when the real flow lands.
- `handleEnable` now `await`s the mock instead of the real call.
  Always reports granted = true (the assumption being that v1
  optimizes for the happy path; real OS permission is re-asked when
  the real module wires in).
- `handleSkip` unchanged — still writes `notificationsEnabled: false`.

**`package.json` + `package-lock.json`**
- `expo-notifications` removed via `npm uninstall expo-notifications`.
  Metro will resolve cleanly on next bundle.

### Out of scope
- The quick-list time picker (preset 6 AM through 9 PM options)
  doesn't need `@react-native-community/datetimepicker` and ships
  unchanged — already a Modal of Pressable rows.
- Real OS permission ask, daily notification scheduling, and the
  reminder-time settings UI all stay on the Firebase wire-up
  follow-up list in PROJECT_CONTEXT.md.

### Files touched
- `src/screens/OnboardingWelcomeScreen.tsx`
- `package.json`
- `package-lock.json`
- `WORK_LOG.md`

---

## 2026-05-13 — Onboarding screen 12: Welcome + notifications opt-in (final screen, hand-off to home)

**Onboarding flow SHELL IS COMPLETE.** All 12 screens shipped end to
end. This commit finishes the loop by adding the welcome screen and
the navigation hand-off back to the main app's `MainTabs`.

Per `docs/ONBOARDING_RETENTION_RESEARCH.md` the notification opt-in
goes HERE — user has just experienced value (first trade + badge +
rank reveal), is motivated, and hasn't left the app. Optimal moment.
Framed against the daily-commitment promise the user made on screen
8, not as a generic OS prompt.

### What shipped

**`expo-notifications` installed** via `npx expo install
expo-notifications`. Bundled in Expo Go for local notifications +
permission flow; full remote push would need a dev-client rebuild.

**`src/store/onboardingStore.ts`**
- New state fields: `notificationsEnabled: boolean` (default
  `false`), `preferredReminderTime: string` HH:MM 24h (default
  `'09:00'`), `onboardingComplete: boolean` (default `false`).
- New actions: `setNotifications(enabled, time)`,
  `setOnboardingComplete(complete)`. `reset()` clears all three.

**`src/screens/OnboardingWelcomeScreen.tsx`** (rewritten from placeholder)
- "You're in." headline (38 px 800 bold, centered, tight letter
  spacing -0.8).
- Subheadline interpolates `dailyCommitment` via a `COMMITMENT_PHRASE`
  map: light → "three days a week" / steady → "every day" / pro →
  "every day, sometimes twice".
- Notification card: small-caps `DAILY TRAINING REMINDER` label,
  big 24 px tabular-nums time display (`9:00 AM` by default), gold
  underlined "Change time" link, body copy "We'll send one
  notification a day at your chosen time…".
- **Time picker:** quick-list modal (`Modal` + 9 preset times in a
  `Pressable` list). Selected option highlighted with gold border +
  gold text. Tap to pick → modal closes, card updates. Avoids
  `@react-native-community/datetimepicker` which isn't bundled in
  Expo Go.
- **"Enable reminders and enter"** — gold CTA. Tap →
  `Haptics.Medium` → `await Notifications.requestPermissionsAsync()`
  (wrapped in try/catch so a module hiccup doesn't break the flow)
  → `setNotifications(granted, preferredReminderTime)` →
  `setOnboardingComplete(true)` →
  `navigation.reset({ index: 0, routes: [{ name: 'Main' }] })`.
- **"Skip reminders for now"** — small white-50% underlined link
  below the CTA. Skips the permission request,
  `setNotifications(false, preferredReminderTime)`, same
  reset-to-Main hand-off.
- Either button marks `onboardingComplete: true` and clears the
  navigation stack so the user can't navigate back into onboarding.
- Staggered fade-ins: headline (t=0) → subheadline (t=200) → card
  (t=400) → buttons (t=600), each 320 ms native-driver opacity.

**`App.tsx`**
- Registered `<Stack.Screen name="Main" component={MainTabs} />`
  inside the `FORCE_ONBOARDING_FLOW` stack so the screen-12
  `navigation.reset` has a valid destination. `MainTabs` is the
  existing bottom-tab navigator defined in `App.tsx`.

**`PROJECT_CONTEXT.md`**
- Onboarding bullet rewritten: all 12 screens shipped. Follow-up
  task list spelled out:
  1. Real Firebase auth wire-up (replace screen-11 mock).
  2. Notification scheduling logic (screen 12 only requests
     permission; actual cron-style daily firing isn't wired).
  3. Onboarding-complete routing guard (skip the flow on relaunch
     when `onboardingComplete: true` and `FORCE_ONBOARDING_FLOW:
     false`).
  4. Backend save of the captured onboarding payload.

### Final onboardingStore shape (after the full flow)
```ts
{
  archetype, archetypeAnswers,
  identity, goalCategory,
  experienceLevel,
  accountSize,
  handle, displayName,
  dailyCommitment,
  firstTrade: { action, entryPrice, exitPrice, pnl, badge },
  authMethod, isAuthed: true,
  notificationsEnabled, preferredReminderTime,
  onboardingComplete: true,
}
```
All fields populated by the time the user lands on `MainTabs`.

### Out of scope (deferred to follow-ups)
- Real notification scheduling (just permission grant + stored
  preferred time for now).
- Settings UI for changing the reminder time post-onboarding.
- Backend save of onboarding data.
- Routing guard that skips onboarding on subsequent launches.
- Confetti / celebratory motion beyond the simple fade-in.
- Screens 1-11 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingWelcomeScreen.tsx` (rewritten)
- `App.tsx` (Main route added to onboarding stack)
- `package.json` + `package-lock.json` (`expo-notifications` added)
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

### Flow wired end-to-end
Splash → Premise → Quiz → reveal → Identity → Experience → Account
size → Trader name → Daily commitment → First Trade → result →
Rank reveal → Auth (mock) → **Welcome** (notification opt-in +
either CTA) → `MainTabs` (existing bottom-tab home screen).

---

## 2026-05-13 — Onboarding screen 11: Auth UI shell (mock auth, real Firebase integration deferred)

Per `docs/ONBOARDING_RETENTION_RESEARCH.md` the single
highest-leverage retention move in the funnel — defer-auth lift
(Duolingo +20% next-day retention). User has now invested 10
screens of work, made a first trade, earned a badge. Auth is
framed as "preserve what you built."

**This commit ships the UI shell with MOCK auth.** Real Firebase /
Apple SSO / Google SSO / email-password form is a follow-up prompt.

### What shipped

**`src/store/onboardingStore.ts`**
- New type: `AuthMethod` = `'mock-apple' | 'mock-google' | 'mock-email'`.
  Mock prefixes are intentional — when real Firebase lands the union
  extends to include the real method ids and these mock values can
  be removed in a single grep.
- New state fields: `authMethod: AuthMethod | null` (default `null`),
  `isAuthed: boolean` (default `false`).
- New action: `setAuth(method)` — sets `authMethod` and flips
  `isAuthed` to true in a single update.
- `reset()` clears both back to defaults.

**`src/components/onboarding/PlayerCardPreview.tsx`**
- New optional `badge?: FirstTradeBadge | null` prop. Renders a
  small black-on-color pill below `@handle` when set:
  `FIRST STRIKE` / `FIRST STEP` → gold `#FFB800` bg, `FIRST BLOOD`
  → red `#FF4757` bg. 11 px 900 bold black text, 1.4 letter-spacing,
  `paddingHorizontal: 9 / paddingVertical: 4`, 5 px radius,
  `alignSelf: flex-start` so it hugs the left edge.
- New optional `showYouIndicator?: boolean` prop (default `true`).
  Pass `false` on screen 11's recap so the banner reads as
  read-only — the "← YOU" affordance is for screens where the user
  is actively choosing their identity.
- Backwards-compatible — existing call site on screen 7 doesn't pass
  these props and gets the same visual as before.

**`src/screens/OnboardingAuthScreen.tsx`** (rewritten from placeholder)
- Headline "Save your progress" (32 px bold) + 3-sentence
  subheadline (white 0.75 / 15 px / 1.5 line-height).
- Recap: `<PlayerCardPreview rank="gambler" handle displayName
  badge={firstTrade?.badge ?? null} showYouIndicator={false} />`
  pulled live from the store. Below it, "Your trader name, rank,
  and first badge are saved when you sign up." at white 0.5 / 13 px.
- 3 auth buttons stacked with 12 px gaps:
  - **Continue with Apple** — white bg, black text + `Ionicons logo-apple` 22 px.
  - **Continue with Google** — white bg, black text + `Ionicons logo-google` 20 px.
  - **Continue with email** — transparent bg, gold (`#FFB800`) 1.5 px
    border, gold text + `Ionicons mail-outline` 20 px.
- All 56 px tall, 12 px radius, 17 px 700 bold label.
- Fine print: "By signing up you agree to our Terms of Service and
  Privacy Policy." with the two phrases as `<Text onPress>` links
  (white 0.8 underlined) that log to console for v1 — real link
  destinations come with the ToS / Privacy pages.

### Mock auth flow
1. Tap any of the 3 buttons → `setLoading(true)` + medium haptic.
2. ~500 ms `setTimeout` (mock latency so the spinner reads as a
   real round-trip).
3. `setAuth(method)` → store now has `{ authMethod, isAuthed: true }`.
4. `navigation.navigate('OnboardingWelcome')`.
5. Loading state intentionally not reset — the screen unmounts (or
   stays hidden under the welcome route) before the user could see
   the buttons re-enable.

A `position: absolute` overlay with `ActivityIndicator size="large"
color="#FFB800"` covers the screen while loading. `pointerEvents:
auto` so the user can't accidentally tap the fine-print links
during the spin.

### Entrance animations
Built-in `Animated`, no new deps. 3 per-element opacity values
fading in with staggered delays:
- t=0: headline + subheadline.
- t=200: recap (player card + caption).
- t=400: auth buttons + fine print.
Each fade is 320 ms, native driver.

### Other touches
- `src/screens/OnboardingWelcomeScreen.tsx` (new) — placeholder for
  screen 12 ("Welcome + notifications opt-in", the final onboarding
  screen).
- `App.tsx` — `OnboardingWelcome` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.
- `PROJECT_CONTEXT.md` — onboarding bullet updated to reflect
  screens 1-11 shipped + the explicit "AUTH IS MOCKED" note so
  future-us can't miss that real Firebase wire-up is still
  outstanding.

### Out of scope (deliberately deferred to follow-up)
- Real Firebase auth.
- Real Apple SignIn / Google SignIn SDK integration.
- Email/password form UI + validation.
- Terms of Service / Privacy Policy actual link destinations.
- Account recovery / forgot password.
- Profile picture upload.
- Screens 1-10 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/components/onboarding/PlayerCardPreview.tsx`
- `src/screens/OnboardingAuthScreen.tsx` (rewritten)
- `src/screens/OnboardingWelcomeScreen.tsx` (new)
- `App.tsx`
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Identity → Experience → Account
size → Trader name → Daily commitment → First Trade → result →
Rank reveal → Continue → **Save your progress** (player card recap
+ 3 auth buttons) → tap any → 500 ms spinner → "Screen 12
placeholder".

---

## 2026-05-13 — Onboarding screen 10: Rank progression reveal

Per `docs/ONBOARDING_RETENTION_RESEARCH.md` the "where you're going"
moment — cashes the identity check from screen 4 with a visible
progression ladder.

### Commit 1 — `RankBanner: add upNext + locked variants`
- `RankBanner` extended with two new optional props:
  - `upNext?: boolean` — overlays a small gold-text "UP NEXT" pill
    on a dark muted background (`#1A1A1A` bg / `#2A2A2A` border /
    `#FFB800` text / 9 px bold 1.2 letter-spaced) at the banner's
    top-right corner via `position: absolute`.
  - `locked?: boolean` — applies `opacity: 0.5` to the whole banner
    row (banner + any "← YOU" indicator), signaling a future rank
    not yet earned.
- API-compatible: existing call sites (`<RankBanner rank="gambler"
  showYouIndicator />` on the player-card preview) keep working.

### Commit 2 — `Onboarding screen 10: Rank progression reveal`

**`src/screens/OnboardingRankRevealScreen.tsx`** (rewritten from placeholder)
- Headline "Where you're going" (32 px bold white, centered) +
  subheadline verbatim from spec at white 0.75 / 15 px / 1.5
  line-height.
- 5 stacked rank banners using existing `RankBanner`:
  - **Gambler** — `showYouIndicator`, full opacity.
  - Progress bar wedged between Gambler and Paper Hands.
  - **Paper Hands** — `upNext`, full opacity.
  - **Sniper / Inside Trader / Market Maker** — `locked` (0.5 opacity).
- Vertical gap between banners: 10 px (via `gap` on the stack).
- **Progress bar**: 5 px tall, `#1F1F1F` track, gold `#FFB800` fill,
  4 px corner radius, label "10% toward Paper Hands" below (white
  0.6 / 12 px / centered).

**Staggered entrance** (`Animated.parallel` of per-element fade-ins,
each `Animated.sequence(delay → timing(280 ms, native driver))`):
- t=0: headline + subheadline
- t=200: Gambler banner
- t=400: progress block (track + label fade in) + **fill animates
  0% → 10% over 600 ms with ease-out cubic, JS driver** (width %
  needs the non-native driver)
- t=500: Paper Hands
- t=600: Sniper
- t=700: Inside Trader
- t=800: Market Maker
- t=1000: Continue CTA

Total animation ~1.3 s — coordinated, not draggy.

**Layout** — `ScrollView` for the stack so smaller phones get
scroll behaviour; Continue CTA pinned outside the ScrollView at
the bottom with safe-area-aware padding. CTA always enabled (no
gating — purely informational screen).

### Other touches
- `src/screens/OnboardingAuthScreen.tsx` (new) — placeholder for
  screen 11 ("Save your progress" deferred-auth moment).
- `App.tsx` — `OnboardingAuth` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

### State
No new persistence. Reads existing `onboardingStore.firstTrade`
implicitly via narrative ("Your first trade just moved the
needle"). The 10% fill amount is hardcoded for v1 — when the real
rank-XP system lands, it'll come from the store.

### Animation library
Existing built-in `Animated` from `react-native`. No new deps.

### Out of scope (deliberate)
- No tap-to-expand rank details.
- No comparison to other users.
- No XP system numbers beyond the 10% bar.
- Screens 1–9 untouched.

### Files touched
- `src/components/RankBanner.tsx` (commit 1)
- `src/screens/OnboardingRankRevealScreen.tsx` (rewritten — commit 2)
- `src/screens/OnboardingAuthScreen.tsx` (new — commit 2)
- `App.tsx` (commit 2)
- `WORK_LOG.md`

### Commits
- `3f8ccd8` — RankBanner: add upNext + locked variants
- (this commit) — Onboarding screen 10: Rank progression reveal

### Flow wired
Splash → Premise → Quiz → reveal → Identity → Experience → Account
size → Trader name → Daily commitment → First Trade → result →
Continue → **Rank reveal** (staggered ladder + progress bar
fills to 10%) → Continue → "Screen 11 placeholder".

---

## 2026-05-13 — Screen 9 — First Trade activation event

THE highest-leverage retention screen per
`docs/ONBOARDING_RETENTION_RESEARCH.md`. Required, can't-fail first
trade with a positive badge for every outcome.

### What shipped

**`src/store/onboardingStore.ts`**
- New types: `FirstTradeAction` (`'buy' | 'sell'`),
  `FirstTradeBadge` (`'first_strike' | 'first_blood' | 'first_step'`),
  `FirstTradeResult` (action, entryPrice, exitPrice, pnl, badge).
- New state field: `firstTrade: FirstTradeResult | null`.
- New action: `setFirstTrade(result)`. `reset()` clears it.

**`src/components/onboarding/OnboardingMiniChart.tsx`** (new, ~150 lines)
- SVG candlestick component. Slides a 20-bar window across the
  hardcoded 33-bar dataset so the current bar always sits near the
  right edge. Up/down candle colors `#00D395` / `#FF4757`.
- Optional `entryPrice` renders a dashed horizontal line, colored
  green/red to match the trade direction.
- Uses `onLayout` for actual pixel width — works in any flex layout.
- **Not the production TradingChart.** Rationale captured in
  `PROJECT_CONTEXT.md`: TradingChart is a heavy WebView with deep
  coupling to `sessionStore` / `positions` / `currentPrice` /
  backend endpoints, and will be replaced wholesale by TradingView
  Advanced Charts when the application is approved. Plumbing an
  onboarding-only flow through it would have spent more effort
  wiring + disabling than the inheritance was worth.

**`src/screens/OnboardingFirstTradeScreen.tsx`** (rewritten from placeholder)
- Four internal phases on a single screen — no extra routes:
  - **intro:** "Your first trade" overlay + 3-paragraph body + gold
    "Show me the chart" CTA. 300 ms fade-in.
  - **awaiting_trade:** chart visible (33 bars, paused at bar 29),
    pulsing tooltip "Tap BUY or SELL to place your first paper
    trade", large `BUY` (green) + `SELL` (red) buttons.
  - **awaiting_advance:** tooltip shifts to "Tap NEXT BAR to advance
    time and see what happens", gold `NEXT BAR · N LEFT` button.
    Three taps total; small entry-badge pill shows
    `BUY|SELL @ 11500` once the trade is placed; the dashed entry
    line follows it on the chart.
  - **result:** "RESULT" label, big bold badge (`FIRST STRIKE` gold
    / `FIRST BLOOD` red / `FIRST STEP` gold), `±$XXX.XX` P&L line,
    badge-specific body copy verbatim from spec, gold Continue CTA.
- **Curated dataset:** NQ 2022-09-13 (CPI day). 30 pre-event chop
  bars (11,490-11,520) + 3 advance bars dropping cleanly to 11,470.
  Hand-crafted 5-minute OHLC; deterministic so every user sees the
  same chart. Entry @ 11,500, exit @ 11,470, NQ point value $20 →
  `±$600` P&L either direction.
- Symbol/date header (NQ · 2022-09-13 · 5m) at the top during chart
  phases — gives the screen the "real data" feel even though the
  candles are hand-crafted.
- Light haptic on every tap (medium on BUY/SELL).
- 650 ms delay between the third NEXT BAR tap and the result
  overlay, so the final candle visibly paints before the modal.

**`src/screens/OnboardingRankRevealScreen.tsx`** (new)
- Placeholder "Screen 10 placeholder", pure black + white bold.

**`App.tsx`**
- `OnboardingRankReveal` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

**`PROJECT_CONTEXT.md`**
- "Onboarding rebuild" bullet updated to reflect screens 1–9
  shipped + the OnboardingMiniChart rationale.

### Store confirmation
After phase `result`, `useOnboardingStore.getState().firstTrade` is
`{ action, entryPrice: 11500, exitPrice: 11470, pnl: ±600, badge }`.
Screen 10 will read this to drive the rank progress bar movement.

### Locked dataset specifics
- File: hardcoded `CANDLES` array in `OnboardingFirstTradeScreen.tsx`.
- Entry bar index: 29 (close = 11,500).
- Final bar index: 32 (close = 11,470).
- Point value × contracts: $20 × 1 = $20/point.
- ±$600 P&L is non-trivial without being absurd on a $50K default
  account (1.2% loss / gain). Mirrors a realistic CPI-day NQ move.

### Out of scope (deliberate)
- No "Try again" / retake option.
- No leaderboard / social share.
- No archetype/identity-adaptive date selection — hardcoded for v1.
- No real backend data fetch — bundled candles only (keeps
  onboarding offline-resilient).
- Screens 1-8 untouched.

### Architectural flag
- The mini-chart is intentionally a sibling to TradingChart, not a
  replacement. When TradingView Advanced Charts replaces the
  production chart, this onboarding component can stay as-is OR be
  swapped for a similarly-locked TradingView config — either way no
  rip-out of session/backend plumbing needed.

### Files touched
- `src/store/onboardingStore.ts`
- `src/components/onboarding/OnboardingMiniChart.tsx` (new)
- `src/screens/OnboardingFirstTradeScreen.tsx` (rewritten)
- `src/screens/OnboardingRankRevealScreen.tsx` (new)
- `App.tsx`
- `PROJECT_CONTEXT.md`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Identity → Experience → Account
size → Trader name → Daily commitment → **First Trade**:
- intro → tap CTA →
- chart + tooltip on BUY/SELL → tap BUY or SELL →
- chart + tooltip on NEXT BAR → 3 taps →
- result overlay (FIRST STRIKE / FIRST BLOOD / FIRST STEP) → tap
  Continue → "Screen 10 placeholder".

---

## 2026-05-13 — Onboarding screen 8: Daily commitment (Light/Steady/Pro)

Habit-anchor screen. The chosen cadence sets the user's streak
target and (later) the cadence of any notifications. Middle option
pre-selected per Duolingo — aspirational nudge; user can downgrade
if it feels heavy.

### What shipped

**`src/store/onboardingStore.ts`**
- New type: `DailyCommitment` = `'light' | 'steady' | 'pro'`.
- New state field: `dailyCommitment: DailyCommitment` (default `'steady'`).
- New action: `setDailyCommitment(commitment)`.
- `reset()` restores `dailyCommitment` to `'steady'`.

**`src/screens/OnboardingCommitmentScreen.tsx`** (rewritten from placeholder)
- Headline "How often will you train?" + subheadline "Streaks build
  skill. Pick a pace you'll actually stick to."
- 3 cards (Light / Steady / Pro) with verbatim descriptions from
  spec. Same card style as screens 4/5/6 (`#0F0F0F` bg / 1 px
  `#1F1F1F` border / 14 px radius; selected adds 2 px gold border
  with 1 px padding compensation).
- Mutually-exclusive selection driven by store: card selected when
  `dailyCommitment === opt.id`. Light haptic on each tap.
- **Steady pre-selected** on mount because the store's default is
  already `'steady'` — gold border visible immediately, CTA enabled
  from the start. No extra mount-effect needed.
- CTA always enabled. On tap → navigates to `OnboardingFirstTrade`
  (no extra write to store; the latest selection is already there).
- 400 ms fade-in via `Animated.Value`.

**`src/screens/OnboardingFirstTradeScreen.tsx`** (new)
- Placeholder "Screen 9 placeholder", pure black + white bold.

**`App.tsx`**
- `OnboardingFirstTrade` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

### Store confirmation
`setDailyCommitment(id)` fires on every card tap with `'light'`,
`'steady'`, or `'pro'`. The CTA reads no extra state — store already
holds the latest selection when Continue is tapped.

### Out of scope (deliberate)
- No notification-permission prompt (deferred to screen 12).
- No streak-counter UI (post-onboarding).
- No back button.
- Screens 1-7 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingCommitmentScreen.tsx` (rewritten)
- `src/screens/OnboardingFirstTradeScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Continue → Identity → Continue
→ Experience → Continue → Account size → Continue → Trader name →
Continue → **Daily commitment** (Steady pre-selected) → Continue →
"Screen 9 placeholder".

---

## 2026-05-12 — RankBanner rewritten as pure SVG (no PNG asset)

User feedback after seeing the PNG-based banners in the app: drop the
image entirely and generate the banners in code so we can iterate on
visuals without art assets. Pure-SVG, vibrant per-rank color, unique
pattern per rank, clean outline.

### What shipped

**`src/theme/index.ts`** — rank palette updated to **vibrant**:
- `rankGambler:      '#333333' → '#C0C0C0'` (silver)
- `rankPaperHands:   '#888888' → '#00D395'` (brand green)
- `rankSniper:       '#B87333' → '#3B82F6'` (electric blue)
- `rankInsideTrader: '#C0A062' → '#A855F7'` (royal purple)
- `rankMarketMaker:  '#FFB800'` (brand gold, unchanged)

The earlier muted ladder was replaced — the artwork the user wants
matched uses bright saturated identity colors per rank.

**`src/components/RankBanner.tsx`** — rewritten from image-crop to
pure SVG (`react-native-svg`):
- ViewBox `1000 × 200` (5:1 aspect). On typical mobile widths
  (340-390 px), the banner renders at 68-78 px tall — squarely in
  the 60-80 px target the original prompt set.
- Solid black banner background so it blends with the `#000000`
  screen — only the vibrant elements (border / glyph / pattern /
  label) pop.
- 4 px rounded outline (18 px corner radius) stroked in the rank's
  vibrant color.
- **Per-rank pattern** (clipped to the rounded interior):
  - **Gambler:** diagonal silver stripes at 8% opacity.
  - **Paper Hands:** 10 ascending mini-candles in green at 18%.
  - **Sniper:** 4 horizontal scan lines + a faint concentric
    crosshair circle on the right.
  - **Inside Trader:** jagged city-skyline silhouette along the
    bottom edge at 22%.
  - **Market Maker:** dot grid covering the whole banner at 28%.
- **Per-rank glyph** on the left (100×100 SVG box):
  - Gambler: classic spade `<Path>`.
  - Paper Hands: three overlapping rotated quadrilaterals (crumpled
    paper).
  - Sniper: concentric circles + crosshair lines + center dot.
  - Inside Trader: doorway rectangle + small figure silhouette.
  - Market Maker: "M" monogram inside a circle.
- Vertical divider line (50% opacity) between glyph and label.
- Label rendered as `<SvgText>` with `letterSpacing={4}` on a
  `<TSpan>` — works around `react-native-svg`'s top-level
  `letterSpacing` quirks.
- `showYouIndicator` still renders the "← YOU" label to the right
  (unchanged).

**Asset:** `assets/ranks/rank_banners.png` **deleted** — no longer
needed. The image was only there for the crop approach.

### Reusability
API unchanged: `<RankBanner rank="gambler" showYouIndicator />` is
all you need. Future screens (profile, leaderboard, achievements)
drop it in and pass the rank — pattern + glyph + color all selected
from the `DESIGN` map by rank id.

### Files touched
- `src/theme/index.ts`
- `src/components/RankBanner.tsx`
- `assets/ranks/rank_banners.png` (deleted)
- `WORK_LOG.md`

---

## 2026-05-12 — RankBanner artwork + screen 7 uses it on the player card

Two-commit set. Replaces the text-based GAMBLER pill with the custom
banner artwork. Component is reusable for later profile / leaderboard
/ achievement screens.

### Commit 1 — `Add RankBanner component using custom artwork`
- **Asset:** `assets/ranks/rank_banners.png` (1774 × 887 px, total
  aspect 2:1; 5 banners stacked vertically). Copied from the user's
  attached image.
- **`src/components/RankBanner.tsx`** (new, reusable across the app).
  Props: `{ rank: Rank, width?: number, showYouIndicator?: boolean }`.
  - Per-banner aspect is **10:1** (1774 ÷ 177). The component crops
    via `overflow: 'hidden'` on an outer container at `aspectRatio: 10`
    (or fixed `width` if provided), with the source Image positioned
    absolutely at `width: '100%'`, `aspectRatio: 2` (matching source),
    and `top: '-N00%'` for rank index N — each `-100%` shifts the
    image up by exactly one banner slice.
  - No per-rank PNG files; cropping is purely runtime.
  - When `showYouIndicator` is true, renders a 11 px bold letter-
    spaced "← YOU" text to the right of the banner (8 px gap, white
    at 0.6 opacity, vertically centered).
  - `resizeMode: 'cover'` on the Image so the artwork stays sharp at
    any scale.

### Commit 2 — `Screen 7: use RankBanner on player card preview`
- **`src/components/onboarding/PlayerCardPreview.tsx`** simplified:
  - Removed the text-based GAMBLER pill (`rankPill` View + `rankText`
    Text + `RANKS` mapping table).
  - Removed the card's outer border / background / padding so the
    banner's black blends into the screen's pure black with no
    visible edge.
  - Wraps `RankBanner` with `showYouIndicator={true}`; display name +
    @handle render below as plain text on screen background.
- No changes to screen 7 itself — `PlayerCardPreview` consumed the
  same way; the player-card moment just looks different.

### Note on banner height
Source per-banner aspect is **10:1**, not the 5:1 the spec assumed.
At a phone screen width of ~340-390 px (banner fills available width
minus 24 px of side padding and the "← YOU" indicator slot), the
banner height comes out around **28-34 px** — shorter than the
prompt's 60-80 px target.

Honoring aspect was the right call for v1 (artwork looks crisp, no
distortion). If you want a taller banner, options are: (a) horizontally
crop the source to lose the right-side imagery (banner becomes
square-ish, just icon + label), (b) stretch vertically with
`resizeMode: 'stretch'` (artwork distorts), or (c) reduce screen
padding so the banner sits closer to the screen edges. Flag this in
smoke test and I'll iterate.

### Reusability
`<RankBanner rank="gambler" />` — that's the whole API for a banner.
Future screens (post-Commitment confirm, profile, leaderboard row,
achievements) can drop it in and pass the rank. The 5-rank type is
exported from the component for shared use.

### Files touched
- `assets/ranks/rank_banners.png` (new)
- `src/components/RankBanner.tsx` (new)
- `src/components/onboarding/PlayerCardPreview.tsx`
- `WORK_LOG.md`

### Commits
- `47d4923` — Add RankBanner component using custom artwork
- (this commit) — Screen 7: use RankBanner on player card preview

---

## 2026-05-12 — Screen 7: live player card preview with starting rank (Gambler)

Replaces the `gambler.` handle prefix with a visible **starting rank
pill** + a live player-card preview that updates as the user types.
The handle now feels like an identity moment instead of a form field.

### What shipped

**`src/components/onboarding/PlayerCardPreview.tsx`** (new, reusable)
- Props: `rank?: Rank`, `displayName: string`, `handle: string`. Default
  rank is `'gambler'`. Future screens can pass any of the 5 ranks.
- Layout: full-width card, `#0F0F0F` bg, gold-tinted border
  (`rgba(255, 184, 0, 0.2)`, 1 px, 14 px radius), 18 px padding,
  minHeight 108. Inside, top-to-bottom:
  1. Rank pill — `paddingHorizontal: 10 / paddingVertical: 4`, 6 px
     radius, bg from `colors.rank*`. Today only `GAMBLER` (muted grey)
     is wired.
  2. Display name — 23 px bold white. Placeholder `Your Name` at
     white 0.3 when empty.
  3. `@handle` line — 15 px white 0.6. Placeholder `@your.handle` at
     white 0.3 when empty.
- `numberOfLines={1}` on both text rows so absurdly long inputs don't
  blow up the card height.

**`src/theme/index.ts`** — rank palette updated per the new ladder:
- `rankGambler:      '#6B7280' → '#333333'` (muted grey)
- `rankPaperHands:   '#F59E0B' → '#888888'` (silver-grey)
- `rankSniper:       '#3B82F6' → '#B87333'` (bronze)
- `rankInsideTrader: '#A855F7' → '#C0A062'` (muted gold)
- `rankMarketMaker:  '#FFB800'` (unchanged — full brand gold)

The progression now goes from muted grey at the bottom (Gambler) to
full brand gold at the top (Market Maker). Gambler has no sparkle on
purpose — saves the flash for higher tiers.

**`src/screens/OnboardingTraderNameScreen.tsx`**
- Inserted `<PlayerCardPreview rank="gambler" displayName handle />`
  directly under the subheadline (`marginTop: 24`). Card values come
  straight from the onboarding store and update on every keystroke.
- Suggestion generator dropped the `gambler.` prefix and now weights
  the separator:
  - 60% none → `wolf42`
  - 30% underscore → `fox_15`
  - 10% period → `shark.88`
  - Helper `pickSeparator()` returns `'' | '_' | '.'`. The 16-animal
    pool is unchanged. All suggestions still satisfy
    `isHandleValid` by construction (length, charset, no consecutive
    separators, no leading/trailing separators).
- Handle input placeholder: `gambler.your.name` → `your.handle` so
  the input + the preview's @handle placeholder agree.

### Out of scope (deliberate)
- Crossfade animation between placeholder and live text — simple
  conditional rendering + opacity. The text content swap is
  effectively instant; if a true crossfade is wanted later we'd stack
  two Text elements and animate opacities.
- Continue button gating, validation, suggestions logic, keyboard
  handling — all unchanged.
- Screens 1-6 untouched.

### Files touched
- `src/components/onboarding/PlayerCardPreview.tsx` (new)
- `src/screens/OnboardingTraderNameScreen.tsx`
- `src/theme/index.ts`
- `WORK_LOG.md`

### Component location
`src/components/onboarding/PlayerCardPreview.tsx` (new
`onboarding` subfolder created — first screen-specific component
moves us toward grouping by feature area). Reusable for later
onboarding screens (e.g. the post-Commitment "confirm your trader"
moment if we want one) plus the profile / leaderboard cards later.

---

## 2026-05-12 — Onboarding screen 7: Trader name (handle + display name with auto-suggestions)

Per `docs/ONBOARDING_RETENTION_RESEARCH.md` Q5 — two-field model
modelled after Twitter / Discord. Handle is the unique URL /
leaderboard identifier; display name is the friendlier name shown on
profile cards. Auto-suggests 3 handles seeded with the user's current
rank prefix ("gambler") + random animal + 2-digit number.

**Uniqueness is deferred to signup (screen 11).** Here we only
format-validate.

### What shipped

**`src/store/onboardingStore.ts`**
- New state fields: `handle: string` (default `''`), `displayName: string` (default `''`).
- New actions: `setHandle(handle)`, `setDisplayName(displayName)`.
- `reset()` clears both. Each keystroke writes to the store, so the
  inputs are fully store-controlled — the screen is the consumer, not
  the owner.

**`src/screens/OnboardingTraderNameScreen.tsx`** (rewritten from placeholder)
- Headline "Pick your trader name" + subheadline.
- **HANDLE field** (small-caps label, `#0F0F0F` bg, `#1F1F1F` border,
  12 px radius, white bold 18 px text). Placeholder
  `gambler.your.name`. Auto-correct + auto-capitalize OFF.
  `selectionColor: gold`. On focus → border becomes 2 px gold with
  1 px padding compensation so the layout doesn't jump. Green check
  icon (`Ionicons checkmark-circle`, `#00D395`) appears at the right
  end of the input when format is valid.
  - Format validation (`isHandleValid`):
    - length 3-20
    - `^[a-z0-9._]+$`
    - no leading/trailing `.` or `_`
    - no consecutive `.` or `_`
  - Error text `Invalid handle format` shows only AFTER the user has
    typed at least one character (no nag on empty mount). Helper
    text otherwise: `3-20 characters. Lowercase letters, numbers,
    periods, and underscores only.`
- **SUGGESTIONS section**:
  - Label "SUGGESTIONS" + refresh `Ionicons refresh` button.
  - 3 chips generated client-side from a 16-animal pool
    (`wolf, hawk, fox, shark, bear, bull, tiger, lion, raven, viper,
    falcon, panther, eagle, cobra, jaguar, owl`) + random 10-99 number.
    Pattern: `gambler.<animal>.<num>`.
  - Picks 3 unique animals per refresh (shuffles + slices 3).
  - Tap chip → `setHandle(chip)` (store-driven; the input refreshes
    automatically). Light haptic.
  - Refresh icon → regenerate. Light haptic.
- **DISPLAY NAME field** — same visual style as HANDLE. Placeholder
  "What should we call you?". Auto-correct ON, auto-capitalize words.
  Helper: `1-24 characters. This is what shows on your profile.`
  Error `Too long` if > 24 chars (`maxLength` is set to 28 so the
  error can actually appear). Green check on valid (1-24 chars).
- **Continue button** disabled until BOTH fields format-valid (handle
  passes `isHandleValid`, display name length 1-24). Disabled visual:
  `#2A2A2A` bg, text at 0.5 opacity. Enabled visual: full gold. On
  tap → `Keyboard.dismiss()` + navigate to `OnboardingCommitment`.
- **Keyboard**:
  - `KeyboardAvoidingView` wraps the screen (iOS padding behavior).
  - `keyboardShouldPersistTaps="handled"` on the ScrollView so the
    suggestion chips and refresh icon stay tappable while the keyboard
    is open.
  - `TouchableWithoutFeedback` on the scroll content dismisses the
    keyboard on outer tap.
- 400 ms fade-in on mount.

**`src/screens/OnboardingCommitmentScreen.tsx`** (new)
- Placeholder "Screen 8 placeholder", pure black + white bold.

**`App.tsx`**
- `OnboardingCommitment` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

### Store confirmation
Every keystroke writes to `onboardingStore.handle` / `displayName`.
Suggestion taps go through the same `setHandle()`. The fields persist
across screen transitions (in-memory only — survives navigation, not
app reload).

### Out of scope (deliberate)
- Backend uniqueness check (deferred to signup).
- Profanity filter (server-side at signup later).
- Avatar / profile picture upload.
- "Import from social" buttons.
- Screens 1–6 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingTraderNameScreen.tsx` (rewritten)
- `src/screens/OnboardingCommitmentScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Continue → Identity → Continue →
Experience → Continue → Account size → Continue → **Trader name**
(handle + suggestions + display name; CTA gated) → Continue →
"Screen 8 placeholder".

---

## 2026-05-12 — Onboarding screen 6: Account size selection (5 preset tiers, $50K default)

Rewrites the prior commit (`17818b6`) to drop the custom-amount option
entirely. Choices stay constrained to the 5 prop-firm tiers so users
can't pick an unrealistic number ($999K etc.). Default remains $50K.

### Removed from the prior shipment
- `AccountSizeType` type.
- `accountSizeType` field on `OnboardingState`.
- `setAccountSize(size, type)` two-arg signature.
- Custom-amount modal (with `KeyboardAvoidingView`, numeric input,
  validation, inline error, Cancel/Confirm buttons).
- "Choose your own amount" link below the cards.
- "Custom: $XXX,XXX selected" gold pill above the CTA.
- Local state for `customOpen` / `customInput` / `customError`.

### What ships now

**`src/store/onboardingStore.ts`**
- `accountSize: number` — default `50_000`, one of the 5 prop-firm
  tiers (10/25/50/100/150K). No type/source flag.
- `setAccountSize(size: number)` — one-arg setter.
- `reset()` restores `accountSize` to the $50K default.

**`src/screens/OnboardingAccountSizeScreen.tsx`** (rewritten)
- Headline "Select your evaluation account" + subheadline.
- 5 preset cards (same `#0F0F0F` / `#1F1F1F` / 14 px-radius pattern;
  selected → 2 px gold border with 1 px padding compensation).
- $50K pre-selected on mount because the store's default is already
  `50_000` and the card's selection state derives from
  `accountSize === opt.value`.
- CTA always enabled (a value is always selected). Tap → writes
  nothing extra (value already in store); navigates to
  `OnboardingTraderName`.
- 400 ms fade-in on mount.

### Store confirmation
`setAccountSize(value)` is called on every preset tap with one of the
5 canonical numbers. The CTA reads no extra state — it just navigates,
since the store already holds the latest selection.

### Out of scope (deliberate, per the new spec)
- No custom-amount input (deleted from prior commit).
- No currency toggle.
- No "evaluation account" explainer popup — subheadline carries it.
- Screens 1–5 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingAccountSizeScreen.tsx`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Continue → Identity → Continue →
Experience → Continue → **Account size** ($50K pre-selected; tap any
preset to change) → Continue → "Screen 7 placeholder".

---

## 2026-05-12 — Onboarding screen 6: Account size selection (chips + custom)

Per `docs/ONBOARDING_RETENTION_RESEARCH.md` Q4 — prop-firm "evaluation
account" framing, preset chips at Apex/Topstep canonical tiers ($10K /
$25K / $50K / $100K / $150K). Default is $50K (most common Combine
size; teaches realistic position sizing). "Custom" is a less-prominent
text link so we don't nudge users into unrealistic numbers.

### What shipped

**`src/store/onboardingStore.ts`**
- New type: `AccountSizeType` = `'preset' | 'custom'`.
- New state fields (with sensible defaults so the user can advance
  without interacting):
  - `accountSize: number` — default `50_000`
  - `accountSizeType: AccountSizeType` — default `'preset'`
- New action: `setAccountSize(size, type)`.
- `reset()` resets both fields back to the $50K / `'preset'` default.

**`src/screens/OnboardingAccountSizeScreen.tsx`** (rewritten from placeholder)
- Headline "Select your evaluation account" (31 px bold white,
  centered) + subheadline ("This is your starting balance. You can
  practice as much as you want with it — losses don't follow you
  home.") at 15 px white 0.7.
- 5 preset cards (`PRESETS` array; descriptions verbatim from spec).
  Card style matches screens 4/5 — `#0F0F0F` bg / 1 px `#1F1F1F`
  border / 14 px radius; selected adds 2 px gold border with 1 px
  padding compensation so the layout never jumps.
- Card body: dollar amount (25 px bold white, formatted via
  `toLocaleString('en-US')`) over description (14 px white 0.7).
- "Choose your own amount" link below the cards — white 0.6,
  underlined, 15 px regular, centered.
- **$50K pre-selected on mount** because the store's default is
  already `{ accountSize: 50000, accountSizeType: 'preset' }` and the
  card's selection state is derived from the store. CTA therefore
  enabled immediately.
- Custom modal: `Modal` + `KeyboardAvoidingView`, centered card. Title,
  numeric `TextInput` (`keyboardType: 'number-pad'`, `autoFocus`,
  pre-filled with current `accountSize`), validation (must be between
  `$1,000` and `$500,000`), inline red error on invalid, Cancel +
  Confirm buttons. Strips non-digit characters before parsing.
- On Confirm with valid value: writes `(n, 'custom')` to the store,
  dismisses the modal, deselects all preset cards (selection derives
  from `accountSizeType === 'preset'`), and renders a gold pill above
  the CTA: `Custom: $XXX,XXX selected`.
- On Cancel / backdrop tap: dismisses without state change.
- CTA always enabled (preset baseline). On tap → navigates to
  `OnboardingTraderName`.
- 400 ms fade-in on mount (same pattern as screens 4/5).

**`src/screens/OnboardingTraderNameScreen.tsx`** (new)
- Placeholder "Screen 7 placeholder", pure black + white bold.

**`App.tsx`**
- `OnboardingTraderName` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

### Store confirmation
Both `accountSize` (number) and `accountSizeType` (`'preset' | 'custom'`)
are written to `onboardingStore` in a single `setAccountSize(size, type)`
call:
- Preset card tap → `setAccountSize(value, 'preset')`
- Custom modal confirm → `setAccountSize(parsed, 'custom')`

### Out of scope (deliberate)
- No slider for the custom amount — numeric input only.
- No USD/other-currency toggle.
- No descriptive popup explaining "evaluation account" — subheadline
  carries the explanation.
- Screens 1–5 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingAccountSizeScreen.tsx` (rewritten)
- `src/screens/OnboardingTraderNameScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Continue → Identity → Continue →
Experience → Continue → **Account size** ($50K pre-selected; tap a
preset OR open custom modal) → Continue → "Screen 7 placeholder".

---

## 2026-05-12 — Onboarding screen 5: Experience level

Per `docs/ONBOARDING_RETENTION_RESEARCH.md`: calibration screen. The
captured `experienceLevel` drives later personalization — first
replay difficulty, default contract size, and tooltip frequency.

Structurally identical to screen 4 (identity): headline + scroll-area
of selectable cards + bottom-anchored gated CTA + 400 ms fade-in. Card
visuals locked to the screen-4 pattern (unselected `#0F0F0F` bg / 1 px
`#1F1F1F` border / 14 px radius; selected `#0A0A0A` bg / 2 px gold
`#FFB800` border with 1 px padding compensation so the layout doesn't
jump on selection).

### What shipped

**`src/store/onboardingStore.ts`**
- New type: `ExperienceLevel` = `'never' | 'beginner' | 'intermediate' | 'experienced'`.
- New state field: `experienceLevel: ExperienceLevel | null` (default `null`).
- New action: `setExperienceLevel(level)`.
- `reset()` now clears the new field too.

**`src/screens/OnboardingExperienceScreen.tsx`** (rewritten from placeholder)
- Headline "How long have you been trading?" (32 px bold white, centered).
- 4 cards: Never traded / Beginner / Intermediate / Experienced — title
  21 px bold, description 14 px white 0.7. Card descriptions verbatim
  from spec.
- Mutually-exclusive selection, light haptic on each tap.
- CTA disabled (`#2A2A2A` bg, text 0.5 opacity) until selection; turns
  full gold on selection. On tap → writes `experienceLevel` to the
  store and navigates to `OnboardingAccountSize`.

**`src/screens/OnboardingAccountSizeScreen.tsx`** (new)
- Placeholder "Screen 6 placeholder", pure black + white bold.

**`App.tsx`**
- `OnboardingAccountSize` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

### Out of scope (deliberate)
- Screens 1–4 untouched.
- No icons / emojis on cards.
- No Firebase persistence (local-only per deferred-auth strategy).
- No back button.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingExperienceScreen.tsx` (rewritten)
- `src/screens/OnboardingAccountSizeScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Continue → Identity → Continue →
**Experience** (4 cards, gated CTA) → Continue → "Screen 6 placeholder".

---

## 2026-05-12 — Onboarding screen 4: Identity selection (Atomic Habits framing)

Per `docs/ONBOARDING_RETENTION_RESEARCH.md`: identity-based habits beat
outcome-based habits (Atomic Habits / James Clear) if the identity gets
reinforced with small wins. The chosen identity also maps to a
`goalCategory` that drives later coaching tips, push notification copy,
and personalized challenges.

### What shipped

**`src/store/onboardingStore.ts`**
- New types: `Identity` (`patient_sniper | process_machine | risk_surgeon | calm_operator | profit_compounder`), `GoalCategory` (`psychology | consistency | risk | profitability`).
- New state fields: `identity: Identity | null`, `goalCategory: GoalCategory | null`.
- New action: `setIdentity(identity, goalCategory)`.
- `reset()` now clears the new fields too.

**`src/screens/OnboardingIdentityScreen.tsx`** (rewritten from placeholder)
- Pure-black bg. Headline "Who do you want to BECOME?" (32 px bold,
  centered). Subheadline "Pick the identity you're working toward.
  Not what you are today." (16 px, white 0.7, regular).
- 5 identity cards stacked vertically inside a `ScrollView` so the
  layout never clips on shorter devices.
- Card visual states:
  - Unselected: `#0F0F0F` bg, 1 px `#1F1F1F` border, 14 px radius.
  - Selected: `#0A0A0A` bg, 2 px gold `#FFB800` border (paddings
    compensated by 1 px so the layout doesn't jump as the border
    grows).
  - Pressed (un-selected only): subtle 0.85 opacity feedback.
- Card body: title 21 px bold white, description 14 px white 0.7
  regular. Internal padding 18 × 16 px.
- Light haptic on each selection.
- Mutual exclusion: tapping a different card swaps the selection.
- CTA pinned at the bottom, safe-area-aware. **Disabled by default**
  (`#2A2A2A` bg, text at 0.5 opacity, `disabled` Pressable). Becomes
  full gold `#FFB800` once any card is selected. On tap → writes
  `(identity, goalCategory)` to the store and navigates to
  `OnboardingExperience`.
- Entrance: full-content fade-in over 400 ms (`Animated.Value`).
  Stagger-per-card was optional; skipped for v1 to keep the screen
  responsive and minimal.

**`src/screens/OnboardingExperienceScreen.tsx`** (new)
- Placeholder "Screen 5 placeholder", pure black + white bold.

**`App.tsx`**
- `OnboardingExperience` imported and added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false`.

### Identity → goalCategory mapping (locked)
- patient_sniper     → psychology
- process_machine    → consistency
- risk_surgeon       → risk
- calm_operator      → psychology
- profit_compounder  → profitability

The mapping lives next to the card data in `IDENTITIES[]` — `setIdentity`
is called with both values pulled from the chosen `IdentityOption`, so
the mapping is enforced in one place.

### Out of scope (deliberate)
- No tooltip / explanation modal — card descriptions ARE the
  explanation.
- No Firebase persistence (local-only per deferred-auth strategy).
- No retake / back button.
- No icons / emojis on the cards.
- Screens 1–3 untouched.

### Files touched
- `src/store/onboardingStore.ts`
- `src/screens/OnboardingIdentityScreen.tsx` (rewritten)
- `src/screens/OnboardingExperienceScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

### Flow wired
Splash → Premise → Quiz → reveal → Continue → **Identity** (cards +
gated CTA) → Continue → "Screen 5 placeholder".

---

## 2026-05-12 — Premise copy: 90 days; Quiz: drop Q6 (decision frequency)

Two small surgical updates.

### Change 1 — Premise supporting headline: "first year" → "first 90 days"
- `src/screens/OnboardingPremiseScreen.tsx`
- Same factual claim, more punchy framing. 95% hero number, body copy,
  CTA, bearish candle row, all animations — unchanged.

### Change 2 — Quiz drops to 5 questions
- `src/screens/OnboardingArchetypeScreen.tsx`
- Removed Q6 ("How often do you want to make a trading decision?") —
  redundant with Q1 (closure behaviour implies pacing) and Q5
  (session length).
- Everything else auto-adjusts because the UI derives from
  `QUESTIONS.length`: progress dots render 5 segments, counter reads
  `QUESTION X OF 5`, `REVEAL_STEP = 5`, scoring loops 5 times.
- `OPTION_SCORES` matrix, archetype mapping (A/B/C/D), tie-break logic
  — all untouched.
- File-top doc comment + the inline `step` comment updated to reflect
  the new count (0..4 questions, 5 = reveal).

### Scoring sanity (verified mentally)
Max points per archetype is now 10 (was 12), but the bias remains
balanced:
- All-A: scalper 10, day 5 → **Scalper** ✓
- All-B: scalper 5, day 10, swing 5 → **Day Trader** ✓
- All-C: day 5, swing 10, position 5 → **Swing Trader** ✓
- All-D: swing 5, position 10 → **Position Trader** ✓

### Files touched
- `src/screens/OnboardingPremiseScreen.tsx`
- `src/screens/OnboardingArchetypeScreen.tsx`
- `WORK_LOG.md`

---

## 2026-05-12 — Quiz V2: plain-language pass — remove trader jargon from Q1, Q5, Q6

Copy-only update. V2 questions assumed familiarity with trader
vocabulary (0.5R, trailing stop, high-conviction, "market open" /
"close" implying intraday calendar). Target users include aspiring
traders who've never placed a trade — rewriting to read naturally
without prior knowledge.

### Untouched (locked)
- Scoring matrix (`OPTION_SCORES`) — same uniform adjacency-weighted
  matrix applied identically to every question.
- Archetype mapping per option (A/B/C/D → Scalper / Day / Swing /
  Position).
- Tie-break rule (Q1-scored ∩ tied, then long-horizon priority).
- Reveal screen copy ("YOUR CLOSEST MATCH" + personality descriptions).
- Progress dots, card sizing, fade transitions — all unchanged.

### Copy changes (verbatim from spec)
**Q1** — text + all 4 options rewritten:
- Headline: "0.5R … move is still going strong" → "winning on a trade
  and the price is still moving your way".
- A: "you don't argue with a winner" — added "Take the profit now".
- B: "Scale half off, let the rest run" → "Take half the profit now,
  let the rest keep running".
- C: "trailing stop" → "safety stop" + explanatory framing.
- D: "I sized it for the full target" → "I picked my target before I
  entered".

**Q5** — headline kept; options A/B/C rewritten:
- A: "90 minutes after open" → "first hour or two — I'm in and out
  fast".
- B: "open to close" → "All day during market hours, but done by
  evening".
- C: "Check at lunch, again at the close" → "Check it briefly a
  couple of times during the day".
- D unchanged.

**Q6** — headline kept; options B/C/D rewritten:
- B: "pick my spots" → "pick my best moments".
- C: "wait for the right setup" → "wait for the right opportunity".
- D: "high-conviction only" → "only when I'm really sure".
- A unchanged.

**Q2, Q3, Q4** — fully unchanged (already plain).

### Scoring sanity (unchanged from previous commit)
- All-A → Scalper; all-B → Day Trader; all-C → Swing; all-D →
  Position. The matrix wasn't touched, just the prompts and option
  labels users see.

### Files touched
- `src/screens/OnboardingArchetypeScreen.tsx` (QUESTIONS array
  literals only)
- `WORK_LOG.md`

---

## 2026-05-12 — Quiz V2: 6 questions, 4 options each, quasi-ipsative scoring with adjacency

V1 had two problems: (1) on-the-nose questions self-aware traders
could game, (2) binary scoring biased the result to Scalper /
Position — Day Trader and Swing Trader almost never won. V2 swaps in
indirect scenario questions and a uniform adjacency-weighted score
matrix so middle archetypes can win. Full rationale:
`docs/QUIZ_V2_RESEARCH.md`.

### What changed

**`src/store/onboardingStore.ts`**
- `ArchetypeAnswer`: `'A' | 'B'` → **`'A' | 'B' | 'C' | 'D'`**.
- Everything else unchanged (still in-memory only; no Firebase).

**`src/screens/OnboardingArchetypeScreen.tsx`** (rewritten)
- **6 questions**, 4 options each. All copy verbatim from the prompt.
- `OPTION_SCORES` is **uniform across every question** — option order
  is locked A→Scalper, D→Position, with B/C awarding adjacency points:
    - **A:** Scalper +2, Day Trader +1
    - **B:** Scalper +1, Day Trader +2, Swing Trader +1
    - **C:** Day Trader +1, Swing Trader +2, Position Trader +1
    - **D:** Swing Trader +1, Position Trader +2
- **Tie-break** (`computeArchetype`):
    1. If the user's Q1 answer scored exactly one of the tied
       archetypes, that one wins.
    2. Else fall to long-horizon priority
       `['position_trader', 'swing_trader', 'day_trader', 'scalper']`
       — first match in the tied set wins.
- **Progress dots** are now 6 segments (was 4); `QUESTION X OF 6`.
- **Answer cards** shrunk to fit 4 stacked: `minHeight: 76`,
  `paddingVertical: 12`, font 16/22, gaps 10 px. `minHeight` (vs fixed
  height) lets longer option text wrap to 2-3 lines without cropping.
  Same dark surface / 1 px subtle border / gold-on-tap highlight as V1.
- **Reveal label**: `YOU ARE A` → **`YOUR CLOSEST MATCH`**.
- **Personality copy refined** (Scalper / Day / Swing / Position) per
  spec, verbatim.

### Scoring verified mentally
- All-B → Day Trader wins (scalper 6, day 12, swing 6). ✓
- All-A → Scalper. All-C → Swing. All-D → Position.
- 3A+3D → tied scalper/position; Q1=A scored scalper → Scalper wins.
- 3B+3C → tied day/swing; Q1=B scored both → fallback long-horizon
  → Swing wins.

### Out of scope (deliberate)
- Screens 1, 2, 4 untouched (no flow regression).
- No new dependencies.
- No "retake quiz" — forward-only.
- Visual chart preview question (Q5 from research's 18-candidate
  pool) deferred.

### Files touched
- `src/store/onboardingStore.ts` (answer-type widening)
- `src/screens/OnboardingArchetypeScreen.tsx` (rewritten)
- `WORK_LOG.md`

### Flow wired
Splash → Premise → tap "I'm in" → Q1/6 → tap → fade → Q2 … Q6 →
reveal ("YOUR CLOSEST MATCH" + archetype + new copy) → Continue →
"Screen 4 placeholder".

---

## 2026-05-12 — Onboarding screen 3: Trader Archetype Quiz with 4 questions and reveal

First interactive screen of the rebuild. 4 binary questions → reveal
one of Scalper / Day Trader / Swing Trader / Position Trader. Result
captured in the new onboarding store and used later (default chart
timeframe + replay date range curation). Per
`docs/ONBOARDING_RETENTION_RESEARCH.md` (locked flow + Q6 idea #2).

### What shipped

**`src/store/onboardingStore.ts`** (new)
- Zustand store matching the existing `src/store/*` convention.
- Fields: `archetype: Archetype | null`, `archetypeAnswers: ('A'|'B')[]`.
- Actions: `setArchetype(archetype, answers)`, `reset()`.
- **In-memory only.** Survives screen transitions; not persisted to
  AsyncStorage / Firebase per the deferred-auth strategy — we migrate
  everything captured during onboarding when the user signs up at
  screen 11.

**`src/screens/OnboardingArchetypeScreen.tsx`** (rewritten — was placeholder)
- Single screen, internal `step` state advances through 4 question
  views + a reveal view. No separate routes.
- **Top band** (questions only): 4 progress dots (gold filled for
  `i <= step`, white 30% for unfilled) + `QUESTION X OF 4` counter
  (white 60%, 13 px, 1.5 letter-spacing).
- **Question view**: headline (white bold 30 px), two answer cards
  stacked. Cards: 120 px tall, `#0F0F0F` bg, 1 px `#1F1F1F` border,
  16 px radius; white bold 20 px label centered. On tap → card border
  briefly becomes gold (2 px), 180 ms fade-out, state advances,
  220 ms fade-in. `transitioning` ref guards against double-taps.
  Light haptic on each tap.
- **Reveal view** (after Q4): `YOU ARE A` label (white 60%, 14 px,
  letter-spacing 2) + huge gold (`#FFB800`) archetype name (52 px) +
  personality description (white bold 18 px, line-height 27, max 85%
  width). Bottom: full-width gold "Continue" CTA matching screen 2's
  "I'm in" style.

### Scoring + tie-break
- Each question's A/B answer awards 1-2 points across the four
  archetypes (spec exact values).
- After Q4: sum totals; pick the highest.
- Ties resolved by `TIE_PRIORITY: ['day_trader', 'swing_trader', 'scalper', 'position_trader']`
  — Day Trader > Swing > Scalper > Position (most generally-applicable
  wins). The function iterates this list and only overwrites the
  winner on strictly-greater score, so earlier entries win ties.

### Personality copy
Per spec, verbatim:
- **Scalper:** "You live in the moment. Quick decisions, tight risk, dozens of trades a day. Your edge is speed."
- **Day Trader:** "You read price action and act decisively. In and out within hours. Your edge is pattern recognition."
- **Swing Trader:** "You wait for the right setup, then ride it for days. Patience is your weapon. Your edge is timing."
- **Position Trader:** "You see the big picture. Hold positions for weeks or months. Your edge is conviction."

### Other touches
- `src/screens/OnboardingIdentityScreen.tsx` (new) — placeholder
  "Screen 4 placeholder", pure black bg, white bold text. Lands here
  on tap of Continue.
- `App.tsx` — `OnboardingIdentity` imported + added to the
  `FORCE_ONBOARDING_FLOW` stack with `gestureEnabled: false` (matching
  Premise + Archetype — no backwards swipe through the funnel).

### Out of scope (deliberate)
- Real swipe gestures on the answer cards (buttons only for v1).
- Firebase persistence (in-memory store only).
- A "back / retake the quiz" affordance (forward-only for v1).
- Audio / particle effects on the reveal.
- Screen 4 beyond the placeholder.

### Files touched
- `src/store/onboardingStore.ts` (new)
- `src/screens/OnboardingArchetypeScreen.tsx` (rewritten)
- `src/screens/OnboardingIdentityScreen.tsx` (new)
- `App.tsx`
- `WORK_LOG.md`

### Flow wired end-to-end
Splash → Premise (with tick-up + bearish row) → tap "I'm in" → Q1 →
Q2 → Q3 → Q4 → archetype reveal → tap Continue → "Screen 4 placeholder".

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
