import json
import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import get_conn, init_db
from data_pipeline.symbol_map import CONTRACT_SPECS, DISPLAY_NAMES, CATEGORIES

app = FastAPI(title="Pocket Trade API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Markets ─────────────────────────────────────────────────────────────────

@app.get("/markets")
def get_markets():
    markets = []
    for symbol, spec in CONTRACT_SPECS.items():
        markets.append({
            "symbol": symbol,
            "name": DISPLAY_NAMES.get(symbol, symbol),
            "pip": spec["pip"],
            "contractSize": spec["contractSize"],
            # Category drives the section grouping in the watchlist picker.
            # Falls back to "Other" so any newly-added contract that hasn't
            # been classified yet still renders (under its own section)
            # instead of disappearing.
            "category": CATEGORIES.get(symbol, "Other"),
        })
    return markets


# ─── Candles (market browser preview — no session) ───────────────────────────

@app.get("/candles")
def get_candles(
    symbol: str = Query(...),
    timeframe: str = Query("1D"),
    limit: int = Query(200, le=500),
):
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT time, open, high, low, close, volume
            FROM candles
            WHERE symbol = ? AND timeframe = ?
            ORDER BY time DESC LIMIT ?
            """,
            (symbol, timeframe, limit),
        ).fetchall()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return [
        {"time": _wire_time(timeframe, r["time"]), "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for r in reversed(rows)
    ]


# ─── Users / Accounts ────────────────────────────────────────────────────────

class UpsertUserRequest(BaseModel):
    uid: str
    username: str
    email: str


@app.post("/users")
def upsert_user(req: UpsertUserRequest):
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO users (uid, username, email) VALUES (?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET username=excluded.username, email=excluded.email
        """,
        (req.uid, req.username, req.email),
    )
    conn.execute(
        "INSERT OR IGNORE INTO accounts (uid) VALUES (?)",
        (req.uid,),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM accounts WHERE uid = ?", (req.uid,)).fetchone()
    conn.close()
    return dict(row)


@app.get("/users/{uid}")
def get_user(uid: str):
    """Get user info (username, email) — called on login to restore display name."""
    conn = get_conn()
    row = conn.execute("SELECT uid, username, email FROM users WHERE uid = ?", (uid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


@app.get("/users/{uid}/account")
def get_account(uid: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM accounts WHERE uid = ?", (uid,)).fetchone()
    xp_row = conn.execute("SELECT xp FROM users WHERE uid = ?", (uid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    out = dict(row)
    xp_total = xp_row["xp"] if xp_row else 0
    out["xp"] = xp_total
    # Phase 2: surface the full rank object alongside the legacy
    # `rank` string field. The legacy field stays so existing
    # leaderboard/group-LB consumers don't break.
    out["rank_obj"] = _rank_from_xp(xp_total)
    return out


@app.get("/users/{uid}/xp")
def get_user_xp(uid: str):
    conn = get_conn()
    try:
        row = conn.execute("SELECT xp FROM users WHERE uid=?", (uid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        xp_total = row["xp"]
        events = conn.execute(
            "SELECT id, session_id, amount, reason, breakdown, created_at "
            "FROM xp_events WHERE uid=? ORDER BY created_at DESC LIMIT 50",
            (uid,),
        ).fetchall()
        recent_events = [
            {
                "id": e["id"],
                "session_id": e["session_id"],
                "amount": e["amount"],
                "reason": e["reason"],
                "breakdown": json.loads(e["breakdown"]),
                "created_at": e["created_at"],
            }
            for e in events
        ]
    finally:
        conn.close()
    return {
        "xp_total": xp_total,
        "recent_events": recent_events,
        "rank": _rank_from_xp(xp_total),
    }


@app.get("/users/{uid}/sessions")
def list_user_sessions(uid: str):
    """List a user's existing replay sessions, newest first. Drives the
    SessionsScreen "Continue" list. Returns an empty array (200) when
    the user has no sessions — callers don't need to special-case 404.

    `progress_pct` is computed from end_time when present; when the
    session has no defined end bound we omit the field rather than
    inventing a noisy "% through the dataset" number that would mean
    nothing to the user. `trade_count` and `realized_pnl` aggregate the
    `trades` table on session_id; sessions with no closed trades yet
    return 0 / 0.0.

    Order: newest first by created_at (the session-row insert time).
    Filter: trading_sessions.uid (FK to users.uid).
    """
    conn = get_conn()
    # is_shadow = 0 filter: hide watchlist-picker-spawned scratch sessions
    # from the Continue list. The user only sees the sessions they
    # explicitly created via SessionsScreen / CreateSessionSheet.
    rows = conn.execute(
        """
        SELECT s.session_id, s.symbol, s.timeframe, s.hidden_start,
               s.current_time, s.end_time, s.created_at, s.status,
               s.account_size,
               COALESCE(t.trade_count, 0)  AS trade_count,
               COALESCE(t.realized_pnl, 0) AS realized_pnl
        FROM trading_sessions s
        LEFT JOIN (
          SELECT session_id, COUNT(*) AS trade_count, SUM(pnl) AS realized_pnl
          FROM trades
          GROUP BY session_id
        ) t ON t.session_id = s.session_id
        WHERE s.uid = ? AND s.is_shadow = 0
        ORDER BY s.created_at DESC
        """,
        (uid,),
    ).fetchall()
    conn.close()

    out = []
    for r in rows:
        start_t = r["hidden_start"]
        cur_t = r["current_time"]
        end_t = r["end_time"]
        item: dict = {
            "session_id": r["session_id"],
            "symbol": r["symbol"],
            "timeframe": r["timeframe"],
            "start_time": start_t,
            "end_time": end_t,
            "current_time": cur_t,
            "created_at": r["created_at"],
            "status": r["status"],
            "trade_count": int(r["trade_count"]),
            "realized_pnl": round(float(r["realized_pnl"]), 2),
            "account_size": r["account_size"],
        }
        # Only compute progress_pct when there's a defined end bound —
        # see docstring. Guard against zero-length windows.
        if end_t is not None and end_t > start_t:
            pct = (cur_t - start_t) / (end_t - start_t) * 100.0
            # Clamp to [0, 100] for display friendliness.
            item["progress_pct"] = round(max(0.0, min(100.0, pct)), 1)
        out.append(item)
    return out


@app.get("/symbols/{symbol}/range")
def get_symbol_range(symbol: str):
    """Min/max candle time for a symbol — drives the date-picker bounds
    on the New Session "Pick dates" mode. Returns the full 1m base
    range; smaller TFs share the same window because they're resampled
    from 1m. ES/NQ honor the same Databento window the cached helper
    above uses. Returns unix seconds."""
    conn = get_conn()
    row = conn.execute(
        "SELECT MIN(time) AS min_t, MAX(time) AS max_t FROM candles "
        "WHERE symbol = ? AND timeframe = '1m'",
        (symbol,),
    ).fetchone()
    conn.close()
    if not row or row["min_t"] is None:
        raise HTTPException(status_code=404, detail="No data for this symbol")
    return {"symbol": symbol, "min_time": int(row["min_t"]), "max_time": int(row["max_t"])}


# ─── Session helpers ─────────────────────────────────────────────────────────

# Per-symbol cached 1m data range for symbols whose intraday data window must
# clamp _pick_random_start. ES and NQ are sourced from a fixed Databento window
# (2020-04 → 2025-04); a fresh session must never land outside it.
_DATA_RANGE_CACHE: dict[str, tuple[int, int]] = {}


def _data_range_1m(conn, symbol: str) -> tuple[int, int]:
    cached = _DATA_RANGE_CACHE.get(symbol)
    if cached is not None:
        return cached
    row = conn.execute(
        "SELECT MIN(time), MAX(time) FROM candles "
        "WHERE symbol = ? AND timeframe = '1m'",
        (symbol,),
    ).fetchone()
    if not row or row[0] is None:
        raise HTTPException(status_code=404, detail="No data for this symbol")
    rng = (int(row[0]), int(row[1]))
    _DATA_RANGE_CACHE[symbol] = rng
    return rng


def _pick_random_start(conn, symbol: str, timeframe: str) -> int:
    """
    Pick a random hidden start with bias toward recent data.

    Why bias: prices in 2010-2015 are very different from today (e.g. NQ at
    $2,000 vs $18,000+). Even though those are real periods, traders find them
    disorienting because the price levels look unfamiliar. We weight the
    distribution so ~70% of sessions land in the last 3 years and only ~10%
    pick anything older than 8 years.

    Future-supply bound: the picked T_0 must leave AT LEAST `MIN_FUTURE_1M`
    minutes of unrevealed 1m base data after it, so that /advance can keep
    revealing candles for a long session on any TF. Without this, the recency
    bias collapses the distribution to the last few days of data — fine for
    1m (thousands of presses) but exhausted in <10 presses on 1h/1D. The
    1m base is the source of truth for all TFs (resample_with_forming reads
    1m), so bounding the future in 1m units works for every TF.
    """
    cutoff = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())

    # Ensure ≥ MIN_FUTURE_1M 1m candles remain after T_0. 100_000 1m candles
    # in CME futures (~5,000 trading minutes/week) ≈ 20 weeks of replay data,
    # which gives:
    #   • 1m   : 100,000 presses
    #   • 5m   :  20,000 presses
    #   • 1h   :   1,666 presses
    #   • 4h   :     416 presses
    #   • 1D   :     ~100 presses
    #   • 1W   :     ~20 presses
    # Long enough for any realistic session on any TF. Computed in candle
    # COUNT (via OFFSET), not wall-clock seconds, so that sparse / gapped
    # data near the end of the table doesn't undercut the buffer.
    MIN_FUTURE_1M = 100_000

    # Latest pickable 1m candle = the one MIN_FUTURE_1M back from the end.
    future_cap_row = conn.execute(
        """
        SELECT time FROM candles
        WHERE symbol = ? AND timeframe = '1m'
        ORDER BY time DESC LIMIT 1 OFFSET ?
        """,
        (symbol, MIN_FUTURE_1M),
    ).fetchone()
    if not future_cap_row:
        raise HTTPException(status_code=404, detail="No data for this symbol")
    future_cap = future_cap_row[0]
    pick_ceiling = min(cutoff, future_cap)

    row = conn.execute(
        """
        SELECT min(time), max(time) FROM candles
        WHERE symbol = ? AND timeframe = ? AND time < ?
        """,
        (symbol, timeframe, pick_ceiling),
    ).fetchone()
    if not row or row[0] is None:
        raise HTTPException(status_code=404, detail="No data for this symbol/timeframe")

    min_t, max_t = row[0], row[1]

    # Per-symbol data-window clamp. ES and NQ intraday is sourced from a
    # fixed Databento range; cap picks strictly inside [data_min, data_max -
    # MIN_FUTURE_1M*60s] so a fresh session never lands outside that window.
    # MIN_FUTURE_1M is preserved as the count-based future buffer (in 1m bars),
    # converted to seconds here for the wall-clock max bound.
    if symbol in ("ES", "NQ"):
        data_min, data_max = _data_range_1m(conn, symbol)
        min_t = max(min_t, data_min)
        max_t = min(max_t, data_max - MIN_FUTURE_1M * 60)

    # Ensure at least 200 bars of history before start
    offset_row = conn.execute(
        """
        SELECT time FROM candles
        WHERE symbol = ? AND timeframe = ?
        ORDER BY time ASC LIMIT 1 OFFSET 200
        """,
        (symbol, timeframe),
    ).fetchone()
    if offset_row:
        min_t = max(min_t, offset_row[0])

    # Safety: if the dataset is so short that the history+future bounds
    # collapsed the pickable range, widen by ignoring the future cap (rather
    # than throwing) — small datasets just won't have a long future.
    if min_t > max_t:
        max_t = max(min_t, row[1])

    # Exponential weighting toward recent: pick uniform in [0, 1), apply
    # power < 1 to bias toward 1.0 (recent). Then map to [min_t, max_t].
    # power=0.3 → ~70% of picks fall in the most recent 30% of the timeline.
    #
    # Local-density guard: the picked timestamp is a UNIFORM-IN-TIME draw, so
    # in this dataset (CME futures with overnight + weekend gaps) ~72% of
    # naive picks land INSIDE a market-closed gap — fine for higher TFs whose
    # nominal step skips over the gap, but devastating on 1m where the first
    # /advance press then jumps several hours instead of 60 seconds.
    #
    # Fix: snap the picked T to an existing 1m candle ≤ T, then require the
    # IMMEDIATELY-following 1m candle to be within MAX_LOCAL_GAP_1M seconds.
    # That rejects positions inside overnight/weekend gaps while still
    # allowing the small intraday micro-gaps the synthetic data has. Retry
    # up to MAX_LOCAL_DENSITY_RETRIES times; if every attempt is sparse
    # (unlikely on any real symbol), accept the last candidate so we don't
    # bubble a 500 to the user — the per-press behavior degrades to "occasional
    # big jump on the first press" which matches pre-fix behavior.
    #
    # We snap/check on the 1m grid for ALL timeframes because GET ?timeframe=1m
    # can switch a 1D/1h session to 1m at any moment, and the same start
    # position must read well on 1m too. For higher TFs the snapped 1m
    # candle is still a valid moment-in-time for the position's hidden_start.
    # In this dataset the 1m gap distribution is sharply bimodal: ~99.8% of
    # consecutive-candle gaps are exactly 60s (continuous trading), and the
    # remaining ~0.2% are multi-hour overnight/weekend gaps. There is no
    # middle ground, so a tight threshold (120s) is both ample for the
    # continuous case and a sharp filter against the gap case.
    MAX_LOCAL_GAP_1M = 120            # rejects overnight/weekend, keeps continuous
    MAX_LOCAL_DENSITY_RETRIES = 25    # 25 tries × ~99.8% acceptance ≈ certain
    last_pick = min_t
    for _ in range(MAX_LOCAL_DENSITY_RETRIES):
        u = random.random()
        weighted = 1.0 - (u ** 3)  # cubed inverse — strong recency bias
        t_pick = int(min_t + weighted * (max_t - min_t))
        # Snap to the most-recent existing 1m candle ≤ t_pick. This makes
        # hidden_start a real candle time, so hidden_start + 60 lands on
        # the next minute boundary cleanly (not mid-gap).
        snap_row = conn.execute(
            """
            SELECT time FROM candles
            WHERE symbol = ? AND timeframe = '1m' AND time <= ?
            ORDER BY time DESC LIMIT 1
            """,
            (symbol, t_pick),
        ).fetchone()
        if not snap_row:
            continue
        snapped = snap_row[0]
        # Density check: the immediately-following 1m candle must be close.
        nxt_row = conn.execute(
            """
            SELECT time FROM candles
            WHERE symbol = ? AND timeframe = '1m' AND time > ?
            ORDER BY time ASC LIMIT 1
            """,
            (symbol, snapped),
        ).fetchone()
        last_pick = snapped
        if nxt_row and (nxt_row[0] - snapped) <= MAX_LOCAL_GAP_1M:
            return snapped
    return last_pick


def _snap_to_1800_et(conn, symbol: str, snapped_1m: int, max_days_back: int = 30) -> Optional[int]:
    """Walk backward from `snapped_1m` (unix-seconds) and return the most
    recent 1m candle time anchoring a futures Globex daily session open.
    Intent: the cursor lands at "18:00 ET" — i.e. the start of a daily
    trading session, which on CME futures begins around 18:00 ET (DST-aware
    via zoneinfo: 22 UTC EST / 23 UTC EDT).

    Dataset reality: NQ 1m candles in this DB are stored only between
    ~19:00–03:00 ET (the dataset lacks the 18:00–19:00 ET hour entirely in
    most eras, and the cash session 09:30–16:00 ET is also missing). The
    actual daily session-open in the data therefore falls at ~19:00 ET —
    the first 1m candle after the daily >30-min break. We snap to THAT
    candle: it's the truest "session open ~18:00 ET" available, and the
    cursor lands at a real candle time that `_resample_with_forming` can
    bucket cleanly across every TF.

    Density rule: the candle is verified as a continuous session-open by
    requiring its IMMEDIATELY-following 1m candle within MAX_LOCAL_GAP_1M —
    same check `_pick_random_start` uses. This rejects one-off candles
    bookending a sparse range.

    Cap: walk back at most `max_days_back` days. Return None if no
    acceptable session-open is found; the caller falls back to the
    unsnapped density-checked pick (never 500).
    """
    MAX_LOCAL_GAP_1M = 120
    GAP_BREAK_SECONDS = 30 * 60  # >30 min gap from previous candle = new session
    cutoff = snapped_1m - max_days_back * 86400

    # Pull all 1m candles in [cutoff, snapped_1m] ascending. The dataset's
    # density (~1 candle/min during session) means at most ~30d × ~8h × 60 ≈
    # 14k rows — small enough to scan in Python.
    rows = conn.execute(
        """
        SELECT time FROM candles
        WHERE symbol = ? AND timeframe = '1m' AND time BETWEEN ? AND ?
        ORDER BY time ASC
        """,
        (symbol, cutoff, snapped_1m),
    ).fetchall()
    if not rows:
        return None
    times = [int(r[0]) for r in rows]

    # Walk forward, find every index where a new session begins (gap > 30min
    # from prior candle, OR index 0). Keep the LATEST one whose forward
    # density passes.
    best = None
    for i in range(len(times)):
        if i > 0 and (times[i] - times[i - 1]) <= GAP_BREAK_SECONDS:
            continue
        t = times[i]
        # Forward-density check.
        if i + 1 < len(times):
            if (times[i + 1] - t) > MAX_LOCAL_GAP_1M:
                continue
        else:
            # Tail candle — query the table for its actual next neighbor.
            nxt_row = conn.execute(
                """
                SELECT time FROM candles
                WHERE symbol = ? AND timeframe = '1m' AND time > ?
                ORDER BY time ASC LIMIT 1
                """,
                (symbol, t),
            ).fetchone()
            if not nxt_row or (int(nxt_row[0]) - t) > MAX_LOCAL_GAP_1M:
                continue
        best = t  # latest acceptable session-open

    return best


TF_SECONDS = {
    "1m":   60,
    "5m":  300,
    "15m": 900,
    "30m": 1800,
    "1h":  3600,
    "4h":  14400,
    "1D":  86400,
    "1W":  604800,
}


def _wire_time(tf: str, t: int) -> int:
    """Snap a 1D/1W candle timestamp to UTC midnight on the wire.

    The DB stores CME-session-aligned timestamps for 1D and 1W candles,
    which drift across three end-of-day bands (~23:46, ~23:53, ~00:00 UTC).
    That drift makes ~18% of UTC calendar dates contain two 1D bars with
    different stored times. The hosted chart bundle keys daily bars by
    UTC calendar date, so two same-date pushes collapse to one (apparent
    "gaps") and a later same-date push overwrites the earlier one
    (apparent "candles disappearing after being scrolled past").

    The fix is wire-layer only: every endpoint that emits 1D/1W candles
    to the chart runs the bar's `time` through this helper, snapping
    it to the UTC midnight (00:00:00) of its calendar date so each
    calendar day carries one unique bar. Lower TFs (1m..4h) are
    untouched — their times already render unambiguously on the chart's
    intraday grid.

    Server-internal math (next-bucket lookups, _resample_with_forming
    bucket containment, bars_at_* counts, SL/TP walk windows) keeps
    operating on the raw r["time"] from the DB, so non-uniform CME
    spacing for ES/NQ/YM/GC at every TF still works correctly.
    """
    if tf in ("1D", "1W"):
        # int() guard: if a caller ever passes a float t (e.g. drifted
        # through a JSON round-trip), keep the wire payload's `time`
        # int-typed for the chart-host's contract.
        return int(t // 86400) * 86400
    return t


def _get_tf_step(timeframe: str) -> int:
    """Single source of truth for the nominal step at a given timeframe.
    Used by `_resample_with_forming` (to test bucket-containment) and `/advance`
    (to seed `new_current` when the table can't provide the real next-bucket
    boundary). For 1D/1W the REAL bucket spans aren't strict multiples of this —
    use `_next_bucket_after` to find the actual next bucket from the table.
    """
    return TF_SECONDS.get(timeframe, 86400)


def _next_bucket_after(conn, symbol: str, timeframe: str, from_time: int):
    """Return the candle table's NEXT bucket whose `time > from_time`, or None
    if we've run off the end. Table-driven — works regardless of CME-aligned
    1D/1W spacing, weekend gaps, etc. The shared boundary lookup that both
    `/advance` (for picking the next bucket to reveal) and the post-advance
    `new_current` calculation use, so the two stay in sync.
    """
    return conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time > ?
        ORDER BY time ASC LIMIT 1
        """,
        (symbol, timeframe, from_time),
    ).fetchone()


_IMPACT_RANK = {"high": 3, "medium": 2, "low": 1, "holiday": 0}


@app.get("/news")
def get_news(
    date: str = Query(..., description="Replay day, YYYY-MM-DD."),
    tz: str = Query(
        "America/New_York",
        description="IANA tz; defines the day boundary AND the time_local display.",
    ),
    currency: Optional[str] = Query(
        None,
        description="Comma-separated currency filter (e.g. 'USD' or 'USD,EUR'). Omit = all.",
    ),
    min_impact: Optional[str] = Query(
        None,
        description="'high'|'medium'|'low' — events ranked at or above. Omit = all.",
    ),
):
    """Economic-calendar events for one replay calendar day in `tz`. The
    day's UTC window is computed via zoneinfo so DST day-length is correct
    (e.g. the spring-forward day is 23h in America/New_York). Each row's
    `time_local` is the row's UTC time converted to `tz`. `time_known=false`
    rows carry placeholder times the source CSV never pinned down — the UI
    can render them as date-only when needed."""
    # ── Parse + validate inputs ──
    try:
        d = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"Bad date: {date!r}; expected YYYY-MM-DD")
    try:
        zone = ZoneInfo(tz)
    except Exception:
        raise HTTPException(400, f"Unknown tz: {tz!r}")

    # ── UTC window: [local_midnight(date), local_midnight(date+1)) ──
    local_start = datetime(d.year, d.month, d.day, tzinfo=zone)
    local_end   = local_start + timedelta(days=1)
    utc_start   = local_start.astimezone(timezone.utc)
    utc_end     = local_end.astimezone(timezone.utc)

    # ── Build SQL (datetime_utc is indexed) ──
    sql_parts = [
        "SELECT datetime_utc, currency, impact, title, actual, forecast, previous, time_known",
        "FROM economic_events",
        "WHERE datetime_utc >= ? AND datetime_utc < ?",
    ]
    args: list = [
        utc_start.strftime("%Y-%m-%d %H:%M:%S"),
        utc_end.strftime("%Y-%m-%d %H:%M:%S"),
    ]
    if currency:
        currencies = [c.strip().upper() for c in currency.split(",") if c.strip()]
        if currencies:
            sql_parts.append(
                "AND currency IN (" + ",".join("?" * len(currencies)) + ")"
            )
            args.extend(currencies)
    if min_impact:
        mi = min_impact.lower()
        if mi not in _IMPACT_RANK:
            raise HTTPException(
                400,
                f"Bad min_impact: {min_impact!r}; expected 'high'|'medium'|'low'",
            )
        threshold = _IMPACT_RANK[mi]
        allowed = [k for k, v in _IMPACT_RANK.items() if v >= threshold]
        sql_parts.append("AND impact IN (" + ",".join("?" * len(allowed)) + ")")
        args.extend(allowed)
    sql_parts.append("ORDER BY datetime_utc ASC")

    conn = get_conn()
    try:
        rows = conn.execute("\n".join(sql_parts), args).fetchall()
    finally:
        conn.close()

    events = []
    for r in rows:
        try:
            dt_utc = datetime.strptime(
                r["datetime_utc"], "%Y-%m-%d %H:%M:%S"
            ).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        dt_local = dt_utc.astimezone(zone)
        events.append(
            {
                "datetime_utc": dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "time_local":   dt_local.strftime("%H:%M"),
                "currency":     r["currency"],
                "impact":       r["impact"],
                "title":        r["title"],
                "actual":       r["actual"],
                "forecast":     r["forecast"],
                "previous":     r["previous"],
                "time_known":   bool(r["time_known"]),
            }
        )

    return {"date": date, "tz": tz, "events": events}


def _get_candles_up_to(conn, symbol: str, timeframe: str, up_to: int, limit: int):
    """Return up to `limit` most recent FULLY REVEALED candles in `timeframe`.
    A candle is fully revealed when its entire period ends at or before
    `up_to` (the session's current_time).

    The cutoff is precomputed (`up_to - s`) and used as `time <= ?` so SQLite
    can seek the (symbol, timeframe, time) index — putting `time + ?` in the
    WHERE forces a scan, which crushes 1m where the table is huge.
    """
    s = _get_tf_step(timeframe)
    cutoff = up_to - s
    rows = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time <= ?
        ORDER BY time DESC LIMIT ?
        """,
        (symbol, timeframe, cutoff, limit),
    ).fetchall()
    return list(reversed(rows))


def _resample_with_forming(conn, symbol: str, timeframe: str, current_time: int, limit: int):
    """Return up to `limit` candles in `timeframe` ending with a FORMING bucket
    whose close == the 1m base close at `current_time`. This makes the last
    candle's close identical across every TF — the single source of truth being
    the 1m base price at the replay cursor.

    Mechanics:
      * For tf=='1m', no forming bucket is needed; the base IS the data, so the
        candle whose time == current_time naturally has close == base[pos].close.
      * For higher TFs, pick the TF candle whose bucket contains `current_time`
        (its `time` ≤ current_time and `time + tf_seconds` > current_time). If
        such a bucket exists, REPLACE it with an aggregate over the 1m candles
        in [bucket_start, current_time]. Otherwise (no containing TF bucket
        because the dataset ended on a boundary), no forming bucket is added —
        the existing fully-closed candles already end at current_time.

    Note on bucket alignment: this DB's TF buckets are NOT aligned to
    `N * TF_SECONDS` (1D buckets start near CME session open, not UTC midnight).
    The bucket-start is derived from the existing TF candle's `time`, never
    computed as `(current_time // tf_seconds) * tf_seconds` — that would land
    off-grid and break the rebuild.
    """
    s = _get_tf_step(timeframe)
    # 1m base: no resample, just hand back rows up to current_time.
    if timeframe == "1m":
        rows = conn.execute(
            """
            SELECT time, open, high, low, close, volume
            FROM candles
            WHERE symbol = ? AND timeframe = '1m' AND time <= ?
            ORDER BY time DESC LIMIT ?
            """,
            (symbol, current_time, limit),
        ).fetchall()
        return list(reversed(rows))

    # Locate the TF bucket that CONTAINS current_time, if any.
    containing = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time <= ?
        ORDER BY time DESC LIMIT 1
        """,
        (symbol, timeframe, current_time),
    ).fetchone()

    forming = None
    if containing is not None and containing["time"] + s > current_time:
        # Rebuild the bucket from 1m candles in [bucket_start, current_time].
        bucket_start = containing["time"]
        m_rows = conn.execute(
            """
            SELECT open, high, low, close, volume
            FROM candles
            WHERE symbol = ? AND timeframe = '1m' AND time >= ? AND time <= ?
            ORDER BY time ASC
            """,
            (symbol, bucket_start, current_time),
        ).fetchall()
        if m_rows:
            forming = {
                "time": bucket_start,
                "open": m_rows[0]["open"],
                "high": max(r["high"] for r in m_rows),
                "low":  min(r["low"]  for r in m_rows),
                "close": m_rows[-1]["close"],
                "volume": sum((r["volume"] or 0) for r in m_rows),
            }
        else:
            # No 1m data inside this bucket — fall back to the pre-aggregated
            # row's own values (last close still won't equal base, but we'd
            # have nothing to rebuild with). This is a graceful degrade.
            forming = dict(containing)

    # Complete TF candles: bucket-end <= current_time (i.e. time + s <= current_time).
    # We want (limit - 1) complete + 1 forming if a forming bucket exists.
    complete_limit = (limit - 1) if forming is not None else limit
    cutoff = current_time - s
    complete = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time <= ?
        ORDER BY time DESC LIMIT ?
        """,
        (symbol, timeframe, cutoff, complete_limit),
    ).fetchall()
    out = [dict(r) for r in reversed(complete)]
    if forming is not None:
        out.append(forming)
    return out


# ─── Sessions ────────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    uid: str
    username: str
    symbol: str
    timeframe: str
    account_size: float
    # Optional override — if provided, the session's hidden_start is the bar
    # whose period contains this unix timestamp instead of a random pick.
    start_time: int | None = None
    # Optional replay end bound. When set, /advance returns the existing
    # end-of-data shape ({"candles": [], "done": True}) once the cursor
    # would step past this unix timestamp. Lets a user constrain a
    # "Pick dates" session to a specific window. NULL = open-ended,
    # matches today's behavior.
    end_time: int | None = None
    # When true, this session is auto-spawned by the chart-screen
    # watchlist picker so the chart can render a different symbol at
    # the same time as the user's primary session. Shadow sessions:
    #   - are hidden from /users/{uid}/sessions (Continue list)
    #   - are DELETED when the user exits the chart back to SessionsScreen
    # Default false → behaves like every existing user-initiated session.
    is_shadow: bool = False


class AdvanceRequest(BaseModel):
    count: int = 1


class TradeRequest(BaseModel):
    action: str                       # "open" | "close" | "update_stops"
    side: Optional[str] = None        # "buy" | "sell"
    lots: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    position_id: Optional[str] = None
    # Entry price the user saw on screen at the moment they hit CONFIRM.
    # Used to lock the recorded entry to the visual entry, avoiding any
    # last-bar/close-tick drift between what was shown and what gets stored.
    entry_price: Optional[float] = None


class TimeframeChangeRequest(BaseModel):
    timeframe: str


class SeekRequest(BaseModel):
    target_time: int   # unix seconds — backend snaps to the nearest valid bar


class SeekSessionRequest(BaseModel):
    """Fast-forward to the next wall-clock time matching `target_hh:target_mm`.
    Phase A defaults supplied by the RN dropdown: NY=09:30, London=03:00,
    Asia=20:00. Forward-only — backend always picks the NEXT occurrence
    strictly after the current cursor, then snaps to the first available bar
    at-or-after that instant (handles weekend/holiday gaps for free).

    Phase B: `tz` is an optional IANA timezone identifier. When omitted the
    handler falls back to `"America/New_York"` for backwards compat with the
    Phase A hardcoded ET behavior. The target HH:MM is interpreted in this
    timezone (DST-aware via zoneinfo), and the landing bar's wall-clock IN
    `tz` must literally equal target_hh:target_mm."""
    target_hh: int   # 0-23, wall-clock hour in `tz`
    target_mm: int   # 0-59
    tz: Optional[str] = None  # IANA tz id; defaults to "America/New_York"


@app.get("/sessions/{session_id}")
def get_session(session_id: str, timeframe: Optional[str] = Query(None)):
    """Resume endpoint — called on app reopen to restore session state without
    leaking real dates. Also the hot path for TF-aware getBars from the hosted
    chart: when ?timeframe= is passed, we resample around the session's
    current_time at THAT tf (deterministic per request) and persist it so
    /advance keeps revealing at the same TF. When omitted, we serve at the
    stored sess["timeframe"] (legacy / resume behavior)."""
    # TF-aware path: validate against the canonical set, then reuse the same
    # resample + persist the timeframe handler uses. This eliminates the race
    # where the hosted chart's getBars beats a separately-fired POST /timeframe.
    if timeframe is not None and timeframe not in TF_SECONDS:
        raise HTTPException(status_code=400, detail="Invalid timeframe")

    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    # Pick which TF to query at: the request's override or the session's stored TF.
    effective_tf = timeframe if timeframe is not None else sess["timeframe"]

    # TF-switch / stale-cursor guard. NQ/GC/ES/YM all have 1D data extending
    # ~13 months past the intraday-TF tail (2026-04-30 vs 2025-03-31 for the
    # intraday tail). If the user advanced a 1D session near its end and then
    # switches the chart down to a lower TF, an unclamped resample would
    # return the youngest 500 rows of the lower TF — landing in March 2025 —
    # which yanks the visible chart back ~13 months from where the session
    # cursor sits. Clamp the resample cursor for THIS request to the maximum
    # available time at the requested TF. We do NOT persist this clamp —
    # the session's stored current_time stays anchored at the original TF, so
    # switching back doesn't lose state.
    tf_max_row = conn.execute(
        "SELECT MAX(time) AS m FROM candles WHERE symbol=? AND timeframe=?",
        (sess["symbol"], effective_tf),
    ).fetchone()
    resample_ct = sess["current_time"]
    if tf_max_row and tf_max_row["m"] is not None and resample_ct > tf_max_row["m"]:
        resample_ct = tf_max_row["m"]

    # Reconstruct the bar-indexed candle history from hidden_start up to current_time.
    # Use the forming-bucket resampler so the LAST candle's close is the 1m base
    # close at current_time — identical across every TF (single source of truth).
    rows = _resample_with_forming(conn, sess["symbol"], effective_tf, resample_ct, 500)
    # Self-heal: pre-existing sessions stored current_time as bar.start under
    # the old convention. The new convention treats current_time as bar.end,
    # so the query returns nothing. Shift forward by tf_seconds and migrate.
    if not rows:
        s_heal = TF_SECONDS.get(sess["timeframe"], 86400)
        new_t = resample_ct + s_heal
        rows = _resample_with_forming(conn, sess["symbol"], effective_tf, new_t, 500)
        if rows:
            conn.execute(
                "UPDATE trading_sessions SET current_time = ? WHERE session_id = ?",
                (new_t, session_id),
            )
            conn.commit()
            sess = dict(sess); sess["current_time"] = new_t  # reflect for the rest of this request
            resample_ct = new_t

    # If a TF override was supplied and produced candles, persist it so subsequent
    # /advance reveals at the right TF. This collapses the old POST /timeframe
    # + GET dance into one race-free GET. Skip the write when the TF didn't change.
    if timeframe is not None and rows and timeframe != sess["timeframe"]:
        conn.execute(
            "UPDATE trading_sessions SET timeframe = ? WHERE session_id = ?",
            (timeframe, session_id),
        )
        conn.commit()
        sess = dict(sess); sess["timeframe"] = timeframe

    # Bar-index counts use `resample_ct` (the clamped cursor that was
    # actually fed to _resample_with_forming) — keeping bars_at_current
    # in lockstep with the revealed rows. If we used sess["current_time"]
    # while the resample saw the clamped value, bars_at_current would
    # overshoot and the bar-index math would slide.
    bars_at_start = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], effective_tf, sess["hidden_start"]),
    ).fetchone()[0]
    bars_at_current = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], effective_tf, resample_ct),
    ).fetchone()[0]
    conn.close()

    # bar index offset: bars revealed since hidden_start (the initial 200-bar window ends at bar 199)
    bar_offset = bars_at_current - bars_at_start
    first_bar = 199 - (len(rows) - 1 - bar_offset) if len(rows) > bar_offset else 0

    candles = [
        {"bar": first_bar + i, "time": _wire_time(effective_tf, r["time"]),
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {
        "session_id": session_id,
        "symbol": sess["symbol"],
        "timeframe": effective_tf,
        # current_time is the session's authoritative replay cursor in
        # unix seconds. Surfaced so the chart-screen can time-sync
        # shadow sessions (other markets viewed via the watchlist) to
        # the user's primary cursor when they switch symbols.
        "current_time": sess["current_time"],
        "account_size": sess["account_size"],
        "balance": sess["balance"],
        "status": sess["status"],
        "open_positions": json.loads(sess["open_positions"]),
        "closed_trades": json.loads(sess["closed_trades"]),
        "candles": candles,
        "current_bar": candles[-1]["bar"] if candles else 0,
    }


@app.post("/sessions/{session_id}/seek")
def seek_session(session_id: str, req: SeekRequest):
    """
    Jump current_time to the most recent bar at-or-before target_time.
    Used by the session-jump UI (Asia / London / NY / Custom). Same TF, same
    symbol, just teleports the replay cursor.

    Note: any positions opened "after" the new current_time will technically
    sit in the future — the user is responsible for not seeking backward
    while holding open trades.
    """
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    s = TF_SECONDS.get(sess["timeframe"], 86400)
    # Snap to the latest bar whose period ends ≤ target_time (same convention
    # as _get_candles_up_to). target_time may be in the past relative to
    # current_time — that's fine, we just pick the appropriate bar.
    rows = _get_candles_up_to(conn, sess["symbol"], sess["timeframe"], req.target_time, 200)
    if not rows:
        conn.close()
        raise HTTPException(status_code=404, detail="No data near target time")
    new_current = rows[-1]["time"] + s
    conn.execute(
        "UPDATE trading_sessions SET current_time = ? WHERE session_id = ?",
        (new_current, session_id),
    )
    conn.commit()
    conn.close()
    candles = [
        {"bar": i, "time": _wire_time(sess["timeframe"], r["time"]),
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {
        "session_id": session_id,
        "symbol": sess["symbol"],
        "timeframe": sess["timeframe"],
        "candles": candles,
        "current_bar": len(candles) - 1,
    }


@app.post("/sessions/{session_id}/seek_session")
def seek_session_open(session_id: str, req: SeekSessionRequest):
    """Phase 3C: fast-forward the replay cursor to the next ET wall-clock
    instant matching `target_hh:target_mm` (NY/London/Asia session opens).

    Forward-only — if today's target has already passed at the current cursor
    we advance to the same time on the next day. DST is handled correctly via
    `zoneinfo.ZoneInfo('America/New_York')`. The landing bar's ET wall-clock
    MUST literally equal target_hh:target_mm — we search 1m candles day-by-day
    forward (up to 30 days), verify the bar's HH:MM after each hit, and skip
    days where the target minute has no data. If no matching bar exists within
    30 days we soft-fail with `success: false, reason: ...` — never silently
    land at a different wall-clock (the bug that made NY 09:30 jumps roll to
    19:53 reopen bars when the dataset has no 09:30 ET data).

    Critical: we walk every bar between the OLD and NEW cursor through the
    same TP/SL auto-close pipeline as `/advance`, so a multi-day jump can't
    silently skip past a position's stop or target. Response mirrors
    /advance's `auto_closed` shape for the RN handler to reuse.

    The RN side refreshes the chart via Path B (`resetData()`), which triggers
    a fresh GET /sessions/{id}?timeframe= at the new cursor — no per-bar
    pushBar walk, scales to multi-day jumps cleanly.
    """
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["status"] != "active":
        conn.close()
        raise HTTPException(status_code=400, detail="Session ended")

    if not (0 <= req.target_hh <= 23) or not (0 <= req.target_mm <= 59):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid target time")

    # Phase B: per-request timezone. Falls back to America/New_York for
    # backwards compat with the Phase A hardcoded ET behavior. Note the
    # module-level `ET` constant stays — other functions (e.g. `_snap_to_1800_et`)
    # use it for SYSTEM session-start anchoring, which is not user-configurable.
    try:
        user_tz = ZoneInfo(req.tz) if req.tz else ZoneInfo("America/New_York")
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid timezone: {req.tz!r}")

    old_current = sess["current_time"]
    s = _get_tf_step(sess["timeframe"])

    # Search at 1m precision (the dataset's base granularity) regardless of the
    # session's stored TF — this is the only way to guarantee the landing bar
    # ACTUALLY reads target_hh:target_mm ET. The session can still be on 5m/1h/
    # etc.; the cursor moves at 1m precision and `_resample_with_forming` handles
    # per-TF rendering of the forming bucket that contains the landing minute.
    BASE_TF = "1m"
    TOLERANCE_SEC = 60       # strict: bar must START at target HH:MM (one 1m bucket)
    MAX_DAYS_FORWARD = 30    # cap the day-by-day forward search

    # Day-by-day forward loop. For each candidate day we compute the wall-clock
    # at target_hh:target_mm in `user_tz` (DST-aware via zoneinfo), then look
    # for a 1m bar whose `time` falls inside [candidate_unix, candidate_unix + 60).
    # If found, we VERIFY the bar's HH:MM in `user_tz` literally equals the
    # target — that closes the loophole where the old algorithm silently
    # returned the next bar after a data gap (e.g. asked for 09:30 ET, landed
    # at 19:53 ET because 09:30 has no data in this dataset).
    cur_et = datetime.fromtimestamp(old_current, tz=user_tz)
    row = None
    for day_offset in range(MAX_DAYS_FORWARD):
        candidate = cur_et.replace(
            hour=req.target_hh, minute=req.target_mm, second=0, microsecond=0
        ) + timedelta(days=day_offset)
        if candidate <= cur_et:
            # Only day_offset == 0 can be at-or-before cursor — skip past today
            # so the jump is always forward-only.
            continue
        candidate_unix = int(candidate.timestamp())
        candidate_row = conn.execute(
            """
            SELECT time, open, high, low, close, volume
            FROM candles
            WHERE symbol = ? AND timeframe = ? AND time >= ? AND time < ?
            ORDER BY time ASC LIMIT 1
            """,
            (sess["symbol"], BASE_TF, candidate_unix, candidate_unix + TOLERANCE_SEC),
        ).fetchone()
        if candidate_row is not None:
            bar_et = datetime.fromtimestamp(candidate_row["time"], tz=user_tz)
            if bar_et.hour == req.target_hh and bar_et.minute == req.target_mm:
                row = candidate_row
                break
        # else: this day's HH:MM has no 1m bar — try next day.

    if row is None:
        conn.close()
        tz_label = req.tz if req.tz else "America/New_York"
        return {
            "success": False,
            "reason": f"no {req.target_hh:02d}:{req.target_mm:02d} {tz_label} bar found within {MAX_DAYS_FORWARD} days",
        }

    # End-of-1m-bucket: cursor sits at the moment AFTER the target minute is
    # fully revealed. `_resample_with_forming` handles per-TF rendering at any
    # higher TF (the forming bucket containing this minute will be drawn).
    new_current = row["time"] + 60

    if new_current <= old_current:
        # Snap landed on or before the existing cursor — nothing to reveal.
        # Treat as a no-op rather than rewinding the replay.
        conn.close()
        return {
            "success": False,
            "reason": "target already revealed",
        }

    # Auto-close walk between old and new current_time. Same query shape /advance
    # uses: `time > old_ct - s_nominal` catches a straddling bucket that just
    # completed; `time <= row["time"]` is the table-driven upper bound (the
    # target bar's start time).
    walk_rows = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time > ? AND time <= ?
        ORDER BY time ASC
        """,
        (sess["symbol"], sess["timeframe"], old_current - s, row["time"]),
    ).fetchall()

    positions = json.loads(sess["open_positions"])
    closed_trades = json.loads(sess["closed_trades"])
    balance = sess["balance"]
    spec = CONTRACT_SPECS.get(sess["symbol"], {"pip": 1, "contractSize": 1})
    closed_now = []
    for pos in positions[:]:
        for r in walk_rows:
            hit_sl = hit_tp = False
            if pos["side"] == "buy":
                if pos.get("stop_loss") and r["low"] <= pos["stop_loss"]:
                    hit_sl = True
                elif pos.get("take_profit") and r["high"] >= pos["take_profit"]:
                    hit_tp = True
            else:
                if pos.get("stop_loss") and r["high"] >= pos["stop_loss"]:
                    hit_sl = True
                elif pos.get("take_profit") and r["low"] <= pos["take_profit"]:
                    hit_tp = True
            if hit_sl or hit_tp:
                exit_price = pos["stop_loss"] if hit_sl else pos["take_profit"]
                direction = 1 if pos["side"] == "buy" else -1
                pips = (exit_price - pos["entry_price"]) / spec["pip"] * direction
                pnl = pips * spec["pip"] * spec["contractSize"] * pos["lots"]
                r_multiple = None
                if pos.get("stop_loss"):
                    risk_pips = abs(pos["entry_price"] - pos["stop_loss"]) / spec["pip"]
                    if risk_pips > 0:
                        r_multiple = round(pips / risk_pips, 2)

                trade = {
                    "id": str(uuid.uuid4()),
                    "position_id": pos["id"],
                    "session_id": session_id,
                    "uid": sess["uid"],
                    "symbol": sess["symbol"],
                    "side": pos["side"],
                    "lots": pos["lots"],
                    "entry_price": pos["entry_price"],
                    "exit_price": exit_price,
                    "stop_loss": pos.get("stop_loss"),
                    "take_profit": pos.get("take_profit"),
                    "opened_at": pos["opened_at"],
                    "closed_at": r["time"],
                    "pnl": round(pnl, 2),
                    "pips": round(pips, 1),
                    "r_multiple": r_multiple,
                    "hit": "sl" if hit_sl else "tp",
                    "news_snapshot": "[]",
                }
                balance += pnl
                closed_trades.append(trade)
                closed_now.append(trade)
                positions.remove(pos)

                conn.execute(
                    """
                    INSERT INTO trades
                      (id, uid, session_id, symbol, side, lots, entry_price, exit_price,
                       stop_loss, take_profit, opened_at, closed_at, pnl, pips, r_multiple, news_snapshot)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (trade["id"], sess["uid"], session_id, trade["symbol"], trade["side"],
                     trade["lots"], trade["entry_price"], trade["exit_price"],
                     trade.get("stop_loss"), trade.get("take_profit"),
                     trade["opened_at"], trade["closed_at"],
                     trade["pnl"], trade["pips"], trade.get("r_multiple"), "[]"),
                )
                break

    # Count bars revealed across the jump (diagnostics only; the RN path uses
    # resetData() so it doesn't depend on this number).
    bars_revealed = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time > ? AND time <= ?",
        (sess["symbol"], sess["timeframe"], old_current, row["time"]),
    ).fetchone()[0]

    conn.execute(
        "UPDATE trading_sessions SET current_time = ?, open_positions = ?, closed_trades = ?, balance = ? WHERE session_id = ?",
        (new_current, json.dumps(positions), json.dumps(closed_trades), balance, session_id),
    )
    if closed_now:
        _update_account_stats(conn, sess["uid"])
    conn.commit()
    conn.close()

    return {
        "success": True,
        "new_current_time": new_current,
        "target_bar_time": row["time"],
        "bars_revealed": bars_revealed,
        "auto_closed": closed_now,
    }


@app.post("/sessions/{session_id}/timeframe")
def change_session_timeframe(session_id: str, req: TimeframeChangeRequest):
    """
    Switch a session's timeframe WITHOUT picking a new random period.
    Re-fetches candles around the same hidden_start timestamp.
    """
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    # Use the session's CURRENT_TIME (not hidden_start) so all the bars the
    # user has already revealed on other timeframes are reflected on this one.
    # And keep current_time as-is — don't floor to the new TF's grid; otherwise
    # advancing on a higher TF and switching to a lower one would lose progress.
    # Forming-bucket resampler keeps the last close in sync with the GET path.
    rows = _resample_with_forming(conn, sess["symbol"], req.timeframe, sess["current_time"], 200)
    # Self-heal stored current_time → end-of-bar convention if needed.
    if not rows:
        s_heal_old = TF_SECONDS.get(sess["timeframe"], 86400)
        new_t = sess["current_time"] + s_heal_old
        rows = _resample_with_forming(conn, sess["symbol"], req.timeframe, new_t, 200)
        if rows:
            conn.execute(
                "UPDATE trading_sessions SET current_time = ? WHERE session_id = ?",
                (new_t, session_id),
            )
            sess = dict(sess); sess["current_time"] = new_t
    if not rows:
        conn.close()
        raise HTTPException(status_code=404, detail="No data for this symbol/timeframe")

    conn.execute(
        "UPDATE trading_sessions SET timeframe = ? WHERE session_id = ?",
        (req.timeframe, session_id),
    )
    conn.commit()
    conn.close()

    candles = [
        {"bar": i, "time": _wire_time(req.timeframe, r["time"]),
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {
        "session_id": session_id,
        "symbol": sess["symbol"],
        "timeframe": req.timeframe,
        "candles": candles,
        "current_bar": len(candles) - 1,
    }


@app.post("/sessions/start")
def start_session(req: StartSessionRequest):
    conn = get_conn()
    s_init = TF_SECONDS.get(req.timeframe, 86400)
    if req.start_time is not None:
        # Snap to the latest bar whose start time is <= start_time on this TF.
        snap = conn.execute(
            "SELECT MAX(time) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
            (req.symbol, req.timeframe, req.start_time),
        ).fetchone()
        hidden_start = snap[0] if snap and snap[0] is not None else _pick_random_start(conn, req.symbol, req.timeframe)
    else:
        hidden_start = _pick_random_start(conn, req.symbol, req.timeframe)

    # Snap session start to the futures Globex daily session open (~18:00
    # ET). We walk back from the density-checked pick to the most recent 1m
    # candle that opens a daily session (see `_snap_to_1800_et` for the
    # dataset-specific definition — strict 18:00:00 doesn't exist in this
    # DB) and set BOTH hidden_start AND current_time to it. The cursor then
    # sits at the session open regardless of TF. The per-TF `+ s` offset
    # below is bypassed for the snap path because `_resample_with_forming`
    # already handles the per-TF "bucket containing current_time" lookup,
    # so the cursor needs no granularity adjustment.
    #
    # When `start_time` was explicitly supplied the caller wanted a specific
    # moment — don't override that. Otherwise (typical fresh-session path)
    # snap if a candidate exists; on miss, fall through to the original
    # +s offset behavior (never 500).
    s = TF_SECONDS.get(req.timeframe, 86400)
    snapped_to_1800 = False
    if req.start_time is None:
        target_1800 = _snap_to_1800_et(conn, req.symbol, hidden_start)
        if target_1800 is not None:
            hidden_start = target_1800
            initial_current_time = target_1800
            snapped_to_1800 = True

    if not snapped_to_1800:
        # current_time = the END of the last revealed bar's period. With this
        # convention a bar is "fully revealed" iff time + tf_seconds <= current_time,
        # which lets every timeframe stay in sync no matter which one the user
        # advances on.
        initial_current_time = hidden_start + s

    rows = _get_candles_up_to(conn, req.symbol, req.timeframe, hidden_start + s_init, 200)
    if not rows:
        conn.close()
        raise HTTPException(status_code=404, detail="No candle data found")

    session_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO trading_sessions
          (session_id, uid, symbol, timeframe, account_size, balance, hidden_start, current_time, end_time, is_shadow)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (session_id, req.uid, req.symbol, req.timeframe,
         req.account_size, req.account_size, hidden_start, initial_current_time, req.end_time,
         1 if req.is_shadow else 0),
    )
    conn.commit()
    conn.close()

    # Strip real timestamps — send bar index only
    candles = [
        {"bar": i, "time": _wire_time(req.timeframe, r["time"]),
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {
        "session_id": session_id,
        "symbol": req.symbol,
        "timeframe": req.timeframe,
        "account_size": req.account_size,
        "balance": req.account_size,
        "candles": candles,
        "current_bar": len(candles) - 1,
    }


@app.post("/sessions/{session_id}/advance")
def advance_session(session_id: str, req: AdvanceRequest):
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["status"] != "active":
        conn.close()
        raise HTTPException(status_code=400, detail="Session ended")

    s = _get_tf_step(sess["timeframe"])
    # Reveal the next `count` COMPLETE buckets at this TF, where "next" means
    # the buckets whose `time >= current_time`. The chart's hosted `pushBar`
    # ignores the bar's real time and uses a synthetic contiguous index, so
    # every returned bucket appends as a new visible bar regardless of any
    # overlap with GET's forming bucket at the boundary case.
    #
    # `time >= current_time` rather than `time > current_time` is required
    # so the bucket whose start sits AT the cursor (e.g. fresh session with
    # ct = hidden_start + s landing on a TF boundary) gets revealed on the
    # first press. `_resample_with_forming` paints that same bucket as the
    # FORMING bar in GET, which is fine — pushBar appends synthetically and
    # the next GET correctly shows the post-advance forming bar based on
    # the updated `current_time`.
    rows = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time >= ?
        ORDER BY time ASC LIMIT ?
        """,
        (sess["symbol"], sess["timeframe"], sess["current_time"], req.count),
    ).fetchall()

    if not rows:
        conn.close()
        return {"candles": [], "done": True}

    # User-defined replay end bound. When `sess["end_time"]` is set, any
    # candle whose start time is strictly past end_time is dropped from
    # the reveal, and we flag `done` so the chart disables Next Bar. The
    # filter uses `time > end_time` (not >=) so a candle landing exactly
    # at the bound is still revealed. If filtering empties the list, fall
    # through the existing "no rows → done" branch. This matches the
    # soft-fail shape every existing caller already handles.
    end_time_bound = sess["end_time"]
    end_time_hit = False
    if end_time_bound is not None:
        kept = [r for r in rows if r["time"] <= end_time_bound]
        if len(kept) < len(rows):
            end_time_hit = True
        rows = kept
        if not rows:
            conn.close()
            return {"candles": [], "done": True}

    # Table-driven `new_current` is THE fix for non-uniform 1D/1W buckets.
    # 1D buckets are CME-aligned and don't span exactly N*86400 (typical
    # diffs are 86000–87000, weekend gaps are ~259000). Computing
    # `new_current = last.time + s_nominal` would overshoot the next
    # bucket's actual start whenever the real span < s_nominal, so the
    # subsequent advance's `WHERE time >= new_current` would skip the
    # bucket(s) in between. Looking up the next bucket from the candles
    # table — the SAME table-driven boundary lookup `_resample_with_forming`
    # uses to find its containing bucket — keeps both endpoints aligned.
    # For uniform-step TFs (1m..4h) `next_following.time == last.time + s`
    # so this preserves the original behavior. When we've run off the end
    # of the data (no next bucket), fall back to `last.time + s_nominal`.
    next_following = _next_bucket_after(conn, sess["symbol"], sess["timeframe"], rows[-1]["time"])
    # When _next_bucket_after returns None, the row we just revealed IS
    # the table tail — there are no more bars for this (symbol, timeframe).
    # Set done=True on THIS press so the session terminates atomically with
    # the final reveal, instead of requiring a second press to flip done.
    # Without this, the chart sees `{candles: [last_bar], done: False}` and
    # the user has to click Next Bar once more to get `{candles: [], done: True}`.
    eod = next_following is None
    new_current = next_following["time"] if next_following is not None else rows[-1]["time"] + s

    # Count bars revealed so far. With the end-of-period convention, the last
    # revealed bar's time IS rows[-1].time. Use it directly as the upper bound
    # (table-driven, no `- s` arithmetic which over-counts for 1D/1W where the
    # nominal step exceeds the real bucket span).
    bars_at_start = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], sess["timeframe"], sess["hidden_start"]),
    ).fetchone()[0]
    bars_at_new_current = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], sess["timeframe"], rows[-1]["time"]),
    ).fetchone()[0]

    conn.execute(
        "UPDATE trading_sessions SET current_time = ? WHERE session_id = ?",
        (new_current, session_id),
    )

    # Check SL/TP hits for all open positions on each newly-traversed bar.
    # The H/L walk uses a SUPERSET of `rows`: it also includes any straddling
    # bucket that was forming at old current_time and just became complete
    # during this advance (its full H/L period traversed inside this step).
    # Without this, a TP/SL inside the straddling bucket's full range would
    # be missed on the first advance after a TF switch. The response
    # `candles` array stays as `rows` (just the NEW buckets) so the chart
    # appends exactly `count` new bars via pushBar.
    #
    # Walk range: `time > old_ct - s_nominal` catches a possible straddling
    # bucket whose start is within `s` of the old cursor; `time <= rows[-1].time`
    # is the table-driven upper bound (matches `bars_at_new_current`).
    walk_rows = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time > ? AND time <= ?
        ORDER BY time ASC
        """,
        (sess["symbol"], sess["timeframe"], sess["current_time"] - s, rows[-1]["time"]),
    ).fetchall()

    positions = json.loads(sess["open_positions"])
    closed_trades = json.loads(sess["closed_trades"])
    balance = sess["balance"]
    spec = CONTRACT_SPECS.get(sess["symbol"], {"pip": 1, "contractSize": 1})
    closed_now = []
    for pos in positions[:]:
        for r in walk_rows:
            hit_sl = hit_tp = False
            if pos["side"] == "buy":
                if pos.get("stop_loss") and r["low"] <= pos["stop_loss"]:
                    hit_sl = True
                elif pos.get("take_profit") and r["high"] >= pos["take_profit"]:
                    hit_tp = True
            else:
                if pos.get("stop_loss") and r["high"] >= pos["stop_loss"]:
                    hit_sl = True
                elif pos.get("take_profit") and r["low"] <= pos["take_profit"]:
                    hit_tp = True
            if hit_sl or hit_tp:
                exit_price = pos["stop_loss"] if hit_sl else pos["take_profit"]
                direction = 1 if pos["side"] == "buy" else -1
                pips = (exit_price - pos["entry_price"]) / spec["pip"] * direction
                pnl = pips * spec["pip"] * spec["contractSize"] * pos["lots"]
                r_multiple = None
                if pos.get("stop_loss"):
                    risk_pips = abs(pos["entry_price"] - pos["stop_loss"]) / spec["pip"]
                    if risk_pips > 0:
                        r_multiple = round(pips / risk_pips, 2)

                trade = {
                    "id": str(uuid.uuid4()),
                    "position_id": pos["id"],
                    "session_id": session_id,
                    "uid": sess["uid"],
                    "symbol": sess["symbol"],
                    "side": pos["side"],
                    "lots": pos["lots"],
                    "entry_price": pos["entry_price"],
                    "exit_price": exit_price,
                    "stop_loss": pos.get("stop_loss"),
                    "take_profit": pos.get("take_profit"),
                    "opened_at": pos["opened_at"],
                    "closed_at": r["time"],
                    "pnl": round(pnl, 2),
                    "pips": round(pips, 1),
                    "r_multiple": r_multiple,
                    "hit": "sl" if hit_sl else "tp",
                    "news_snapshot": "[]",
                }
                balance += pnl
                closed_trades.append(trade)
                closed_now.append(trade)
                positions.remove(pos)

                conn.execute(
                    """
                    INSERT INTO trades
                      (id, uid, session_id, symbol, side, lots, entry_price, exit_price,
                       stop_loss, take_profit, opened_at, closed_at, pnl, pips, r_multiple, news_snapshot)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (trade["id"], sess["uid"], session_id, trade["symbol"], trade["side"],
                     trade["lots"], trade["entry_price"], trade["exit_price"],
                     trade.get("stop_loss"), trade.get("take_profit"),
                     trade["opened_at"], trade["closed_at"],
                     trade["pnl"], trade["pips"], trade.get("r_multiple"), "[]"),
                )
                break

    conn.execute(
        """
        UPDATE trading_sessions
        SET open_positions = ?, closed_trades = ?, balance = ?
        WHERE session_id = ?
        """,
        (json.dumps(positions), json.dumps(closed_trades), balance, session_id),
    )
    if closed_now:
        _update_account_stats(conn, sess["uid"])
    conn.commit()
    conn.close()

    # Bar indices start at 199 (the last bar of the initial 200-bar load).
    # bars_at_new_current - bars_at_start gives offset from hidden_start.
    # Offset 0 = bar 199 (the initial last bar). Offset 1 = bar 200, etc.
    base_bar = (bars_at_new_current - bars_at_start) + 199 - (len(rows) - 1)

    candles = [
        {"bar": base_bar + i, "time": _wire_time(sess["timeframe"], r["time"]),
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {"candles": candles, "done": end_time_hit or eod, "auto_closed": closed_now}


@app.post("/sessions/{session_id}/trade")
def place_trade(session_id: str, req: TradeRequest):
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["status"] != "active":
        conn.close()
        raise HTTPException(status_code=400, detail="Session ended")

    positions = json.loads(sess["open_positions"])
    closed_trades = json.loads(sess["closed_trades"])
    balance = sess["balance"]
    spec = CONTRACT_SPECS.get(sess["symbol"], {"pip": 1, "contractSize": 1})

    # Get current price
    cur_row = conn.execute(
        """
        SELECT close FROM candles
        WHERE symbol = ? AND timeframe = ? AND time <= ?
        ORDER BY time DESC LIMIT 1
        """,
        (sess["symbol"], sess["timeframe"], sess["current_time"]),
    ).fetchone()
    if not cur_row:
        conn.close()
        raise HTTPException(status_code=400, detail="No price data available")
    current_price = cur_row["close"]

    if req.action == "open":
        if not req.side or not req.lots:
            conn.close()
            raise HTTPException(status_code=400, detail="side and lots required")
        # Prefer the price the user confirmed on the chart. Fall back to
        # current_price only if the client didn't send one.
        recorded_entry = req.entry_price if req.entry_price is not None else current_price
        pos = {
            "id": str(uuid.uuid4()),
            "side": req.side,
            "lots": req.lots,
            "entry_price": recorded_entry,
            "stop_loss": req.stop_loss,
            "take_profit": req.take_profit,
            "opened_at": sess["current_time"],
        }
        positions.append(pos)
        conn.execute(
            "UPDATE trading_sessions SET open_positions = ? WHERE session_id = ?",
            (json.dumps(positions), session_id),
        )
        conn.commit()
        conn.close()
        return {"position": pos}

    elif req.action == "close":
        pos = next((p for p in positions if p["id"] == req.position_id), None)
        if not pos:
            conn.close()
            raise HTTPException(status_code=404, detail="Position not found")

        direction = 1 if pos["side"] == "buy" else -1
        pips = (current_price - pos["entry_price"]) / spec["pip"] * direction
        pnl = pips * spec["pip"] * spec["contractSize"] * pos["lots"]
        r_multiple = None
        if pos.get("stop_loss"):
            risk_pips = abs(pos["entry_price"] - pos["stop_loss"]) / spec["pip"]
            if risk_pips > 0:
                r_multiple = round(pips / risk_pips, 2)

        trade = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "uid": sess["uid"],
            "symbol": sess["symbol"],
            "side": pos["side"],
            "lots": pos["lots"],
            "entry_price": pos["entry_price"],
            "exit_price": current_price,
            "stop_loss": pos.get("stop_loss"),
            "take_profit": pos.get("take_profit"),
            "opened_at": pos["opened_at"],
            "closed_at": sess["current_time"],
            "pnl": round(pnl, 2),
            "pips": round(pips, 1),
            "r_multiple": r_multiple,
            "news_snapshot": "[]",
        }
        balance += pnl
        positions = [p for p in positions if p["id"] != req.position_id]
        closed_trades.append(trade)

        conn.execute(
            """
            UPDATE trading_sessions
            SET open_positions = ?, closed_trades = ?, balance = ?
            WHERE session_id = ?
            """,
            (json.dumps(positions), json.dumps(closed_trades), balance, session_id),
        )
        conn.execute(
            """
            INSERT INTO trades
              (id, uid, session_id, symbol, side, lots, entry_price, exit_price,
               stop_loss, take_profit, opened_at, closed_at, pnl, pips, r_multiple, news_snapshot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (trade["id"], sess["uid"], session_id, trade["symbol"], trade["side"],
             trade["lots"], trade["entry_price"], trade["exit_price"],
             trade.get("stop_loss"), trade.get("take_profit"),
             trade["opened_at"], trade["closed_at"],
             trade["pnl"], trade["pips"], trade.get("r_multiple"), "[]"),
        )
        # Rank recalculates after every closed trade
        _update_account_stats(conn, sess["uid"])
        conn.commit()
        conn.close()
        return {"trade": trade, "balance": round(balance, 2)}

    elif req.action == "update_stops":
        # Adjust SL/TP on an already-open position (drag-to-adjust from the
        # chart's TP/SL lines). Mutates the position in the open_positions
        # JSON blob and persists. Only the stop(s) explicitly present in the
        # request body are changed — a field omitted from the request is left
        # untouched (so moving just the SL doesn't wipe the TP). pydantic's
        # `model_fields_set` is the set of fields the client actually sent.
        if not req.position_id:
            conn.close()
            raise HTTPException(status_code=400, detail="position_id required")
        pos = next((p for p in positions if p["id"] == req.position_id), None)
        if not pos:
            conn.close()
            raise HTTPException(status_code=404, detail="Position not found")

        sent = req.model_fields_set
        if "stop_loss" in sent:
            pos["stop_loss"] = req.stop_loss
        if "take_profit" in sent:
            pos["take_profit"] = req.take_profit

        conn.execute(
            "UPDATE trading_sessions SET open_positions = ? WHERE session_id = ?",
            (json.dumps(positions), session_id),
        )
        conn.commit()
        conn.close()
        return {"position": pos}

    conn.close()
    raise HTTPException(status_code=400, detail="action must be 'open', 'close', or 'update_stops'")


XP_BASE = 50


# ─── Rank ladder (Phase 4: divisions removed) ────────────────────────────────
# 6 levels = 6 ranks, no divisions. Each rank has a single XP threshold
# (Paper, Unprofitable, Disciplined, Consistent, Profitable, Funded).
# `_rank_from_xp(xp)` maps a user's total XP → level entry; `/ranks` returns
# the whole ladder (drives the frontend Journey screen). `accounts.rank`
# (TEXT column) stores the level_name (e.g. "Disciplined"); the API
# responses additionally surface a `rank` object (nested) alongside the
# legacy `rank` string field — see `_account_rank_obj` callsites below.

RANK_LADDER = [
    # (level_index, tier, division, level_name, threshold)
    # Phase 4: divisions collapsed — one threshold per rank, level_name
    # == tier (no Roman numerals). `division` is None for every rank.
    # Thresholds carry forward from the prior tier-I entry of each rank.
    (1, "Paper",        None, "Paper",        0),
    (2, "Unprofitable", None, "Unprofitable", 800),
    (3, "Disciplined",  None, "Disciplined",  3200),
    (4, "Consistent",   None, "Consistent",   7500),
    (5, "Profitable",   None, "Profitable",   14500),
    (6, "Funded",       None, "Funded",       25000),
]

TIER_EMBLEM_KEYS = {
    "Paper":        "paper",
    "Unprofitable": "unprofitable",
    "Disciplined":  "disciplined",
    "Consistent":   "consistent",
    "Profitable":   "profitable",
    "Funded":       "funded",
}


def _rank_from_xp(xp: int) -> dict:
    """Return the rank object for a user with `xp` total XP.
    Spec:
      - level = highest ladder entry whose threshold <= xp
      - division is None at Elite
      - is_max true at Elite (top)
      - xp_into_level = xp - current threshold
      - xp_for_next = next threshold - xp (0 when is_max)
    """
    current = RANK_LADDER[0]
    for entry in RANK_LADDER:
        if entry[4] <= xp:
            current = entry
        else:
            break
    level_index, tier, division, level_name, threshold = current
    is_max = level_index == RANK_LADDER[-1][0]
    if is_max:
        next_level_name = None
        xp_for_next = 0
    else:
        next_entry = RANK_LADDER[level_index]  # next is 0-based, equal to level_index
        next_level_name = next_entry[3]
        xp_for_next = next_entry[4] - xp
    return {
        "xp": xp,
        "tier": tier,
        "division": division,
        "level_index": level_index,
        "level_name": level_name,
        "xp_into_level": xp - threshold,
        "next_level_name": next_level_name,
        "xp_for_next": xp_for_next,
        "is_max": is_max,
        "emblem_key": TIER_EMBLEM_KEYS[tier],
    }


@app.get("/ranks")
def get_ranks():
    """Full rank ladder — drives the frontend Journey screen."""
    return {
        "ladder": [
            {
                "level_index": e[0],
                "tier": e[1],
                "division": e[2],
                "level_name": e[3],
                "threshold": e[4],
                "emblem_key": TIER_EMBLEM_KEYS[e[1]],
            }
            for e in RANK_LADDER
        ]
    }


def _compute_session_xp(closed_trades: list, realized_pnl: float, journaled: bool) -> dict:
    """Compute XP for a session at /end.

    Returns: {amount, breakdown: {base, multipliers, product, final}}
    Multipliers are multiplicative; each one only applies when its
    `applied` flag is true. `closed_trades` is the parsed JSON list
    from `trading_sessions.closed_trades` — fields used: `id`, `pnl`,
    `r_multiple`, `opened_at`, `closed_at` (sim-time unix seconds).
    """
    base = XP_BASE
    multipliers = []

    # 1. Net profitable session
    profitable = realized_pnl > 0
    multipliers.append({"name": "net_profitable", "applied": profitable, "factor": 1.5})

    # 2. Win rate > 50%
    if closed_trades:
        wins = sum(1 for t in closed_trades if (t.get("pnl") or 0) > 0)
        win_rate = wins / len(closed_trades)
        win_rate_qualifies = win_rate > 0.5
    else:
        win_rate_qualifies = False
    multipliers.append({"name": "win_rate_gt_50", "applied": win_rate_qualifies, "factor": 1.25})

    # 3. Positive R:R — avg r_multiple >= 1.0 over trades with non-null r_multiple
    r_values = [t.get("r_multiple") for t in closed_trades if t.get("r_multiple") is not None]
    if r_values:
        avg_r = sum(r_values) / len(r_values)
        rr_qualifies = avg_r >= 1.0
    else:
        rr_qualifies = False  # don't reward or penalize when no stops were used
    multipliers.append({"name": "positive_rr", "applied": rr_qualifies, "factor": 1.5})

    # 4. No revenge trading — no trade opened within 120s sim-time of a
    #    LOSING trade's close.
    revenge_clean = True
    losses_sorted = sorted(
        (t for t in closed_trades if (t.get("pnl") or 0) < 0 and t.get("closed_at") is not None),
        key=lambda t: t["closed_at"],
    )
    for loss in losses_sorted:
        loss_close = loss["closed_at"]
        for t in closed_trades:
            if t.get("id") == loss.get("id"):
                continue
            opened_at = t.get("opened_at")
            if opened_at is None:
                continue
            if loss_close <= opened_at <= loss_close + 120:
                revenge_clean = False
                break
        if not revenge_clean:
            break
    multipliers.append({"name": "no_revenge", "applied": revenge_clean, "factor": 1.1})

    # 5. Journaled the session (always False today; flips True when Journal wires up)
    multipliers.append({"name": "journaled", "applied": bool(journaled), "factor": 1.2})

    # Multiplicative: product of qualifying multipliers
    product = 1.0
    for m in multipliers:
        if m["applied"]:
            product *= m["factor"]

    final = round(base * product)
    return {
        "amount": final,
        "breakdown": {
            "base": base,
            "multipliers": multipliers,
            "product": product,
            "final": final,
        },
    }


@app.post("/sessions/{session_id}/end")
def end_session(session_id: str, payload: dict):
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    final_balance = payload.get("final_balance", sess["balance"])
    return_pct = (final_balance - sess["account_size"]) / sess["account_size"] * 100
    closed_trades = json.loads(sess["closed_trades"])
    wins = sum(1 for t in closed_trades if t.get("pnl", 0) > 0)
    win_rate = wins / len(closed_trades) if closed_trades else 0
    realized_pnl = final_balance - sess["account_size"]

    conn.execute(
        "UPDATE trading_sessions SET status='ended', ended_at=unixepoch(), balance=? WHERE session_id=?",
        (final_balance, session_id),
    )
    username = payload.get("username", "anonymous")
    conn.execute(
        """
        INSERT INTO leaderboard (uid, username, symbol, timeframe, account_size, return_pct, total_trades, win_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (sess["uid"], username, sess["symbol"], sess["timeframe"],
         sess["account_size"], return_pct, len(closed_trades), win_rate),
    )

    # ── XP grant (idempotent on session_id) ──────────────────────────────────
    existing = conn.execute(
        "SELECT id, amount, breakdown FROM xp_events WHERE session_id=?",
        (session_id,),
    ).fetchone()
    if existing:
        xp_awarded = existing["amount"]
        xp_breakdown = json.loads(existing["breakdown"])
    else:
        sess_keys = sess.keys() if hasattr(sess, "keys") else []
        journaled = bool(sess["journaled"]) if "journaled" in sess_keys else False
        result = _compute_session_xp(closed_trades, realized_pnl, journaled)
        xp_awarded = result["amount"]
        xp_breakdown = result["breakdown"]
        conn.execute(
            "INSERT INTO xp_events (uid, session_id, amount, reason, breakdown, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (sess["uid"], session_id, xp_awarded, "session_end",
             json.dumps(xp_breakdown), time.time()),
        )
        conn.execute(
            "UPDATE users SET xp = xp + ? WHERE uid=?",
            (xp_awarded, sess["uid"]),
        )

    xp_row = conn.execute("SELECT xp FROM users WHERE uid=?", (sess["uid"],)).fetchone()
    xp_total = xp_row["xp"] if xp_row else 0

    # Update account stats
    _update_account_stats(conn, sess["uid"])

    conn.commit()
    conn.close()
    return {
        "return_pct": round(return_pct, 2),
        "win_rate": round(win_rate * 100, 1),
        "xp_awarded": xp_awarded,
        "xp_breakdown": xp_breakdown,
        "xp_total": xp_total,
        "rank": _rank_from_xp(xp_total),
    }


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, uid: str = Query(...)):
    """Delete a session and its associated trades. Scoped to the owning user.
    Returns 404 if not found, 403 if uid mismatches the session's stored uid."""
    conn = get_conn()
    try:
        sess = conn.execute(
            "SELECT uid FROM trading_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")
        if sess["uid"] != uid:
            raise HTTPException(status_code=403, detail="Not your session")
        # delete dependent rows first (FK or not — be explicit)
        conn.execute("DELETE FROM trades WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM trading_sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()
    return {"success": True}


def _update_account_stats(conn, uid: str):
    # Rolling last 200 trades per spec
    rows = conn.execute(
        "SELECT pnl FROM trades WHERE uid = ? ORDER BY closed_at DESC LIMIT 200", (uid,)
    ).fetchall()
    if not rows:
        return
    total_pnl = sum(r["pnl"] for r in rows)
    wins   = [r["pnl"] for r in rows if r["pnl"] > 0]
    losses = [abs(r["pnl"]) for r in rows if r["pnl"] <= 0]
    win_rate = len(wins) / len(rows)
    gross_profit = sum(wins)
    gross_loss   = sum(losses)
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)
    starting = conn.execute("SELECT starting_balance FROM accounts WHERE uid = ?", (uid,)).fetchone()
    starting_balance = starting["starting_balance"] if starting else 10000
    return_pct = total_pnl / starting_balance * 100
    # Rank is now driven by total XP (Phase 2), not by the legacy
    # win-rate/profit-factor heuristic in `_calc_rank`. We persist the
    # `level_name` (e.g. "Disciplined Trader II") in the TEXT column so
    # the leaderboard/group queries that read `a.rank` still get a
    # human-readable label. `_calc_rank` is kept for back-compat in
    # case any caller still references it.
    xp_row = conn.execute("SELECT xp FROM users WHERE uid = ?", (uid,)).fetchone()
    user_xp = xp_row["xp"] if xp_row else 0
    rank = _rank_from_xp(user_xp)["level_name"]
    # all-time total for dashboard display
    all_rows = conn.execute("SELECT pnl FROM trades WHERE uid = ?", (uid,)).fetchall()
    all_pnl = sum(r["pnl"] for r in all_rows)
    conn.execute(
        """
        UPDATE accounts
        SET total_pnl = ?, win_rate = ?, total_trades = ?, rank = ?, last_updated = unixepoch()
        WHERE uid = ?
        """,
        (round(all_pnl, 2), round(win_rate, 4), len(all_rows), rank, uid),
    )


def _tournament_score(closed_trades: list, final_balance: float, account_size: float) -> tuple[float, dict]:
    """
    score = final_balance
            * min(1.5, profit_factor / 2)
            * min(1.5, win_rate / 0.5)
            * max(0.5, 1 - max_drawdown_pct)

    score = 0 if profit_factor <= 1.0 OR win_rate < 0.30
    """
    if not closed_trades:
        return 0.0, {"return_pct": 0.0, "profit_factor": 0.0, "win_rate": 0.0,
                     "max_drawdown_pct": 0.0, "consistency_mul": 0.0}

    wins   = [t["pnl"] for t in closed_trades if t["pnl"] > 0]
    losses = [abs(t["pnl"]) for t in closed_trades if t["pnl"] <= 0]
    gross_profit = sum(wins)
    gross_loss   = sum(losses)
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (1.01 if gross_profit > 0 else 0.0)
    win_rate = len(wins) / len(closed_trades)
    return_pct = (final_balance - account_size) / account_size

    # Max drawdown from equity curve
    equity = account_size
    peak   = account_size
    max_dd = 0.0
    for t in closed_trades:
        equity += t["pnl"]
        peak = max(peak, equity)
        dd = (peak - equity) / peak if peak > 0 else 0.0
        max_dd = max(max_dd, dd)

    # Zero-floor conditions
    if profit_factor <= 1.0 or win_rate < 0.30:
        score = 0.0
    else:
        score = (
            final_balance
            * min(1.5, profit_factor / 2)
            * min(1.5, win_rate / 0.5)
            * max(0.5, 1.0 - max_dd)
        )

    return score, {
        "return_pct": round(return_pct * 100, 2),
        "profit_factor": round(profit_factor, 3),
        "win_rate": round(win_rate, 4),
        "max_drawdown_pct": round(max_dd * 100, 2),
        "consistency_mul": round(min(1.5, profit_factor / 2) * min(1.5, win_rate / 0.5) * max(0.5, 1.0 - max_dd), 4),
    }


def _calc_rank(total_trades: int, win_rate: float, profit_factor: float, return_pct: float) -> str:
    # Gambler: fails ANY minimum threshold
    if total_trades < 25 or win_rate < 0.35 or profit_factor < 1.0 or return_pct < 2.0:
        return "Gambler"
    # Paper Hands: meets Gambler floor but not Sniper
    if total_trades < 100 or win_rate < 0.45 or profit_factor < 1.3 or return_pct < 8.0:
        return "Paper Hands"
    # Sniper
    if total_trades < 300 or win_rate < 0.55 or profit_factor < 1.6 or return_pct < 20.0:
        return "Sniper"
    # Inside Trader
    if total_trades < 750 or win_rate < 0.60 or profit_factor < 2.0 or return_pct < 60.0:
        return "Inside Trader"
    return "Market Maker"


# ─── Leaderboard ─────────────────────────────────────────────────────────────

@app.get("/leaderboard")
def get_leaderboard(period: str = Query("weekly")):
    cutoff_map = {
        "weekly":  7 * 86400,
        "monthly": 30 * 86400,
        "alltime": 36500 * 86400,
    }
    delta = cutoff_map.get(period, 7 * 86400)
    cutoff = int(datetime.now(timezone.utc).timestamp()) - delta

    conn = get_conn()
    rows = conn.execute(
        """
        SELECT username, symbol, timeframe, account_size,
               return_pct, total_trades, win_rate, ended_at
        FROM leaderboard
        WHERE ended_at >= ?
        ORDER BY return_pct DESC
        LIMIT 100
        """,
        (cutoff,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── Trade journal ────────────────────────────────────────────────────────────

@app.get("/users/{uid}/trades")
def get_trades(uid: str, limit: int = Query(50, le=200), offset: int = Query(0)):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT * FROM trades WHERE uid = ?
        ORDER BY closed_at DESC LIMIT ? OFFSET ?
        """,
        (uid, limit, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── Public feed ─────────────────────────────────────────────────────────────

@app.get("/feed")
def get_feed(limit: int = Query(50, le=100)):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT * FROM public_feed ORDER BY posted_at DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/feed/post")
def post_to_feed(payload: dict):
    uid = payload.get("uid")
    trade_id = payload.get("trade_id")
    if not uid or not trade_id:
        raise HTTPException(status_code=400, detail="uid and trade_id required")

    conn = get_conn()
    trade = conn.execute("SELECT * FROM trades WHERE id = ? AND uid = ?", (trade_id, uid)).fetchone()
    if not trade:
        conn.close()
        raise HTTPException(status_code=404, detail="Trade not found")
    user = conn.execute("SELECT username FROM users WHERE uid = ?", (uid,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    conn.execute(
        """
        INSERT INTO public_feed (uid, username, trade_id, symbol, side, pnl, pips, r_multiple)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (uid, user["username"], trade_id, trade["symbol"], trade["side"],
         trade["pnl"], trade["pips"], trade["r_multiple"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── Groups ──────────────────────────────────────────────────────────────────

@app.post("/groups/create")
def create_group(payload: dict):
    uid = payload.get("uid")
    name = payload.get("name")
    if not uid or not name:
        raise HTTPException(status_code=400, detail="uid and name required")
    invite_code = str(uuid.uuid4())[:8].upper()
    conn = get_conn()
    conn.execute(
        "INSERT INTO leaderboard_groups (name, invite_code, owner_uid) VALUES (?, ?, ?)",
        (name, invite_code, uid),
    )
    group_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute(
        "INSERT INTO group_members (group_id, uid) VALUES (?, ?)", (group_id, uid)
    )
    conn.commit()
    conn.close()
    return {"group_id": group_id, "invite_code": invite_code}


@app.post("/groups/join")
def join_group(payload: dict):
    uid = payload.get("uid")
    invite_code = payload.get("invite_code")
    if not uid or not invite_code:
        raise HTTPException(status_code=400, detail="uid and invite_code required")
    conn = get_conn()
    group = conn.execute(
        "SELECT id FROM leaderboard_groups WHERE invite_code = ?", (invite_code,)
    ).fetchone()
    if not group:
        conn.close()
        raise HTTPException(status_code=404, detail="Invalid invite code")
    try:
        conn.execute(
            "INSERT INTO group_members (group_id, uid) VALUES (?, ?)", (group["id"], uid)
        )
        conn.commit()
    except Exception:
        pass  # already a member
    conn.close()
    return {"group_id": group["id"]}


@app.get("/groups/{group_id}/leaderboard")
def group_leaderboard(group_id: int):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT u.username, a.total_pnl, a.win_rate, a.total_trades, a.rank
        FROM group_members gm
        JOIN users u ON u.uid = gm.uid
        JOIN accounts a ON a.uid = gm.uid
        WHERE gm.group_id = ?
        ORDER BY a.total_pnl DESC
        """,
        (group_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── Tournaments ──────────────────────────────────────────────────────────────

class CreateTournamentRequest(BaseModel):
    name: str
    symbol: str
    timeframe: str
    account_size: float = 10000
    duration_days: int = 30


@app.post("/tournaments/create")
def create_tournament(req: CreateTournamentRequest):
    conn = get_conn()
    hidden_start = _pick_random_start(conn, req.symbol, req.timeframe)
    now = int(datetime.now(timezone.utc).timestamp())
    ends_at = now + req.duration_days * 86400
    conn.execute(
        """
        INSERT INTO tournaments (name, symbol, timeframe, hidden_start, starts_at, ends_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (req.name, req.symbol, req.timeframe, hidden_start, now, ends_at),
    )
    tid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return {"tournament_id": tid, "ends_at": ends_at}


@app.get("/tournaments")
def list_tournaments():
    now = int(datetime.now(timezone.utc).timestamp())
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM tournaments WHERE ends_at > ? ORDER BY starts_at DESC",
        (now,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/tournaments/{tournament_id}/enter")
def enter_tournament(tournament_id: int, payload: dict):
    uid = payload.get("uid")
    username = payload.get("username", "anonymous")
    if not uid:
        raise HTTPException(status_code=400, detail="uid required")

    conn = get_conn()
    tourney = conn.execute(
        "SELECT * FROM tournaments WHERE id = ?", (tournament_id,)
    ).fetchone()
    if not tourney:
        conn.close()
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Each entrant uses the same hidden_start — server enforces this
    rows = _get_candles_up_to(conn, tourney["symbol"], tourney["timeframe"], tourney["hidden_start"], 200)
    if not rows:
        conn.close()
        raise HTTPException(status_code=404, detail="No candle data for tournament")

    session_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO trading_sessions
          (session_id, uid, symbol, timeframe, account_size, balance, hidden_start, current_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (session_id, uid, tourney["symbol"], tourney["timeframe"],
         10000, 10000, tourney["hidden_start"], tourney["hidden_start"]),
    )
    try:
        conn.execute(
            """
            INSERT INTO tournament_entries (tournament_id, uid, username, session_id)
            VALUES (?, ?, ?, ?)
            """,
            (tournament_id, uid, username, session_id),
        )
    except Exception:
        conn.close()
        raise HTTPException(status_code=409, detail="Already entered")

    conn.commit()
    conn.close()

    candles = [
        {"bar": i, "time": _wire_time(tourney["timeframe"], r["time"]),
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {
        "session_id": session_id,
        "symbol": tourney["symbol"],
        "timeframe": tourney["timeframe"],
        "candles": candles,
        "current_bar": len(candles) - 1,
    }


@app.post("/tournaments/{tournament_id}/submit")
def submit_tournament(tournament_id: int, payload: dict):
    uid = payload.get("uid")
    session_id = payload.get("session_id")
    if not uid or not session_id:
        raise HTTPException(status_code=400, detail="uid and session_id required")

    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ? AND uid = ?", (session_id, uid)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    closed_trades = json.loads(sess["closed_trades"])
    final_balance = sess["balance"]
    account_size  = sess["account_size"]

    score, breakdown = _tournament_score(closed_trades, final_balance, account_size)

    conn.execute(
        """
        UPDATE tournament_entries
        SET final_return = ?, consistency_mul = ?, score = ?, completed_at = unixepoch()
        WHERE tournament_id = ? AND uid = ?
        """,
        (round(breakdown["return_pct"], 2), round(breakdown["consistency_mul"], 4),
         round(score, 4), tournament_id, uid),
    )
    conn.execute(
        "UPDATE trading_sessions SET status='ended', ended_at=unixepoch() WHERE session_id=?",
        (session_id,),
    )
    conn.commit()
    conn.close()
    return {**breakdown, "score": round(score, 2)}


@app.get("/tournaments/{tournament_id}/leaderboard")
def tournament_leaderboard(tournament_id: int):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT username, final_return, consistency_mul, score, completed_at
        FROM tournament_entries
        WHERE tournament_id = ? AND score IS NOT NULL
        ORDER BY score DESC
        """,
        (tournament_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
