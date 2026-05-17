# Pocket Trade — Project Context

> **READ THIS FIRST** at the start of every new Claude session. This file is the single source of truth — keep it current. After any major decision, file change, or block completion, update this file and commit it.

## REPO

- GitHub: https://github.com/ttradez/pocket-trade (private)
- Local: `C:\Users\benti\trading-app`
- Owner: `ttradez`

## MULTI-CLAUDE ORCHESTRATION

Three Claude sessions are in active use. They cannot talk to each other directly — the user is the bridge.

| Role | Session | Best for |
|---|---|---|
| Director | Claude Remote (browser claude.ai) | Decisions, prompts, Firebase walkthrough (screenshots), planning |
| Implementer | Claude Code on the web (claude.ai/code, repo `ttradez/pocket-trade`) | Spec docs, code edits, repo commits |
| Local | Claude Code in user's terminal | Local file ops, machine-specific tasks |

PROJECT_CONTEXT.md is the shared state. Anything important must be written here and committed so all sessions see it on next read.

## SOCIAL

- 3-tab leaderboard: Global / Monthly / Weekly + Tournament tab during active tournaments
- Public profiles: rank, P&L, win rate, profit factor, total trades, badges, recent public trades
- Trade sharing: post closed trades to public feed
- Private friend-group leaderboards
- No follow/feed-of-followed-users in v1

## DASHBOARD

Shows: rank badge, total trades, win rate, profit factor, expectancy, avg win, avg loss, R:R, max drawdown, equity curve, best/worst trade, full trade journal with notes + filtering, tournament history.

## SETUP LIBRARY

Browseable encyclopedia of named trading patterns — the "curriculum" layer. **Now Classic (15) + ICT (13) = 28 total setups**, split by a Classic/ICT segmented control. Classic: 5 categories (momentum / reversal / range / news / pattern). ICT: 4 categories (structure / entry / liquidity / time) with a violet `#9B59B6` label accent and a soft rank gate (intermediate concepts unlock at Paper Hands, advanced at Sniper — locked cards dim + show a lock modal instead of the detail). Each setup has a description, how-to-trade, numbered key rules, and 2-3 real 2022 NQ/ES historical examples that deep-link straight into a replay (same `dailySetup` route param as Daily Mission / Saved Setups). Data in `src/data/setupLibrary.ts`; **expandable** — add entries to `SETUP_LIBRARY` with `section: 'ict'` (no screen changes needed). Entry points: a Zone-1 dashboard card and a book icon in the chart header. Deferred: per-setup completion tracking (badges/XP), user-created setups (Firebase), cross-section search, more ICT concepts (AMD, PO3, IPDA, Turtle Soup).

## TRADE JOURNAL

Auto-popup on trade close. Auto-fills: symbol, direction, entry/exit, size, SL/TP, P&L, R-multiple, session date (revealed only here), news snapshot. User adds optional notes.

## BRANDING — locked 2026-05-12

- **Backgrounds: pure black `#000000`** (locked — no navy, no dark blue). Card surface `#0F0F0F` for subtle lift on cards where black-on-black would lose depth; default border `#1F1F1F`.
- **Text:** white `#FFFFFF`, **bold default** (`fontWeight: 700`). Secondary text `#9CA3AF`, tertiary `#6B7280`.
- **Font:** clean modern sans-serif — **Inter preferred** (not yet bundled via `expo-font`; once loaded, swap `font.sans` / `font.sansBold` in `src/theme/index.ts`), **system fallback** otherwise (San Francisco on iOS, Roboto on Android).
- **Accents (semantic):** gold `#FFB800`, gain green `#00D395`, loss red `#FF4757`. Used for buttons, BUY/SELL, P&L, candle up/down (`DEFAULT_CHART_THEME`).
- **Monospace** (`SpaceMono-Regular` / `-Bold`) for ALL numbers: prices, P&L, percentages, balances.
- Vibe: prop-firm-meets-Robinhood
- Logo: placeholder "PT" gold on dark with candlestick

## LEGAL

- Splash screen disclaimer on first launch (must dismiss)
- ToS and Privacy Policy as Markdown files in `legal/` (not yet drafted)
- LEGAL_DISCLAIMER.md notes lawyer review needed before publishing

## BUILD STATUS

### COMPLETE (16 master-spec blocks)
- Backend: db.py, main.py (FastAPI + all endpoints), data_pipeline (symbol_map, fetch_stooq → yfinance, fetch_kaggle_intraday, data_ingest, fetch_news scaffold)
- Frontend: authStore, sessionStore, api service, iapService, TradingChart, OrderPanel, TradingScreen, DashboardScreen, LeaderboardScreen, DisclaimerScreen, App.tsx, app.json rebranded
- SETUP.md created
- PROJECT_CONTEXT.md created

