"""
SQLite database bootstrap for Pocket Trade.
All tables are created here; main.py imports `get_conn` and `init_db`.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "pocket_trade.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    cur.executescript("""
    -- ── Users ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
        uid          TEXT PRIMARY KEY,   -- Firebase UID
        username     TEXT NOT NULL UNIQUE,
        email        TEXT NOT NULL,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
        ads_removed  INTEGER NOT NULL DEFAULT 0  -- 1 = paid IAP
    );

    -- ── Accounts (per-user running stats) ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS accounts (
        uid              TEXT PRIMARY KEY REFERENCES users(uid),
        balance          REAL NOT NULL DEFAULT 10000,
        starting_balance REAL NOT NULL DEFAULT 10000,
        total_pnl        REAL NOT NULL DEFAULT 0,
        daily_pnl        REAL NOT NULL DEFAULT 0,
        win_rate         REAL NOT NULL DEFAULT 0,
        total_trades     INTEGER NOT NULL DEFAULT 0,
        rank             TEXT NOT NULL DEFAULT 'Gambler',
        last_updated     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- ── Candles (loaded from CSV by data_ingest.py) ──────────────────────────
    CREATE TABLE IF NOT EXISTS candles (
        symbol    TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        time      INTEGER NOT NULL,   -- unix timestamp seconds
        open      REAL,
        high      REAL,
        low       REAL,
        close     REAL,
        volume    REAL,
        PRIMARY KEY (symbol, timeframe, time)
    );
    CREATE INDEX IF NOT EXISTS idx_candles ON candles (symbol, timeframe, time DESC);

    -- ── Trading sessions (anti-cheat engine) ─────────────────────────────────
    CREATE TABLE IF NOT EXISTS trading_sessions (
        session_id     TEXT PRIMARY KEY,
        uid            TEXT NOT NULL REFERENCES users(uid),
        symbol         TEXT NOT NULL,
        timeframe      TEXT NOT NULL,
        account_size   REAL NOT NULL,
        balance        REAL NOT NULL,
        hidden_start   INTEGER NOT NULL,  -- unix timestamp — never sent to client
        current_time   INTEGER NOT NULL,  -- last bar revealed
        open_positions TEXT NOT NULL DEFAULT '[]',   -- JSON
        closed_trades  TEXT NOT NULL DEFAULT '[]',   -- JSON
        status         TEXT NOT NULL DEFAULT 'active',
        created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
        ended_at       INTEGER
    );

    -- ── Closed trades (denormalized for journal + stats) ─────────────────────
    CREATE TABLE IF NOT EXISTS trades (
        id           TEXT PRIMARY KEY,
        uid          TEXT NOT NULL REFERENCES users(uid),
        session_id   TEXT NOT NULL REFERENCES trading_sessions(session_id),
        symbol       TEXT NOT NULL,
        side         TEXT NOT NULL,   -- 'buy' | 'sell'
        lots         REAL NOT NULL,
        entry_price  REAL NOT NULL,
        exit_price   REAL NOT NULL,
        stop_loss    REAL,
        take_profit  REAL,
        opened_at    INTEGER NOT NULL,
        closed_at    INTEGER NOT NULL,
        pnl          REAL NOT NULL,
        pips         REAL NOT NULL,
        r_multiple   REAL,
        news_snapshot TEXT NOT NULL DEFAULT '[]'  -- JSON list of headline strings
    );
    CREATE INDEX IF NOT EXISTS idx_trades_uid ON trades (uid, closed_at DESC);

    -- ── Leaderboard ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS leaderboard (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        uid          TEXT NOT NULL,
        username     TEXT NOT NULL,
        symbol       TEXT,
        timeframe    TEXT,
        account_size REAL,
        return_pct   REAL NOT NULL,
        total_trades INTEGER NOT NULL DEFAULT 0,
        win_rate     REAL NOT NULL DEFAULT 0,
        ended_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_lb_ended ON leaderboard (ended_at DESC, return_pct DESC);

    -- ── Tournaments ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tournaments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        symbol        TEXT NOT NULL,
        timeframe     TEXT NOT NULL,
        hidden_start  INTEGER NOT NULL,   -- same for all entrants
        starts_at     INTEGER NOT NULL,
        ends_at       INTEGER NOT NULL,
        status        TEXT NOT NULL DEFAULT 'open'  -- 'open' | 'closed'
    );

    CREATE TABLE IF NOT EXISTS tournament_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id   INTEGER NOT NULL REFERENCES tournaments(id),
        uid             TEXT NOT NULL REFERENCES users(uid),
        username        TEXT NOT NULL,
        session_id      TEXT REFERENCES trading_sessions(session_id),
        final_return    REAL,
        consistency_mul REAL,           -- computed on session end
        score           REAL,           -- final_return * consistency_mul
        completed_at    INTEGER,
        UNIQUE (tournament_id, uid)
    );
    CREATE INDEX IF NOT EXISTS idx_te_score ON tournament_entries (tournament_id, score DESC);

    -- ── Leaderboard groups ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS leaderboard_groups (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        owner_uid  TEXT NOT NULL REFERENCES users(uid),
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER NOT NULL REFERENCES leaderboard_groups(id),
        uid      TEXT NOT NULL REFERENCES users(uid),
        joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (group_id, uid)
    );

    -- ── Public trade feed ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS public_feed (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        uid         TEXT NOT NULL REFERENCES users(uid),
        username    TEXT NOT NULL,
        trade_id    TEXT NOT NULL REFERENCES trades(id),
        symbol      TEXT NOT NULL,
        side        TEXT NOT NULL,
        pnl         REAL NOT NULL,
        pips        REAL NOT NULL,
        r_multiple  REAL,
        posted_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_feed ON public_feed (posted_at DESC);
    """)

    conn.commit()
    conn.close()
