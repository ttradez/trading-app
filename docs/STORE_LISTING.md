# Store listing copy for Pip

Paste this content into App Store Connect + Google Play Console.
All copy is written to be honest about Pip being a SIMULATOR and
NOT real-money trading — both stores reject apps that imply or
hint at brokerage activity without the proper licensing
disclosures.

If you want to tweak the voice or shorten anything, edit here
and tell me; I'll regenerate.

---

## App identity (both stores)

- **App name**: `Pip`
- **Subtitle (iOS, 30 chars max)**: `Trading practice simulator`
- **Short description (Android, 80 chars max)**: `Practice futures trading on real historical data — no real money at risk.`
- **Bundle ID / Package**: `com.pockettrade.app`
- **Primary category**:
  - iOS: **Finance** (sub-category: Investing) OR **Education** (cleaner reviewer path)
  - Android: **Finance**
- **Age rating / content rating**:
  - iOS: **17+** — financial info, simulated gambling-adjacent (replay trading)
  - Android: **Mature 17+** with the same rationale on the IARC form
- **Pricing**: Free
- **In-app purchases**: optional ad-removal upgrade (configure once Google Play account is live)

---

## App description

### Long description (~4000 chars, both stores)

```
Pip is a futures-trading practice simulator. Replay real historical
market data on Nasdaq (NQ), S&P 500 (ES), Dow Jones (YM), and Gold
(GC) futures — one bar at a time — and learn to spot setups, manage
risk, and journal your decisions without ever putting real money
at risk.

WHAT YOU CAN DO IN PIP
• Open a session on any of the four supported futures contracts
• Replay any historical date from 2020 onward at your own pace
• Switch between 1-minute, 5m, 15m, 30m, 1h, 4h, and daily timeframes
• Click Next Bar to advance the chart one candle at a time
• Buy and sell at the price the chart shows — entries are exactly
  what you saw on screen, no slippage trickery
• Set stops and targets that hit automatically as the chart advances
• Build a journal of every trade with notes, screenshots, mistakes,
  and what went well
• Track your win rate, P&L, R-multiple, and consistency over time
• Earn XP and rank up as you log more disciplined practice

WHY PIP EXISTS
Live trading is the most expensive way to learn a market. Demo
accounts hide the emotional friction of waiting for a real setup.
Pip splits the difference — you face real market structure on real
historical data, but the cost of being wrong is only what you wrote
in your journal. Trade 1,000 sessions before you ever touch your
real broker.

WHO PIP IS FOR
• New traders who want a serious practice rep before risking capital
• Funded-challenge candidates rehearsing intraday execution
• Existing traders who want to journal more sessions per week than
  market hours allow
• Anyone curious about chart reading and futures without commitment

WHAT PIP IS NOT
Pip is a simulator. It does NOT execute real trades. It does NOT
connect to a brokerage. The balance, P&L, and stops inside the app
are simulated. Pip is not financial advice, not an investment
recommendation, and not a substitute for risk management you'll
need when trading real money. Past performance inside the replay
environment is not indicative of future results in a real account.

DATA
Pip ships with real one-minute historical OHLCV data from a
licensed Databento feed for ES, NQ, YM, and GC covering 2020-04
through 2025-03. Daily and weekly aggregates extend earlier.

PRIVACY
We collect the minimum needed to run your account: your email,
chosen display name, and the simulated trades / journal entries
you create. We do not sell your data, do not show third-party
ads, and do not track you across other apps or websites. Full
privacy policy at the link in Settings.

QUESTIONS?
Email bentitus2009@gmail.com — replies usually within a day.
```

### Promotional text (iOS, 170 chars, updatable without re-review)

```
Practice futures trading on real historical NQ/ES/YM/GC data. Replay any date, one bar at a time, journal every trade, no real money on the line.
```

### What's new (release notes for first version)

```
First release of Pip — futures-trading practice simulator.

• Replay real historical NQ, ES, YM, and GC futures one bar at a time
• 1m, 5m, 15m, 30m, 1h, 4h, and daily timeframes
• Built-in journal with screenshots, notes, mistakes, and self-rating
• Track win rate, R-multiple, XP, and rank as you log practice reps
• Sign in with Apple, Google, or email

Pip is a simulator. No real trades, no real money. Educational use only.
```

