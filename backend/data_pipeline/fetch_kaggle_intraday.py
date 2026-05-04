"""
Ingests the Kaggle CC0 cleaned SPY & QQQ 1-minute dataset.
Dataset: https://www.kaggle.com/datasets/cesarecastro/cleaned-spy-and-qqq-1-minute-data
License: CC0 (public domain, fully redistributable).

Steps:
  1. Download the zip from Kaggle (free account required).
  2. Extract clean_SPY.csv and clean_QQQ.csv to backend/data_pipeline/raw/
  3. Run: python backend/data_pipeline/fetch_kaggle_intraday.py

Output: backend/data/intraday/{SYMBOL}.csv  (one file per symbol, all timeframes)

Resamples 1m → 5m, 15m, 30m, 1h, 4h automatically.
SPY is stored as ES; QQQ is stored as NQ (see symbol_map.KAGGLE_MAP).
"""
from pathlib import Path

import pandas as pd

from symbol_map import KAGGLE_MAP

RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent.parent / "data" / "intraday"

RESAMPLE_RULES = {
    "1m":  None,      # native resolution — no resample needed
    "5m":  "5min",
    "15m": "15min",
    "30m": "30min",
    "1h":  "1h",
    "4h":  "4h",
}


def process_file(csv_name: str, symbol: str) -> None:
    src = RAW_DIR / csv_name
    if not src.exists():
        print(f"  {src} not found — download from Kaggle first.")
        return

    print(f"  Loading {csv_name} → {symbol} ...")
    df = pd.read_csv(src, parse_dates=["datetime"], index_col="datetime")
    df.index = pd.DatetimeIndex(df.index).tz_localize("America/New_York").tz_convert("UTC")
    df.columns = [c.capitalize() for c in df.columns]
    df = df.sort_index()

    rows = []

    for tf_label, rule in RESAMPLE_RULES.items():
        if rule is None:
            resampled = df
        else:
            resampled = df.resample(rule).agg({
                "Open": "first", "High": "max",
                "Low": "min",    "Close": "last", "Volume": "sum",
            }).dropna()

        for ts, row in resampled.iterrows():
            rows.append({
                "timeframe": tf_label,
                "time": ts.isoformat(),
                "open":   float(row["Open"]),
                "high":   float(row["High"]),
                "low":    float(row["Low"]),
                "close":  float(row["Close"]),
                "volume": float(row.get("Volume", 0) or 0),
            })
        print(f"    {tf_label}: {len(resampled):,} bars")

    out = pd.DataFrame(rows)
    out_path = OUT_DIR / f"{symbol}.csv"
    out.to_csv(out_path, index=False)
    print(f"  Saved → {out_path}")


if __name__ == "__main__":
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Ingesting Kaggle intraday data → {OUT_DIR}\n")
    for csv_name, symbol in KAGGLE_MAP.items():
        process_file(csv_name, symbol)
    print("\nDone.")