### VERIFIED (7 integrity checks all passed)
1. yfinance fetch — works, all 14 symbols, real OHLC confirmed
2. Advance endpoint — server-computed bar_index, no real timestamps to client, GET /sessions/{id} resume endpoint
3. Tournament score — exact spec match (final_balance × min(1.5, profit_factor/2) × min(1.5, win_rate/0.5) × max(0.5, 1−max_drawdown_pct); zero if PF≤1.0 OR WR<0.30)
4. Rank recalc — fires on every trade close, rolling 200 trades, exact thresholds (Gambler/Paper Hands/Sniper/Inside Trader/Market Maker)
5. Multiple positions — JSON array, all positions checked per bar for SL/TP
6. News snapshot — honest empty array, TODO wire real source
7. State persistence — AsyncStorage + server rebuild on mount

### VERIFIED CLEAN (previously pending)
- symbol_map.py renames via STOOQ_MAP — actual files in `backend/data/daily/`: SPX.csv, NDX.csv, DJI.csv, DAX.csv, FTSE.csv, N225.csv, ES.csv, NQ.csv, YM.csv, CL.csv, GC.csv, SI.csv, NG.csv, ZB.csv. No `ES=F.csv` filenames anywhere.
- fetch_kaggle_intraday.py wired correctly: KAGGLE_MAP only has clean_SPY.csv→ES, clean_QQQ.csv→NQ; resamples to 5m/15m/30m/1h/4h.

### IN FLIGHT
- **Drawing tools: DEPRECATED — TradingView Advanced Charts application SUBMITTED 2026-05-12.** The custom SVG drawing system is retired in favor of TradingView's library. **Awaiting 3–10 business day approval response.**

  **Application details (for reference if TradingView reaches out):**
  - Product: **TradingView Advanced Charts** (private repo access)
  - Signatory: **Zachary James Titus**
  - Contact email: **ben@sitesbyben.ca**
  - Website submitted: **https://pockettrade.sitesbyben.ca** — must load when TradingView reviews. User is building the landing page on Lovable and will deploy it to that subdomain.

  Last working snapshot of the custom system is at the local git tag **`pre-charting-library-switch`**. Backup of the pre-reset implementations remains at **`drawings-before-reset`**. DO NOT delete either tag.

  Research / planning notes will live in **`docs/DRAWING_LIBRARY_RESEARCH.md`** (user is adding).

  **While waiting for approval:** pivot to OTHER features — Lovable landing page deploy, news (Forex Factory), trade card, Firebase, ToS / Privacy, logo, etc. No drawing-related work until the library is in hand.
