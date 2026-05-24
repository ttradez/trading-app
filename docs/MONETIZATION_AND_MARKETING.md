# Pocket Trade — Strategic Evaluation

Monetization, pricing, positioning, and go-to-market. Drafted with live competitive research, May 2026. Budget assumption: $500–$5,000 Year 1 marketing.

## Phase 1 — App Audit

### 1.1 Strengths — what's genuinely differentiated and well-built

Pocket Trade has four real moats already in code, not on a roadmap:

The replay-on-mobile thesis is the central differentiator. TradingSim, TradingView's Bar Replay, ForexTester, NinjaTrader Sim, and TrendSpider's playback are all desktop-first or browser-first. None of them are a polished mobile-native experience. Mobile replay is "ten minutes of deliberate practice while waiting for coffee," not "a Saturday afternoon at the desktop." That use case is wide open.

The 28 named setups with per-user performance tracking is structural, not cosmetic. Most journals (Tradervue, Edgewonk, TraderSync) let you tag setups but require you to invent your own taxonomy. Pocket Trade ships a curated catalog — 15 classic patterns plus 13 ICT concepts (FVG, OB, BPR, etc.) — each with lesson content and a profit factor per pattern per user. That's the engine that powers the "mastered" criterion on Learn (lesson read + 3+ trades + PF ≥ 1). No competitor combines curriculum, replay, and personal stats in one loop.

The discipline layer is the actual product. Pre-trade checklist, plan capture (stop/target/size), post-trade rating, discipline rate, and plan-adherence metric are what distinguish Pocket Trade from any pure simulator. Most sims teach you to click buttons; Pocket Trade teaches process. This is the line you can credibly draw against TradingSim and ForexTester.

The rank/XP system is the right metaphor for the audience. "Gambler I → Market Maker III" with 30 illustrated badges and ~35 challenges hits a tone that's self-deprecating about the trader-as-gambler problem while still aspirational. The earnable streak freeze (no guilt mechanics) is mature game-design — Duolingo gets criticized for the opposite. The Sunday Wrap is a retention hook competitors don't have.

Brand and craft. Pure black + gold + Inter Display + JetBrains Mono for numerals is a category-correct visual language. Most trading apps are either Bloomberg-terminal-busy or robo-advisor-bland. Pocket Trade looks like a $40 annual subscription should look.

Cloud sync + Apple/Google/email auth via Firebase is a real engineering win against ForexTester (desktop-licensed) and the local-only mobile sims on the App Store.

### 1.2 Gaps — what's still missing for production launch

TradingView Advanced Charts license is the only true blocker. Everything else is paperwork or polish.

Beyond the license, the realistic pre-launch punchlist:

