"""
dedupe_daily_dupes.py — one-shot cleanup of duplicate 1D/1W rows in
the candles table.

Background: the candles ingest currently stores TWO rows per calendar
date for ~15.5% of 1D dates (one at ~00:00:00 UTC, one at ~23:53:20
UTC) — a CME-session vs UTC-calendar alignment artifact. The hosted
chart bundle (lightweight-charts) keys daily bars by UTC calendar
date, so duplicate-date rows collapse to one and the second silently
overwrites the first — producing the "candles disappear after being
scrolled past" symptom on the daily TF.

The companion `_wire_time` helper in main.py snaps emitted bar times
to UTC midnight, which makes the duplicate-row collision visible to
the chart at the SAME wire timestamp. lightweight-charts still
overwrites. This script is what actually resolves the symptom — it
deletes the older row per (symbol, timeframe, calendar_day) group
from the DB so only one bar per calendar date is stored AND emitted.

We keep MAX(time) per group because that's typically the
CME-aligned session close (~23:53 UTC), which is what traders mean
when they say "the day's close".

Idempotent — safe to re-run after a future re-ingest reintroduces
duplicates.

Run from backend/:
    python data_pipeline/dedupe_daily_dupes.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).parent
BACKEND_DIR = HERE.parent
sys.path.insert(0, str(BACKEND_DIR))

from db import get_conn

DAILY_TFS = ("1D", "1W")
BUCKET = 86400  # seconds in a UTC calendar day


def _audit(conn, label: str) -> int:
    """Print per-(symbol, tf) row + distinct-date count. Returns total dupes."""
    placeholders = ",".join("?" * len(DAILY_TFS))
    rows = conn.execute(
        f"""
        SELECT symbol, timeframe,
               COUNT(*) AS n,
               COUNT(DISTINCT time / {BUCKET}) AS n_distinct_dates,
               COUNT(*) - COUNT(DISTINCT time / {BUCKET}) AS n_dupes
        FROM candles
        WHERE timeframe IN ({placeholders})
        GROUP BY symbol, timeframe
        ORDER BY symbol, timeframe
        """,
        DAILY_TFS,
    ).fetchall()

    print(f"\n{label}")
    print("=" * 76)
    print(f"  {'sym':<6}{'tf':<5}{'rows':>8}{'distinct_dates':>18}{'dupes':>10}")
    print("-" * 76)
    total = 0
    for r in rows:
        sym, tf, n, n_dist, n_dup = r["symbol"], r["timeframe"], r["n"], r["n_distinct_dates"], r["n_dupes"]
        marker = "" if n_dup == 0 else "   <<< has dupes"
        print(f"  {sym:<6}{tf:<5}{n:>8,}{n_dist:>18,}{n_dup:>10,}{marker}")
        total += n_dup
    print("-" * 76)
    print(f"  TOTAL DUPES: {total:,}")
    return total


def main() -> None:
    conn = get_conn()

    total_before = _audit(conn, "BEFORE cleanup:")
    if total_before == 0:
        print("\nNothing to do — DB already has at most 1 row per calendar day.")
        conn.close()
        return

    # Delete duplicates. Keep one row per (symbol, timeframe, calendar_day)
    # group — the one with MAX(time). Window functions require SQLite 3.25+,
    # which has shipped with Python since 3.7 — safe on the user's Python 3.13.
    placeholders = ",".join("?" * len(DAILY_TFS))
    print("\nDeleting duplicates...")
    cur = conn.execute(
        f"""
        DELETE FROM candles
        WHERE timeframe IN ({placeholders})
          AND rowid NOT IN (
              SELECT keep_rowid FROM (
                  SELECT rowid AS keep_rowid,
                         ROW_NUMBER() OVER (
                             PARTITION BY symbol, timeframe, time / {BUCKET}
                             ORDER BY time DESC
                         ) AS rn
                  FROM candles
                  WHERE timeframe IN ({placeholders})
              )
              WHERE rn = 1
          )
        """,
        DAILY_TFS + DAILY_TFS,
    )
    n_deleted = cur.rowcount
    conn.commit()
    print(f"Deleted {n_deleted:,} duplicate rows.")

    total_after = _audit(conn, "AFTER cleanup:")
    if total_after == 0:
        print("\nAll (symbol, tf) groups now have exactly 1 row per calendar date.")
        print("Chart-host overwrite collisions are resolved.")
    else:
        print(f"\nWARNING: {total_after} dupes remain after cleanup — investigate.")

    conn.close()


if __name__ == "__main__":
    main()
