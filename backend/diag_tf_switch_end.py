"""Diagnostic: User is on NQ 1D, walks current_time near end (2026-04-30).
What happens if they switch TF to 5m/15m/1h/4h? The 5m/etc data only goes
to 2025-03-31, more than a year BEFORE the cursor. Does this trigger the
self-heal? Where does the chart end up?
"""
import sqlite3
from pathlib import Path
import datetime

DB = Path(__file__).parent / "pocket_trade.db"
TF_SECONDS = {"1m":60,"5m":300,"15m":900,"30m":1800,"1h":3600,"4h":14400,"1D":86400,"1W":604800}

def get_conn():
    conn = sqlite3.connect(str(DB)); conn.row_factory = sqlite3.Row
    return conn

def f(t):
    if t is None: return "None"
    return f"{t} ({datetime.datetime.utcfromtimestamp(t).strftime('%Y-%m-%d')}Z)"

def _resample_with_forming(conn, symbol, tf, current_time, limit):
    s = TF_SECONDS[tf]
    if tf == "1m":
        rows = conn.execute(
            "SELECT time, open, high, low, close, volume FROM candles "
            "WHERE symbol=? AND timeframe='1m' AND time<=? ORDER BY time DESC LIMIT ?",
            (symbol, current_time, limit)).fetchall()
        return list(reversed(rows))
    containing = conn.execute(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol=? AND timeframe=? AND time<=? ORDER BY time DESC LIMIT 1",
        (symbol, tf, current_time)).fetchone()
    forming = None
    if containing is not None and containing["time"] + s > current_time:
        m_rows = conn.execute(
            "SELECT open, high, low, close, volume FROM candles "
            "WHERE symbol=? AND timeframe='1m' AND time>=? AND time<=? ORDER BY time ASC",
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
        "WHERE symbol=? AND timeframe=? AND time<=? ORDER BY time DESC LIMIT ?",
        (symbol, tf, cutoff, complete_limit)).fetchall()
    out = [dict(r) for r in reversed(complete)]
    if forming is not None:
        out.append(forming)
    return out

def simulate_get(conn, symbol, stored_tf, override_tf, ct):
    """Simulate GET /sessions/{id}?timeframe=override_tf with stored sess.timeframe=stored_tf"""
    effective_tf = override_tf if override_tf else stored_tf
    rows = _resample_with_forming(conn, symbol, effective_tf, ct, 500)
    print(f"  GET symbol={symbol} stored_tf={stored_tf} effective_tf={effective_tf} ct={f(ct)}")
    print(f"    initial _resample -> {len(rows)} rows")
    if not rows:
        # SELF-HEAL FIRES
        s_heal = TF_SECONDS[stored_tf]  # NOTE: uses sess["timeframe"], not effective
        new_t = ct + s_heal
        print(f"    !!! SELF-HEAL FIRES (because not rows)")
        print(f"    !!! shifts ct by tf_seconds({stored_tf})={s_heal} -> {f(new_t)}")
        rows = _resample_with_forming(conn, symbol, effective_tf, new_t, 500)
        print(f"    !!! after self-heal _resample -> {len(rows)} rows")
        if rows:
            print(f"    !!! sess.current_time PERSISTED to {f(new_t)}")
            print(f"    !!! BUT new_t still way past effective_tf's data max!")
        ct = new_t
    if rows:
        print(f"    first row: {f(rows[0]['time'])}")
        print(f"    last row:  {f(rows[-1]['time'])}")
        print(f"    ROWS SPAN: {(rows[-1]['time']-rows[0]['time'])/86400:.1f} days, ENDS AT {f(rows[-1]['time'])}")
    return rows

def main():
    conn = get_conn()
    nq_1d_max = conn.execute("SELECT MAX(time) FROM candles WHERE symbol='NQ' AND timeframe='1D'").fetchone()[0]
    print(f"NQ 1D max(time): {f(nq_1d_max)}")
    for tf in ["1m","5m","15m","1h","4h","1D"]:
        m = conn.execute("SELECT MAX(time) FROM candles WHERE symbol='NQ' AND timeframe=?",(tf,)).fetchone()[0]
        print(f"NQ {tf} max(time): {f(m)}  (delta from 1D max: {(nq_1d_max - m)/86400:.0f} days earlier)")

    print("\n" + "="*70)
    print("Scenario 1: NQ 1D session at end (ct=max(1D)). User switches to 1h on chart.")
    print("="*70)
    simulate_get(conn, "NQ", "1D", "1h", nq_1d_max)

    print("\n" + "="*70)
    print("Scenario 2: NQ 1D session at end (ct=max(1D)). User switches to 5m on chart.")
    print("="*70)
    simulate_get(conn, "NQ", "1D", "5m", nq_1d_max)

    print("\n" + "="*70)
    print("Scenario 3: NQ 1D session walks PAST end. ct = max(1D) + 86400. User stays 1D.")
    print("="*70)
    simulate_get(conn, "NQ", "1D", None, nq_1d_max + 86400)

    print("\n" + "="*70)
    print("Scenario 4: NQ 1D session at end (ct=max(1D)+86400). User switches to 1h.")
    print("="*70)
    simulate_get(conn, "NQ", "1D", "1h", nq_1d_max + 86400)

    print("\n" + "="*70)
    print("Scenario 5: AS SCENARIO 1, but ct is ANYWHERE past NQ 1h max (~2025-03-31).")
    print("="*70)
    nq_1h_max = conn.execute("SELECT MAX(time) FROM candles WHERE symbol='NQ' AND timeframe='1h'").fetchone()[0]
    print(f"NQ 1h max: {f(nq_1h_max)}")
    for label, ct in [("1h_max+3600 (1h past)", nq_1h_max+3600),
                       ("1h_max+86400 (1d past)", nq_1h_max+86400),
                       ("1h_max+86400*30 (1 month past)", nq_1h_max+86400*30),
                       ("1h_max+86400*365 (1 year past)", nq_1h_max+86400*365)]:
        print(f"\n  -> {label}: ct={f(ct)}")
        simulate_get(conn, "NQ", "1D", "1h", ct)

    print("\n" + "="*70)
    print("Scenario 6: NQ 1D session at end. User REOPENS app, GET with timeframe=1D.")
    print("(stored ct = nq_1d_max + 86400 after final advance)")
    print("="*70)
    simulate_get(conn, "NQ", "1D", "1D", nq_1d_max + 86400)

    conn.close()

if __name__ == "__main__":
    main()