- Privacy policy + terms of service + EULA, hosted at a stable URL.
- App Store / Play Store screenshots, preview video, and ASO copy (title + subtitle + keywords + long description).
- App Tracking Transparency prompt copy (iOS) and a Google Play data safety form.
- Crash reporting (Sentry/Firebase Crashlytics) plus a release-channel build pipeline.
- Subscription/paywall implementation (RevenueCat SDK wired to App Store Connect + Google Play Console).
- An onboarding "first trade in 90 seconds" path — most users won't survive a slow first replay.
- Empty-state polish on Stats (someone with 2 trades shouldn't see a heatmap full of blanks).
- A demo/seeded account option for App Store reviewers (Apple reviewers reject finance-adjacent apps if they can't get past auth quickly).
- Customer support route — at minimum a support@pockettrade.app mailbox routed to your inbox.
- Push notifications certificate setup beyond the current opt-in local notifications.
- Account deletion in-app (iOS requirement since 2022, also a Play Store requirement).

What you do not need before launch: leaderboards, multiplayer, more symbols, more setups, dark/light mode toggle, web app. Resist all of these.

### 1.3 Launch readiness

Assuming TradingView Advanced Charts approval is the long pole:

- TradingView license: historically 2–6 weeks from application, sometimes longer. Treat it as 4 weeks expected, 8 weeks worst case.
- Punchlist work (1.2): 10–15 focused engineering days. Privacy/legal pages can be drafted in an afternoon with a template service ($50–200). ASO + screenshots: 3 days. Paywall + RevenueCat: 3–5 days. Reviewer demo account + onboarding tune-up: 2–3 days.
- TestFlight closed beta: 1 week minimum to surface crashes on a real device fleet. Recruit 20–50 testers; Reddit r/Daytrading and r/FuturesTrading both allow legitimate beta-test posts if you follow their rules.
- App Store review: 24–72 hours typical; finance-adjacent apps sometimes draw a second pass. Plan for 5 business days worst case.
- Play Store review: 1–7 days, with the new-developer 14-day testing requirement (you need 12 testers on a closed track for 14 days before production for personal developer accounts created after Nov 2023).

Realistic end-to-end: 5–8 weeks from today to public launch on both stores, gated almost entirely on the TradingView decision. If TradingView denies, the fallback is Lightweight Charts (free, MIT-licensed, no replay primitive but you can build one) — that pushes you another 3–4 weeks.

### 1.4 Positioning statement

> Pocket Trade is the mobile replay simulator that turns futures practice into a daily habit — track your setups, build discipline, level up. No real money, no fake P&L bragging, no get-rich noise — just deliberate reps on the patterns that actually matter.

The second sentence is the negative-space positioning that matters most. Your category is full of grifters. Saying out loud what you are not is the brand.

## Phase 2 — Competitive Landscape

### 2.1 Direct competitors — trading simulators

| Product | Platform | Pricing (verified 2025–26) | What they have you lack | What you have they lack |
|---|---|---|---|---|
| TradingSim | Web (desktop) | Pro $79/mo or $396/yr; Premium $89/mo | 2–5 years tick-level history, Level II depth, options, equities + futures | Mobile, replay-as-habit loop, named setup taxonomy with per-user PF, gamified rank/XP, discipline checklist |
| TradingView Bar Replay | Web + mobile (limited) | Bundled in Essential ($14.95/mo) and up | Multi-asset, indicator ecosystem, social charts | Dedicated trade-flow (plan → execute → review), curriculum, journaling, gamification, badges, archetype quiz |
| TrendSpider Playback | Web (desktop) | $33/mo annual (Pro), $37/mo annual (Premium) | Algorithmic charting, multi-timeframe scanning | Mobile-native, curriculum, per-setup analytics, discipline metrics |
| ForexTester 5 | Windows desktop | $149–$449 one-time + data subscriptions | Tick-level FX/futures data, EA backtesting | Cross-platform mobile, gamification, social/auth/cloud, modern UX |
| NinjaTrader Sim | Windows desktop | Free with platform | Live broker connection, real DOM, order routing realism | Curriculum, journaling, mobile, anything Duolingo-shaped |
| Stock Market Simulator (top App Store result) | iOS/Android | Free + IAP | None of substance | Everything — most mobile sims are crypto/stock toy apps with no curriculum or analytics |

Key insight: the iOS/Android "trading simulator" category is dominated by either (a) Investopedia-style equities sims aimed at total beginners, or (b) ad-laden free apps. No one is shipping a serious, mobile-first, futures-specific, ICT-aware replay tool with a discipline layer. The lane is genuinely open.

### 2.2 Adjacent — trader education and journals

| Product | Pricing (verified 2025–26) | Segment owned |
|---|---|---|
| Tradervue | Pro $29.95/mo, Premium $49.95/mo | Serious retail equities/futures journaling, prop-firm-aware power users |
| Edgewonk | $169 one-time/yr | Forex-leaning desktop journaling, psychology focus |
| TradesViz | Free tier, Pro ~$15/mo | Visual analytics, options heatmaps, broker auto-sync |
| TraderSync | $29.95–$79.95/mo | Auto-sync from 700+ brokers, scanner/replay add-ons |
| TradeZella | $29–$49/mo | Younger / social journal users, prop-firm crowd |
| Babypips | Free | Forex 101, top of funnel for retail FX |
| Investopedia Stock Simulator | Free | College classroom and absolute beginner equities |
| ICT (Inner Circle Trader) | Free YouTube + paid mentorship | The methodology itself — single largest influence on your target user's mental model |
| Prop firm evals (Topstep, FTMO, Apex) | Apex $147/mo per eval, FTMO €155–€1,080 one-time, Topstep $149/mo $50K | Adjacent revenue capture — these are who your power users pay $100–200/mo to next |

Take: Journals are an 8-figure category. Pocket Trade is not a journal — it's the simulator that produces the data a journal would store.

### 2.3 "Duolingo for X" gamified-learning comparables

| Product | Model | Public conversion / paid signal |
|---|---|---|
| Duolingo | Freemium + Super ($6.99/mo, $83.99/yr) + Max ($14/mo) | ~8% of MAUs are paying as of 2024 disclosures; trial-to-paid in the high teens |
| Brilliant | Free trial + $13.49/mo or $149/yr | Hard paywall after 3-day trial; reported trial-to-paid ~30–35% |
| Sololearn | Freemium + Pro $12.99/mo, $59.99/yr | Lighter monetization, ad-supported free; conversion in low single digits |
| Mimo | Freemium + Pro ~$9.99/mo, $79.99/yr | Hard paywall pattern; conversion in the 4–8% range based on RevenueCat-bucket apps |
| Headway | Hard paywall + 7-day trial, ~$89.99/yr | Aggressive paid acquisition on TikTok/Meta; trial-to-paid ~25% |

RevenueCat 2025 benchmarks (verified): median freemium D35 conversion ≈ 2.1%; hard paywall apps with higher price points see D35 ≈ 2.7% vs 1.5% for low-price apps. Median monthly revenue per app jumped to ~$92; ~19% of apps reach $1,000+/mo.

Take: The winning pattern in this category is hard paywall + 7-day trial + annual price anchor, not "free with optional upgrade." Duolingo is the outlier because it has 100M+ DAU to support an ad business. You will not. Plan accordingly.

### 2.4 The gap Pocket Trade could own

The intersection of:
- Futures-specific (not equities, not crypto, not generic FX)
- Mobile-native replay (not desktop)
- Curriculum + journaling + analytics in one loop (not three apps duct-taped together)
- ICT-aware (the dominant methodology in retail futures right now — every prop-firm-funded trader on YouTube uses some flavor of it)

Is a real, defensible niche, not a crowded one. The crowded space is "trading journals" and "general stock sims." The empty space is "the thing you open between sessions to practice the FVG entry you screwed up on Tuesday."

The risk isn't competition — it's that the futures-mobile-ICT audience is small enough that your TAM caps somewhere in the low hundreds of thousands of active practitioners worldwide, of whom maybe 10–20K are serious enough to pay $40+/yr. That's a $400K–$800K ARR ceiling if you nail it, with realistic Year 1 in the $20–80K ARR range.

## Phase 3 — Monetization Model Analysis

### 3.1 Ads-based

eCPM reality for trading-adjacent audiences: finance is one of the highest-paying ad categories in absolute terms ($15–$40 eCPM on rewarded video, $5–$15 on interstitials, $1–$4 on banners). But:

- App Store and Play Store policy risk is real. Both stores have tightened around financial advertising. AdMob/AppLovin explicitly restrict CFD ads, prop firm referrals, signal services, and "guaranteed returns" creative. The ads that would pay you the most are exactly the ones that get rejected.
- Audience self-perception kills the model. A trader paying $149/mo to Topstep does not want to watch a 30-second rewarded ad to unlock a chart.
- Realistic monthly RPU at 10–15 minutes/day engagement: $0.30–$1.20 with conservative ad load, $1.50–$3.00 if you're aggressive. That's a fraction of what a $40/yr subscriber returns ($3.33/mo).

Verdict: not the model.

### 3.2 Subscription

This is the live option.

Comparable anchors:
- TradingView Essential: $14.95/mo
- Tradervue Pro: $29.95/mo. Edgewonk: $169/yr ≈ $14/mo. TraderSync entry: $29.95/mo.
- Topstep eval: $149/mo. Apex eval: $147/mo.
- Duolingo Super: $6.99/mo / $83.99/yr. Brilliant: $149/yr. Headway: ~$89.99/yr.

Conversion benchmarks (RevenueCat 2025–26):
- Freemium D35 conversion median: 2.1%.
- Hard paywall with trial, higher price: ~2.7% D35.
- Trial-to-paid in well-designed onboarding-paywall apps: 25–40%.
- Annual plan share of revenue tends to land at 60–75% in mature subscription apps.

Trial mechanics: 7-day free trial is standard; longer trials (14, 30 days) reduce trial-to-paid conversion because users forget.

RevenueCat vs native StoreKit/Play Billing: at your scale and team size, use RevenueCat. It's free up to $2.5K MTR, then 1% over.

### 3.3 One-time purchase

Upfront-paid apps as a category have not died but they have been ghettoized. Procreate, Things 3, Bear, and a handful of utilities still thrive as one-time purchases — but they all share the trait of "tool that pays back its price in week one and doesn't need server costs." Pocket Trade has Firestore costs, support obligations, content updates, and chart-license fees that compound over the user lifetime.

LTV math:
- $6.99 one-time, less 15% store fee = $5.94 net LTV.
- $39.99/yr with 50% Y2 renewal = $50.99 net 2-yr LTV, and the curve continues.
- $7.99/mo with 6-month median lifetime = ~$40.75 net.

A subscriber is worth 8–10× a one-time buyer.

### 3.4 Freemium / hybrid

The right structure for Pocket Trade is freemium with a meaningful free tier that demonstrates the loop, and a paywall that gates depth, history, and analytics — not the core "do one replay trade" experience.

**Free tier (the hook):**
- 3 of 14 symbols (suggest NQ, MES, MGC)
- 10 replay sessions per week
- All 28 setup names visible, but only 6 lesson pages unlocked (1 momentum + 1 reversal + 1 range + 3 ICT foundations: FVG, OB, liquidity sweep)
- Last 7 days of trade history in Stats
- Journal: unlimited entries, but no per-setup PF or per-symbol breakdown
- Streak system + ranks: fully free (this is the engagement engine — never gate it)
- Sunday Wrap: free
- Onboarding archetype quiz: free
- Daily mission notification: free

**Pro (paywall):**
- All 14 symbols
- Unlimited replay sessions
- All 28 setup lessons + skill paths + "mastered" status
- Full Stats: equity curve, calendar heatmap, per-setup, per-symbol, discipline rate, plan adherence, P&L histogram
- Unlimited history
- Future: CSV export, journal templates, custom setups

**Paywall placement.** Show the paywall after the user completes their first trade and rates it — the dopamine moment. Not on app open. Not after onboarding. Show it again on Day 3, Day 7, and any time a Pro-only screen is tapped.

### 3.5 Recommendation

**Subscription, freemium model, hard-ish paywall after first trade.**

| Model | Yr 1 install assumption | Conversion | ARPU/mo | Yr 1 net revenue (est.) |
|---|---|---|---|---|
| Ads-only | 20,000 | n/a | $0.60 | ~$144 — only at >100K MAU; unrealistic |
| One-time $6.99 | 20,000 | 4% paid | $5.94 LTV | ~$4,750 |
| Sub freemium ($7.99/mo, $39.99/yr, 70% annual) | 20,000 | 3% paid | net ARPU $2.40/mo blended | ~$17,300 Y1, ~$29K Y2 with renewals |
| Sub hard paywall + trial | 8,000 | 8% paid | net ARPU $2.40/mo blended | ~$18,500 Y1, riskier with $500–5K UA budget |

Freemium subscription wins on three vectors: (1) it lets organic + ASO + word-of-mouth fill the top of funnel; (2) the free tier is the marketing channel; (3) RevenueCat 2025 data shows higher-priced subscription apps convert better, not worse.

## Phase 4 — Pricing Strategy

### 4.1 Exact price points

**Pocket Trade Pro**
- Monthly: $9.99/mo
- Annual: $39.99/yr (effective $3.33/mo — a 67% discount vs monthly, displayed as "Save 67%")
- Free trial: 7 days, on annual only. No trial on monthly.
- Lifetime (added at month 6): $99.99 one-time, capped offer.
- Founding Member offer (launch week only): $29.99/yr for life as long as the subscription remains active, capped at the first 500 subscribers.

Why these numbers:
- $9.99 monthly sits below Tradervue ($29.95) and Edgewonk ($14/mo equivalent), well below TraderSync ($29.95–$79.95), and at roughly 2/3 of TradingView Essential ($14.95).
- $39.99 annual keeps the annual under the psychological $40 line (Brilliant $149, Headway $89.99, Duolingo Super $83.99 — you're meaningfully cheaper than the comp set).
- 7-day trial, annual only. Forces the annual decision up front (best LTV lever you have).
- No "weekly" SKU. Cannibalizes annual and feels scammy in a trader audience.

**Free tier feature set:**

| Surface | Free | Pro |
|---|---|---|
| Symbols | 3 (NQ, MES, MGC) | All 14 |
| Replay sessions | 10/week | Unlimited |
| Setup lessons unlocked | 6 of 28 | All 28 |
| Skill paths | Browseable, locked drill-in | Full Momentum / Reversal / Range / ICT |
| Stats history | Last 7 days | Unlimited |
| Per-setup PF, per-symbol breakdown | Locked | Unlocked |
| Calendar heatmap, equity curve, P&L histogram | Locked | Unlocked |
| Discipline rate, plan adherence | Locked | Unlocked |
| Journal entries | Unlimited | Unlimited |
| Streaks, ranks, badges, XP | Full | Full |
| Sunday Wrap | Full | Full |
| Pre-trade checklist | Full | Full |
| Daily mission + daily challenges | Full | Full |
| CSV export | — | Pro |

Design principle: the engagement engine (streaks, ranks, daily missions, challenges) is free forever. The insight engine (analytics depth) is Pro.

### 4.2 Price anchoring and paywall copy

Three variants to A/B:

**Variant A — Anchor against the cost of a real-money mistake**

> Practice costs $39.99 a year. One blown stop costs more.
> Your last losing trade was probably bigger than a year of Pocket Trade. Get unlimited replay across all 14 futures symbols, full analytics, the entire setup library, and the discipline tools that make funded-account traders, funded.
> [Try free for 7 days — $39.99/yr after] [Or $9.99/mo]
> Cancel anytime. No real money, ever. Just reps.

**Variant B — Anchor against the prop firm comp set**

> Topstep eval: $149/mo. Apex: $147/mo. Pocket Trade Pro: $3.33/mo.
> You're going to take an eval one day. Stop paying $147 a month to learn what you could have learned on a phone for free this week. Unlock all 14 symbols, the full ICT library, calendar heatmap, per-setup profit factor, and unlimited replay.
> [Start 7-day trial — then $39.99/yr] [Monthly: $9.99]
> No real money. No noise. Just reps.

**Variant C — Anchor against the tool stack**

> TradingView Premium: $30/mo. Tradervue Pro: $30/mo. TradeZella: $29/mo.
> Pocket Trade replaces nothing — it's what comes before those. The practice layer. The reps you never logged. Unlock the full library, full analytics, full history.
> [7 days free — $39.99/yr] [Monthly $9.99]

Lead with Variant B at launch. Run A as the second test, C as the third.

Critical copy rule: never imply real-money outcomes. No "make money trading," no "become a profitable trader," no return claims. Always frame as practice, skill, discipline, reps.

### 4.3 First-year pricing roadmap

**Launch (Day 0 → Day 30): Founding Member**
- Annual: $29.99/yr for the first 500 paying annual subscribers — locked at that price for as long as their subscription stays active.
- Monthly: $9.99 (no founding discount on monthly).
- Communicate the cap explicitly: "First 500 subscribers — $29.99/yr for life. 217 remaining."

**Month 1–3: Standard pricing live**
- Annual moves to $39.99/yr for new subscribers. Founding members stay locked.
- Keep 7-day trial on annual.
- Begin paywall A/B testing (Variant B vs A vs C).
- Track D7 trial-start rate, D14 trial-to-paid rate, D35 paid-active rate.

**Month 4–6: Optimize and expand SKUs**
- If D35 paid is converging above 2.7%: leave price alone, push UA.
- If D35 is <2%: do not lower price — re-tune the paywall placement and free-tier generosity instead.
- Introduce Lifetime: $99.99 one-time at month 6. Cap it at 200 buyers.
- Add gift subscription as an annual SKU (Apple supports this natively).

**Month 7–9: Consider price tier expansion**
- If you have >2K paying subscribers, test Pro+ at $79.99/yr with: CSV export, journal templates, advanced filters, custom setups, multi-account, priority support.
- Hold Pro at $39.99.

**Month 10–12: Annual price raise**
- Raise annual to $49.99/yr for new subscribers. Grandfather everyone at $39.99 forever.
- Communicate the raise 30 days in advance: "Pro is going to $49.99/yr on [date]. Lock in $39.99 now."

The single biggest revenue lever in Year 1 is not price — it's the trial-to-paid conversion rate and annual share of new subscriptions.

## Phase 5 — Go-to-Market / Marketing Strategy

### 5.1 Channel analysis — fit and CAC at $500–$5K Year 1 budget

The hard truth: at a $500–$5K total Year 1 marketing budget, you cannot meaningfully scale paid acquisition on Meta, TikTok, or YouTube ads. Industry-standard mobile finance app CAC sits at $5–$30 per install on Meta/TikTok in 2025–26, with finance-app paying-user CAC commonly $30–$120. A $5K spend buys you maybe 80–250 paying subs if everything works. That math means your real marketing strategy is organic + creator + community first, paid as a small targeted accelerant.

| Channel | Fit | Realistic CAC (paying sub) 2025–26 | Verdict |
|---|---|---|---|
| TikTok ads | Medium. Finance/trading creative gets restricted often. | $25–$80 per paying sub | Skip for paid. Organic only. |
| Instagram ads + Reels | Medium-low. | $30–$100 per paying sub | Skip for paid. Reels organic, yes. |
| Facebook ads | Low. Audience skews older; futures traders aren't on FB. | $50–$150 per paying sub | Skip entirely. |
| YouTube pre-roll | Low. CPMs high; pre-roll skip rates kill efficiency. | $40–$120 per paying sub | Skip paid pre-roll. Creator placements instead. |
| Twitter/X (FinTwit) organic + low-spend boosts | High. Densest trader audience anywhere. | Organic ≈ time. Boost $15–$50 per paying sub | Yes. Primary organic channel. |
| Reddit organic posts | High if you respect the subs. | Free; engineer-builds-in-public converts | Yes. Secondary organic. |
| Reddit ads | Medium. Cheap CPMs but most clicks go to free apps. | $20–$60 per paying sub | Maybe — small $200 test. |
| Discord (your own + relevant) | High. ICT/futures Discords are where the audience lives. | Free; time-intensive | Yes. Long-tail channel. |
| ASO | Critical and free. | $0 ongoing | Non-negotiable. Best ROI of any channel. |
| Paid influencer / creator sponsorships | High at small budgets — direct audience overlap. | $5–$40 per paying sub from vetted mid-tier | Yes. Where most of your paid spend should go. |
| Product Hunt launch | Medium. PH audience light on traders. | Free; spikes day-of installs | Yes — one-time launch event. |
| Apple Search Ads | High for a niche app with strong keywords. | $3–$15 per install, $25–$80 per paying sub | Yes — small spend, $300–600 on brand + competitor keywords. |

**Recommended Year-1 budget allocation ($3,000 mid-range):**
- Creator sponsorships: $1,800 (60%) — 4–6 mid-tier placements
- Apple Search Ads (brand + competitor terms): $600 (20%)
- Reddit ad test + TikTok Spark Ads on your own organic hits: $300 (10%)
- Reserve for boosting best-performing organic content: $300 (10%)

If budget is $500: skip paid tests, $400 to one mid-tier creator, $100 to Apple Search Ads on brand defense. If $5K: scale creators to $3.5K, ASA to $800, keep $700 reserve.

### 5.2 Organic strategy

**YouTube / TikTok account showing Pocket Trade replays — should you?**

Yes, but pick one and commit for 90 days. The play is not "show off the app." The play is **show the trader's process using the app as the canvas**.

Recommended pick: **TikTok-first**, Reels-cross-posted, YouTube Shorts-cross-posted. TikTok still has the best organic reach for cold accounts in 2025–26.

**Content formulas (start with these 6):**
1. "Watch me practice an [FVG / OB / Opening Range Breakout] in 60 seconds." Screen record of a Pocket Trade replay — pre-trade checklist, plan, execution, post-trade rating. Hook in first 1.5 seconds.
2. "3 ICT concepts every futures trader should drill — and how to practice them on your phone." Carousel-style.
3. "I lost $X on this real-money trade. Here's what the replay told me afterward." Vulnerability content — performs disproportionately well.
4. Build-in-public dev clips. Sketch a feature, ship it the next day, post the before/after.
5. "Your archetype quiz says you're a [Scalper / Day Trader / Swing / Position]. Here's what each one actually means."
6. Sunday Wrap-style weekly recap content.

Posting cadence: 4–5x/week on TikTok for the first 60 days, then re-evaluate based on what gets >5K views.

**Twitter/X (FinTwit) — three pillars:**
1. Daily setup commentary. Screenshot a real chart, mark up your read. Tie back to a Pocket Trade pattern by name. 1–3x/day.
2. Build-in-public threads. Weekly threads on a feature, design decision, or trader-psychology insight.
3. Replies, replies, replies. Spend more time replying to mid-tier FinTwit accounts (5K–50K followers) than posting your own.

Avoid: P&L screenshots that imply real-money outcomes (will get you confused with grifters). Hashtag spam.

**Reddit norms by sub:**
- r/Daytrading (1.3M+): product posts allowed if you have karma history and clearly disclose.
- r/FuturesTrading (300K+): more lenient. Your most-likely-to-convert sub.
- r/ICTtrading: very methodology-loyal. Lead with ICT-specific content.
- r/PropTrading: small but extremely targeted — perfect for "practice tool before you take your eval" framing.

Rule: never post the same content across multiple subs on the same day. Stagger by 2–4 days, rewrite per sub.

**Discord strategy:**
1. Join 5–8 existing trading Discords as a person. Contribute for 4–6 weeks before mentioning the product.
2. Launch your own Pocket Trade Discord at App Store launch. Channels: #welcome, #weekly-recaps, #setup-of-the-day, #feature-requests, #bug-reports, #ict-corner, #funded-thread.

### 5.3 Paid influencer strategy

Creator sponsorships are where 50–70% of your paid budget should go.

**Typical sponsor costs in trading creator space (verified 2025–26):**

| Creator size | Subs/followers | Typical 60–90s integrated mention CPM | Flat fee range |
|---|---|---|---|
| Micro | 5K–25K | $25–$60 CPM, but most charge flat | $150–$600 per video |
| Small | 25K–100K | $30–$70 CPM | $500–$2,500 per video |
| Mid | 100K–500K | $40–$80 CPM | $2,000–$10,000 per video |
| Large | 500K+ | $50–$120 CPM | $8,000+ — out of budget |

Finance/trading is a premium-CPM niche — expect 1.3–2x the base CPM vs general lifestyle.

**CAC at three budget tiers:**

**Tier 1 — $500 total**
- One micro creator (10K–25K), $300–$500 flat for integrated 60-second mention + pinned comment with code POCKET20.
- Expected views: 5K–25K. Installs: 50–300. Paying subs: 3–15.
- CAC per paying sub: $35–$165. Marginal — mostly for learning what creative resonates.

**Tier 2 — $2,000 total**
- 3–4 small creators ($400–$700 each) in adjacent niches (one ICT-purist, one prop-firm-funded-story, one general futures educator, one funded-trader-day-in-the-life).
- Stagger releases 1 week apart.
- Expected aggregate views: 50K–150K. Paying subs: 30–90.
- CAC per paying sub: $22–$65. Sweet spot for your budget.

**Tier 3 — $10,000 total**
- One mid-tier placement (~$5K–$7K) plus 4–6 small placements.
- Expected aggregate views: 200K–700K. Paying subs: 250–700.
- CAC per paying sub: $14–$40.
- At this budget level, paid influencer can credibly drive the bulk of your Year 1 acquisition and produce 5–10 reusable creative assets.

**a) Creator vetting criteria** (disqualify on any):

1. **View consistency.** Pull last 10 videos. Top video to median ratio should be <5×. Pay against median, not best.
2. **Engagement rate.** Likes-per-view >2% YouTube, >4% TikTok, >2% Reels. Comments-per-view >0.2% on YouTube.
3. **Comment quality.** Read the last 50 comments on 3 videos. Substantive trader-talk vs emoji floods.
4. **Audience geo and platform fit.** US/UK/EU heavy initially. Creators with 60%+ India/SEA audience aren't a fit for paid USD subs.
5. **No "get rich" / signal-service red flags.** Skip creators who: sell signals, advertise prop firm referrals with returns claims, show "passing the eval in 1 day" content, talk 10R-20R trades as routine, have "trading mentorship" as primary monetization.
6. **Sponsorship history.** 1–3 prior sponsorships ideal. Never or 3+ in 6 months = both problematic.
7. **Methodology overlap.** Do they actually trade futures? Do they reference ICT, classical TA, opening range?
8. **Personal-brand stability.** Avoid drama-prone creators.

**b) Outreach DM / email template:**

> Subject: Sponsorship — Pocket Trade (mobile futures replay sim) — [Creator name]'s audience seems like the right fit
>
> Hey [Name],
>
> I'm [your name], the dev behind Pocket Trade. It's a mobile-first replay simulator for futures — 14 symbols including NQ/MNQ/ES/MES, 28 setups (classic + ICT — FVG, OB, BPR, Liquidity Sweep, Breaker, etc.), pre-trade checklist, per-setup profit factor, and a discipline rate metric. Basically the practice tool I wish existed before I took my first prop-firm eval.
>
> I've been watching your channel — your [specific video, named] is exactly the kind of process content I think Pocket Trade is built for. The audience you've built around [their specific angle — "ICT execution," "funded-account journey," "futures fundamentals"] overlaps almost perfectly with who I'm building for.
>
> I'd love to do a paid integrated mention. Open to:
> - 60–90 second integrated mid-roll on a regular video
> - Or a dedicated full-video review if that's your preference
>
> I can send you a Pro account today so you can drive it for a week before you decide whether the product is worth your audience's attention. If it's not, no hard feelings — I'd rather you pass than do a forced read.
>
> What's your rate, and what's your normal turnaround? I have a small launch budget and I'm being honest about that — I'm looking to do 3–5 placements across creators in this niche over the next 6–8 weeks. If you're in, you'd get a unique promo code (POCKET-[YOURNAME]) at 20% off and a custom landing page so we can both see exactly what your audience does.
>
> Either way — appreciate the work you put into [their channel]. Reply whenever.
>
> [Your name]
> [Pocket Trade landing page]

**Tone rules:** lead with their content, not yours. Name a specific video. Be transparent about budget. Offer the product before you ask for the money. Cap the ask. Leave them an easy exit. Never lead with "we're a startup," "we just launched," "huge opportunity," or any pitch-deck language. Never name-drop other creators you've talked to. Never write more than 180 words. Never send a follow-up before day 5. Send exactly one follow-up at day 7, a single line: "Bumping this in case it got buried — totally fine if it's a no." After that, leave it alone.

Send the outreach Tuesday or Wednesday between 10 AM and 1 PM their local time. Expect a 15–25% reply rate on a cold list of well-vetted creators; expect 30–50% of replies to convert to a booked placement. That math means send 20–30 outreaches to land 4–6 placements at the Tier-2 budget.

**c) Measurement**

