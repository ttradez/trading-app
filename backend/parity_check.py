"""
Cross-symbol parity check after _wire_time fixes.
"""
import sqlite3
import sys
from datetime import datetime, timezone

DB = r"C:/Users/benti/trading-app/backend/pocket_trade.db"
SYMBOLS = ["ES", "NQ", "YM", "GC"]
TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"]


def _wire_time(tf: str, t: int) -> int:
    if tf in ("1D", "1W"):
        return (t // 86400) * 86400
    return t


def fmt_ts(t):
    if t is None:
        return "None"
    return datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def section(s):
    print("\n" + "=" * 78)
    print(s)
    print("=" * 78)


def step1_counts_and_ranges():
    section("STEP 1: COUNT, MIN(time), MAX(time) for each (symbol, tf)")
    conn = sqlite3.connect(DB)
    print(f"{'TF':5}", end="")
    for s in SYMBOLS:
        print(f"{s:>12}", end="")
    print()
    # Show counts
    counts = {}
    ranges = {}
    for tf in TFS:
        print(f"{tf:5}", end="")
        for sym in SYMBOLS:
            row = conn.execute(
                "SELECT COUNT(*), MIN(time), MAX(time) FROM candles WHERE symbol=? AND timeframe=?",
                (sym, tf),
            ).fetchone()
            counts[(sym, tf)] = row[0]
            ranges[(sym, tf)] = (row[1], row[2])
            print(f"{row[0]:>12}", end="")
        print()
    print()
    # Show date ranges (min..max as date)
    print(f"{'TF':5}", end="")
    for s in SYMBOLS:
        print(f"{s:>26}", end="")
    print()
    for tf in TFS:
        print(f"{tf:5}", end="")
        for sym in SYMBOLS:
            mn, mx = ranges[(sym, tf)]
            print(f"  {fmt_ts(mn)[:10]}..{fmt_ts(mx)[:10]}", end="")
        print()
    conn.close()
    # Now check parity: at each TF, all four symbols within a few percent
    print("\nParity (max-min row count, percent spread):")
    bad = []
    for tf in TFS:
        cs = [counts[(s, tf)] for s in SYMBOLS]
        mn, mx = min(cs), max(cs)
        spread = (mx - mn) / mx * 100 if mx else 0.0
        marker = ""
        if spread > 5:
            marker = "  <-- SPREAD > 5%"
            bad.append((tf, spread))
        print(f"  {tf:5} min={mn:>8} max={mx:>8} spread={spread:6.2f}%{marker}")
    return counts, ranges, bad


def step2_1d_distinct_dates():
    section("STEP 2: 1D distinct calendar dates vs row count (wire-snap behavior)")
    conn = sqlite3.connect(DB)
    print(f"{'SYM':5} {'rows':>8} {'distinct_raw_t':>16} {'distinct_wire_t':>17} {'distinct_dates':>16} {'dupes_after_snap':>18}")
    for sym in SYMBOLS:
        rows = conn.execute(
            "SELECT time FROM candles WHERE symbol=? AND timeframe='1D' ORDER BY time ASC",
            (sym,),
        ).fetchall()
        raw_times = [r[0] for r in rows]
        wire_times = [_wire_time("1D", t) for t in raw_times]
        distinct_raw = len(set(raw_times))
        distinct_wire = len(set(wire_times))
        distinct_dates = len({datetime.fromtimestamp(t, tz=timezone.utc).date() for t in raw_times})
        dupes = len(wire_times) - distinct_wire
        print(f"{sym:5} {len(rows):>8} {distinct_raw:>16} {distinct_wire:>17} {distinct_dates:>16} {dupes:>18}")
        # Sanity: distinct_wire should equal distinct_dates (each calendar UTC date -> one wire time)
        assert distinct_wire == distinct_dates, f"{sym}: distinct_wire ({distinct_wire}) != distinct_dates ({distinct_dates})"
    conn.close()


def step3_ordering_preserved():
    section("STEP 3: ordering preservation after _wire_time snap")
    conn = sqlite3.connect(DB)
    failures = []
    for sym in SYMBOLS:
        for tf in TFS:
            rows = conn.execute(
                "SELECT time FROM candles WHERE symbol=? AND timeframe=? ORDER BY time ASC",
                (sym, tf),
            ).fetchall()
            raw_times = [r[0] for r in rows]
            wire_times = [_wire_time(tf, t) for t in raw_times]
            # Check: wire_times should be non-decreasing
            non_decreasing = all(wire_times[i] <= wire_times[i + 1] for i in range(len(wire_times) - 1))
            # Count adjacent ties (only allowed for 1D/1W where collapse can happen)
            adj_ties = sum(1 for i in range(len(wire_times) - 1) if wire_times[i] == wire_times[i + 1])
            status = "OK" if non_decreasing else "BROKEN"
            if not non_decreasing:
                failures.append((sym, tf))
            print(f"  {sym:4} {tf:4} non-decreasing={non_decreasing} adj_ties={adj_ties} status={status}")
    conn.close()
    return failures


def step4_bar_index_advance_simulation():
    section("STEP 4: simulated /advance bar index integrity (1D)")
    # Simulate the actual /advance bar increment logic:
    #   base_bar = (bars_at_new_current - bars_at_start) + 199 - (len(rows) - 1)
    # We're checking that advancing one bucket at a time produces strictly
    # incrementing bar indices, even when adjacent rows share the same wire time.
    conn = sqlite3.connect(DB)
    for sym in SYMBOLS:
        rows_db = conn.execute(
            "SELECT time, open, high, low, close FROM candles WHERE symbol=? AND timeframe='1D' ORDER BY time ASC",
            (sym,),
        ).fetchall()
        # Pick a slice in the middle: start at index 100, advance through next 100 bars
        # Each /advance reveals exactly one new bar (assuming we move one bucket at a time)
        # In real code base_bar comes from a counter that increments per bar, NOT from the time.
        # So the wire-time snap can cause two adjacent bars to share a wire time, but their
        # bar indices remain strictly increasing.
        start_idx = 100
        n_advances = 50
        bar_indices = []
        wire_times_emitted = []
        for adv in range(n_advances):
            cur_idx = start_idx + adv
            if cur_idx >= len(rows_db):
                break
            # bars_at_new_current - bars_at_start = adv + 1 (we've advanced adv+1 buckets)
            # In real code, the rows returned are the new bars revealed since last advance.
            # For one-bucket advance, exactly 1 new row, so len(rows) - 1 == 0.
            # base_bar = adv + 1 + 199 - 0 = 200 + adv  (one bar per advance, monotonic)
            len_rows = 1
            bars_at_new_current = adv + 1
            bars_at_start = 0
            base_bar = (bars_at_new_current - bars_at_start) + 199 - (len_rows - 1)
            t = rows_db[cur_idx][0]
            bar_indices.append(base_bar)
            wire_times_emitted.append(_wire_time("1D", t))
        # Verify bar indices are strictly increasing
        strictly_inc = all(bar_indices[i] < bar_indices[i + 1] for i in range(len(bar_indices) - 1))
        # Count wire-time ties in advance window
        wt_ties = sum(1 for i in range(len(wire_times_emitted) - 1) if wire_times_emitted[i] == wire_times_emitted[i + 1])
        print(f"  {sym:4} n_advances={len(bar_indices)} bar_strictly_increasing={strictly_inc} wire_time_ties_in_window={wt_ties}")
        print(f"        first 5 bar indices: {bar_indices[:5]}")
        print(f"        last  5 bar indices: {bar_indices[-5:]}")
        # Print any tie examples
        if wt_ties:
            for i in range(len(wire_times_emitted) - 1):
                if wire_times_emitted[i] == wire_times_emitted[i + 1]:
                    print(f"        TIE at adv {i}: bar={bar_indices[i]} t_raw={rows_db[start_idx+i][0]} -> wire={wire_times_emitted[i]} (next bar={bar_indices[i+1]})")
                    break  # just show first one
    conn.close()


def show_duplicate_examples():
    section("EXTRA: actual duplicate calendar-date examples per symbol on 1D")
    conn = sqlite3.connect(DB)
    for sym in SYMBOLS:
        rows = conn.execute(
            "SELECT time FROM candles WHERE symbol=? AND timeframe='1D' ORDER BY time ASC",
            (sym,),
        ).fetchall()
        raw_times = [r[0] for r in rows]
        from collections import defaultdict
        groups = defaultdict(list)
        for t in raw_times:
            groups[_wire_time("1D", t)].append(t)
        dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
        print(f"\n{sym}: {len(dup_groups)} duplicate wire-time groups (out of {len(groups)} total)")
        for k in list(dup_groups.keys())[:3]:
            print(f"   wire_t={k} ({fmt_ts(k)[:10]}) -> raw times: {[fmt_ts(t) for t in dup_groups[k]]}")
    conn.close()


if __name__ == "__main__":
    counts, ranges, bad = step1_counts_and_ranges()
    step2_1d_distinct_dates()
    failures = step3_ordering_preserved()
    step4_bar_index_advance_simulation()
    show_duplicate_examples()
    section("SUMMARY")
    print(f"Step 1 row-count parity issues (>5% spread): {bad}")
    print(f"Step 3 ordering failures: {failures}")
