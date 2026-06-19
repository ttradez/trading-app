"""
Audit script: verify the bar-index calculation in /advance handles non-uniform
1D timestamps correctly.

base_bar formula (main.py:1530):
    base_bar = (bars_at_new_current - bars_at_start) + 199 - (len(rows) - 1)
where:
    bars_at_X        = COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=X
    bars_at_start    = uses sess.hidden_start
    bars_at_new_curr = uses rows[-1].time (NOT new_current itself; main.py:1415)
    rows             = newly-revealed candles (time >= old current_time LIMIT count)

The CORRECT base_bar for the first new row should be:
    prev_bars + 200    where prev_bars = (bars_at_old_current_minus_1 - bars_at_start)
    i.e. one past the last bar of the previous reveal which sits at index
    199 + (revealed_count_so_far).

We exercise four scenarios on NQ 1D and one on NQ 5m for the uniform case.
"""
import sqlite3
import os

DB = os.path.join(os.path.dirname(__file__), "pocket_trade.db")

TF_SECONDS = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "1D": 86400, "1W": 604800,
}


def bars_at(conn, sym, tf, t):
    return conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time<=?",
        (sym, tf, t),
    ).fetchone()[0]


def next_bucket_after(conn, sym, tf, from_time):
    return conn.execute(
        """SELECT time FROM candles WHERE symbol=? AND timeframe=? AND time>?
           ORDER BY time ASC LIMIT 1""",
        (sym, tf, from_time),
    ).fetchone()


def fetch_advance_rows(conn, sym, tf, current_time, count):
    return conn.execute(
        """SELECT time, open, high, low, close FROM candles
           WHERE symbol=? AND timeframe=? AND time>=?
           ORDER BY time ASC LIMIT ?""",
        (sym, tf, current_time, count),
    ).fetchall()


def simulate_advance(conn, sym, tf, hidden_start, current_time, count):
    """Mirror main.py:1331-1538 advance logic. Returns dict with diagnostics."""
    s = TF_SECONDS[tf]
    rows = fetch_advance_rows(conn, sym, tf, current_time, count)
    if not rows:
        return {"empty": True, "current_time": current_time}

    nxt = next_bucket_after(conn, sym, tf, rows[-1]["time"])
    new_current = nxt["time"] if nxt is not None else rows[-1]["time"] + s

    bars_at_start = bars_at(conn, sym, tf, hidden_start)
    bars_at_new_current = bars_at(conn, sym, tf, rows[-1]["time"])  # NOTE: uses rows[-1].time, not new_current

    base_bar = (bars_at_new_current - bars_at_start) + 199 - (len(rows) - 1)

    return {
        "current_time_in": current_time,
        "row_times": [r["time"] for r in rows],
        "row_gaps": [rows[i]["time"] - rows[i - 1]["time"] for i in range(1, len(rows))],
        "new_current": new_current,
        "bars_at_start": bars_at_start,
        "bars_at_new_current": bars_at_new_current,
        "delta": bars_at_new_current - bars_at_start,
        "len_rows": len(rows),
        "base_bar": base_bar,
        "bar_indices_returned": [base_bar + i for i in range(len(rows))],
    }


def find_fri_to_mon_gap(conn, sym="NQ", tf="1D"):
    """Find an NQ 1D row pair where the gap is roughly a Fri->Mon weekend (>2 days)."""
    rows = conn.execute(
        """SELECT time FROM candles WHERE symbol=? AND timeframe=?
           ORDER BY time ASC""",
        (sym, tf),
    ).fetchall()
    for i in range(1, len(rows)):
        gap = rows[i]["time"] - rows[i - 1]["time"]
        if gap >= 200000:  # weekend-ish (>2 days)
            return rows[i - 1]["time"], rows[i]["time"], gap
    return None


