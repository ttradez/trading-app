"""
slim_db_for_prod.py — produce a slimmed copy of pocket_trade.db that
ships only the 4 active futures symbols (ES, NQ, YM, GC) plus their
related session/trade/user data.

The dev DB carries 14 symbols' candles (the original Pocket Trade
catalog + the unused OTHER_SYMBOLS), ballooning to ~12 GB. Production
only serves ES/NQ/YM/GC, so the unused symbols can be dropped before
uploading to the Railway volume — typical shrink is 12 GB -> 2-3 GB.

Output: backend/pocket_trade_slim.db (does NOT touch the source DB).

Run from backend/:
    python data_pipeline/slim_db_for_prod.py
"""

import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
BACKEND_DIR = HERE.parent
sys.path.insert(0, str(BACKEND_DIR))

from db import DB_PATH  # noqa: E402

KEEP_SYMBOLS = ("ES", "NQ", "YM", "GC")
OUTPUT_PATH = BACKEND_DIR / "pocket_trade_slim.db"


def main() -> None:
    src = Path(DB_PATH)
    if not src.exists():
        sys.exit(f"ERROR: source DB not found at {src}")

    print(f"Source:      {src}  ({src.stat().st_size / 1_000_000_000:.2f} GB)")
    print(f"Destination: {OUTPUT_PATH}")
    print(f"Keep symbols: {KEEP_SYMBOLS}")
    print()

    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()
    print("Copying source -> destination (full file)...")
    shutil.copy2(src, OUTPUT_PATH)
    print(f"  Copied {OUTPUT_PATH.stat().st_size / 1_000_000_000:.2f} GB")

    import sqlite3
    conn = sqlite3.connect(str(OUTPUT_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    print()
    print("Before:")
    rows = conn.execute(
        "SELECT symbol, COUNT(*) AS n FROM candles GROUP BY symbol ORDER BY symbol"
    ).fetchall()
    for r in rows:
        keep = r["symbol"] in KEEP_SYMBOLS
        marker = "KEEP" if keep else "DROP"
        print(f"  {r['symbol']:>5}: {r['n']:>12,}  [{marker}]")

    placeholders = ",".join("?" * len(KEEP_SYMBOLS))
    print()
    print("Deleting candles for non-active symbols...")
    n_deleted = conn.execute(
        f"DELETE FROM candles WHERE symbol NOT IN ({placeholders})",
        KEEP_SYMBOLS,
    ).rowcount
    conn.commit()
    print(f"  Deleted {n_deleted:,} candle rows")

    print()
    print("Reclaiming free space via VACUUM (this can take a couple minutes)...")
    conn.execute("VACUUM")
    conn.commit()
    conn.close()

    print(f"  Done. Final size: {OUTPUT_PATH.stat().st_size / 1_000_000_000:.2f} GB")
    print()
    print("After:")
    conn = sqlite3.connect(str(OUTPUT_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT symbol, COUNT(*) AS n FROM candles GROUP BY symbol ORDER BY symbol"
    ).fetchall()
    for r in rows:
        print(f"  {r['symbol']:>5}: {r['n']:>12,}")
    conn.close()

    print()
    print("Upload this file to Railway via the steps in backend/DEPLOY_RAILWAY.md.")
    print("Do NOT commit it to git — gitignore covers backend/*.db.")


if __name__ == "__main__":
    main()