- **Onboarding rebuild — IN PROGRESS (2026-05-12).** Replacing the current `AccountSetup` / `Login` / `FeatureTour` flow with a 13-screen sequence informed by retention research. Source of truth: **`docs/ONBOARDING_RETENTION_RESEARCH.md`** (user is adding). Building one screen at a time, smoke-testing each before moving on.
  - **All 13 screens shipped.** Splash → Premise → Archetype quiz (5Q + reveal) → Identity (5 cards) → Experience (4 cards) → Account size (5 preset tiers, $50K default) → Trader name (handle + display + rank-banner preview) → Daily commitment (Light/Steady/Pro, Steady default) → First Trade (activation event) → Rank reveal (5-banner ladder + progress bar) → **Plan Summary (synthesized card before the auth ask)** → Save your progress (auth UI shell, **mocked**) → Welcome + daily time goal (chip-select, hand-off to `MainTabs`).
  - **Plan Summary screen (between Rank Reveal and Auth)** — added 2026-05-14 per `docs/ONBOARDING_AUDIT.md`. Reads-only synthesis of everything captured so far (displayName + @handle, archetype with its sigil icon, identity, experience, account size, training pace, Gambler → Paper Hands trajectory with a `~N weeks at this pace` estimate derived from the current 10%-per-session progression model — pre-XP estimate; replace when the real rank XP system lands). Visually a single composed card, deliberately distinct from the option-stack screens. Does NOT read `dailyTimeGoalMinutes` (that's set on the Welcome screen, which comes after Auth). No RankBanner here — screens 10 and 12 already own that visual.
  - **Follow-up tasks (deferred, must ship before launch):**
    1. **Real Firebase auth wire-up** — replace the mock 500 ms timeout on screen 11 with real Apple SignIn / Google SignIn / email-password flow. `AuthMethod` union can shed the `mock-*` prefixes at that point.
    2. **Streak system** — **live as of 2026-05-14, local-state only.** Screen 12 captures `dailyTimeGoalMinutes`. The full mechanic (time tracking, daily increment, freeze accounting, milestone detection on day 3/7/14/30/60/100/365, freeze earning every 7 streak days up to a cap of 3) runs entirely on-device via `streakStore` with `zustand/middleware` `persist` over AsyncStorage. Three moving parts:
       - **`src/store/streakStore.ts`** — persisted state (`currentStreak`, `freezesRemaining`, `lastCompletedDate`, `todayDate`, `todayTrainingMinutes`, `frozenToday`) + actions (`addTrainingTime`, `completeDaily`, `performDailyCheck`, `consumeFreeze`, `resetStreak`, `reset`) + `computeDisplayStatus(state)` exported helper that maps state → StreakBadge status with the correct precedence (completed-today wins over frozen wins over broken/new).
       - **`src/hooks/useStreakManager.ts`** — mounted in `MainTabs`. Calls `performDailyCheck()` on mount and on every background → foreground AppState transition. The check rolls over the today-bucket on date change, counts missed days between `lastCompletedDate` and yesterday, and burns freezes one per missed day; if freezes run out mid-loop, the streak resets to 0 and `lastCompletedDate` stays set (so the badge reads 'broken' not 'new').
       - **`src/hooks/useTrainingTimer.ts`** — mounted in `TradingScreen`. `setInterval` every 10 s while the screen is mounted AND the app is foregrounded; pauses on background, resumes on foreground via AppState. Flushes any partial interval (≥1 s) on stop/unmount so brief visits aren't rounded to zero. Each tick calls `addTrainingTime(0.1667 min, dailyGoalMinutes)`; the store auto-fires `completeDaily()` the moment today's bucket crosses the goal.

       **Still to build (deferred):** (a) Firebase sync of streak data (cross-device + cross-install resilience), (b) the milestone celebration screens that fire on day 3/7/14/30/60/100/365, (c) optional daily reminder notification scheduled around the user's typical training time — that's where notifications would re-enter if we want them. A midnight rollover edge case while the app stays foreground all night isn't gracefully handled — the AppState listener and the next training tick both detect the date change, but there's no in-session midnight timer; revisit if it becomes a complaint.
    3. **Onboarding-complete routing guard** — when `onboardingStore.onboardingComplete` is `true` AND `FORCE_ONBOARDING_FLOW` is `false`, the app should bypass the onboarding stack on relaunch. Currently `FORCE_ONBOARDING_FLOW=true` still triggers onboarding every relaunch (intentional dev behavior).
    4. **Real backend save of onboarding data** — capture the user's onboarding payload (archetype, identity, experience, account size, handle/display, daily commitment, first-trade badge/PnL, daily time goal) on the auth handshake and persist server-side. Today everything past mock-auth lives only in the in-memory Zustand store.
  - **First Trade chart approach:** screen 9 is fully decoupled from the production trading stack. Two dedicated files:
    - `src/data/firstTradeScenario.ts` — hardcoded 33-bar NQ-like dataset (30 chop bars + 3 trending-UP bars, +30 pts) plus all scenario constants (`FIRST_TRADE_ENTRY_INDEX`, `FIRST_TRADE_MAX_REVEALED`, point value, contracts, symbol, date label). UP move means BUY → FIRST STRIKE (+$600), SELL → FIRST BLOOD (−$600).
    - `src/components/onboarding/OnboardingChart.tsx` — focused SVG candlestick renderer with a 1-based `revealedCount` prop that's defensively clamped to `bars.length`, making out-of-bounds bar access structurally impossible. Sliding 20-bar window pinned to the latest revealed bar. Dashed direction-tinted entry-price line.
    Rationale: TradingChart is a WebView host with deep coupling to `sessionStore` / `positions` / `currentPrice` / backend session endpoints — an earlier crash on this screen ("Cannot read property 'c' of undefined") traced to that plumbing reaching for bar data the onboarding flow didn't have. The activation event needs to be offline-resilient and bounded; a hardcoded dataset + clamped reveal counter delivers that with no production-chart inheritance. The main app's chart will be replaced wholesale by TradingView Advanced Charts when the application is approved anyway, so any onboarding-mode plumbing on top of it would be thrown away.
  - **Dev flag:** `FORCE_ONBOARDING_FLOW` at the top of `App.tsx` (currently `true`). When true, the app skips the loading splash / disclaimer / auth gates entirely and boots straight into the onboarding stack — and the onboarding stack now includes `Main` as a registered route so screen 12 can `navigation.reset({ routes: [{ name: 'Main' }] })` for the hand-off. Flip to `false` before shipping (paired with the routing-guard follow-up above).
- **Firebase — LIVE (2026-05-16).** Pure-JS firebase v12.12.1 (NOT @react-native-firebase), bundle ID `com.pockettrade.app`, Expo managed (works in Expo Go, no native modules). Config + `auth` (AsyncStorage-persisted) + `db` (Firestore) exported from **`src/services/firebase.ts`** (the canonical init — there is no `src/config/firebase.ts`; do not add a second `initializeApp`). All six `EXPO_PUBLIC_FIREBASE_*` env vars are set in `.env` (restart Metro with `--clear` after changing). **Real email/password auth is wired** on onboarding screen 11 (`OnboardingAuthScreen`): create/sign-in, mapped error copy, sign-up↔sign-in toggle. On success the onboarding profile is written to Firestore `users/{uid}` via `setDoc({...}, { merge: true })` then onboarding is flagged complete. **Routing guard** in `App.tsx`: `onAuthStateChanged` → `'loading'`(splash) / `'authenticated'`(Main) / `'unauthenticated'` → `OnboardingAuth` if a local handle exists else `OnboardingSplash`. The old hardcoded `initialRouteName="Main"` dev skip is removed. **Google + Apple SSO are now real (2026-05-16):** Google via `expo-auth-session/providers/google` (`useIdTokenAuthRequest` → `GoogleAuthProvider.credential` → `signInWithCredential`), reading `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (+ optional `_IOS_/_ANDROID_CLIENT_ID`) from `.env`. Apple via `expo-apple-authentication` (SHA-256 nonce from `expo-crypto` → `OAuthProvider('apple.com')` → `signInWithCredential`). app.json gained `scheme: "pockettrade"`, the `expo-apple-authentication` plugin, and `ios.usesAppleSignIn: true` — **these require a dev/EAS rebuild; Apple + native Google do NOT work in Expo Go.** The `.env` must contain `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (user is adding it) — the Google button surfaces a clear config error if it's absent (no placeholder "coming soon" alerts remain). **Follow-ups:** Firestore security rules (still test mode), handle-uniqueness check on screen 7 (deferred), password reset.

### ABANDONED
- **KLineChart Pro spike** (`feature/klinechart-spike` branch, latest commit `3f5f458`) — 7 iterations attempting to swap our custom-SVG drawing system for the KLineChart Pro library inside the WebView. Spike was preserved but abandoned because: (a) couldn't get a clean simultaneous state — fixing pan/zoom broke layout, fixing layout reintroduced overlays, etc.; (b) couldn't determine which API path was usable without device-side log access; (c) custom SVG drawing system on master already worked in earlier user testing. Branch is parked as fallback if we revisit; do NOT delete. Reason for keeping: research artifact (locale, theme, CDN-via-WebView pattern, defensive path-A/B fallbacks, in-WebView debug log overlay) might inform a future swap.

### NOT YET BUILT
- Real news data source (FRED is macro-only and not useful per-trade — backend-headlines `NewsPanel` retired from the chart toolbar 2026-05-14, news_snapshot column kept in trades table for future)
- **Onboarding routing guard — LIVE as of 2026-05-15.** `FORCE_ONBOARDING_FLOW` **removed**. `onboardingStore` is now persisted (`zustand/middleware` + AsyncStorage, `onboarding-storage-v1`) so `onboardingComplete` + the captured archetype/handle/goal survive reloads. App.tsx renders a single guarded stack: first paint gated on `useOnboardingStore.persist.hasHydrated()` (LoadingSplash until rehydrated, 2.5 s safety), then `Stack.Navigator initialRouteName = onboardingComplete ? 'Main' : 'OnboardingSplash'`. All onboarding screens stay registered so screen-12 / Redo-Onboarding `navigation.reset` works. The legacy disclaimer/Firebase-auth-gated render branch + the FORCE force-sign-out hack were deleted; the auth `useEffect` is slimmed to only populate authStore `uid/username` (no routing role). Settings → Data has a non-destructive **"Redo Onboarding"** row (confirm → `setOnboardingComplete(false)` + reset to `OnboardingSplash`; trades/streak/badges kept). Legacy `LoginScreen`/`AccountSetupScreen`/`FeatureTourScreen`/`DisclaimerScreen` no longer mounted (files preserved).
- **Progression celebrations + goal-gradient — LIVE as of 2026-05-15.** `xpStore.addXP` enqueues a `celebrationStore` item whenever `checkRankUp` reports a crossing (carries `xpEarned` = triggering amount). `RankUpCelebrationHost` (MainTabs) drains it but **gates on `badgeToastStore` + `challengeToastStore` queues being empty + a ~900 ms grace** so ordering is journal-popup → toasts → rank-up (journal is always first because XP is granted post-dismiss). **Sub-tier** (I→II/II→III): compact modal — "RANK UP", RankBanner, RN pip row with the just-filled pip scale-bouncing hollow→gold, "<Rank> <Roman>", "+X XP", Success notification haptic, Continue. **Main rank** (e.g. Gambler→Paper Hands): full-screen — gold flash → 18-particle Animated burst → banner spring 0.5→1 (+Medium haptic on land) → all-filled pip row → rank name in `RANK_THEME_COLOR` → `RANK_PROMOTION_COPY` fade (+Success haptic) → Continue. Copy/theme maps live in `rankConfig.ts`. Goal-gradient on the dashboard rank bar: `pct = xpInTier/xpNeededForNext`; **≥80 %** → Animated opacity-loop gold glow over the fill; **≥95 %** → tap-able nudge card, gap-mapped (≤15→"1 journaled trade"→Chart, ≤30→"2 trades"→Chart, ≤50→"1 Daily Setup away"→scroll top, else "N XP"→scroll to missions). Pip scale-bounce is RN Views (not the SVG banner pips) — RankBanner unchanged. **Follow-ups:** celebration sound, shareable rank card (view-shot), confetti on sub-tier.
- **Challenge system — LIVE as of 2026-05-15, local-only.** 3 daily (from a pool) + 1 weekly + 1 monthly, rank-gated. **34 templates** (`src/data/challengePool.ts`: 19 daily / 10 weekly / 5 monthly). Generation filters by `minRank ≤ currentRank` (xpStore) AND `DETECTABLE_CONDITIONS` (so a user never gets an un-progressable challenge — `new_symbol_today`/`quick_start` are excluded from generation until detection lands; still in the pool). `src/store/challengeStore.ts` (persist `challenge-storage-v1`): activeDailies[3]/activeWeekly/activeMonthly instances + dailyDate/weeklyWeek(ISO)/monthlyMonth + `skipsUsedThisWeek` (cap 1, resets on the weekly boundary). `updateProgress(condition,value)` applies `CONDITION_MODE` ('add' default / 'max' for consecutive_wins·streak_days·unique_symbols·unique_emotions); on target reached → `xpStore.addXP(reward,'challenge')` + `streakStore.grantFreeze()` if `bonusReward==='streak_freeze'` + enqueue `challengeToastStore`. `checkExpiry(rank)` (via `useChallengeRotation` in MainTabs, on open + foreground) regenerates expired periods; expired-incomplete just disappear (no backlog/shame). `skipDaily(i,rank)` swaps one uncompleted daily once/week. Detection wired in `src/utils/challengeDetection.ts` (trade-close/journal/daily-setup from TradingScreen; streak/active-days/time-goal from `useXpWatchers`; `minutes_traded` from `useTrainingTimer`). Windowing v1 simplification (documented): `unique_symbols` is lifetime-distinct; `green_day`/`win_rate_55` window to local day, `win_rate_55_monthly` to month, `consecutive_wins` reads badgeStore's real in-a-row counter. `ChallengeToastHost` (MainTabs) = green "MISSION COMPLETE" toast (BadgeToastHost pattern). Dashboard "Today's Missions" replaces the old placeholder: 3 daily cards (progress bar, ✓+XP when done, per-card "Swap a mission" when a skip is available, "No swaps remaining this week" once used, "All daily missions complete ✓" + dimmed when all done) then WEEKLY + MONTHLY tagged cards. Settings Reset Everything wipes challenges too (10 stores). **Follow-ups:** challenge history log, "1 away" nudges, custom challenges, tighter per-window counters.
- **XP system + rank sub-tiers — LIVE as of 2026-05-15, local-only.** XP never decreases; ranks permanent; no decay/derank/prestige (deliberate per research). `src/data/rankConfig.ts` = 15 beats (5 ranks × 3 sub-tiers), `getRankForXP(xp)` pure lookup + `RANK_BEATS` ladder. Cumulative thresholds: Gambler I/II/III 0/150/300, Paper Hands I/II/III 500/1100/1800, Sniper 3000/5000/7500, Inside Trader 10500/15000/20500, Market Maker 27500/36500/48500. `src/store/xpStore.ts` (persist `xp-storage-v1`): currentXP/Rank/SubTier + daily trackers (tradesToday, todayDate, dailySetupCompletedToday, firstTradeToday); `addXP(amt,source)` logs + auto `checkRankUp` (can cross multiple beats, console.logs promotion — celebration screens are a later prompt); `registerTrade()` (soft-cap), `tryClaimDailySetup()`, `getCurrentProgress()`. **XP values:** trade base +10 (→+5 after 20/day soft cap), +5 win, +5 journaled-loss (== win; process-over-outcome), first-trade-of-day +15, journal +15, daily setup +50 (1/day), streak daily-goal +25, streak maintain +10+min(day,40), streak milestones d7/14/30/60/100/365 = +100/200/500/1000/2000/5000, badge unlock +100, weekly recap viewed +25. Triggers: trade/journal/first-trade in TradeJournalModal onSave/onSkip (TradingScreen); daily-setup in the close effect's once-per-day guard; badge +100 inside `evaluateBadges`; recap +25 in `useWeeklyRecapTrigger.dismiss`; streak XP via `useXpWatchers()` (MainTabs streakStore subscription — keeps streakStore import-free, no cycle). `RankBanner` gained an optional `subTier?:1|2|3` prop → 3 SVG pip dots below the name (gold earned / hollow #333); opt-in so existing call sites are unchanged; dashboard passes real `rankInfo.subTier`. Dashboard Rank Progression now shows real `getRankForXP(currentXP)` (label + pips + "X / Y XP to <next>" or "Max rank reached"). Settings Reset Everything wipes xp too (9 stores). **Challenge XP is the next prompt** (challenges don't exist yet); rank-up celebration screens + goal-gradient nudges are later prompts.
- **Achievement / Badge system — LIVE as of 2026-05-15, local-only.** 30 badges across 5 categories (volume 6 / skill 9 / consistency 7 / discovery 5 / journal 3) in `src/data/badges.ts` (pure data; MCI icons — lucide still not installed; rarity → colour map). `src/store/badgeStore.ts` (persist) holds the unlock ledger + stateful counters (`consecutiveWins`, `dailySetupsCompleted`, `freezesUsedTotal`). `src/utils/badgeChecker.ts` builds a context from all stores and `evaluateBadges()` re-checks ALL 30 predicates on every trigger (idempotent, never misses one); `getBadgeProgress()` powers the locked-badge modal. Triggers: trade-close + journal-save fired explicitly from TradingScreen's TradeJournalModal `onSave`/`onSkip` (AFTER the modal dismisses so the toast isn't hidden); daily-setup completion guarded once-per-day in the close effect; watchlist-save in `confirmSaveBookmark`; **streak/freeze changes via `useBadgeWatchers()` (MainTabs) subscribing to streakStore** (also runs one full evaluate on entry to catch up persisted data). `consecutiveWins` advanced/reset once per close inside `checkTradeCloseBadges`. Celebration: `badgeToastStore` FIFO queue drained by `BadgeToastHost` (MainTabs) — transparent-Modal toast, slides from top, 3 s hold + 1 s gap, swipe-up dismiss, rarity-coloured, `maybeHaptic` on appear. Trophy case: a "Leaderboard | Badges" segment toggle on the Ranks tab (`LeaderboardScreen`), badges-view = progress bar + category-grouped 4-per-row grid + tap-for-detail modal (unlocked: description + date; locked: condition + numeric progress). Dashboard badge counter (trophy + "N / 30") below Rank Progression → taps to `Leaderboard` with `initialSegment: 'badges'`. Settings "Reset Everything" now wipes badge state too (8 stores). "Global Trader" assumes the curated symbol set `[NQ,ES,CL,GC]` (documented — no offline market list). **Follow-ups:** >30 badges, badge sharing (view-shot/dev build), per-badge celebration screens.
- **Custom Watchlist — LIVE as of 2026-05-15, local-only.** Bookmark icon in the chart `topBar` (right of the symbol; `useSavedSetup(symbol, replayDateYMD)` → outline white-50 % vs solid gold). Tap → save modal (optional 100-char note, `maybeHaptic` on success) / remove modal. `src/store/watchlistStore.ts` persists `savedSetups` (zustand/middleware + AsyncStorage, `watchlist-storage-v1`), 50-cap (`addSetup` returns false → caller alerts), `savedSetupStartUnixSeconds` mirrors dailySetups' anchor. Dashboard "Saved Setups" horizontal section sits **between the Daily Mission card and the training ring**; cards reuse the `dailySetup` nav-param to preload the chart (identical mechanism to Daily Mission — no TradingScreen consume-logic change). Removal is chart-only (filled bookmark → Remove); no swipe-delete. Settings "Reset Everything" now also wipes the watchlist (7 stores total). **Follow-ups:** folders/categories, sharing (Firebase), sort/filter, full-screen manager.
- **Weekly Performance Recap ("Sunday Wrap") — LIVE as of 2026-05-15, local-only.** Auto-generated weekly synthesis. `src/utils/weeklyRecap.ts` is the pure generator (ISO week id, Mon-00:00→Sun-23:59 local bounds, win/loss/P&L/best/worst, + an auto-derived "edge insight" picked by interest score from: long-vs-short win rate, winner/loser hold duration, days-traded consistency, A-grade journal correlation; <3 trades → "keep trading" fallback). `src/store/recapStore.ts` persists recaps keyed by weekId (last 12 weeks, prunes oldest; tracks `viewedAt`; never clobbers an existing week so a re-generate can't wipe viewedAt). `src/hooks/useWeeklyRecapTrigger.ts` (mounted in `MainTabs`, once per app open, hydration-safe — awaits journalStore.hydrate + persist rehydration of recap/streak/tradeJournal stores) decides the target week: **Sunday → current week; Mon–Sat → previous full week (catch-up if they missed Sunday)**; shows only if that week is unviewed AND had ≥1 closed trade. `WeeklyRecapModal` (full-screen, count-up hero P&L reusing the screen-9 listener pattern, staggered entrance ~1.7 s) is reused by both the auto-trigger and the Journal "Weekly Recaps" section (tap a past recap to review). **Known v1 limitation:** `totalTrainingMinutes` is best-effort (streak store only keeps *today's* bucket — a weekly training accumulator is a follow-up). **Follow-ups:** share-as-image (needs view-shot/dev build), Sunday push notification, prev-week comparison ("↑12%").
- **Settings screen — LIVE as of 2026-05-15.** Gear icon on the dashboard header (right of the StreakBadge) pushes `SettingsScreen` onto the stack (`Settings` route registered as a sibling of `Main` in both the FORCE and production navigators). Sections: Profile (display-name inline edit → onboardingStore; handle read-only/locked; archetype + rank read-only), Training (time goal / commitment / default contract size via select-modals), Preferences (haptics toggle → settingsStore), Data (CSV export via `Share.share({message})` joining journalStore + tradeJournalStore by tradeId; Reset Streak single-confirm; Reset Everything double-confirm → wipes all 6 stores + `navigation.reset` to OnboardingSplash), About (version from app.json, mailto support, ToS/Privacy stubs). New `src/store/settingsStore.ts` (persisted: `hapticsEnabled`, `defaultContractSize`) exports `maybeHaptic` / `maybeNotificationHaptic` gated helpers — **existing haptic call sites are NOT yet refactored onto them (deliberate follow-up).** `journalStore` gained a `reset()`.
- **Daily Setup ("Today's Mission") — LIVE as of 2026-05-15, local-only.** Cold-start solver: one curated trade scenario per day, shown as the top card on the dashboard. Dataset `src/data/dailySetups.ts` ships **30 scenarios** (expandable to 365), all 2022 dates, symbols NQ(11)/ES(11)/CL(4)/GC(4), all 7 setup types (News Reaction / Reversal / Trend Day / Breakdown / Opening Range Breakout / Range Day / Gap Fill), balanced beginner/intermediate/advanced. `getTodaySetup()` rotates by `dayOfYear % 30` — deterministic per calendar day, no backend, every device agrees. The card's "Trade this setup" CTA navigates `Chart` with a `dailySetup` param; `TradingScreen` consumes it (sets market/timeframe, queues the scenario's historical `start_time` into `startSession`, resets any live session so the auto-start effect reloads at that date). Completion is tracked in `src/store/dailySetupStore.ts` (persisted, stores only `lastCompletedSetupDate`); the card flips to a disabled green "Completed ✓" with a green left-accent once the user closes a trade whose symbol + NY-time replay date match the scenario. Completion is keyed on trade *close* (round-trip), not open — documented limitation. **Follow-ups:** expand to 365 scenarios; per-archetype/skill personalized selection (v1 is day-of-year only); backend-served scenarios.
- **Trade journal auto-popup — LIVE as of 2026-05-14, local-state only.** Every trade close on `TradingScreen` (manual close, TP/SL auto-close, replay-end) now triggers `TradeJournalModal`, which captures (a) execution grade A+/A/B/C/F — required; (b) up to 3 emotion tags from a fixed 8-tag set (4 positive — Calm/Confident/Patient/Focused, 4 negative — Anxious/FOMO/Revenge/Impulsive); (c) an optional ≤ 280-char note. Save persists into `src/store/tradeJournalStore.ts` (persisted via `zustand/middleware` + AsyncStorage, keyed by tradeId); Skip dismisses without writing. `TradeCard` reads the grade per tradeId via the store and renders a small gold pill in the top-right when present. The legacy `TradeCardModal` (R-multiple stats panel + manual "Journal Trade" button) is retired from the close flow — the component file is preserved but unused. Onboarding screen 9's first-trade activation event has its own result overlay and never routes through `TradingScreen`, so the journal modal deliberately doesn't fire there. **Analytics layer (win rate by grade, P&L by emotion, etc.) is a follow-up** — for now the store just captures the data. The older `journalStore` (notes/mistakes/wentWell/emotion/confidence/strategy/tags schema captured via `EntryEditModal`) coexists; the two will likely be reconciled when the analytics pass lands.
- **Economic-calendar feature — LIVE as of 2026-05-14.** Chart screen's News button now opens `EconomicCalendarPanel`, a slide-up sheet listing macro events (CPI / NFP / FOMC / GDP) for the replay date. Dataset lives at `src/data/economicCalendar.ts` — **36 hardcoded 2022 events**, all U.S. Eastern time, with `getEventsForDate(YYYY-MM-DD)` lookup. Coverage is **2022 only**; expand to 2021/2023/2024 as historical replay scenarios are added. Date derivation uses the existing `tzPartsOf(unixMs, 'America/New_York')` helper so the events match the replay's calendar day regardless of the user's device timezone. Gold dot indicator on the News button signals "events scheduled for this date" — visible on CPI / NFP / FOMC / GDP days. No backend, no network — synchronous filter against the bundled dataset.
- Drafted ToS / Privacy Policy markdown
- Logo SVG placeholder
- Beta test plan

