"""
Loads CSV files from backend/data/daily/ and backend/data/intraday/ into SQLite.
Run after fetch_stooq.py and fetch_kaggle_intraday.py have produced the CSVs.

Usage:
    cd backend
    python data_pipeline/data_ingest.py
"""
import sys
from pathlib import Path

import pandas as pd

# Allow importing db from parent directory
sys.path.insert(0, str(Path(__file__).parent.parent))
from db import get_conn, init_db

DAILY_DIR    = Path(__file__).parent.parent / "data" / "daily"
INTRADAY_DIR = Path(__file__).parent.parent / "data" / "intraday"


def ingest_csv(conn, csv_path: Path) -> int:
    df = pd.read_csv(csv_path)
    # time column is ISO string → convert to unix int
    df["time"] = pd.to_datetime(df["time"], utc=True).astype("int64") // 10**9
    symbol = csv_path.stem   # filename without extension = symbol
    records = [
        (symbol, row["timeframe"], int(row["time"]),
         float(row["open"]), float(row["high"]),
         float(row["low"]),  float(row["close"]),
         float(row.get("volume", 0) or 0))
        for _, row in df.iterrows()
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO candles (symbol, timeframe, time, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        records,
    )
    conn.commit()
    return len(records)


if __name__ == "__main__":
    init_db()
    conn = get_conn()

    total = 0
    for directory, label in [(DAILY_DIR, "daily"), (INTRADAY_DIR, "intraday")]:
        if not directory.exists():
            print(f"  {directory} not found — run fetch scripts first.")
            continue
        for csv_path in sorted(directory.glob("*.csv")):
            n = ingest_csv(conn, csv_path)
            print(f"  [{label}] {csv_path.name}: {n:,} rows inserted")
            total += n

    conn.close()
    print(f"\nTotal rows inserted: {total:,}")
