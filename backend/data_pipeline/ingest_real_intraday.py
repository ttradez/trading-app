"""
Ingest real Databento 1m OHLCV for ES and NQ into the `candles` table,
replacing the synthetic intraday rows for these two symbols only.

Source CSVs (already downloaded, must exist):
    backend/data_pipeline/raw/ES_databento_1m.csv
    backend/data_pipeline/raw/NQ_databento_1m.csv

Behavior:
  - For each symbol (ES, NQ):
      * Delete all rows in `candles` for that symbol where timeframe NOT IN
        ('1D','1W')  (i.e. wipe 1m/5m/15m/30m/1h/4h intraday).
      * Insert real 1m bars from the CSV (ts in unix seconds UTC at bar start).
      * Resample 1m -> 5m/15m/30m/1h/4h on UTC-second boundaries and insert.
  - Daily (1D) and weekly (1W) rows for ES/NQ are preserved.
  - All other symbols (CL, GC, SI, NG, ZB, DAX, FTSE, N225, SPX, NDX, DJI, YM)
    are untouched.
  - Idempotent: re-running produces identical final state.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

# Make sibling `db` module importable when run as a script.
HERE = Path(__file__).resolve().parent
BACKEND_DIR = HERE.parent
sys.path.insert(0, str(BACKEND_DIR))

from db import get_conn  # noqa: E402  (after sys.path tweak)


RAW_DIR = HERE / "raw"
SOURCES = [
    ("ES", RAW_DIR / "ES_databento_1m.csv"),
    ("NQ", RAW_DIR / "NQ_databento_1m.csv"),
    ("YM", RAW_DIR / "YM_databento_1m.csv"),
    ("GC", RAW_DIR / "GC_databento_1m.csv"),
]

# Higher TFs to resample from the 1m base, in seconds.
HIGHER_TFS = [
    ("5m", 5 * 60),
    ("15m", 15 * 60),
    ("30m", 30 * 60),
    ("1h", 60 * 60),
    ("4h", 4 * 60 * 60),
]

INTRADAY_TFS = ("1m", "5m", "15m", "30m", "1h", "4h")

# Untouched-symbols sanity check (these must not move).
OTHER_SYMBOLS = ("CL", "SI", "NG", "ZB", "DAX", "FTSE", "N225",
                 "SPX", "NDX", "DJI")


def _load_1m_csv(symbol: str, path: Path) -> pd.DataFrame:
    """Load a Databento ohlcv-1m CSV and return a normalized DataFrame with
    columns: time(int, unix seconds UTC), open, high, low, close, volume.
    """
    df = pd.read_csv(path)
    if "ts_event" not in df.columns:
        raise RuntimeError(
            f"{path.name}: expected 'ts_event' column, got {list(df.columns)}"
        )
    needed = ["open", "high", "low", "close", "volume"]
    for col in needed:
        if col not in df.columns:
            raise RuntimeError(f"{path.name}: missing '{col}' column")

    # NOTE: pandas 2.x infers a sub-ns resolution dtype (often datetime64[us])
    # when parsing ISO strings, so dividing astype('int64') by 1e9 silently
    # loses precision (microseconds / 1e9 truncates to a tiny integer). Force
    # nanosecond resolution before integer conversion, then divide.
    ts = pd.to_datetime(df["ts_event"], utc=True)
    ts_ns = ts.astype("datetime64[ns, UTC]")
    time_unix = (ts_ns.astype("int64") // 1_000_000_000).astype("int64")

    out = pd.DataFrame({
        "time": time_unix,
        "open": df["open"].astype(float),
        "high": df["high"].astype(float),
        "low": df["low"].astype(float),
        "close": df["close"].astype(float),
        "volume": df["volume"].astype(float),
    })

    # Drop duplicate timestamps if any (keep first), sort ascending.
    out = out.drop_duplicates(subset=["time"], keep="first")
    out = out.sort_values("time", kind="mergesort").reset_index(drop=True)
    print(
        f"  loaded {len(out):,} 1m bars   "
        f"first={int(out.time.iloc[0])}  last={int(out.time.iloc[-1])}"
    )
    return out


def _resample(df_1m: pd.DataFrame, tf_seconds: int) -> pd.DataFrame:
    """Resample 1m bars to a higher TF on UTC-second boundaries divisible by
    tf_seconds. Aggregation: open=first, high=max, low=min, close=last,
    volume=sum. Empty buckets are skipped (never fabricated)."""
    bucket = (df_1m["time"] // tf_seconds) * tf_seconds
    grouped = df_1m.groupby(bucket, sort=True)
    agg = pd.DataFrame({
        "open":   grouped["open"].first(),
        "high":   grouped["high"].max(),
        "low":    grouped["low"].min(),
        "close":  grouped["close"].last(),
        "volume": grouped["volume"].sum(),
    })
    agg = agg.reset_index().rename(columns={"time": "time"})
    return agg


def _snapshot_counts(cur, symbols, timeframes=None) -> dict:
    """Return dict[(symbol, timeframe)] -> count for the given symbols.
    If timeframes is None, return for all timeframes present.
    """
    placeholders = ",".join("?" * len(symbols))
    sql = (
        f"SELECT symbol, timeframe, COUNT(*) FROM candles "
        f"WHERE symbol IN ({placeholders}) "
        f"GROUP BY symbol, timeframe"
    )
    out = {}
    for sym, tf, n in cur.execute(sql, symbols).fetchall():
        if timeframes is None or tf in timeframes:
            out[(sym, tf)] = n
    return out


def main() -> None:
    # Sanity: source files present.
    for sym, path in SOURCES:
        if not path.exists():
            raise FileNotFoundError(f"Missing source CSV for {sym}: {path}")

    conn = get_conn()
    try:
        cur = conn.cursor()

        # ── Pre-script snapshots for sanity checks ──────────────────────────
        pre_other = _snapshot_counts(cur, OTHER_SYMBOLS)
        pre_es_nq_dw = _snapshot_counts(
            cur, ("ES", "NQ"), timeframes=("1D", "1W")
        )
        print("Pre-script snapshots captured:")
        print(f"  other-symbol rows tracked: {len(pre_other)} (symbol,tf) keys")
        print(f"  ES/NQ daily+weekly rows tracked: {pre_es_nq_dw}")

        # ── Process ES then NQ in one transaction each ──────────────────────
        for symbol, csv_path in SOURCES:
            print(f"\n=== {symbol} ===")
            df_1m = _load_1m_csv(symbol, csv_path)

            # Build all rows: 1m + resampled higher TFs.
            tf_rows: dict[str, list[tuple]] = {}
            tf_rows["1m"] = list(zip(
                [symbol] * len(df_1m),
                ["1m"] * len(df_1m),
                df_1m["time"].astype(int).tolist(),
                df_1m["open"].tolist(),
                df_1m["high"].tolist(),
                df_1m["low"].tolist(),
                df_1m["close"].tolist(),
                df_1m["volume"].tolist(),
            ))
            for tf, tf_secs in HIGHER_TFS:
                resampled = _resample(df_1m, tf_secs)
                tf_rows[tf] = list(zip(
                    [symbol] * len(resampled),
                    [tf] * len(resampled),
                    resampled["time"].astype(int).tolist(),
                    resampled["open"].tolist(),
                    resampled["high"].tolist(),
                    resampled["low"].tolist(),
                    resampled["close"].tolist(),
                    resampled["volume"].tolist(),
                ))

            # Single transaction for this symbol.
            cur.execute("BEGIN")
            try:
                del_cur = cur.execute(
                    "DELETE FROM candles "
                    "WHERE symbol = ? "
                    "AND timeframe NOT IN ('1D','1W')",
                    (symbol,),
                )
                deleted = del_cur.rowcount
                inserted_summary = {}
                for tf in INTRADAY_TFS:
                    rows = tf_rows.get(tf, [])
                    if not rows:
                        inserted_summary[tf] = 0
                        continue
                    cur.executemany(
                        "INSERT INTO candles "
                        "(symbol, timeframe, time, open, high, low, close, volume) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        rows,
                    )
                    inserted_summary[tf] = len(rows)
                conn.commit()
            except Exception:
                conn.rollback()
                raise

            print(f"  deleted intraday rows: {deleted:,}")
            for tf in INTRADAY_TFS:
                print(f"  inserted {tf:>3}: {inserted_summary[tf]:>10,}")

        # ── Post-script sanity checks ───────────────────────────────────────
        post_other = _snapshot_counts(cur, OTHER_SYMBOLS)
        post_es_nq_dw = _snapshot_counts(
            cur, ("ES", "NQ"), timeframes=("1D", "1W")
        )

        if post_other != pre_other:
            diffs = []
            keys = set(pre_other) | set(post_other)
            for k in sorted(keys):
                if pre_other.get(k) != post_other.get(k):
                    diffs.append((k, pre_other.get(k), post_other.get(k)))
            raise RuntimeError(
                f"Untouched-symbol counts changed: {diffs}"
            )
        if post_es_nq_dw != pre_es_nq_dw:
            raise RuntimeError(
                "ES/NQ daily/weekly counts changed: "
                f"pre={pre_es_nq_dw} post={post_es_nq_dw}"
            )
        print("\nSanity checks passed:")
        print("  - CL/GC/SI/NG/ZB/DAX/FTSE/N225/SPX/NDX/DJI/YM rows unchanged")
        print("  - ES/NQ 1D/1W rows unchanged")

        # Final ES/NQ counts per TF.
        print("\nFinal ES/NQ counts per timeframe:")
        sql = (
            "SELECT symbol, timeframe, COUNT(*) FROM candles "
            "WHERE symbol IN ('ES','NQ') "
            "GROUP BY symbol, timeframe ORDER BY symbol, timeframe"
        )
        for sym, tf, n in cur.execute(sql).fetchall():
            print(f"  {sym:>3} {tf:>3}: {n:>10,}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
