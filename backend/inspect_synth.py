import sys
sys.path.insert(0, 'C:/Users/benti/trading-app/backend')
from db import get_conn
conn = get_conn()
print("trades:", conn.execute("SELECT COUNT(*) FROM trades").fetchone()[0])
print("leaderboard:", conn.execute("SELECT COUNT(*) FROM leaderboard").fetchone()[0])
print("trading_sessions:", conn.execute("SELECT COUNT(*) FROM trading_sessions").fetchone()[0])
print("tournaments:", conn.execute("SELECT COUNT(*) FROM tournaments").fetchone()[0])
conn.close()