You need to know within two weeks of a placement going live whether it worked, with enough granularity to know whether the creator was the problem, the creative was the problem, or the funnel was the problem. Build the measurement stack before the first placement, not after.

**Unique landing pages per creator.** Spin up pockettrade.app/c/[creator-handle] for each placement. Identical layout, identical CTA, but the page logs the source via a query string (?utm_source=youtube&utm_campaign=creator-handle&utm_medium=video). The page should pre-emphasize the angle the creator hit on. Conversion uplift from a matched landing page vs the generic homepage is typically 30–80%.

**App Store custom product pages.** Both Apple and Google support custom product pages tied to a URL parameter. Build at minimum three variants — ICT-focused (Setup Library's ICT tab, FVG/OB/Liquidity Sweep), prop-firm-focused (Ranks, discipline rate, equity curve), and beginner-focused (Today's Mission, archetype quiz, Trade-this-setup CTA). Wire each creator's landing page CTA to the correct App Store custom product page via the appropriate ppid (Apple) / listing_id (Google) param. Most underrated free measurement tool you have.

**RevenueCat campaign attribution.** Tag entitlement-granted events with the source attribution via RevenueCat's setAttributes SDK call on first launch. From RevenueCat's dashboard, filter by campaign and see trial starts, trial-to-paid, and net revenue per creator within 14 days. You do not need a paid MMP at this budget.

