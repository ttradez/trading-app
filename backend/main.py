import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import get_conn, init_db
from data_pipeline.symbol_map import CONTRACT_SPECS, DISPLAY_NAMES

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
        {"time": r["time"], "open": r["open"], "high": r["high"],
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
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


# ─── Session helpers ─────────────────────────────────────────────────────────

def _pick_random_start(conn, symbol: str, timeframe: str) -> int:
    """
    Pick a random hidden start with bias toward recent data.

    Why bias: prices in 2010-2015 are very different from today (e.g. NQ at
    $2,000 vs $18,000+). Even though those are real periods, traders find them
    disorienting because the price levels look unfamiliar. We weight the
    distribution so ~70% of sessions land in the last 3 years and only ~10%
    pick anything older than 8 years.
    """
    cutoff = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())
    row = conn.execute(
        """
        SELECT min(time), max(time) FROM candles
        WHERE symbol = ? AND timeframe = ? AND time < ?
        """,
        (symbol, timeframe, cutoff),
    ).fetchone()
    if not row or row[0] is None:
        raise HTTPException(status_code=404, detail="No data for this symbol/timeframe")

    min_t, max_t = row[0], row[1]

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

    # Exponential weighting toward recent: pick uniform in [0, 1), apply
    # power < 1 to bias toward 1.0 (recent). Then map to [min_t, max_t].
    # power=0.3 → ~70% of picks fall in the most recent 30% of the timeline.
    u = random.random()
    weighted = 1.0 - (u ** 3)  # cubed inverse — strong recency bias
    return int(min_t + weighted * (max_t - min_t))


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


@app.get("/news")
def get_news(symbol: str = "", before: int = 0, limit: int = 50):
    """Historical news up to (and including) `before` unix-seconds. Plug a real
    provider in here later — for now returns an empty list so the UI can
    render the "no news" state without breaking. Keeps the contract stable so
    the frontend can ship before a provider is chosen."""
    return []