## USER BLOCKERS — TODO BEFORE LAUNCH

1. Firebase project (in flight via Claude Remote walkthrough)
2. Railway backend deployment, paste URL into `.env` as `EXPO_PUBLIC_API_URL`
3. Kaggle account + API token to `~/.kaggle/kaggle.json`, then run data_ingest.py
4. AdMob account, swap test IDs for real ones in `app.json` + `src/services/adService.ts`
5. Apple Developer Program ($99/yr) for iOS publish
6. Google Play Console ($25 one-time) for Android publish

## LOCKED DECISIONS

### Product
- Free + ads (6-min interstitials) + $5 CAD remove-ads IAP per device
- $25k/$50k/$75k/$100k account picks
- 2 accounts max (practice + tournament)
- Random-day-at-market-open with timezone picker
- Bar-by-bar manual + auto-play 1x–10x
- All order types, multiple positions, no commissions/spreads/slippage
- News panel hidden in v1; news_snapshot column stays in trades table
- Trade journal auto-popup with auto-attach news (when wired)
- Public profiles + trade feed + private group leaderboards
- 5-tier rank system (Gambler → Paper Hands → Sniper → Inside Trader → Market Maker)
- Monthly tournaments, top 3, score with consistency multiplier
- Dark theme + gold accent
- Splash disclaimer on first launch