**Promo codes.** Generate one promo code per creator in App Store Connect (Apple: Subscription Offer Codes; Google Play: Promotional Codes). Format: POCKET-[CREATOR]. Offer: first month free on monthly or 20% off year one on annual.

**How to read the data within 2 weeks:**
- **Day 0–2:** watch view curve + landing page sessions. Healthy: 60–70% of total 14-day views land in first 48 hours, landing page CTR ~1–3%.
- **Day 2–7:** App Store CPP impressions and downloads. Healthy: 35–50% of landing-page sessions click through, 25–40% of those download.
- **Day 3–10:** trial starts in RevenueCat. Healthy: 25–45% of new installs from the campaign start the 7-day annual trial.
- **Day 7–14:** trial-to-paid convert. Healthy: 25–40% of trial starts convert to paid annual. <15% means audience mismatch.
- **Day 14:** compute deal-level metrics. RNR/$ >1.5 = repeat. 0.5–1.5 = diagnose. <0.5 = kill the archetype.

Track in a single spreadsheet, one row per placement: creator handle, sub count, paid date, fee, video URL, drop date, 14d views, 14d landing sessions, 14d App Store CPP downloads, 14d trial starts, 14d paid conversions, 14d net revenue, 14d RNR/$.

**d) Specific creators and creator archetypes**

