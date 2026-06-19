"""
rebuild_1d_from_intraday.py — rebuild clean 1D bars from real
Databento 1m intraday data for ES/NQ/YM/GC.

Background: the 1D bars in the DB came from the Stooq pipeline, which
is missing ~35% of trading days (e.g. 7 of 20 in Feb 2025 for GC).
But for ES/NQ/YM/GC the 1m intraday data is from Databento and has
full coverage — 1,300+ bars per trading day. This script rebuilds
the 1D bars in the intraday window by aggregating those 1m bars
in-memory (one streaming pass per symbol — much faster than the
SQL-correlated-subquery approach the first version used).

Aggregation rule (per UTC calendar date with at least 1 1m bar):
    open   = first 1m bar's open
    high   = max(high) across the day
    low    = min(low)  across the day
    close  = last 1m bar's close
    volume = sum(volume)
    time   = UTC midnight of that date (matches what _wire_time emits)

Scope:
    Symbols:  ES, NQ, YM, GC  (the four with real Databento 1m data)
    Window:   the intraday range available per symbol
    Other:    1D bars OUTSIDE the intraday window are NOT touched
    Other:    other symbols' 1D bars are NOT touched

Idempotent: re-run after future intraday re-ingest to refresh 1D.

Run from backend/:
    python data_pipeline/rebuild_1d_from_intraday.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).parent
BACKEND_DIR = HERE.parent
sys.path.insert(0, str(BACKEND_DIR))

from db import get_conn

SYMBOLS = ("ES", "NQ", "YM", "GC")
BUCKET = 86400


def main() -> None:
    conn = get_conn()
    cur = conn.cursor()

    for sym in SYMBOLS:
        print(f"\n=== {sym} ===", flush=True)
        # Find the intraday (1m) window for this symbol.
        row = cur.execute(
            "SELECT MIN(time) AS mn, MAX(time) AS mx, COUNT(*) AS n FROM candles WHERE symbol=? AND timeframe='1m'",
            (sym,),
        ).fetchone()
        if not row or row["n"] == 0:
            print(f"  No 1m data — skipping.", flush=True)
            continue
        win_start, win_end = row["mn"], row["mx"]
        print(f"  Intraday window: {win_start} -> {win_end}  ({row['n']:,} 1m bars)", flush=True)

        before = cur.execute(
            "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe='1D' AND time>=? AND time<=?",
            (sym, win_start, win_end),
        ).fetchone()[0]
        print(f"  Existing 1D bars in window: {before:,}", flush=True)

        # Stream the 1m rows in ASC time order and aggregate in Python.
        # One pass over the ~1.75M rows per symbol — much faster than
        # the SQL correlated-subquery approach (which was per-day).
        print(f"  Aggregating 1m -> 1D in-memory...", flush=True)
        agg: dict = {}  # day_start -> dict(open, high, low, close, volume)
        cursor = cur.execute(
            """
            SELECT time, open, high, low, close, volume
            FROM candles
            WHERE symbol = ? AND timeframe = '1m'
            ORDER BY time ASC
            """,
            (sym,),
        )
        n_seen = 0
        for r in cursor:
            t, o, h, l, c, v = r["time"], r["open"], r["high"], r["low"], r["close"], (r["volume"] or 0)
            day = (t // BUCKET) * BUCKET
            bucket = agg.get(day)
            if bucket is None:
                agg[day] = {"open": o, "high": h, "low": l, "close": c, "volume": v}
            else:
                if h > bucket["high"]: bucket["high"] = h
                if l < bucket["low"]:  bucket["low"]  = l
                bucket["close"]   = c   # rows are ASC, so last write wins -> day close
                bucket["volume"] += v
            n_seen += 1
        print(f"  Aggregated {n_seen:,} 1m bars into {len(agg):,} 1D bars", flush=True)

        # Delete the old 1D bars in the intraday window. Outside-window 1D
        # bars (Stooq, pre-2020-04 and post-2025-03) stay untouched —
        # they're the only data we have for those dates.
        n_deleted = cur.execute(
            "DELETE FROM candles WHERE symbol=? AND timeframe='1D' AND time>=? AND time<=?",
            (sym, win_start, win_end),
        ).rowcount
        print(f"  Deleted {n_deleted:,} old 1D bars in window.", flush=True)

        # Bulk insert the rebuilt 1D bars.
        cur.executemany(
            """
            INSERT INTO candles (symbol, timeframe, time, open, high, low, close, volume)
            VALUES (?, '1D', ?, ?, ?, ?, ?, ?)
            """,
            [
                (sym, day, b["open"], b["high"], b["low"], b["close"], b["volume"])
                for day, b in sorted(agg.items())
            ],
        )
        conn.commit()

        after = cur.execute(
            "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe='1D' AND time>=? AND time<=?",
            (sym, win_start, win_end),
        ).fetchone()[0]
        print(f"  Inserted {after:,} clean 1D bars  (delta vs before: +{after - before:,})", flush=True)

    # Final summary across all 4 symbols.
    print("\n=== Final 1D counts ===", flush=True)
    for sym in SYMBOLS:
        n = cur.execute(
            "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe='1D'", (sym,),
        ).fetchone()[0]
        n_dist = cur.execute(
            f"SELECT COUNT(DISTINCT time/{BUCKET}) FROM candles WHERE symbol=? AND timeframe='1D'", (sym,),
        ).fetchone()[0]
        print(f"  {sym}: {n:,} 1D rows, {n_dist:,} distinct dates  (dupes: {n - n_dist})", flush=True)

    conn.close()


if __name__ == "__main__":
    main()
