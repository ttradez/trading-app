"""Diagnostic: trace what GET /sessions/{id} returns when ct is past max(time)
after the final advance. Specifically the bar_offset and first_bar math.
"""
import sqlite3
from pathlib import Path

DB = Path(__file__).parent / "pocket_trade.db"
TF_SECONDS = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "1D": 86400, "1W": 604800,
}

def get_conn():
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    return conn

def _resample_with_forming(conn, symbol, tf, current_time, limit):
    s = TF_SECONDS[tf]
    if tf == "1m":
        rows = conn.execute(
            "SELECT time, open, high, low, close, volume FROM candles "
            "WHERE symbol=? AND timeframe='1m' AND time<=? "
            "ORDER BY time DESC LIMIT ?",
            (symbol, current_time, limit)).fetchall()
        return list(reversed(rows))
    containing = conn.execute(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol=? AND timeframe=? AND time<=? "
        "ORDER BY time DESC LIMIT 1",
        (symbol, tf, current_time)).fetchone()
    forming = None
    if containing is not None and containing["time"] + s > current_time:
        m_rows = conn.execute(
            "SELECT open, high, low, close, volume FROM candles "
            "WHERE symbol=? AND timeframe='1m' AND time>=? AND time<=? "
            "ORDER BY time ASC",
            (symbol, containing["time"], current_time)).fetchall()
        if m_rows:
            forming = {"time": containing["time"], "open": m_rows[0]["open"],
                       "high": max(r["high"] for r in m_rows),
                       "low": min(r["low"] for r in m_rows),
                       "close": m_rows[-1]["close"],
                       "volume": sum((r["volume"] or 0) for r in m_rows)}
        else:
            forming = dict(containing)
    complete_limit = (limit - 1) if forming is not None else limit
    cutoff = current_time - s
    complete = conn.execute(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol=? AND timeframe=? AND time<=? "
        "ORDER BY time DESC LIMIT ?",
        (symbol, tf, cutoff, complete_limit)).fetchall()
    out = [dict(r) for r in reversed(complete)]
    if forming is not None:
        out.append(forming)
    return out

def fmt_ts(t):
    if t is None: return "None"
    import datetime
    return f"{t} ({datetime.datetime.utcfromtimestamp(t).strftime('%Y-%m-%d %H:%M:%S')}Z)"

def simulate_get(conn, symbol, tf, ct, hidden_start, label):
    print(f"\n--- GET simulation: {label} ---")
    print(f"  symbol={symbol} tf={tf} ct={fmt_ts(ct)} hidden_start={fmt_ts(hidden_start)}")
    rows = _resample_with_forming(conn, symbol, tf, ct, 500)
    print(f"  _resample_with_forming -> {len(rows)} rows")
    if not rows:
        # Self-heal branch
        s_heal = TF_SECONDS[tf]
        new_t = ct + s_heal
        print(f"  SELF-HEAL FIRES: ct shifted by +{s_heal} to {fmt_ts(new_t)}")
        rows = _resample_with_forming(conn, symbol, tf, new_t, 500)
        print(f"  After self-heal: {len(rows)} rows")
        if rows:
            print(f"    sess.current_time PERSISTED to {fmt_ts(new_t)}")
            ct = new_t
    if rows:
        print(f"    first row: {fmt_ts(rows[0]['time'])}")
        print(f"    last row:  {fmt_ts(rows[-1]['time'])}")
    bars_at_start = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (symbol, tf, hidden_start)).fetchone()[0]
    bars_at_current = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (symbol, tf, ct)).fetchone()[0]
    bar_offset = bars_at_current - bars_at_start
    first_bar = 199 - (len(rows) - 1 - bar_offset) if len(rows) > bar_offset else 0
    current_bar = first_bar + len(rows) - 1 if rows else 0
    print(f"  bars_at_start={bars_at_start}, bars_at_current={bars_at_current}, bar_offset={bar_offset}")
    print(f"  first_bar={first_bar}, current_bar={current_bar}")
    return rows, ct