Trading creator names change quickly. Verify current status before outreach.

**Real, named creators in the small-to-mid tier (under 500K):**

- **TraderDante (Tom Dante)** — ~150K subs, futures + indices, classical price action, very British, anti-grift, audience leans serious retail and prop-firm-curious. Direct fit. Methodology aligns with your classic-setup library.
- **Trader Mickey** — small-to-mid futures day-trader segment, ~50K–120K range, often funded-trader-journey content. The archetype matters more than the specific channel.
- **The Trading Geek (Riley Coleman)** — varies in size, futures-leaning, prop-firm-aware. Strong educator energy.
- **Stacey Burke Trading** — ~150K range, swing/futures, methodology-driven. Older audience but high engagement, lower CPM.
- **Daniel Ramos (Ramos Trading)** — small ICT-aligned creator in the 20K–80K band; the "young ICT student" archetype. Audience is 19–28 male prop-firm hopefuls.

**Archetypes to systematically target:**

1. **The ICT-purist explainer (20K–100K).** Lives on FVG / OB / BPR / Power-of-3 content. Top-tier fit.
2. **The funded-account-journey vlogger (30K–150K).** Documents Topstep / Apex / FundedNext attempts in real time. Best for prop-firm-anchor paywall copy.
3. **The day-in-the-life futures day-trader (50K–250K).** Wakes up, journals, takes 2–4 trades on NQ or ES, posts the day's review.
4. **The trading-psychology / discipline educator (40K–200K).** Smaller niche, but their content thesis is your product thesis. Highest narrative fit.
5. **The TikTok futures clipper (5K–80K).** Native TikTok creators with 30–60s "this is the setup I took this morning" clips. Cheap ($150–$400/placement), creative-test fuel.