def _get_candles_up_to(conn, symbol: str, timeframe: str, up_to: int, limit: int):
    """Return up to `limit` most recent FULLY REVEALED candles in `timeframe`.
    A candle is fully revealed when its entire period ends at or before
    `up_to` (the session's current_time).

    The cutoff is precomputed (`up_to - s`) and used as `time <= ?` so SQLite
    can seek the (symbol, timeframe, time) index — putting `time + ?` in the
    WHERE forces a scan, which crushes 1m where the table is huge.
    """
    s = TF_SECONDS.get(timeframe, 86400)
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


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    """Resume endpoint — called on app reopen to restore session state without leaking real dates."""
    conn = get_conn()
    sess = conn.execute(
        "SELECT * FROM trading_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    # Reconstruct the bar-indexed candle history from hidden_start up to current_time
    rows = _get_candles_up_to(conn, sess["symbol"], sess["timeframe"], sess["current_time"], 500)
    # Self-heal: pre-existing sessions stored current_time as bar.start under
    # the old convention. The new convention treats current_time as bar.end,
    # so the query returns nothing. Shift forward by tf_seconds and migrate.
    if not rows:
        s_heal = TF_SECONDS.get(sess["timeframe"], 86400)
        new_t = sess["current_time"] + s_heal
        rows = _get_candles_up_to(conn, sess["symbol"], sess["timeframe"], new_t, 500)
        if rows:
            conn.execute(
                "UPDATE trading_sessions SET current_time = ? WHERE session_id = ?",
                (new_t, session_id),
            )
            conn.commit()
            sess = dict(sess); sess["current_time"] = new_t  # reflect for the rest of this request

    bars_at_start = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], sess["timeframe"], sess["hidden_start"]),
    ).fetchone()[0]
    bars_at_current = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], sess["timeframe"], sess["current_time"]),
    ).fetchone()[0]
    conn.close()

    # bar index offset: bars revealed since hidden_start (the initial 200-bar window ends at bar 199)
    bar_offset = bars_at_current - bars_at_start
    first_bar = 199 - (len(rows) - 1 - bar_offset) if len(rows) > bar_offset else 0

    candles = [
        {"bar": first_bar + i, "time": r["time"],
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {
        "session_id": session_id,
        "symbol": sess["symbol"],
        "timeframe": sess["timeframe"],
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
        {"bar": i, "time": r["time"], "open": r["open"], "high": r["high"],
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
    rows = _get_candles_up_to(conn, sess["symbol"], req.timeframe, sess["current_time"], 200)
    # Self-heal stored current_time → end-of-bar convention if needed.
    if not rows:
        s_heal_old = TF_SECONDS.get(sess["timeframe"], 86400)
        new_t = sess["current_time"] + s_heal_old
        rows = _get_candles_up_to(conn, sess["symbol"], req.timeframe, new_t, 200)
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
        {"bar": i, "time": r["time"], "open": r["open"], "high": r["high"],
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
    rows = _get_candles_up_to(conn, req.symbol, req.timeframe, hidden_start + s_init, 200)
    if not rows:
        conn.close()
        raise HTTPException(status_code=404, detail="No candle data found")

    # current_time = the END of the last revealed bar's period. With this
    # convention a bar is "fully revealed" iff time + tf_seconds <= current_time,
    # which lets every timeframe stay in sync no matter which one the user
    # advances on.
    s = TF_SECONDS.get(req.timeframe, 86400)
    initial_current_time = hidden_start + s

    session_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO trading_sessions
          (session_id, uid, symbol, timeframe, account_size, balance, hidden_start, current_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (session_id, req.uid, req.symbol, req.timeframe,
         req.account_size, req.account_size, hidden_start, initial_current_time),
    )
    conn.commit()
    conn.close()

    # Strip real timestamps — send bar index only
    candles = [
        {"bar": i, "time": r["time"], "open": r["open"], "high": r["high"],
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

    s = TF_SECONDS.get(sess["timeframe"], 86400)
    # Find the next `count` bars whose period END is past current_time.
    # When current_time falls inside a bar's period (because the user just
    # advanced on a finer TF), this picks up that straddling bar first so
    # advancing on a coarser TF reveals the rest of that period.
    # Cutoff precomputed (current_time - s) so the index can be used.
    cutoff_lo = sess["current_time"] - s
    rows = conn.execute(
        """
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = ? AND timeframe = ? AND time > ?
        ORDER BY time ASC LIMIT ?
        """,
        (sess["symbol"], sess["timeframe"], cutoff_lo, req.count),
    ).fetchall()

    if not rows:
        conn.close()
        return {"candles": [], "done": True}

    # Set current_time to the END of the last newly-revealed bar's period,
    # so all timeframes can compute consistent visibility from this single value.
    new_current = rows[-1]["time"] + s

    # Count bars revealed so far. With the end-of-period convention, a bar at
    # time t is revealed iff t + s <= current_time, i.e. t <= current_time - s.
    bars_at_start = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], sess["timeframe"], sess["hidden_start"]),
    ).fetchone()[0]
    bars_at_new_current = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sess["symbol"], sess["timeframe"], new_current - s),
    ).fetchone()[0]

    conn.execute(
        "UPDATE trading_sessions SET current_time = ? WHERE session_id = ?",
        (new_current, session_id),
    )

    # Check SL/TP hits for all open positions on each new bar
    positions = json.loads(sess["open_positions"])
    closed_trades = json.loads(sess["closed_trades"])
    balance = sess["balance"]
    spec = CONTRACT_SPECS.get(sess["symbol"], {"pip": 1, "contractSize": 1})
    closed_now = []
    for pos in positions[:]:
        for r in rows:
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
        {"bar": base_bar + i, "time": r["time"],
         "open": r["open"], "high": r["high"],
         "low": r["low"], "close": r["close"], "volume": r["volume"]}
        for i, r in enumerate(rows)
    ]
    return {"candles": candles, "done": False, "auto_closed": closed_now}


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

    # Update account stats
    _update_account_stats(conn, sess["uid"])

    conn.commit()
    conn.close()
    return {"return_pct": round(return_pct, 2), "win_rate": round(win_rate * 100, 1)}


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
    rank = _calc_rank(len(rows), win_rate, profit_factor, return_pct)
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
        {"bar": i, "time": r["time"], "open": r["open"], "high": r["high"],
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
