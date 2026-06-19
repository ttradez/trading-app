"""Diagnostic: trace what happens when an NQ 1D session advances at/past the
last available 1D candle. Reproduces the SQL queries advance_session() runs
and _resample_with_forming() runs, and reports what would be returned.
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

def _next_bucket_after(conn, symbol, tf, from_time):
    return conn.execute(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol=? AND timeframe=? AND time>? ORDER BY time ASC LIMIT 1",
        (symbol, tf, from_time)).fetchone()

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

def simulate_advance(conn, symbol, tf, current_time, hidden_start, count=1, end_time=None):
    """Replays advance_session's logic for a hypothetical session."""
    s = TF_SECONDS[tf]
    rows = conn.execute(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol=? AND timeframe=? AND time>=? ORDER BY time ASC LIMIT ?",
        (symbol, tf, current_time, count)).fetchall()
    if not rows:
        return {"candles": [], "done": True, "trace": "no rows -> done True"}

    end_time_hit = False
    if end_time is not None:
        kept = [r for r in rows if r["time"] <= end_time]
        if len(kept) < len(rows):
            end_time_hit = True
        rows = kept
        if not rows:
            return {"candles": [], "done": True, "trace": "end_time filter empty -> done True"}

    next_following = _next_bucket_after(conn, symbol, tf, rows[-1]["time"])
    new_current = next_following["time"] if next_following is not None else rows[-1]["time"] + s

    bars_at_start = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (symbol, tf, hidden_start)).fetchone()[0]
    bars_at_new_current = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (symbol, tf, rows[-1]["time"])).fetchone()[0]

    base_bar = (bars_at_new_current - bars_at_start) + 199 - (len(rows) - 1)
    return {
        "candles": [dict(r) for r in rows],
        "done": end_time_hit,
        "new_current": new_current,
        "next_following": dict(next_following) if next_following else None,
        "bars_at_start": bars_at_start,
        "bars_at_new_current": bars_at_new_current,
        "base_bar": base_bar,
        "len_rows": len(rows),
    }

def fmt_ts(t):
    if t is None: return "None"
    import datetime
    return f"{t} ({datetime.datetime.utcfromtimestamp(t).strftime('%Y-%m-%d %H:%M:%S')}Z)"

def header(s):
    print("\n" + "="*70)
    print(s)
    print("="*70)