**Skip entirely:**
- Any channel whose top three videos are "I made $X today" thumbnails with red arrows.
- Any creator selling signals, copy-trade Discords, or "mentorship" as primary revenue.
- "Lifestyle" trading creators (Lamborghinis, Dubai, watches).
- Any creator whose Discord is locked behind a $99+/mo paywall.

### 5.4 Concrete 4-Week Launch Sequence

Day-by-day. Day 0 = public App Store + Play Store release.

**Week -2 (Days -14 to -8) — Foundation week**

- **Day -14 (Mon):** Stand up marketing site. Single page: hero, 3 screenshots, archetype quiz teaser, waitlist email capture. Stack: Vercel + Beehiiv or Google Sheet.
- **Day -13 (Tue):** Finalize ASO. Title: Pocket Trade: Futures Sim. Subtitle (iOS, 30 chars): Replay. Practice. Get funded. Keyword field: futures simulator, trading simulator, trading journal, ICT trading, prop firm practice, day trading, replay trading, opening range, fair value gap, order block. Generate 6 screenshots in device frames: (1) Today's Mission + Trade-this-setup CTA, (2) Equity curve + heatmap, (3) Setup Library with Classic/ICT tabs, (4) Ranks with Tournaments-coming-soon, (5) pre-trade checklist + plan capture, (6) post-trade summary with badge unlock. Include a 15–30s preview video.
- **Day -12 (Wed):** Begin creator outreach. Send 20–30 emails. Block 90 minutes; track in a sheet.
- **Day -11 (Thu):** TestFlight + Play Store internal track build live. Recruit 20–50 testers via r/Daytrading, r/FuturesTrading, r/ICTtrading. Disclose you're the dev.
- **Day -10 (Fri):** Set up RevenueCat. Wire entitlements, paywall component, 7-day annual trial, monthly + annual + Founding Member SKU. Test in sandbox. Set up App Store Custom Product Pages (3 variants). Draft Apple Search Ads campaign on brand + competitor terms.
- **Day -9 (Sat):** Content seeding sprint. Record 6 short-form videos. Don't post yet — schedule them. Draft 4 Twitter/X threads: (1) why I built Pocket Trade, (2) what's in the 28-setup library, (3) streak/freeze design rationale, (4) discipline-rate metric and why it matters more than win rate.
- **Day -8 (Sun):** Beta feedback triage. Read every tester comment. Ship top 3–5 fixes by end of day. Mark build as release candidate.

**Week -1 (Days -7 to -1) — Drumroll week**

- **Day -7 (Mon):** Submit production builds to App Store Connect and Play Console. Schedule release for Day 0. Post Twitter thread #1.
- **Day -6 (Tue):** Reddit post #1 in r/FuturesTrading.
- **Day -5 (Wed):** Lock in 3–4 confirmed creator placements. Send each: (a) unique promo code, (b) unique landing page URL, (c) App Store custom product page URL for their archetype, (d) one-page brief with 3 talking points and 0 mandatory scripts. Stagger drop dates across Days 0–14.
- **Day -4 (Thu):** Twitter thread #2 (28-setup library breakdown). DM 10 mid-tier FinTwit accounts you've engaged with for 60 days.
- **Day -3 (Fri):** Schedule Product Hunt launch for Day 0 (00:01 PT, Tuesday or Wednesday). Write PH post: tagline, 3 GIFs, gallery, first comment thread. Recruit 5–10 hunters.
- **Day -2 (Sat):** Draft waitlist launch email. Subject: Pocket Trade is live Tuesday. Body: 4 sentences + screenshot + two CTAs. Schedule for Day 0, 9 AM ET.
- **Day -1 (Sun):** Production app approved on both stores. Sunday Wrap your dev journey on Twitter as a final pre-launch thread. Sleep.

**Week 1 (Days 0–6) — Launch week**

**Day 0 (Tue or Wed) — Launch day:**
- 00:01 PT: Product Hunt post live. Comment from your own account in first 5 minutes with founder story.
- 06:00 ET: Tweet announcement, pinned, with 15s preview video.
- 07:00 ET: Reddit posts go live in r/FuturesTrading, r/ICTtrading (separate copy each — no copy-paste). Hold r/Daytrading for Day 2.
- 09:00 ET: Waitlist launch email sends.
- 09:30 ET: First scheduled TikTok / Reels / Shorts goes live.
- Throughout: reply to every PH comment within 30 minutes; every Reddit comment within 1 hour; every tweet reply within 15 minutes for first 6 hours.
- 18:00 ET: Activate Apple Search Ads at $20/day on brand + 5 competitor keywords (tradingsim, tradervue, edgewonk, tradingview, topstep).
- 21:00 ET: Compute Day-0 numbers, tweet them.

**Day 1 (Wed):**
- Push for review velocity. In-app prompt to rate after the 3rd successful trade.
- First creator placement drops.
- Reddit post #2 in r/ICTtrading.

**Day 2 (Thu):**
- Reddit post in r/Daytrading.
- Twitter: post Day-1 numbers + one specific user story (with permission).
- Open Pocket Trade Discord. Post link in Twitter bio, landing page, pin in Reddit comments.

**Day 3 (Fri):**
- Second creator placement drops.
- Mid-week recap thread on Twitter.
- Apple Search Ads: pause anything spent $20 with 0 conversions. Double budget on what's working.

**Day 4 (Sat):**
- Quiet day on social. Read every review, every comment, every DM. List top 3 friction points + top 3 delight moments.

**Day 5 (Sun):**
- Sunday Wrap content: post your own first week of metrics in Sunday-Wrap-formatted screenshot.
- Two waitlist emails: (1) for installers who haven't started a trial; (2) for non-installers.

**Day 6 (Mon):**
- Third creator placement drops.
- Patch 1 ship: top 3 friction fixes. Submit to both stores. Tweet about it.
- Compute Week 1 metrics. Build spreadsheet row for each creator placement.

**Weeks 2–4 — Iterate, kill, double down**

**Week 2 (Days 7–13):**
- Day 7: "Week 1 in the open" thread — installs, trials, paid, top friction, what shipped, what's next.
- Day 8: kill any paid channel with RNR/$ <0.5 after 14d.
- Day 9–10: shoot 4 new short-form videos based on what got most engagement.
- Day 11: second wave of creator outreach — 15–20 fresh names — using what you learned in Week 1.
- Day 12: review batch — message highest-engaged 30 users individually asking for a review.
- Day 13: ship patch 2 — friction fixes + first net-new free-tier feature improvement.

