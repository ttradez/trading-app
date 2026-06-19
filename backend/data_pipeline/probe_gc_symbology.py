"""
probe_gc_symbology.py — cost-check-only probe to find which GC (Gold)
Databento symbology returns full ~1-minute history over our window.

Background: GC.c.0 returned only ~59k rows over 2020-04-01 -> 2025-03-31
vs ~1.7M for ES.c.0/NQ.c.0/YM.c.0 — far too sparse to be real continuous
1m data. This script tests 4 candidate symbol forms via
metadata.get_cost + metadata.get_record_count (free, no paid download).
The "right" form is the one with a record count in the ~1.5–1.8M ballpark.

Run from backend/:
    python data_pipeline/probe_gc_symbology.py

The API key is read from backend/.env (DATABENTO_API_KEY) via python-
dotenv. Never hardcoded or printed.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import databento as db


HERE     = Path(__file__).parent
DATASET  = "GLBX.MDP3"
SCHEMA   = "ohlcv-1m"
START    = "2020-04-01"
END      = "2025-03-31"

# Reference: real continuous 1m counts for the same window.
REFERENCE = {
    "ES.c.0": 1_754_131,
    "NQ.c.0": 1_751_408,
    "YM.c.0": 1_721_216,
}
TARGET_COUNT = sum(REFERENCE.values()) // len(REFERENCE)  # ~1.74M

# Candidates to probe. (label, databento_symbol, stype_in).
#   GC.c.0  — calendar/front continuous (already tested; came back sparse)
#   GC.v.0  — volume-weighted front-month continuous (often the "true" front)
#   GC.n.0  — open-interest front-month continuous (sometimes supported)
#   GC.FUT  — parent symbol -> resolves to all GC contracts in the window
CANDIDATES = [
    ("GC.c.0", "GC.c.0", "continuous"),
    ("GC.v.0", "GC.v.0", "continuous"),
    ("GC.n.0", "GC.n.0", "continuous"),
    ("GC.FUT", "GC.FUT", "parent"),
]


def _load_api_key() -> str:
    backend_env = HERE.parent / ".env"
    load_dotenv(backend_env)
    key = os.environ.get("DATABENTO_API_KEY")
    if not key:
        sys.exit(
            "ERROR: DATABENTO_API_KEY not found.\n"
            f"Add it to {backend_env} as:\n"
            "  DATABENTO_API_KEY=db-XXXXXXX...\n"
        )
    return key


def _safe_record_count(client, sym, stype_in):
    """Returns (count_or_None, err_str_or_None)."""
    try:
        return (
            client.metadata.get_record_count(
                dataset=DATASET,
                schema=SCHEMA,
                symbols=[sym],
                stype_in=stype_in,
                start=START,
                end=END,
            ),
            None,
        )
    except Exception as e:
        return (None, f"{type(e).__name__}: {str(e)[:80]}")


def _safe_cost(client, sym, stype_in):
    """Returns (cost_or_None, err_str_or_None)."""
    try:
        return (
            client.metadata.get_cost(
                dataset=DATASET,
                schema=SCHEMA,
                symbols=[sym],
                stype_in=stype_in,
                start=START,
                end=END,
            ),
            None,
        )
    except Exception as e:
        return (None, f"{type(e).__name__}: {str(e)[:80]}")


def probe(client) -> None:
    print(f"\nGC symbology probe — dataset={DATASET}, schema={SCHEMA}")
    print(f"Range: {START} -> {END}")
    print()
    print("Reference (real continuous 1m for the same window):")
    for ref_sym, ref_n in REFERENCE.items():
        print(f"  {ref_sym}: {ref_n:>11,} rows")
    print(f"  -> target for GC: ~{TARGET_COUNT:,}")
    print()
    print("=" * 78)
    print(f"  {'symbol':<10}{'stype_in':<13}{'record_count':>15}{'cost':>10}   notes")
    print("-" * 78)

    results = []
    for label, sym, stype_in in CANDIDATES:
        count, count_err = _safe_record_count(client, sym, stype_in)
        cost,  cost_err  = _safe_cost(client, sym, stype_in)

        if count is None and cost is None:
            note = "unsupported"
        elif count is None:
            note = f"count-only failed ({count_err})"
        elif cost is None:
            note = f"cost-only failed ({cost_err})"
        else:
            # Flag whether this matches reference (~1.75M) or is sparse.
            ratio = count / TARGET_COUNT
            if ratio < 0.20:
                note = "sparse — likely wrong symbology"
            elif ratio < 0.80:
                note = "partial — investigate"
            elif ratio < 1.20:
                note = "matches reference [OK]"
            else:
                note = f"oversize ({ratio:.1f}x target) — multi-contract?"

        count_str = f"{count:,}" if count is not None else "n/a"
        cost_str  = f"${cost:.2f}" if cost is not None else "n/a"
        print(f"  {label:<10}{stype_in:<13}{count_str:>15}{cost_str:>10}   {note}")
        results.append((label, sym, stype_in, count, cost, note))

    print("=" * 78)
    print()

    # Pick the recommendation: closest to the reference target among the
    # candidates that returned a count, preferring "matches reference" tags.
    matches = [r for r in results if r[3] is not None and 0.80 <= r[3] / TARGET_COUNT <= 1.20]
    if matches:
        best = min(matches, key=lambda r: abs(r[3] - TARGET_COUNT))
        print(
            f"RECOMMENDATION: {best[0]}  (stype_in={best[2]})\n"
            f"  -> {best[3]:,} records, ${best[4]:.2f} estimated.\n"
            f"  Confirm before downloading. Do NOT download yet."
        )
    else:
        valid = [r for r in results if r[3] is not None]
        if valid:
            closest = min(valid, key=lambda r: abs(r[3] - TARGET_COUNT))
            print(
                "NO candidate matched the reference range cleanly.\n"
                f"Closest: {closest[0]} = {closest[3]:,} records "
                f"({(closest[3]/TARGET_COUNT)*100:.1f}% of target).\n"
                "Consider further candidates (GC.RAW, raw front-month contract "
                "symbol like GCG25, etc.) or check Databento dataset coverage."
            )
        else:
            print(
                "All candidates errored or were unsupported. "
                "Verify the GC dataset is included in your Databento entitlement."
            )


def main() -> None:
    key = _load_api_key()
    client = db.Historical(key=key)
    probe(client)


if __name__ == "__main__":
    main()
