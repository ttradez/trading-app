"""
One-shot migration: fix the candle timestamp scale.

Bug: 1D/1W timestamps were stored as `unix_seconds // 1000` (so daily bars are
86 sec apart instead of 86400). The synthesis adds real-second offsets
(60, 1800, 3600, ...) which on this compressed scale overflow days, scrambling
all intraday bars.

Fix:
  1. Multiply all 1D and 1W timestamps by 1000 → real unix seconds
  2. Delete all (broken) intraday rows
  3. Wipe trading_sessions (their hidden_start references the old scale)
  4. Re-run generate_synthetic_intraday.py to rebuild intraday cleanly

Run: python backend/fix_timestamps.py
Then: python backend/data_pipeline/generate_synthetic_intraday.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from db import get_conn

conn = get_conn()

max_daily = conn.execute(
    "SELECT MAX(time) FROM candles WHERE timeframe IN ('1D','1W')"
).fetchone()[0]

if not max_daily or max_daily > 1e9:
    print(f"Daily times already look correct (max={max_daily}). No migration needed.")
    conn.close()
    sys.exit(0)

print(f"Detected compressed timestamps (max={max_daily}). Fixing...")

# 1. Multiply 1D and 1W times by 1000
n_daily = conn.execute(
    "UPDATE candles SET time = time * 1000 WHERE timeframe IN ('1D','1W')"
).rowcount
print(f"  Updated {n_daily:,} daily/weekly rows")

# 2. Delete all bad intraday rows — synthesis will rebuild
n_intra = conn.execute(
    "DELETE FROM candles WHERE timeframe NOT IN ('1D','1W')"
).rowcount
print(f"  Deleted {n_intra:,} bad intraday rows")

# 3. Wipe trading_sessions (their hidden_start refers to old scale)
n_sess = conn.execute("DELETE FROM trading_sessions").rowcount
print(f"  Deleted {n_sess} trading sessions")

conn.commit()
conn.close()
print("\nDone. Now run: python backend/data_pipeline/generate_synthetic_intraday.py")