**Week 3 (Days 14–20):**
- Day 14–15: paywall A/B test — flip from Variant B to A or C on 50% of new users. Need ~150 trial starts per variant for any signal.
- Day 16: third wave of creator outreach if Week-1 placements showed positive RNR/$. Two mid-tier ($800–1.5K) over four micro this time.
- Day 17: long-form blog post (1,200–1,800 words): "I built a mobile futures simulator. Here's what I learned shipping it."
- Day 18–20: organic-content double-down on whatever video format performed best in Week 1.

**Week 4 (Days 21–28):**
- Day 21–22: third creator placement wave drops. Compute aggregate paid-channel CAC across 6–8 placements.
- Day 23–25: ship patch 3 — first quality-of-life pass on highest-friction screen.
- Day 26: Founding Member offer ends if 500 cap not yet hit. Communicate deadline 72 hours in advance via in-app banner + email + tweet.
- Day 27: first Sunday Wrap from a real Pocket Trade Pro user (with permission, shared from Discord).
- Day 28: Month-1 retrospective. Public. Numbers. Lessons. Mistakes. Roadmap for month 2.

**Brutal-honesty rule for weeks 2–4:** if a channel hasn't shown a sub-$50 paying-user CAC by Day 21, cut its budget by 75%. Spread remaining budget on what worked. Month 1 is for learning; month 2 onward is for compounding.

### 5.5 Long-Term Moat

What defends the position after Year 1, when copycats notice the niche and one of the journals (Tradervue, TradeZella) decides to ship a mobile replay feature. Five compounding moats:

**Network effects — the Tournaments-100-traders gate**

The Ranks tab already signals the strategy: the Tournaments — Coming Soon tile gated at "the first season launches when 100 traders join" is the cleanest network-effect hook the product has. It's a threshold that converts community size into a product feature unlock.

How to weaponize past Year 1:
- **Seasonal tournaments as a feature, not a side quest.** Once 100 traders hit, run a 4-week season — ranked by risk-adjusted score (profit factor × discipline rate × consistency, not raw P&L). Winners get an exclusive badge that can only be earned in tournaments.
- **Tournament-only setups and historical sessions.** Each season ships 1–2 brand-new Setup-of-the-Day scenarios, locked to the active season.
- **Tournament Discord channels.** Live commentary, leaderboards refreshed daily, Sunday Wrap of the day.
- **Funded-account-style narrative.** "Top 10 in last month's Pocket Trade tournament — three just funded their Topstep eval." Social proof no competitor can manufacture.
- **Local network effects via archetype.** Users cluster by archetype in tournament leaderboards, Discord channels, and content feeds.

Trick: publish the count. Show "67 / 100 traders — first tournament unlocks at 100" in-app and on a public Twitter dashboard. Threshold mechanics only work as growth loops when they're observable.

**Content moat**

28 named setups is good. The defensible version is 28 named setups, **plus** a growing library of curated historical sessions, **plus** per-setup performance data accumulating across the user base.

Ship 1–2 new historical Setup-of-the-Day scenarios per week, indefinitely. After 12 months: 50–80 curated scenarios. After 24: 100–150. Editorial content — picked, annotated, contextualized — not auto-generated.

Anonymized per-setup performance across the user base becomes a content moat. "Across 14,000 Pocket Trade users, the FVG entry has a community-wide profit factor of 1.4 on NQ but only 0.9 on CL — here's why." Quarterly blog post + recurring tweet thread + editorial nobody else can publish. Anonymized, aggregated, opt-in, never tied to individuals.

Adjacent: write the canonical lesson for each setup. Over Year 2 they should become the best public writing on each of those 28 concepts. When somebody googles "what is a fair value gap," they should land on Pocket Trade's lesson page. SEO compounding with a product-led conversion path.

**Brand moat**

The locked visual system — pure black, gold #FFB800, JetBrains Mono numerals, Inter Display headings, calm motion — is a real moat in a category where everyone else looks either Bloomberg-busy or robo-advisor-bland. Keep it locked.

The harder-to-replicate piece is the anti-grift positioning. "No real money, no fake P&L bragging, no get-rich noise — just deliberate reps." This is a brand claim that compounds every time you refuse to do something a competitor would. Specifically: never run a $1M-account-balance variant, never run leaderboards by raw P&L, never partner with signal services, never let prop firms pay for placement in the app. Every "no" cements the brand.

ICT-first thinking is the third brand pillar. Eleven of the 28 setups being explicitly ICT-named (FVG, OB, BPR, Breaker, Liquidity Sweep, Power of 3) is a signal flag. The ICT community is small, methodology-loyal, and unusually defensive of tools that treat the methodology seriously. Own it.

**Shipping velocity as moat**

A single-developer indie shop that ships a thoughtful patch every two weeks beats a Series-A startup that ships a redesign every six months. The cadence is the moat.

- **Public patch notes, every release.** Versioned whats-new screen on first launch + tweet thread + Discord post.
- **Feature-request transparency.** Run a public roadmap (Linear, Productlane, GitHub Discussions). When users see their bug-report turn into a shipped feature in 11 days, they tell other traders.

Defensive aspect: if Tradervue or TradeZella ships a mobile replay v1, they'll get savaged in reviews, take 4 months to ship v1.1. You will have shipped 8 patches in that window.

**Switching costs**

Five layers, in order of switching pain:

1. **Trade history.** Every trade with symbol, side, entry, exit, P&L, setupId, intended R:R, achieved R:R, checklist passed, rating, journal note. Cloud-syncing the trade history (currently a known gap) makes this stick across devices and effectively becomes the user's personal trading dataset.
2. **Mastery progress.** "Mastered" status on 28 setups doesn't transfer to a competitor. After 6 months, a user with 14 mastered setups has built something they don't want to walk away from.
3. **Streak.** A 240-day streak is irreplaceable. Even users who quietly resent the streak mechanic don't want to be the person who let it lapse.
4. **Ranks and badges.** Reaching Market Maker III takes real reps. Switching means starting at Gambler I somewhere else, and somewhere else doesn't have ranks.
5. **Personal-best history.** A library of best weeks is psychologically harder to leave than any single feature. It's an autobiography.

A user with 8 months of cloud-synced trades, 11 mastered setups, a 124-day streak, the rank of Trader II, 17 of 30 badges unlocked, and 6 personal-best weeks logged is functionally not switchable.

**Strategic implication:** prioritize the trade-history cloud sync (listed as a known gap) above almost everything else in the post-launch roadmap. It's a switching-cost lever disguised as a sync feature.

## Phase 6 — Final Recommendation

### 6.1 Monetization model

Freemium subscription with a hard-ish paywall on analytics depth, gated after the first trade loop completes. Rationale: a $500–$5K UA budget cannot fund paid acquisition at one-time-purchase LTVs, and the engagement engine (ranks, streaks, daily missions) needs to stay free to power the organic / word-of-mouth top of funnel.

### 6.2 Exact pricing