---

## Keywords (iOS, ~100 chars total)

```
trading,replay,simulator,futures,journal,practice,NQ,ES,YM,GC,chart
```

(Don't waste characters on "trading app" or "stock" — those are
high-competition and Pip's actual hooks are the replay + journal
combo.)

---

## App Store Connect categorization

- **Primary category**: Education
- **Secondary category**: Finance
- *(Education-first reduces Apple-reviewer scrutiny vs. Finance,
  since you're not handling real money or providing advice.)*

## Google Play Console categorization

- **Category**: Finance
- **Tags**: Trading, Stock Market, Education
- **Content rating questionnaire highlights** (for IARC):
  - Does the app contain references to gambling? **No** (it's
    educational simulation, not games of chance)
  - Does the app include simulated gambling activity? **No**
  - Does the app handle real-money transactions? **No** (in-app
    purchases for ad removal only, no money flowing to a third
    party)
  - Does the app reference drugs, alcohol, violence, hate? **No**
  - Recommended age: **Mature 17+**

---

## Data Safety form (Google Play)

Fill these answers on the **Data safety** form under
Google Play Console → App content → Data safety.

### Data collection
- **Personal info > Email address**: Yes
  - Collected, sent off-device (Firebase Auth)
  - Required (yes)
  - Purpose: Account management, App functionality
- **Personal info > Name**: Yes (the display name)
  - Collected, sent off-device
  - Required (no)
  - Purpose: Account management, App functionality
- **App activity > User-generated content**: Yes
  - (Journal notes, screenshots, simulated trades)
  - Collected, sent off-device
  - Required (no)
  - Purpose: App functionality, account management
- **App activity > In-app actions**: Yes
  - (Trade open/close, advance, timeframe switches)
  - Collected, sent off-device
  - Purpose: App functionality, analytics
- **App info and performance > Crash logs**: Yes (Crashlytics)
  - Collected, sent off-device
  - Purpose: Analytics
- **Device or other IDs > Device or other IDs**: Yes (Firebase UID)
  - Collected, sent off-device
  - Purpose: Account management

### Data sharing
- Confirm: All data shared only with Firebase / Google Cloud as the
  cloud backend. NOT shared with third-party advertisers.

### Security practices
- Encrypted in transit: Yes (TLS)
- Encrypted at rest: Yes (cloud provider)
- Users can request data deletion: Yes (Settings → Delete account)

---

## Apple privacy nutrition label (App Store Connect)

Data linked to user:
- **Contact info > Email address** — used for App Functionality
- **User content > Photos or videos** (journal screenshots) — App
  Functionality
- **User content > Other user content** (notes, simulated trades)
  — App Functionality
- **Identifiers > User ID** (Firebase UID) — App Functionality
- **Usage data > Product interaction** — Analytics

Data NOT collected for tracking. NSPrivacyTracking is false in the
app's privacy manifest (already configured in app.json).

---

## Screenshot guidance

You need to capture these for both stores. Use the iOS Simulator
(largest iPhone available, e.g. iPhone 15 Pro Max) for App Store,
and an Android emulator (Pixel 7 / Galaxy S22 profile) for Play
Store. Take 6 each:

1. **Onboarding splash** — gold P-mark + "PIP" wordmark on black
2. **Disclaimer screen** — shows you're up-front that this is a
   simulator
3. **Chart in mid-session** — chart with one open position visible
   (Buy/Sell/Next Bar row, journal of recent trades)
4. **Symbol picker** — watchlist sheet showing the 4 symbols
5. **Journal entry modal** — open journal with notes + emotion + R
6. **Stats screen** — win rate, P&L, rank, XP

Tip: turn on iOS / Android "Hide status bar" via developer tools so
the system clock + battery don't appear; Apple specifically calls
out battery icons as a screenshot disqualifier.

---

## App icon submission

- Use `assets/icon.png` (1024×1024, opaque, no transparency, no
  rounded corners — both stores apply their own rounding).
- App Store: drop into App Store Connect under App Information →
  App Icon.
- Play Store: drop into Play Console under Store Settings → App
  Icon.