def gap_histogram(conn, sym, tf):
    times = [r["time"] for r in conn.execute(
        "SELECT time FROM candles WHERE symbol=? AND timeframe=? ORDER BY time",
        (sym, tf),
    ).fetchall()]
    gaps = [times[i] - times[i - 1] for i in range(1, len(times))]
    buckets = {}
    for g in gaps:
        # bucket by round 1000s
        k = (g // 1000) * 1000
        buckets[k] = buckets.get(k, 0) + 1
    return sorted(buckets.items(), key=lambda x: -x[1])[:8]


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    print("=" * 78)
    print("NQ 1D gap histogram (top buckets, gap_seconds -> count):")
    print("=" * 78)
    for k, c in gap_histogram(conn, "NQ", "1D"):
        print(f"  ~{k}s : {c}")

    # ============================================================
    # Scenario 1: Uniform TF (5m) — 3 consecutive advances of count=N
    # ============================================================
    print()
    print("=" * 78)
    print("SCENARIO 1: Uniform TF (NQ 5m) — base_bar should increment by N each advance")
    print("=" * 78)
    sym, tf = "NQ", "5m"
    s = TF_SECONDS[tf]
    # pick a row at index 200 (so hidden_start has 200 bars before/at it)
    start_row = conn.execute(
        "SELECT time FROM candles WHERE symbol=? AND timeframe=? ORDER BY time LIMIT 1 OFFSET 199",
        (sym, tf),
    ).fetchone()
    hidden_start = start_row["time"]
    current_time = hidden_start + s
    print(f"hidden_start={hidden_start}  initial current_time={current_time}")
    N = 5
    last_base = None
    for step in range(3):
        adv = simulate_advance(conn, sym, tf, hidden_start, current_time, N)
        print(f"  Advance #{step + 1}: len_rows={adv['len_rows']} delta={adv['delta']} "
              f"base_bar={adv['base_bar']} bars={adv['bar_indices_returned']}")
        if last_base is not None:
            diff = adv["base_bar"] - last_base
            ok = "OK" if diff == N else f"MISMATCH (expected +{N}, got +{diff})"
            print(f"     base_bar increment vs prev: {diff}  [{ok}]")
        last_base = adv["base_bar"]
        current_time = adv["new_current"]

    # ============================================================
    # Scenario 2: Non-uniform NQ 1D — Fri->Mon row pair with count=2
    # ============================================================
    print()
    print("=" * 78)
    print("SCENARIO 2: Non-uniform NQ 1D — Fri->Mon row pair with count=2")
    print("=" * 78)
    sym, tf = "NQ", "1D"
    s = TF_SECONDS[tf]
    fri_mon = find_fri_to_mon_gap(conn, sym, tf)
    if not fri_mon:
        print("No weekend gap found (?)")
    else:
        fri_t, mon_t, gap = fri_mon
        print(f"Fri-like bar time={fri_t}  Mon-like bar time={mon_t}  gap={gap}s "
              f"(~{gap / 86400:.2f} days)")
        # set hidden_start to two bars BEFORE fri so we have a stable index base
        before = conn.execute(
            "SELECT time FROM candles WHERE symbol=? AND timeframe=? AND time<? "
            "ORDER BY time DESC LIMIT 1 OFFSET 1",
            (sym, tf, fri_t),
        ).fetchone()
        hidden_start = before["time"]
        print(f"hidden_start={hidden_start} (2 bars before Fri)")

        # First advance: count=1 → should reveal Fri (or whichever bar is at fri_t)
        # Set current_time so that fri_t is the first row revealed
        # rows = time >= current_time. So current_time should be slightly after hidden_start.
        # Simplest: current_time = hidden_start + 1 (so next time >= that includes Fri ... but no,
        # we want to reveal STARTING at the bar AFTER hidden_start). Bar after hidden_start exists.
        # Advance #1: count=1 should reveal one bar.
        current_time = hidden_start + 1
        adv1 = simulate_advance(conn, sym, tf, hidden_start, current_time, 1)
        print(f"  Advance #1 (count=1): row_times={adv1['row_times']} "
              f"new_current={adv1['new_current']} delta={adv1['delta']} "
              f"base_bar={adv1['base_bar']}")
        # Advance #2: count=2 across the Fri->Mon weekend
        current_time = adv1["new_current"]
        adv2 = simulate_advance(conn, sym, tf, hidden_start, current_time, 2)
        print(f"  Advance #2 (count=2): row_times={adv2['row_times']} "
              f"row_gaps={adv2['row_gaps']} new_current={adv2['new_current']} "
              f"delta={adv2['delta']} base_bar={adv2['base_bar']} "
              f"bars_returned={adv2['bar_indices_returned']}")
        # Verify monotonicity & contiguity
        expected_next = adv1["base_bar"] + 1
        ok = "OK" if adv2["base_bar"] == expected_next else \
             f"MISMATCH (expected base_bar={expected_next}, got {adv2['base_bar']})"
        print(f"     Expected contiguous base_bar for adv#2 = {expected_next}  [{ok}]")

        # Continue a few more reveals across normal weekday gaps
        current_time = adv2["new_current"]
        last_base = adv2["base_bar"] + (adv2["len_rows"] - 1)
        for step in range(3):
            adv = simulate_advance(conn, sym, tf, hidden_start, current_time, 1)
            if adv.get("empty"):
                break
            gap_label = adv["row_times"][0] - (last_base_time if step else adv2["row_times"][-1])
            print(f"  Advance #{step + 3} (count=1): row_times={adv['row_times']} "
                  f"base_bar={adv['base_bar']} delta={adv['delta']}")
            expected = last_base + 1
            ok = "OK" if adv["base_bar"] == expected else \
                 f"MISMATCH (expected {expected}, got {adv['base_bar']})"
            print(f"     expected base_bar={expected}  [{ok}]")
            last_base = adv["base_bar"]
            last_base_time = adv["row_times"][-1]
            current_time = adv["new_current"]

    # ============================================================
    # Scenario 3: End-of-data on NQ 1D — request count=5 with only 2 rows left
    # ============================================================
    print()
    print("=" * 78)
    print("SCENARIO 3: End-of-data NQ 1D — request count > remaining rows")
    print("=" * 78)
    sym, tf = "NQ", "1D"
    last3 = conn.execute(
        "SELECT time FROM candles WHERE symbol=? AND timeframe=? ORDER BY time DESC LIMIT 3",
        (sym, tf),
    ).fetchall()
    last3 = list(reversed([r["time"] for r in last3]))
    print(f"Last 3 NQ 1D times: {last3}")
    # set current_time = last3[0] + 1 so only the final 2 bars are returned
    # and request count=5 (more than available)
    # need a hidden_start with bars before — pick something well prior
    hidden_start = conn.execute(
        "SELECT time FROM candles WHERE symbol=? AND timeframe=? ORDER BY time DESC LIMIT 1 OFFSET 10",
        (sym, tf),
    ).fetchone()["time"]
    current_time = last3[0] + 1  # first row returned will be last3[1]
    adv = simulate_advance(conn, sym, tf, hidden_start, current_time, 5)
    print(f"hidden_start={hidden_start} current_time={current_time} (requested count=5)")
    print(f"  row_times={adv['row_times']} len_rows={adv['len_rows']}")
    print(f"  bars_at_start={adv['bars_at_start']} bars_at_new_current={adv['bars_at_new_current']}")
    print(f"  delta={adv['delta']} base_bar={adv['base_bar']} "
          f"bars_returned={adv['bar_indices_returned']} new_current={adv['new_current']}")
    # In this end-of-data case, len(rows) reflects ACTUAL truncation (2 not 5),
    # and bars_at_new_current uses rows[-1].time = last3[-1]. Expected:
    #   delta = 10 - (something)  — verify it equals row count from hidden_start to rows[-1]
    expected_delta = conn.execute(
        "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time>? AND time<=?",
        (sym, tf, hidden_start, adv["row_times"][-1]),
    ).fetchone()[0]
    print(f"  Manual count of bars in (hidden_start, last_row_time]: {expected_delta}")
    # base_bar should equal 199 + (delta - len_rows + 1) = first new bar's index
    # That first new bar is the (delta - len_rows + 1)th bar past hidden_start
    # i.e. if delta=10 and len_rows=2, base_bar = 10+199-1 = 208
    expected_base = adv["delta"] + 199 - (adv["len_rows"] - 1)
    print(f"  Recomputed base_bar from delta and len_rows: {expected_base} "
          f"(== {adv['base_bar']}?)")
    # Also verify the assertion: bars_returned should match "(199 + bar offset since hidden_start)"
    # For each row r at position i, bar index should be: 199 + (count of rows in
    # (hidden_start, r.time]).
    print("  Per-row verification:")
    for i, r_time in enumerate(adv["row_times"]):
        actual_idx_in_db = conn.execute(
            "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time>? AND time<=?",
            (sym, tf, hidden_start, r_time),
        ).fetchone()[0]
        expected_bar = 199 + actual_idx_in_db
        got_bar = adv["bar_indices_returned"][i]
        status = "OK" if got_bar == expected_bar else f"MISMATCH expected={expected_bar}"
        print(f"     row[{i}] time={r_time} expected_bar={expected_bar} got_bar={got_bar}  [{status}]")

    # ============================================================
    # Scenario 4: Self-heal branch in GET /sessions/{id} (lines 866-876)
    # ============================================================
    print()
    print("=" * 78)
    print("SCENARIO 4: Self-heal in GET — current_time + 86400 may land on WRONG bucket")
    print("=" * 78)
    sym, tf = "NQ", "1D"
    s = TF_SECONDS[tf]
    # Self-heal: if rows is empty at current_time, retry with current_time + s.
    # The danger: 1D bar spans aren't exact multiples of 86400. So if current_time
    # was stored as a bar.start, then current_time + 86400 may NOT equal the next
    # bucket's start. It might overshoot or undershoot.
    #
    # Demonstrate: pick a Friday-like bar with gap to next > 86400 to next.
    weekend = find_fri_to_mon_gap(conn, sym, tf)
    if weekend:
        fri_t, mon_t, gap = weekend
        print(f"Friday-like bar time={fri_t}, Monday-like next time={mon_t}, gap={gap}s")
        # Simulate stale session storing current_time = fri_t (old bar.start convention)
        old_ct = fri_t
        # Heal step adds 86400
        new_ct = old_ct + 86400
        # Compare: what bucket does new_ct fall within (using table)?
        # The resample looks for bucket containing new_ct.
        bucket_at_new_ct = conn.execute(
            "SELECT time FROM candles WHERE symbol=? AND timeframe=? AND time<=? "
            "ORDER BY time DESC LIMIT 1",
            (sym, tf, new_ct),
        ).fetchone()
        bucket_at_mon = mon_t
        print(f"  Stored current_time (old convention, = fri bucket time): {old_ct}")
        print(f"  Healed current_time = old + 86400 = {new_ct}")
        print(f"  Bar (time<=new_ct) is at time={bucket_at_new_ct['time'] if bucket_at_new_ct else None}")
        print(f"  Real next bucket (Mon) starts at time={mon_t} (which is {mon_t - new_ct}s after new_ct)")
        if bucket_at_new_ct and bucket_at_new_ct["time"] == fri_t and mon_t > new_ct:
            print(f"  >>> new_ct={new_ct} sits BETWEEN fri ({fri_t}) and mon ({mon_t}).")
            print(f"  >>> _resample_with_forming(new_ct) will return Fri as the 'last' bar "
                  f"which is WRONG by the new end-of-bar convention.")
            print(f"  >>> But the heal succeeds (rows not empty) so heal does NOT retry further.")
            print(f"  >>> Result: current_time becomes new_ct but the bar revealed is "
                  f"Fri's bar repeated, NOT the next (Mon) bar.")

        # Also check the typical weekday case where + 86400 might overshoot
        # Find an example with gap < 86400 (e.g. 86000s)
        sample = conn.execute(
            """SELECT a.time as t1, b.time as t2 FROM candles a JOIN candles b
               ON b.time > a.time AND b.symbol=a.symbol AND b.timeframe=a.timeframe
               WHERE a.symbol=? AND a.timeframe=? AND (b.time - a.time) BETWEEN 85000 AND 86000
               ORDER BY a.time LIMIT 3""",
            (sym, tf),
        ).fetchall()
        for s_row in sample:
            t1, t2 = s_row["t1"], s_row["t2"]
            print(f"\n  Weekday case: bar at {t1}, next bar at {t2} (gap={t2 - t1}s, < 86400)")
            new_ct = t1 + 86400
            bucket = conn.execute(
                "SELECT time FROM candles WHERE symbol=? AND timeframe=? AND time<=? "
                "ORDER BY time DESC LIMIT 1",
                (sym, tf, new_ct),
            ).fetchone()
            print(f"    old_ct={t1}, healed new_ct={new_ct}, bucket(time<=new_ct)={bucket['time']}")
            if bucket["time"] == t2:
                print(f"    OVERSHOOT: heal SKIPPED to next bar t2={t2} (overshoots t1 by 1 bar)")

    # ============================================================
    # Bonus: also exercise multiple weekend-spanning advances at NQ 1D
    # to detect cumulative drift
    # ============================================================
    print()
    print("=" * 78)
    print("BONUS: 10 consecutive 1D advances at count=1 to look for cumulative drift")
    print("=" * 78)
    # start at a known offset, walk 10 bars
    sym, tf = "NQ", "1D"
    s = TF_SECONDS[tf]
    rows_all = conn.execute(
        "SELECT time FROM candles WHERE symbol=? AND timeframe=? ORDER BY time LIMIT 30",
        (sym, tf),
    ).fetchall()
    hidden_start = rows_all[5]["time"]  # 6th bar
    current_time = hidden_start + 1
    expected_bar = 200
    for i in range(15):
        adv = simulate_advance(conn, sym, tf, hidden_start, current_time, 1)
        if adv.get("empty"):
            print(f"  step {i}: empty")
            break
        actual_idx_in_db = conn.execute(
            "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=? AND time>? AND time<=?",
            (sym, tf, hidden_start, adv["row_times"][0]),
        ).fetchone()[0]
        ground_truth_bar = 199 + actual_idx_in_db
        match = "OK" if adv["base_bar"] == ground_truth_bar else "DRIFT"
        print(f"  step {i}: t={adv['row_times'][0]} base_bar={adv['base_bar']} "
              f"truth={ground_truth_bar} [{match}]  new_ct={adv['new_current']}")
        current_time = adv["new_current"]

    conn.close()


if __name__ == "__main__":
    main()
