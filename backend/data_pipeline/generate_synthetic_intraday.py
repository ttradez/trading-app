"""
Generates 1m candles per daily OHLC, then AGGREGATES every higher TF from the
1m stream. This guarantees TFs are consistent — same swing highs/lows, same
trend, same market — just different compression.

  5m  = 5 consecutive 1m bars  → OHLC = [first.O, max(H), min(L), last.C]
  15m = 15 consecutive 1m bars
  30m = 30 ...
  1h  = 60 ...
  4h  = 240 ...

NOT real market data — replace with Kaggle CC0 data when available.

Run: python backend/data_pipeline/generate_synthetic_intraday.py
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from db import get_conn

# 480 1m bars per day (8-hour synthetic session). Divides cleanly into every
# higher TF so aggregation is exact. Total bars per day across all TFs ≈ 633.
MINUTES_PER_DAY = 480

# group size in 1m bars
TF_GROUPS = {
    "5m":  5,
    "15m": 15,
    "30m": 30,
    "1h":  60,
    "4h":  240,
}


def synthesize_1m_for_day(daily) -> list[tuple[int, float, float, float, float, float]]:
    """Brownian-bridge style 1m OHLC anchored at daily.open / daily.close."""
    o = daily["open"]; h = daily["high"]; l = daily["low"]
    c = daily["close"]; v = daily["volume"]
    n = MINUTES_PER_DAY
    daily_range = max(h - l, 0.0001)
    per_min_vol = v / n if v else 0

    # Random walk
    step_sd = daily_range / (n ** 0.5) * 1.2
    cumsum = [0.0]
    for _ in range(n):
        cumsum.append(cumsum[-1] + random.gauss(0, step_sd))
    end = cumsum[-1]

    # Bridge to zero at endpoints, then add linear path o → c
    base = [o + (c - o) * (i / n) for i in range(n + 1)]
    path = [base[i] + (cumsum[i] - i * end / n) for i in range(n + 1)]

    # Scale path's deviation from the linear baseline so max≈h, min≈l
    path_max = max(path); path_min = min(path)
    cur_range = max(path_max - path_min, 0.0001)
    target_range = h - l
    scale = (target_range / cur_range) * 0.95   # slight under-scale; wicks fill the rest
    scaled = [base[i] + (path[i] - base[i]) * scale for i in range(n + 1)]
    scaled[0] = o
    scaled[n] = c

    # Find the bar that hits max/min so we can force-touch H/L
    max_idx = max(range(n + 1), key=lambda i: scaled[i])
    min_idx = min(range(n + 1), key=lambda i: scaled[i])

    bars: list[tuple[int, float, float, float, float, float]] = []
    for i in range(n):
        bo = scaled[i]
        bc = scaled[i + 1]
        wick = abs(random.gauss(0, daily_range * 0.0008))
        bh = max(bo, bc) + wick
        bl = min(bo, bc) - wick
        # Ensure the daily H/L are touched by the bars adjacent to the extreme
        if i == max_idx or i + 1 == max_idx:
            bh = max(bh, h)
        if i == min_idx or i + 1 == min_idx:
            bl = min(bl, l)
        bh = max(bh, bo, bc)
        bl = min(bl, bo, bc)
        bars.append((i * 60, bo, bh, bl, bc, per_min_vol))
    return bars


def aggregate(bars_1m, group_size):
    """Group consecutive 1m bars into a higher TF. Pure deterministic aggregation."""
    out = []
    for i in range(0, len(bars_1m), group_size):
        sl = bars_1m[i:i + group_size]
        if not sl:
            continue
        out.append((
            sl[0][0],                          # time = first bar's time
            sl[0][1],                          # open  = first bar's open
            max(b[2] for b in sl),             # high  = max of all
            min(b[3] for b in sl),             # low   = min of all
            sl[-1][4],                         # close = last bar's close
            sum(b[5] for b in sl),             # volume = sum
        ))
    return out


def generate_for_symbol(conn, symbol: str) -> None:
    daily_rows = conn.execute(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol = ? AND timeframe = '1D' ORDER BY time ASC",
        (symbol,),
    ).fetchall()
    if not daily_rows:
        print(f"  {symbol}: no daily")
        return
    print(f"  {symbol}: {len(daily_rows):,} daily bars → 1m + aggregations")

    all_1m: list[tuple] = []
    aggs: dict[str, list[tuple]] = {tf: [] for tf in TF_GROUPS}

    for d in daily_rows:
        day_start = d["time"]
        daily = {"open": d["open"], "high": d["high"], "low": d["low"],
                 "close": d["close"], "volume": d["volume"]}
        day_1m_rel = synthesize_1m_for_day(daily)
        # Convert to absolute time
        day_1m = [(day_start + off, o, h, l, c, v) for (off, o, h, l, c, v) in day_1m_rel]
        all_1m.extend((symbol, "1m", t, o, h, l, c, v) for (t, o, h, l, c, v) in day_1m)

        # Aggregate within this day so day boundaries align cleanly
        for tf, grp in TF_GROUPS.items():
            for row in aggregate(day_1m, grp):
                aggs[tf].append((symbol, tf, *row))

    conn.executemany(
        "INSERT OR REPLACE INTO candles (symbol, timeframe, time, open, high, low, close, volume) "
        "VALUES (?,?,?,?,?,?,?,?)",
        all_1m,
    )
    print(f"    1m: {len(all_1m):,}")
    for tf, rows in aggs.items():
        conn.executemany(
            "INSERT OR REPLACE INTO candles (symbol, timeframe, time, open, high, low, close, volume) "
            "VALUES (?,?,?,?,?,?,?,?)",
            rows,
        )
        print(f"    {tf}: {len(rows):,}")
    conn.commit()


if __name__ == "__main__":
    random.seed(42)
    conn = get_conn()

    # Sanity: refuse to run on compressed timestamps
    max_d = conn.execute(
        "SELECT MAX(time) FROM candles WHERE timeframe='1D'"
    ).fetchone()[0]
    if not max_d or max_d < 1e9:
        print(f"ERROR: daily timestamps are compressed (max={max_d}).")
        print("Run `python backend/fix_timestamps.py` first.")
        conn.close()
        sys.exit(1)

    # Wipe any stale intraday — we're rebuilding from scratch
    n = conn.execute("DELETE FROM candles WHERE timeframe NOT IN ('1D','1W')").rowcount
    conn.commit()
    print(f"Wiped {n:,} stale intraday rows")

    symbols = [r["symbol"] for r in conn.execute(
        "SELECT DISTINCT symbol FROM candles WHERE timeframe = '1D' ORDER BY symbol"
    ).fetchall()]
    print(f"Generating intraday for {len(symbols)} symbols...\n")
    for sym in symbols:
        generate_for_symbol(conn, sym)
    conn.close()
    print("\nDone. Restart the backend.")
