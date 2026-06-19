"""
Downloads daily OHLCV for indexes and futures via yfinance (free, no API key).
Resamples to weekly automatically.

Note: yfinance data is for internal/educational use only — not for redistribution.
This script is run once on your Railway server at deploy time.

Output: backend/data/daily/{SYMBOL}.csv

Run: python backend/data_pipeline/fetch_stooq.py
Requires: pip install pandas yfinance
"""
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

from symbol_map import STOOQ_MAP

OUT_DIR = Path(__file__).parent.parent / "data" / "daily"
START = "2010-01-01"
END   = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# yfinance ticker -> our internal symbol
# Overrides entries in STOOQ_MAP that use Stooq-specific symbols
YF_OVERRIDE = {
    "ES.F":  ("ES=F",  "ES"),
    "NQ.F":  ("NQ=F",  "NQ"),
}


def fetch_symbol(stooq_sym: str, our_sym: str) -> bool:
    yf_ticker, _ = YF_OVERRIDE[stooq_sym]
    print(f"  {yf_ticker} -> {our_sym} ...", end=" ", flush=True)
    try:
        df = yf.download(yf_ticker, start=START, end=END, progress=False, auto_adjust=True)
    except Exception as e:
        print(f"FAILED: {e}")
        return False

    if df.empty:
        print("FAILED: empty response")
        return False

    # yfinance returns MultiIndex columns when auto_adjust=True; flatten if needed
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.rename(columns={"Open": "Open", "High": "High", "Low": "Low",
                              "Close": "Close", "Volume": "Volume"})
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    df.index.name = "time"

    rows = []
    for ts, row in df.iterrows():
        rows.append({
            "timeframe": "1D",
            "time": ts.isoformat(),
            "open":   round(float(row["Open"]),  6),
            "high":   round(float(row["High"]),  6),
            "low":    round(float(row["Low"]),   6),
            "close":  round(float(row["Close"]), 6),
            "volume": float(row.get("Volume", 0) or 0),
        })

    weekly = df.resample("W").agg({
        "Open": "first", "High": "max",
        "Low":  "min",   "Close": "last", "Volume": "sum",
    }).dropna()
    for ts, row in weekly.iterrows():
        rows.append({
            "timeframe": "1W",
            "time": ts.isoformat(),
            "open":   round(float(row["Open"]),  6),
            "high":   round(float(row["High"]),  6),
            "low":    round(float(row["Low"]),   6),
            "close":  round(float(row["Close"]), 6),
            "volume": float(row.get("Volume", 0) or 0),
        })

    out = pd.DataFrame(rows)
    out_path = OUT_DIR / f"{our_sym}.csv"
    out.to_csv(out_path, index=False)

    daily  = (out["timeframe"] == "1D").sum()
    weekly_count = (out["timeframe"] == "1W").sum()
    print(f"{daily:,} daily | {weekly_count:,} weekly -> {out_path.name}")
    return True


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Fetching market data via yfinance -> {OUT_DIR}\n")
    failed = []
    for stooq_sym, our_sym in STOOQ_MAP.items():
        ok = fetch_symbol(stooq_sym, our_sym)
        if not ok:
            failed.append(our_sym)
        time.sleep(0.5)

    print()
    if failed:
        print(f"FAILED: {failed}")
    else:
        print("All symbols fetched successfully.")
