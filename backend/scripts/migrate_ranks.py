#!/usr/bin/env python3
"""
backend/scripts/migrate_ranks.py

One-time migration: rewrite every `accounts.rank` so it matches the NEW
6-rank ladder (`Paper I` … `Funded`). Reads each account's `users.xp` and
sets `accounts.rank = _rank_from_xp(xp)["level_name"]`. Reuses the live
function from `main.py` — no hardcoded ladder values here, so this script
stays correct if the ladder gets re-tuned later.

Idempotent. Safe to re-run. Prints before/after distributions.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

# Make backend/ importable so we can reuse the canonical _rank_from_xp.
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))

from main import _rank_from_xp  # noqa: E402  (sys.path tweak above)


def print_distribution(label: str, conn: sqlite3.Connection) -> None:
    print(f"\n-- {label} --")
    rows = conn.execute(
        "SELECT rank, COUNT(*) FROM accounts GROUP BY rank ORDER BY 2 DESC"
    ).fetchall()
    if not rows:
        print("  (no rows)")
        return
    print("  rank                              | count")
    for rank, n in rows:
        print(f"  {repr(rank):<33s} | {n}")


def main() -> None:
    db_path = BACKEND / "pocket_trade.db"
    print(f"DB: {db_path}")
    if not db_path.exists():
        sys.exit(f"DB not found at {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    print_distribution("BEFORE", conn)

    # Pull every account + their user XP in one go. LEFT JOIN so accounts
    # without a matching users row still get migrated (xp defaults to 0,
    # which maps to the starter rank).
    rows = conn.execute(
        """
        SELECT a.uid, COALESCE(u.xp, 0) AS xp, a.rank AS old_rank
        FROM accounts a
        LEFT JOIN users u ON u.uid = a.uid
        """
    ).fetchall()

    updated = unchanged = 0
    samples: list[tuple[str, int, str, str]] = []
    for row in rows:
        uid       = row["uid"]
        xp        = int(row["xp"] or 0)
        old_rank  = row["old_rank"]
        new_rank  = _rank_from_xp(xp)["level_name"]
        if old_rank == new_rank:
            unchanged += 1
            continue
        conn.execute(
            "UPDATE accounts SET rank = ? WHERE uid = ?",
            (new_rank, uid),
        )
        updated += 1
        if len(samples) < 10:
            samples.append((uid, xp, old_rank, new_rank))

    conn.commit()

    print(f"\nProcessed {len(rows)} accounts: updated={updated}, unchanged={unchanged}")
    if samples:
        print("\n  sample updates:")
        print("  uid                              | xp     | old_rank             | new_rank")
        for uid, xp, old_rank, new_rank in samples:
            print(f"  {uid:<32s} | {xp:>6} | {repr(old_rank):<20s} | {repr(new_rank)}")

    print_distribution("AFTER", conn)

    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