def main():
    conn = get_conn()
    nq_max = conn.execute("SELECT MAX(time) FROM candles WHERE symbol='NQ' AND timeframe='1D'").fetchone()[0]
    print(f"NQ 1D max(time) = {fmt_ts(nq_max)}")

    hidden_start = conn.execute(
        "SELECT time FROM candles WHERE symbol='NQ' AND timeframe='1D' "
        "AND time<? ORDER BY time DESC LIMIT 1 OFFSET 200",
        (nq_max,)).fetchone()[0]

    # 1) ct = max(time): user is sitting AT the last bar, just opened session, GET load
    simulate_get(conn, "NQ", "1D", nq_max, hidden_start,
                 "ct = max(time) — chart shows last bar as forming bucket")

    # 2) ct = last.time + nominal 86400 (= 1777679400): the state AFTER pressing
    #    Next Bar at the last bar. advance_session set new_current = last.time + s
    #    because next_following was None.
    s = TF_SECONDS["1D"]
    ct_after_final_advance = nq_max + s
    simulate_get(conn, "NQ", "1D", ct_after_final_advance, hidden_start,
                 "ct = max(time)+86400 — state AFTER final advance (next_following=None branch)")

    # 3) Then user opens app, GET fires. Does self-heal fire?
    #    _resample_with_forming(ct=max+86400): containing.time = nq_max,
    #    containing.time + s = nq_max + 86400 = ct, so condition `containing.time+s > ct`
    #    is FALSE (== not >). So no forming bucket. Then complete query: time<=ct-s
    #    = time<=nq_max returns all 4108 rows. So 500 rows returned. No self-heal.

    # 4) But wait: the self-heal condition is "if not rows". Even if ct is past max,
    #    we still return the 500 most recent complete rows. So self-heal doesn't fire here.
    #    Let me explicitly verify by checking what happens when ct is FAR past max.

    # 5) BUT — there's a subtle thing. If new_current = last.time + s where s is
    #    NOMINAL 86400 but actual bucket spans are 86000-87000, then the "ct" stored
    #    is OFF-GRID by up to 1000 seconds. Let me check that case.

    # Inspect the gap-jump case: last bucket ends differently than nominal.
    # NQ 1D: last bar.time = 1777593000. nominal s = 86400. So new_current = 1777679400.
    # The PREVIOUS bar.time was 1777507000 (diff = 86000). So bucket spans are
    # CME-aligned not 86400-aligned.

    # KEY CASE: what if the SESSION was already at ct >= max(time) when the user
    # opened the app, and GET is called. Does the self-heal fire incorrectly?
    print("\n\n" + "="*70)
    print("Testing FAR-PAST ct values to find where self-heal triggers:")
    print("="*70)
    for offset_label, offset in [
        ("0", 0), ("+86400", 86400), ("+86400*2", 86400*2),
        ("+86400*30 (1 month past)", 86400*30),
        ("+86400*60 (2 months past)", 86400*60),
        ("+86400*365 (1 year past)", 86400*365),
    ]:
        ct = nq_max + offset
        rows = _resample_with_forming(conn, "NQ", "1D", ct, 500)
        print(f"  ct = max+{offset_label}: _resample returned {len(rows)} rows  -> self-heal would {'FIRE' if not rows else 'not fire'}")

    # Specifically test ct values that could cause empty rows
    # _resample_with_forming returns nothing only when there's no containing bucket
    # AND no complete bucket with time <= ct - s.
    # complete query: time <= ct - s = ct - 86400. If ct - 86400 < min(time), empty.
    # Since min = 1262563000, only when ct < 1262563000 + 86400 would complete be empty.
    # And containing query: time <= ct. Empty only when ct < min(time).
    # So self-heal CAN'T fire for ct >= min(time) + 86400. It's safe for end-of-data.

    # But WAIT: what if the new ct after the final advance is ct = nq_max + 86400 (nominal)
    # which is > nq_max. Then containing.time = nq_max. The forming condition is
    # `containing.time + s > current_time` = `nq_max + 86400 > nq_max + 86400` = FALSE.
    # So no forming bucket. Then complete query: time <= ct - s = nq_max. All bars
    # returned. 500 rows. NORMAL.

    # So advance + GET sequence at end-of-data is SAFE for the standard path.
    # But the user reports "chart goes back a month". Let me see if there is ANY
    # path that produces that.

    # Hypothesis: maybe the issue is the OLD-CONVENTION self-heal misfiring when
    # the user's hidden_start was originally near the END of data (max - 200 bars)
    # but they walked to the end and the SESSION'S current_time hits the migration trap.

    # Actually let me re-read GET carefully. The self-heal triggers only when
    # rows = _resample_with_forming(ct) returns empty. That happens only when:
    #   - No containing bucket (ct < min(time))
    #   - AND no complete bucket (time <= ct - s)
    # both vacuously true ONLY when ct < min(time) - 0 (essentially)
    # OR a weird edge case: containing exists, no 1m data inside it, forming = dict(containing)
    # then complete with time <= ct - s could still produce 499 rows. So _resample returns 500.

    # Conclusion: GET self-heal CANNOT misfire at end of data with the current logic.
    # _resample_with_forming returns 500 rows whenever ct >= min(time) + s for NQ 1D.

    # Let's investigate ANOTHER hypothesis: what if the bug is on the FRONT-END,
    # not the backend? The chart "going back a month" might be a hosted-chart
    # rendering issue when /advance returns done=True with candles=[] and the
    # chart re-renders the prior data with a different scroll position.

    # Final sanity: simulate the EXACT sequence the user experiences:
    # 1. Open NQ 1D session.
    # 2. Press Next Bar many times until they reach the last bar.
    # 3. Press Next Bar once more (which sets ct = max + 86400, returns done=False with 1 row)
    # 4. Press Next Bar again (returns done=True with [] rows)
    # 5. At step 3, the chart shows the last bar fine.
    # 6. At step 4, the chart receives candles=[] and done=True. What does the FE do?

    # Let me grep the frontend for how done=True is handled.
    print("\n\nNow check what GET returns when ct is at the FAR-PAST self-heal trigger.")
    print("Only triggers when ct < min(time) effectively.")
    too_small_ct = 1000000000  # well before min(time)
    rows = _resample_with_forming(conn, "NQ", "1D", too_small_ct, 500)
    print(f"  ct = {fmt_ts(too_small_ct)} -> _resample returned {len(rows)} rows")
    # Test exactly at min - 1
    nq_min = conn.execute("SELECT MIN(time) FROM candles WHERE symbol='NQ' AND timeframe='1D'").fetchone()[0]
    for offset_label, ct in [
        ("min(time)-1", nq_min - 1),
        ("min(time)", nq_min),
        ("min(time)+1", nq_min + 1),
        ("min(time)+86399", nq_min + 86399),
        ("min(time)+86400", nq_min + 86400),
    ]:
        rows = _resample_with_forming(conn, "NQ", "1D", ct, 500)
        print(f"  ct = {offset_label} = {fmt_ts(ct)} -> _resample returned {len(rows)} rows")

    conn.close()

if __name__ == "__main__":
    main()