- Monthly: $9.99
- Annual: $39.99 (7-day free trial, annual only)
- Founding Member (launch month, capped at first 500 annual subs): $29.99/yr locked for life of subscription
- Lifetime (introduced month 6, capped at 200 buyers): $99.99 one-time
- Year-end annual price raise: $49.99 at month 10 for new subscribers

### 6.3 Primary marketing channel

Paid creator sponsorships in the futures / ICT / prop-firm-funded YouTube and TikTok niche — small to mid-tier creators (10K–250K), $300–$1,500 per placement, measured with unique landing pages + App Store Custom Product Pages + RevenueCat campaign attribution + creator-specific promo codes. Target 4–8 placements in the first 90 days, ~60% of total marketing budget.

### 6.4 Secondary channels

1. **Twitter/X (FinTwit) organic + Reddit organic** in r/FuturesTrading, r/ICTtrading, r/Daytrading. Free. Build-in-public threads, daily setup commentary, methodology-specific posts.
2. **Apple Search Ads + App Store Optimization.** 15–20% of budget on brand defense + competitor keywords (tradingsim, tradervue, tradingview, topstep) + finalized ASO (title, subtitle, keyword field, 6 screenshots, preview video, 3 custom product pages).

### 6.5 Next 30 days

- TradingView Advanced Charts integration ships within 10 days of license approval
- Finalize ASO: title, subtitle, 6 device-framed screenshots, 15–30s preview video, 3 App Store Custom Product Pages (ICT / prop-firm / beginner variants)
- Wire RevenueCat — entitlements, paywall component, 7-day annual trial, monthly + annual + Founding Member SKU; sandbox-test on iOS and Android
- Marketing site live (single page: hero, 3 screenshots, archetype quiz teaser, waitlist capture)
- Privacy policy, terms of service, EULA hosted at stable URLs; in-app account deletion shipped
- App Store reviewer demo account + onboarding tune-up so reviewers complete a trade loop in <90 seconds
- TestFlight closed beta — 20–50 testers from r/FuturesTrading and r/ICTtrading; ship top 3–5 fixes by end of week 2
- Twitter/X account active: 4 build-in-public threads drafted; daily setup-commentary cadence started 14 days before launch
- Creator outreach sprint: 20–30 vetted emails sent using the 5.3b template; target 4–6 confirmed Tier-2 placements within 21 days
- Apple Search Ads dashboard prepped; campaign drafted at $20/day on brand + 5 competitor keywords, activate Day 0
- Submit production builds to App Store Connect + Play Console no later than Day 23, scheduled for release Day 28–30
- Discord server stood up with channels: #welcome, #weekly-recaps, #setup-of-the-day, #feature-requests, #bug-reports, #ict-corner, #funded-thread

### 6.6 Next 90 days

- Public launch on App Store + Play Store; execute the 4-week sequence from 5.4
- Hit 500 Founding Member subs or close the offer at month 1 either way
- **Ship cloud sync for trade history** (single highest-priority post-launch feature — biggest switching-cost lever)
- Patch cadence: every 10–14 days, public patch notes, tweeted + Discord-posted; minimum 6 patches in first 90 days
- Three creator placement waves: launch (4–6 placements), Week 3 (2 mid-tier $800–1,500 each), Week 7 (final wave based on what archetype converted best)
- Paywall A/B test: Variant B vs A vs C, ~150 trial starts per arm before calling a winner
- Build the 50–80-scenario historical-session library (cadence: 1–2 new Setup-of-the-Day scenarios per week)
- Begin canonical setup-lesson SEO project — rewrite all 28 lessons to be the best public writing on each concept
- Launch first tournament when Discord crosses 100 active members + product crosses 100 daily active users
- Month 3 retrospective tweet thread: installs, trials, paid, churn, what shipped, lessons
- Decision point at Day 60: if paid-channel blended CAC <$50/paying sub, scale creator budget; if >$80, shift 60%+ to organic + ASO + ASA and reset

### 6.7 What NOT to do

- Don't add ads as a monetization mechanism. Wrong audience, wrong brand, App Store policy risk.
- Don't ship a one-time-purchase SKU. LTV math doesn't work for a product with ongoing server + content + license costs.
- Don't run Facebook ads. Audience is not there.
- Don't run YouTube pre-roll ads. CPMs too high, skip rates kill efficiency, creator placements dominate at every comparable budget.
- Don't post the same Reddit content across multiple subs on the same day. Stagger 2–4 days, rewrite per sub.
- Don't pay any creator who sells signals, runs a paid signal Discord, advertises "guaranteed returns," or whose top thumbnails are red arrows next to dollar figures.
- Don't run global P&L leaderboards. Ever. Tournaments rank on risk-adjusted score (profit factor × discipline rate × consistency), not raw P&L.
- Don't gate the engagement engine (ranks, streaks, daily missions, badges, archetype quiz) behind the paywall. The free engagement loop is the marketing channel.
- Don't ship features before fixing the trade-history cloud sync gap. It's the biggest switching-cost lever you have and it's currently missing.
- Don't lower the annual price below $39.99 if conversion is soft. The fix is the paywall placement and free-tier generosity, not the shelf price.
- Don't launch a "Pocket Trade" web app, dark/light mode toggle, leaderboards, equities expansion, options expansion, or crypto expansion in Year 1. Scope discipline is the moat.
- Don't accept any prop firm sponsorship or affiliate offer in Year 1, no matter how lucrative. It blows the anti-grift positioning permanently.

## Chat Summary

**Recommended monetization model + price:** Freemium subscription with a 7-day trial on annual. $9.99/mo, $39.99/yr. Founding Member cap: $29.99/yr lifetime-locked for the first 500 annual subscribers in launch month. Lifetime tier ($99.99) introduced at month 6, capped at 200 buyers. Annual moves to $49.99/yr at month 10.

**Top 2 marketing channels:**
1. Paid creator sponsorships in the futures / ICT / prop-firm-funded YouTube and TikTok niche — vetted small-to-mid creators (10K–250K subs), $300–$1,500 per placement, ~60% of marketing budget, measured via unique landing pages + App Store Custom Product Pages + RevenueCat campaign attribution + creator promo codes.
2. Organic FinTwit + Reddit (r/FuturesTrading, r/ICTtrading, r/Daytrading) + Apple Search Ads / ASO. Free or near-free, costs time. Build-in-public threads, daily setup commentary, honest disclosure-tagged Reddit posts, locked-down ASO with 3 custom product pages.

**Biggest open question:** TradingView Advanced Charts license timing. Decide a no-later-than date (suggested Day 21). If TradingView hasn't approved by then, scope Lightweight Charts fallback in parallel so launch slips by weeks, not months.

**Secondary open question:** register as an organization (LLC) or as an individual developer on Google Play — the personal-developer 14-day testing requirement adds two weeks to your Play Store launch and is worth eliminating if you're not already incorporated.

**Realistic launch timeline:** 5–8 weeks from today, gated almost entirely on the TradingView Advanced Charts license decision. Aim for Week 6 release date; protect Week 8 as a soft buffer; if TradingView denies, add 3–4 weeks for the Lightweight Charts fallback (revised target: Week 10–12).