def main():
    conn = get_conn()
    header("DB sanity: candle rows by symbol/timeframe")
    for sym in ["ES", "NQ", "YM", "GC"]:
        for tf in ["1D"]:
            r = conn.execute(
                "SELECT COUNT(*) c, MIN(time) mn, MAX(time) mx FROM candles "
                "WHERE symbol=? AND timeframe=?", (sym, tf)).fetchone()
            print(f"  {sym} {tf}: count={r['c']}, min={fmt_ts(r['mn'])}, max={fmt_ts(r['mx'])}")

    # NQ 1D tail
    header("NQ 1D — last 10 rows")
    rows = conn.execute(
        "SELECT time, open, close FROM candles WHERE symbol='NQ' AND timeframe='1D' "
        "ORDER BY time DESC LIMIT 10").fetchall()
    for r in reversed(rows):
        print(f"  time={fmt_ts(r['time'])} open={r['open']} close={r['close']}")

    # GC 1D tail
    header("GC 1D — last 10 rows")
    rows = conn.execute(
        "SELECT time, open, close FROM candles WHERE symbol='GC' AND timeframe='1D' "
        "ORDER BY time DESC LIMIT 10").fetchall()
    for r in reversed(rows):
        print(f"  time={fmt_ts(r['time'])} open={r['open']} close={r['close']}")

    # Get NQ 1D max time
    nq_max = conn.execute(
        "SELECT MAX(time) FROM candles WHERE symbol='NQ' AND timeframe='1D'"
    ).fetchone()[0]

    # Establish a hidden_start way before max (200 bars back from max), as a session would have
    hidden_start = conn.execute(
        "SELECT time FROM candles WHERE symbol='NQ' AND timeframe='1D' "
        "AND time<? ORDER BY time DESC LIMIT 1 OFFSET 200",
        (nq_max,)).fetchone()[0]

    header(f"Simulated NQ 1D session: hidden_start={fmt_ts(hidden_start)}, max(time)={fmt_ts(nq_max)}")

    # Test 3 conditions for current_time:
    # A) max(time) (cursor sitting AT the last bar's start time)
    # B) max(time) + 86400 (cursor one nominal step PAST)
    # C) max(time) - 86400 (cursor one nominal step BEFORE max)
    # D) max(time) + 1 (cursor 1 second after the last bar's start)
    # E) cursor at the START of NQ 1D data (the migration self-heal case)
    # F) bucket-end of last bar (containing.time + s)
    nq_min = conn.execute(
        "SELECT MIN(time) FROM candles WHERE symbol='NQ' AND timeframe='1D'"
    ).fetchone()[0]

    for label, ct in [
        ("A: ct = max(time)", nq_max),
        ("B: ct = max(time) + 86400", nq_max + 86400),
        ("C: ct = max(time) - 86400", nq_max - 86400),
        ("D: ct = max(time) + 1", nq_max + 1),
        ("E: ct = min(time) (old-convention legacy start)", nq_min),
        ("F: ct = max(time) + 1 second (just past start of last bar)", nq_max + 1),
    ]:
        header(label + f"  ct={fmt_ts(ct)}")
        # _resample_with_forming
        r = _resample_with_forming(conn, "NQ", "1D", ct, 500)
        print(f"  _resample_with_forming returned {len(r)} rows")
        if r:
            print(f"    first: {fmt_ts(r[0]['time'])}")
            print(f"    last:  {fmt_ts(r[-1]['time'])}")
        # simulate /advance
        adv = simulate_advance(conn, "NQ", "1D", ct, hidden_start, count=1)
        print(f"  advance result: done={adv['done']}, len_rows={adv.get('len_rows', 0)}")
        if adv.get('candles'):
            print(f"    revealed first: {fmt_ts(adv['candles'][0]['time'])}")
            print(f"    revealed last:  {fmt_ts(adv['candles'][-1]['time'])}")
        print(f"    next_following: {fmt_ts(adv.get('next_following', {}).get('time') if adv.get('next_following') else None)}")
        print(f"    new_current: {fmt_ts(adv.get('new_current'))}")
        print(f"    bars_at_start={adv.get('bars_at_start')}, bars_at_new_current={adv.get('bars_at_new_current')}")
        print(f"    base_bar={adv.get('base_bar')}")

    # Now THE KEY SEQUENCE: simulate a real session walking up to the end
    # of NQ 1D data, then pressing Next Bar one more time. Track 'done' state
    # across multiple advances starting from a current_time near the end.
    header("KEY SEQUENCE: walk NQ 1D from second-to-last bar through end")
    rows = conn.execute(
        "SELECT time FROM candles WHERE symbol='NQ' AND timeframe='1D' "
        "ORDER BY time DESC LIMIT 5").fetchall()
    last_5 = list(reversed([r['time'] for r in rows]))
    print(f"  last 5 NQ 1D bar times: {[fmt_ts(t) for t in last_5]}")
    print(f"  diffs between bars: {[last_5[i+1]-last_5[i] for i in range(len(last_5)-1)]}")

    ct = last_5[-3]  # start 3 bars before end
    print(f"\n  Starting ct={fmt_ts(ct)}")
    for press in range(1, 6):
        adv = simulate_advance(conn, "NQ", "1D", ct, hidden_start, count=1)
        print(f"\n  Press {press}: ct_before={fmt_ts(ct)}")
        print(f"    rows: {len(adv.get('candles', []))} revealed")
        if adv.get('candles'):
            print(f"      revealed time(s): {[fmt_ts(r['time']) for r in adv['candles']]}")
        print(f"    done={adv['done']}")
        print(f"    new_current={fmt_ts(adv.get('new_current'))}")
        print(f"    next_following={fmt_ts(adv.get('next_following', {}).get('time') if adv.get('next_following') else None)}")
        # Also simulate what GET /sessions/{id} would do AFTER this advance
        # using the new_current as the new ct
        if adv.get('candles'):
            new_ct = adv['new_current']
            get_rows = _resample_with_forming(conn, "NQ", "1D", new_ct, 500)
            print(f"    POST-advance, GET would call _resample_with_forming(ct={fmt_ts(new_ct)}) -> {len(get_rows)} rows")
            if not get_rows:
                # self-heal would fire
                heal_ct = new_ct + TF_SECONDS["1D"]
                heal_rows = _resample_with_forming(conn, "NQ", "1D", heal_ct, 500)
                print(f"    !!! Self-heal would fire: new_t = ct + tf_seconds = {fmt_ts(heal_ct)}")
                print(f"    !!! Self-heal _resample_with_forming returned {len(heal_rows)} rows")
                if heal_rows:
                    print(f"    !!! Self-heal first: {fmt_ts(heal_rows[0]['time'])}")
                    print(f"    !!! Self-heal last:  {fmt_ts(heal_rows[-1]['time'])}")
                    # << This is where the chart 'goes back' >> would the rows go back?
                    print(f"    !!! TOTAL ROWS shown to chart = {len(heal_rows)}; persists ct={fmt_ts(heal_ct)}")
            else:
                print(f"      first GET row: {fmt_ts(get_rows[0]['time'])}")
                print(f"      last GET row:  {fmt_ts(get_rows[-1]['time'])}")
            ct = new_ct
        else:
            print(f"    -> done returned. No new ct (advance did not write).")
            break

    # COMPARE: same on GC 1D
    header("GC 1D comparison: walk to end")
    gc_max = conn.execute("SELECT MAX(time) FROM candles WHERE symbol='GC' AND timeframe='1D'").fetchone()[0]
    rows = conn.execute(
        "SELECT time FROM candles WHERE symbol='GC' AND timeframe='1D' "
        "ORDER BY time DESC LIMIT 5").fetchall()
    gc_last5 = list(reversed([r['time'] for r in rows]))
    print(f"  last 5 GC 1D bar times: {[fmt_ts(t) for t in gc_last5]}")
    print(f"  diffs between bars: {[gc_last5[i+1]-gc_last5[i] for i in range(len(gc_last5)-1)]}")
    gc_hidden_start = conn.execute(
        "SELECT time FROM candles WHERE symbol='GC' AND timeframe='1D' "
        "AND time<? ORDER BY time DESC LIMIT 1 OFFSET 200",
        (gc_max,)).fetchone()[0]
    ct = gc_last5[-3]
    print(f"\n  Starting ct={fmt_ts(ct)}")
    for press in range(1, 6):
        adv = simulate_advance(conn, "GC", "1D", ct, gc_hidden_start, count=1)
        print(f"\n  Press {press}: ct_before={fmt_ts(ct)} -> done={adv['done']}, len={len(adv.get('candles', []))}, new_ct={fmt_ts(adv.get('new_current'))}")
        if adv.get('candles'):
            new_ct = adv['new_current']
            get_rows = _resample_with_forming(conn, "GC", "1D", new_ct, 500)
            print(f"    GET _resample returned {len(get_rows)} rows after advance")
            if not get_rows:
                heal_ct = new_ct + TF_SECONDS["1D"]
                heal_rows = _resample_with_forming(conn, "GC", "1D", heal_ct, 500)
                print(f"    !!! Self-heal would fire: new_t={fmt_ts(heal_ct)} -> {len(heal_rows)} rows")
            ct = new_ct
        else:
            break

    # Final structural check: does NQ 1D have 1m data spanning the tail bars?
    header("NQ 1D last-bar 1m data presence — affects forming bucket")
    last_bar = conn.execute(
        "SELECT time FROM candles WHERE symbol='NQ' AND timeframe='1D' ORDER BY time DESC LIMIT 1"
    ).fetchone()[0]
    nq_1m = conn.execute(
        "SELECT COUNT(*) c, MIN(time) mn, MAX(time) mx FROM candles "
        "WHERE symbol='NQ' AND timeframe='1m' AND time>=? AND time<? ",
        (last_bar, last_bar + 86400)).fetchone()
    print(f"  NQ 1m count IN last 1D bucket [{fmt_ts(last_bar)} .. +86400): {nq_1m['c']}")
    print(f"    min={fmt_ts(nq_1m['mn'])}, max={fmt_ts(nq_1m['mx'])}")

    gc_last_bar = conn.execute(
        "SELECT time FROM candles WHERE symbol='GC' AND timeframe='1D' ORDER BY time DESC LIMIT 1"
    ).fetchone()[0]
    gc_1m = conn.execute(
        "SELECT COUNT(*) c, MIN(time) mn, MAX(time) mx FROM candles "
        "WHERE symbol='GC' AND timeframe='1m' AND time>=? AND time<? ",
        (gc_last_bar, gc_last_bar + 86400)).fetchone()
    print(f"  GC 1m count IN last 1D bucket [{fmt_ts(gc_last_bar)} .. +86400): {gc_1m['c']}")

    # Also: does NQ have 1m data PAST the last 1D bar's start?
    nq_1m_past = conn.execute(
        "SELECT COUNT(*) c, MAX(time) mx FROM candles "
        "WHERE symbol='NQ' AND timeframe='1m' AND time>=?",
        (last_bar,)).fetchone()
    print(f"  NQ 1m count from last 1D bar's start onward: {nq_1m_past['c']}, max={fmt_ts(nq_1m_past['mx'])}")

    conn.close()

if __name__ == "__main__":
    main()
