"""
fetch_databento.py — one-off Databento fetch for YM (E-mini Dow) and GC
(Gold Futures) 1-minute OHLCV bars.

Mirrors the existing ES/NQ files at
  data_pipeline/raw/ES_databento_1m.csv
  data_pipeline/raw/NQ_databento_1m.csv
exactly:
  Dataset:  GLBX.MDP3
  Schema:   ohlcv-1m
  Symbols:  YM.c.0, GC.c.0   (continuous-contract, front-month)
  Range:    2020-04-01  →  2025-03-31

TWO-STEP RUN PATTERN
  1. `python fetch_databento.py`            → COST CHECK ONLY.
     Hits Databento's metadata.get_cost + get_record_count and prints
     an estimate per symbol. No paid query runs.
  2. `python fetch_databento.py --confirm`  → runs the paid download
     and writes the two CSVs into data_pipeline/raw/ in the same
     column order as the existing ES/NQ files.

The API key is read from backend/.env (DATABENTO_API_KEY) via
python-dotenv. It is never hardcoded or printed.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import databento as db


HERE     = Path(__file__).parent
RAW_DIR  = HERE / "raw"
DATASET  = "GLBX.MDP3"
SCHEMA   = "ohlcv-1m"
START    = "2020-04-01"
END      = "2025-03-31"

# (internal_label, databento_continuous_symbol)
#
# GC uses GC.v.0 (volume-weighted front-month continuous) instead of
# .c.0 (calendar/front). The probe in probe_gc_symbology.py confirmed
# .c.0 returns a sparse stitch (~59k rows) for gold while .v.0 returns
# ~1.75M rows matching the ES/NQ/YM coverage profile. The .v.0 series
# rolls when daily volume shifts to the next contract — the same
# stream active traders watch on the tape.
SYMBOLS: list[tuple[str, str]] = [
    ("YM", "YM.c.0"),
    ("GC", "GC.v.0"),
]

# Column order in the existing ES/NQ CSVs (verified from
# ES_databento_1m.csv header). Keeping this exact ordering means the
# downstream ingest script can treat the new files identically.
EXPECTED_COLUMNS = [
    "ts_event", "rtype", "publisher_id", "instrument_id",
    "open", "high", "low", "close", "volume", "symbol",
]


def _load_api_key() -> str:
    """Load DATABENTO_API_KEY from backend/.env. Exit cleanly if missing."""
    # backend/.env sits one level up from data_pipeline/
    backend_env = HERE.parent / ".env"
    load_dotenv(backend_env)
    key = os.environ.get("DATABENTO_API_KEY")
    if not key:
        sys.exit(
            "ERROR: DATABENTO_API_KEY not found.\n"
            f"Add it to {backend_env} as:\n"
            "  DATABENTO_API_KEY=db-XXXXXXX...\n"
            "and re-run."
        )
    return key


def cost_check(client: db.Historical) -> None:
    """Print the cost + record count for each YM/GC fetch. No paid query."""
    print(f"\nCost check -- dataset={DATASET}, schema={SCHEMA}, "
          f"range={START} -> {END}")
    print("=" * 64)

    estimates: list[tuple[str, str, float, int | None]] = []
    for label, sym in SYMBOLS:
        cost = client.metadata.get_cost(
            dataset=DATASET,
            schema=SCHEMA,
            symbols=[sym],
            stype_in="continuous",
            start=START,
            end=END,
        )
        try:
            count = client.metadata.get_record_count(
                dataset=DATASET,
                schema=SCHEMA,
                symbols=[sym],
                stype_in="continuous",
                start=START,
                end=END,
            )
        except Exception:
            # Some plans / SDK versions don't expose record_count for
            # historical schemas — cost is the load-bearing number, so
            # we don't fail the whole check if this isn't available.
            count = None

        estimates.append((label, sym, cost, count))
        count_str = (
            f"{count:,} records" if count is not None
            else "(record count unavailable)"
        )
        print(f"  {label} ({sym}):  ${cost:.2f}   {count_str}")

    total = sum(c for _, _, c, _ in estimates)
    print("=" * 64)
    print(f"  TOTAL ESTIMATED: ${total:.2f}\n")

    ym_cost = next(c for label, _, c, _ in estimates if label == "YM")
    gc_cost = next(c for label, _, c, _ in estimates if label == "GC")
    print(f"Estimated cost YM=${ym_cost:.2f}, GC=${gc_cost:.2f}.")
    print("Re-run with --confirm to download.")


def fetch_and_write(client: db.Historical) -> None:
    """Actually pull the data and write the CSVs."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    for label, sym in SYMBOLS:
        print(f"\nDownloading {label} ({sym})…")
        data = client.timeseries.get_range(
            dataset=DATASET,
            schema=SCHEMA,
            symbols=[sym],
            stype_in="continuous",
            start=START,
            end=END,
        )
        df = data.to_df()

        # ts_event comes back as the DataFrame's index — move it back
        # to a column so the CSV layout matches the existing files.
        df = df.reset_index()

        # Force the `symbol` column to the continuous-contract notation
        # we queried with. By default Databento may write the resolved
        # raw contract (e.g. YMU24) instead, which would diverge from
        # the ES.c.0 / NQ.c.0 convention used by the existing CSVs.
        df["symbol"] = sym

        # Keep only the columns the ingest script expects, in that
        # exact order. Any extra columns Databento adds get dropped
        # silently so the file is byte-shape-compatible with ES/NQ.
        present = [c for c in EXPECTED_COLUMNS if c in df.columns]
        missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
        if missing:
            print(f"  WARNING: columns missing from response: {missing}")
        df = df[present]

        out = RAW_DIR / f"{label}_databento_1m.csv"
        df.to_csv(out, index=False)

        first = df["ts_event"].iloc[0]
        last  = df["ts_event"].iloc[-1]
        print(f"  wrote {out}")
        print(f"    rows: {len(df):,}    span: {first}  ->  {last}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Cost-check (default) or fetch (--confirm) real Databento "
            "1-minute OHLCV bars for YM (E-mini Dow) and GC (Gold)."
        ),
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help=(
            "Run the paid download and write the CSVs. Without this "
            "flag, only the free cost-check runs."
        ),
    )
    parser.add_argument(
        "--only",
        type=str,
        default=None,
        metavar="LABEL",
        help=(
            "Restrict the run to a single label (e.g. --only GC). When "
            "omitted, every entry in SYMBOLS is processed. Useful for "
            "re-fetching one symbol without paying to re-download the "
            "others."
        ),
    )
    args = parser.parse_args()

    # Apply the --only filter to the module-level SYMBOLS list. We
    # mutate the global so both cost_check and fetch_and_write see the
    # filtered set without needing to thread it through every function.
    global SYMBOLS
    if args.only:
        wanted = args.only.strip().upper()
        filtered = [(label, sym) for (label, sym) in SYMBOLS if label == wanted]
        if not filtered:
            sys.exit(
                f"ERROR: --only {args.only!r} matched no label in SYMBOLS. "
                f"Valid labels: {[l for l, _ in SYMBOLS]}"
            )
        SYMBOLS = filtered

    key = _load_api_key()
    client = db.Historical(key=key)

    if args.confirm:
        fetch_and_write(client)
    else:
        cost_check(client)


if __name__ == "__main__":
    main()