### Data sources
- Daily/weekly: yfinance via fetch_stooq.py (all 14 symbols)
- Intraday: Kaggle CC0 dataset for ES/NQ 1-min, resampled to 5m/15m/30m/1h/4h. yfinance only has 7-day intraday window so kaggle stays.

### Drawing tools (Block 17)
- Per-session only, wiped on session end
- Canvas (not SVG) inside WebView, manual hit-test
- Toolbar in React Native (not WebView)
- No snap-to-OHLC in v1
- Pure client-side, no backend changes
- Gesture forwarding: Option A (always-on canvas, manual pan via setVisibleLogicalRange, two-pointer pinch math, setPointerCapture on pointerdown). Option B (three-layer router) rejected — duplicates hit-test logic, can't reassign gesture mid-stroke.

## NEXT STEPS

1. Finish Firebase walkthrough in Claude Remote → paste 6 config values into `.env`
2. Implement Block 17 (spec locked).
3. Deploy backend to Railway → paste URL into `.env`
4. Get Kaggle API token → run `python backend/data_pipeline/data_ingest.py` to load CSVs into SQLite
5. End-to-end test: signup → start session → trade → journal → leaderboard
6. Draft ToS / Privacy Policy
7. Logo SVG
8. Beta plan
9. Apple Developer + Google Play Console accounts

## HOW TO KEEP THIS FILE CURRENT

- After any decision is locked → add to "LOCKED DECISIONS"
- After any block completes → move from "IN FLIGHT" to "COMPLETE" / "VERIFIED"
- After any new file is created → mention in the relevant section
- After any user blocker is cleared → strike from "USER BLOCKERS"
- Always commit + push to GitHub so all Claude sessions see the update on next read
