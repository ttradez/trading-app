#!/usr/bin/env python3
"""
backend/scripts/import_news.py

Downloads the Forex Factory calendar CSV from Hugging Face, decides whether to
trust the embedded ISO offsets or re-localize the wall-clock via
zoneinfo("Asia/Tehran"), converts to UTC, normalizes impact labels, and loads
into backend/pocket_trade.db's `economic_events` table (DROP + CREATE).

After the base load, repairs "midnight stub" rows where the source CSV has
T00:00:00 (date known, time missing). Two-step repair:
  1. PRIMARY: modal-time inference per (title, currency) using non-stub rows
     in US/Eastern. If >=2 non-stub rows share a HH:MM ET, use that.
  2. FALLBACK: canonical ET map by case-insensitive title substring match.
Stubs whose title hits neither remain time_known=0 (don't fabricate).

DROPs + RECREATEs only the economic_events table - price data is untouched.

Usage:
    python backend/scripts/import_news.py
"""

from __future__ import annotations

import csv
import io
import re
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

try:
    from zoneinfo import ZoneInfo
except ImportError:
    sys.exit("zoneinfo unavailable - requires Python 3.9+")


# -- Constants -----------------------------------------------------------------

CSV_URL = (
    "https://huggingface.co/datasets/Ehsanrs2/Forex_Factory_Calendar/"
    "resolve/main/forex_factory_cache.csv"
)

IMPACT_MAP = {
    "High Impact Expected":   "high",
    "Medium Impact Expected": "medium",
    "Low Impact Expected":    "low",
    "Non-Economic":           "holiday",
}

NULL_VALUES = {"", "null", "NULL", "None", "none", "N/A", "n/a", "-"}

try:
    TEHRAN_TZ = ZoneInfo("Asia/Tehran")
    ET_TZ     = ZoneInfo("America/New_York")
except Exception as e:  # pragma: no cover
    sys.exit(
        f"Failed to load tz data: {e}\n"
        "On Windows you may need: pip install tzdata"
    )


# Canonical US release times in ET, keyed by normalized (lowercased,
# stripped) EXACT title. USD-only - applied only when currency == 'USD'
# so non-US events whose title happens to share a substring (e.g.
# [GBP] CPI y/y) are never touched by this map. Substring matching was
# too loose: it pulled "ADP Non-Farm Employment Change" into the 8:30
# NFP rule when ADP actually releases at 8:15 ET.
#
# Notable choices in this revision:
#   - ADP Non-Farm Employment Change is at 8:15 ET, not 8:30.
#   - Philly Fed Manufacturing Index intentionally NOT included: its
#     release time has shifted between 8:30 ET and 10:00 ET over the
#     years, so observed/modal times are more accurate than canonical.
#   - Empire State Manufacturing Index stays at 8:30 ET (stable).
CANONICAL_ET_USD: dict[str, tuple[int, int]] = {
    # 8:30 ET — NFP family, CPI, PPI, retail sales, jobless claims,
    # GDP, PCE, durable goods, personal spending/income, trade,
    # housing starts/permits, Empire State Manufacturing.
    "non-farm employment change":          (8, 30),
    "unemployment rate":                   (8, 30),
    "average hourly earnings m/m":         (8, 30),
    "cpi m/m":                             (8, 30),
    "cpi y/y":                             (8, 30),
    "core cpi m/m":                        (8, 30),
    "ppi m/m":                             (8, 30),
    "core ppi m/m":                        (8, 30),
    "retail sales m/m":                    (8, 30),
    "core retail sales m/m":               (8, 30),
    "unemployment claims":                 (8, 30),
    "advance gdp q/q":                     (8, 30),
    "prelim gdp q/q":                      (8, 30),
    "final gdp q/q":                       (8, 30),
    "advance gdp price index q/q":         (8, 30),
    "prelim gdp price index q/q":          (8, 30),
    "final gdp price index q/q":           (8, 30),
    "core pce price index m/m":            (8, 30),
    "pce price index m/m":                 (8, 30),
    "personal spending m/m":               (8, 30),
    "personal income m/m":                 (8, 30),
    "trade balance":                       (8, 30),
    "goods trade balance":                 (8, 30),
    "housing starts":                      (8, 30),
    "building permits":                    (8, 30),
    "durable goods orders m/m":            (8, 30),
    "core durable goods orders m/m":       (8, 30),
    "empire state manufacturing index":    (8, 30),

    # 8:15 ET — ADP Non-Farm Employment Change (its historical release time).
    "adp non-farm employment change":      (8, 15),

    # 10:00 ET — ISM, JOLTS, consumer confidence, home sales, UoM, factory orders.
    "ism manufacturing pmi":               (10, 0),
    "ism services pmi":                    (10, 0),
    "ism non-manufacturing pmi":           (10, 0),
    "jolts job openings":                  (10, 0),
    "cb consumer confidence":              (10, 0),
    "existing home sales":                 (10, 0),
    "new home sales":                      (10, 0),
    "pending home sales m/m":              (10, 0),
    "uom consumer sentiment":              (10, 0),
    "prelim uom consumer sentiment":       (10, 0),
    "revised uom consumer sentiment":      (10, 0),
    "factory orders m/m":                  (10, 0),

    # 14:00 ET — FOMC family.
    "federal funds rate":                  (14, 0),
    "fomc statement":                      (14, 0),
    "fomc economic projections":           (14, 0),
    "fomc meeting minutes":                (14, 0),

    # 14:30 ET — FOMC Press Conference.
    "fomc press conference":               (14, 30),
}


def canonical_et_time(title: str | None, currency: str | None = None) -> tuple[int, int] | None:
    """Return the canonical ET (hour, minute) for a USD event whose title
    matches the map exactly after normalize (strip + lowercase). Returns
    None for non-USD currencies and for titles not in the map."""
    if currency != "USD":
        return None
    if not title:
        return None
    return CANONICAL_ET_USD.get(title.strip().lower())


# -- Helpers ------------------------------------------------------------------

def resolve_db_path() -> Path:
    """Match backend/db.py: Path(__file__).parent / 'pocket_trade.db'."""
    return Path(__file__).resolve().parent.parent / "pocket_trade.db"


def download_csv(url: str) -> str:
    print(f"Downloading {url}")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    print(f"  -> {len(r.content):,} bytes")
    return r.text


_OFFSET_RE = re.compile(r"([+-]\d{2}:\d{2})$")
_DATE_RE   = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def parse_offset(dt_str: str) -> str | None:
    m = _OFFSET_RE.search(dt_str.strip())
    return m.group(1) if m else None


def scan_offsets(rows: list[dict]) -> tuple[Counter, list[tuple[str, str]]]:
    offsets: Counter = Counter()
    pre22_summer: list[tuple[str, str]] = []
    for r in rows:
        dt = (r.get("DateTime") or "").strip()
        if not dt:
            continue
        off = parse_offset(dt)
        if off:
            offsets[off] += 1
        m = _DATE_RE.match(dt)
        if not m:
            continue
        year = int(m.group(1))
        month = int(m.group(2))
        if year < 2022 and 5 <= month <= 9 and len(pre22_summer) < 30:
            pre22_summer.append((dt, off or "(none)"))
    return offsets, pre22_summer


def detect_strategy(rows: list[dict]) -> str:
    offsets, samples = scan_offsets(rows)

    print("\nDistinct offsets across all rows:")
    for off, n in offsets.most_common():
        print(f"  {off}: {n:,}")

    print("\nFirst 10 pre-2022 summer samples:")
    for dt, off in samples[:10]:
        print(f"  {dt:35s} -> offset={off}")

    pre22_offsets = Counter(off for (_, off) in samples)
    print(f"\nOffsets on pre-2022 summer rows: {dict(pre22_offsets)}")

    has_dst = pre22_offsets.get("+04:30", 0) > 0
    one_offset = len(offsets) == 1

    if has_dst:
        print("\n  -> STRATEGY: trust_offset")
        return "trust_offset"
    if one_offset:
        print("\n  -> STRATEGY: relocalize (single fixed offset)")
        return "relocalize"

    print("\n  -> STRATEGY: relocalize (defensive)")
    return "relocalize"


def to_utc_trust(dt_str: str) -> datetime | None:
    try:
        return datetime.fromisoformat(dt_str.strip()).astimezone(timezone.utc)
    except ValueError:
        return None


def to_utc_relocalize(dt_str: str) -> datetime | None:
    """Strip any trailing offset, treat wall-clock as Asia/Tehran local
    time, convert to UTC via zoneinfo (correct historical DST)."""
    s = dt_str.strip()
    s = _OFFSET_RE.sub("", s).rstrip()
    if s.endswith("Z"):
        s = s[:-1].rstrip()
    try:
        naive = datetime.fromisoformat(s)
    except ValueError:
        return None
    return naive.replace(tzinfo=TEHRAN_TZ).astimezone(timezone.utc)


def is_stub_dt_string(dt_str: str) -> bool:
    """True iff the wall-clock time portion is 00:00:00."""
    s = dt_str.strip()
    s = _OFFSET_RE.sub("", s).rstrip()
    if s.endswith("Z"):
        s = s[:-1].rstrip()
    if len(s) < 19:
        return False
    return s[11:19] == "00:00:00"


def extract_calendar_date(dt_str: str) -> str | None:
    m = _DATE_RE.match(dt_str.strip())
    return m.group(0) if m else None


def normalize_nullable(v: str | None) -> str | None:
    s = (v or "").strip()
    return None if s in NULL_VALUES else s


def normalize_impact(v: str | None) -> str | None:
    return IMPACT_MAP.get((v or "").strip())


def create_table(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.executescript(
        """
        DROP TABLE IF EXISTS economic_events;
        CREATE TABLE economic_events (
            id           INTEGER PRIMARY KEY,
            datetime_utc TEXT NOT NULL,
            currency     TEXT,
            impact       TEXT,
            title        TEXT,
            actual       TEXT,
            forecast     TEXT,
            previous     TEXT,
            time_known   INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX idx_econ_dt           ON economic_events(datetime_utc);
        CREATE INDEX idx_econ_currency_dt  ON economic_events(currency, datetime_utc);
        CREATE INDEX idx_econ_title_curr   ON economic_events(title, currency);
        """
    )
    conn.commit()


def insert_rows(conn, rows, strategy):
    """Insert rows, tagging time_known=0 for source midnight-stub rows.
    Returns (inserted, skipped, stub_meta) where stub_meta maps id ->
    (date_str, title, currency) for stubs only."""
    to_utc = to_utc_trust if strategy == "trust_offset" else to_utc_relocalize
    cur = conn.cursor()
    inserted = skipped = 0
    rid = 0
    batch: list[tuple] = []
    stub_meta: dict[int, tuple[str, str | None, str | None]] = {}
    BATCH = 1000
    for r in rows:
        dt_raw = r.get("DateTime") or ""
        dt = to_utc(dt_raw)
        if dt is None:
            skipped += 1
            continue
        rid += 1
        time_known = 0 if is_stub_dt_string(dt_raw) else 1
        title_n    = normalize_nullable(r.get("Event"))
        currency_n = normalize_nullable(r.get("Currency"))
        batch.append(
            (
                rid,
                dt.strftime("%Y-%m-%d %H:%M:%S"),
                currency_n,
                normalize_impact(r.get("Impact")),
                title_n,
                normalize_nullable(r.get("Actual")),
                normalize_nullable(r.get("Forecast")),
                normalize_nullable(r.get("Previous")),
                time_known,
            )
        )
        if time_known == 0:
            d = extract_calendar_date(dt_raw)
            if d and title_n:
                stub_meta[rid] = (d, title_n, currency_n)
        if len(batch) >= BATCH:
            cur.executemany(
                "INSERT INTO economic_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                batch,
            )
            inserted += len(batch)
            batch = []
    if batch:
        cur.executemany(
            "INSERT INTO economic_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            batch,
        )
        inserted += len(batch)
    conn.commit()
    return inserted, skipped, stub_meta


def print_stub_breakdown(conn) -> None:
    cur = conn.cursor()
    (total_stubs,) = cur.execute(
        "SELECT COUNT(*) FROM economic_events WHERE time_known = 0"
    ).fetchone()
    (total,) = cur.execute("SELECT COUNT(*) FROM economic_events").fetchone()
    pct = (100.0 * total_stubs / total) if total else 0
    print(f"\n-- Stub rows (source T00:00:00): {total_stubs:,} / {total:,} ({pct:.1f}%) --")

    print(f"\n   USD high+medium impact stub breakdown:")
    rows = cur.execute(
        """
        SELECT title, COUNT(*) as n
        FROM economic_events
        WHERE time_known = 0 AND currency = 'USD'
              AND impact IN ('high','medium')
        GROUP BY title
        ORDER BY n DESC
        """
    ).fetchall()
    if not rows:
        print(f"     (none)")
        return
    for title, n in rows:
        (has_ns,) = cur.execute(
            "SELECT EXISTS(SELECT 1 FROM economic_events "
            "WHERE time_known = 1 AND title = ? AND currency = 'USD')",
            (title,),
        ).fetchone()
        flag = "[has non-stub rows]" if has_ns else "[ALL stubs - fallback only]"
        print(f"     {n:5,}  {title!r:55s}  {flag}")


def compute_modal_et_times(conn) -> dict:
    """For each (title, currency) using non-stub rows, the modal ET HH:MM.
    Requires at least 2 occurrences to be considered."""
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT datetime_utc, currency, title FROM economic_events WHERE time_known = 1"
    ).fetchall()
    et_buckets: dict[tuple, Counter] = {}
    for dtu, currency, title in rows:
        if not title:
            continue
        try:
            dt_utc = datetime.fromisoformat(dtu).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        dt_et = dt_utc.astimezone(ET_TZ)
        key = (title, currency)
        et_buckets.setdefault(key, Counter())[(dt_et.hour, dt_et.minute)] += 1
    modal: dict[tuple, tuple[int, int]] = {}
    for key, ctr in et_buckets.items():
        (hhmm, n) = ctr.most_common(1)[0]
        if n >= 2:
            modal[key] = hhmm
    return modal


def apply_sanity_floor(conn) -> tuple[int, list, int]:
    """For each (title, currency) where the title matches the canonical ET
    map, compute its observed modal HH:MM in ET across all current rows.
    If the modal is within +/-2h of the canonical time, REWRITE every row
    of that (title, currency) to use canonical HH:MM on each row's own
    ET calendar date (so e.g. CPI y/y rows at 7:30 ET snap to 8:30 ET
    alongside CPI m/m). If the modal diverges by more than 2h, leave the
    rows alone - canonical probably doesn't apply to this title.

    Returns (total_rows_adjusted, applied_log_entries, skipped_groups)."""
    cur = conn.cursor()
    keys = cur.execute(
        "SELECT DISTINCT title, currency FROM economic_events WHERE title IS NOT NULL"
    ).fetchall()

    total_adjusted = 0
    applied_log: list[tuple] = []
    skipped_log: list[tuple] = []

    for title, currency in keys:
        canon = canonical_et_time(title, currency)
        if canon is None:
            continue
        canon_hh, canon_mm = canon
        canon_min = canon_hh * 60 + canon_mm

        # Pull all current rows for this (title, currency). currency may
        # be NULL on some rows - use IS to compare with possible None.
        if currency is None:
            row_data = cur.execute(
                "SELECT id, datetime_utc FROM economic_events "
                "WHERE title = ? AND currency IS NULL",
                (title,),
            ).fetchall()
        else:
            row_data = cur.execute(
                "SELECT id, datetime_utc FROM economic_events "
                "WHERE title = ? AND currency = ?",
                (title, currency),
            ).fetchall()
        if not row_data:
            continue

        # Compute observed modal ET HH:MM and cache per-row ET dates.
        ctr: Counter = Counter()
        et_cache: list[tuple[int, "date", int, int]] = []
        for rid, dtu in row_data:
            try:
                dt_utc = datetime.fromisoformat(dtu).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            dt_et = dt_utc.astimezone(ET_TZ)
            ctr[(dt_et.hour, dt_et.minute)] += 1
            et_cache.append((rid, dt_et.date(), dt_et.hour, dt_et.minute))
        if not ctr:
            continue

        (mod_hh, mod_mm), _ = ctr.most_common(1)[0]
        mod_min = mod_hh * 60 + mod_mm
        diff = abs(mod_min - canon_min)
        # Wrap-around (e.g. canon=00:30, mod=23:00 should read as 90 min).
        if diff > 720:
            diff = 1440 - diff

        if diff > 120:
            skipped_log.append(
                (currency, title, mod_hh, mod_mm, canon_hh, canon_mm, len(row_data))
            )
            continue

        # Build the update batch: only rows whose ET time differs from
        # canonical need an UPDATE - already-canonical rows are a no-op.
        update_batch: list[tuple[str, int]] = []
        for rid, et_date, et_hh, et_mm in et_cache:
            if (et_hh, et_mm) == (canon_hh, canon_mm):
                continue
            new_et = datetime(
                et_date.year, et_date.month, et_date.day,
                canon_hh, canon_mm, tzinfo=ET_TZ,
            )
            new_utc = new_et.astimezone(timezone.utc)
            update_batch.append((new_utc.strftime("%Y-%m-%d %H:%M:%S"), rid))

        if update_batch:
            cur.executemany(
                "UPDATE economic_events SET datetime_utc = ?, time_known = 1 "
                "WHERE id = ?",
                update_batch,
            )
            total_adjusted += len(update_batch)
            applied_log.append(
                (currency, title, mod_hh, mod_mm, canon_hh, canon_mm,
                 len(update_batch), len(row_data))
            )

    conn.commit()
    return total_adjusted, applied_log, skipped_log


def print_cpi_release_day(conn, label: str, date_str: str, expected_hhmm: str) -> None:
    """Show CPI m/m, CPI y/y, Core CPI m/m for one USD release day so
    same-release pairs can be confirmed at the same UTC time."""
    cur = conn.cursor()
    print(f"\n-- {label} (expect {expected_hhmm} UTC for all three) --")
    rows = cur.execute(
        """
        SELECT datetime_utc, title, time_known FROM economic_events
        WHERE currency = 'USD' AND datetime_utc LIKE ?
          AND (title = 'CPI m/m' OR title = 'CPI y/y' OR title = 'Core CPI m/m')
        ORDER BY title
        """,
        (date_str + "%",),
    ).fetchall()
    if not rows:
        print("  (no CPI rows found)")
        return
    times_seen = set()
    for dt, title, tk in rows:
        hhmm = dt[11:16]
        marker = "[ok]" if hhmm == expected_hhmm else "[FAIL]"
        print(f"   {marker} {dt}  {title}  (time_known={tk})")
        times_seen.add(hhmm)
    if len(times_seen) == 1 and expected_hhmm in times_seen:
        print(f"   ALL THREE ALIGN at {expected_hhmm} UTC.")
    else:
        print(f"   times seen: {times_seen} - misalignment.")


def fix_stubs(conn, stub_meta: dict, modal: dict) -> tuple[int, int, int]:
    cur = conn.cursor()
    corrected_modal = 0
    corrected_fallback = 0
    uncorrected = 0
    for sid, (date_str, title, currency) in stub_meta.items():
        et_hhmm = modal.get((title, currency))
        source = "modal"
        if et_hhmm is None:
            et_hhmm = canonical_et_time(title, currency)
            source = "fallback"
        if et_hhmm is None:
            uncorrected += 1
            continue
        try:
            yy, mo, dd = map(int, date_str.split("-"))
        except ValueError:
            uncorrected += 1
            continue
        hh, mm = et_hhmm
        et_dt = datetime(yy, mo, dd, hh, mm, tzinfo=ET_TZ)
        utc_dt = et_dt.astimezone(timezone.utc)
        cur.execute(
            "UPDATE economic_events SET datetime_utc = ?, time_known = 1 WHERE id = ?",
            (utc_dt.strftime("%Y-%m-%d %H:%M:%S"), sid),
        )
        if source == "modal":
            corrected_modal += 1
        else:
            corrected_fallback += 1
    conn.commit()
    return corrected_modal, corrected_fallback, uncorrected


def print_summary(conn) -> None:
    cur = conn.cursor()
    (total,) = cur.execute("SELECT COUNT(*) FROM economic_events").fetchone()
    mn, mx = cur.execute(
        "SELECT MIN(datetime_utc), MAX(datetime_utc) FROM economic_events"
    ).fetchone()
    print("\n-- Summary --")
    print(f"  total rows: {total:,}")
    print(f"  date range: {mn}  ->  {mx}")
    print(f"  by impact:")
    for row in cur.execute(
        "SELECT impact, COUNT(*) FROM economic_events GROUP BY impact ORDER BY 2 DESC"
    ):
        label = row[0] if row[0] is not None else "(null)"
        print(f"    {label:12s}: {row[1]:,}")
    (usd,) = cur.execute(
        "SELECT COUNT(*) FROM economic_events WHERE currency = 'USD'"
    ).fetchone()
    print(f"  USD events: {usd:,}")


def print_week(conn, label: str, start: str, end: str) -> None:
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT datetime_utc, title, actual, forecast, previous, time_known
        FROM economic_events
        WHERE currency = 'USD' AND impact = 'high'
          AND datetime_utc >= ? AND datetime_utc < ?
        ORDER BY datetime_utc
        """,
        (start + " 00:00:00", end + " 00:00:00"),
    ).fetchall()
    print(f"\n-- {label} --")
    if not rows:
        print("  (no USD high-impact events found)")
        return
    for r in rows:
        tk = "" if r[5] else "  [time_known=0]"
        print(f"  {r[0]}  {r[1]}{tk}")
        if r[2] or r[3] or r[4]:
            print(f"              actual={r[2]}, forecast={r[3]}, previous={r[4]}")


def assert_event_at(conn, date_str: str, title_exact: str, expected_hhmm: str) -> None:
    """Look up rows matching title_exact (case-insensitive) on date_str
    and print pass/fail vs expected_hhmm."""
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT datetime_utc, title, time_known FROM economic_events
        WHERE currency = 'USD' AND datetime_utc LIKE ?
          AND LOWER(title) = LOWER(?)
        ORDER BY datetime_utc
        """,
        (date_str + "%", title_exact),
    ).fetchall()
    if not rows:
        print(f"   [warn] no '{title_exact}' row found on {date_str}")
        return
    for dt, title, tk in rows:
        hhmm = dt[11:16]
        status = "[ok]" if hhmm == expected_hhmm else "[FAIL]"
        print(f"   {status} {dt}  {title}  -> expected {expected_hhmm} UTC  (time_known={tk})")


def print_philly_fed_sample(conn) -> None:
    """Show a few Philly Fed rows to confirm they were NOT forced to
    canonical (the title was intentionally removed from the map)."""
    cur = conn.cursor()
    print(f"\n-- Philly Fed Manufacturing Index sample (intentionally NOT snapped) --")
    rows = cur.execute(
        """
        SELECT datetime_utc, time_known FROM economic_events
        WHERE currency = 'USD'
          AND LOWER(title) = LOWER('Philly Fed Manufacturing Index')
          AND datetime_utc >= '2023-01-01' AND datetime_utc < '2023-04-01'
        ORDER BY datetime_utc
        LIMIT 6
        """
    ).fetchall()
    if not rows:
        print("  (no rows in window)")
        return
    times = Counter()
    for dt, tk in rows:
        hhmm = dt[11:16]
        times[hhmm] += 1
        print(f"   {dt}  (time_known={tk})")
    print(f"   distinct UTC HH:MM in sample: {dict(times)}")


def assert_nfp_at(conn, date_str: str, expected_hhmm: str) -> None:
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT datetime_utc, title, time_known FROM economic_events
        WHERE currency = 'USD' AND impact = 'high' AND datetime_utc LIKE ?
          AND title LIKE '%Non-Farm Employment Change%'
        ORDER BY datetime_utc
        """,
        (date_str + "%",),
    ).fetchall()
    if not rows:
        print(f"   [warn] no NFP row found on {date_str}")
        return
    for dt, title, tk in rows:
        hhmm = dt[11:16]
        status = "[ok]" if hhmm == expected_hhmm else "[FAIL]"
        print(f"   {status} {dt}  {title}  -> expected {expected_hhmm} UTC  (time_known={tk})")


def main() -> None:
    db_path = resolve_db_path()
    print(f"DB path resolved: {db_path}")
    if db_path.exists():
        print(f"  exists: True   size: {db_path.stat().st_size:,} bytes")
    else:
        print("  exists: False  (will be created)")

    text = download_csv(CSV_URL)
    rows = list(csv.DictReader(io.StringIO(text)))
    print(f"\nParsed {len(rows):,} CSV rows.")
    if rows:
        print(f"  CSV columns: {list(rows[0].keys())}")

    strategy = detect_strategy(rows)

    conn = sqlite3.connect(str(db_path))
    create_table(conn)
    inserted, skipped, stub_meta = insert_rows(conn, rows, strategy)
    print(f"\nInserted {inserted:,} rows, skipped {skipped:,} (bad/missing DateTime).")

    # 1. QUANTIFY before fixing
    print_stub_breakdown(conn)

    # 2a. PRIMARY repair: modal time per (title, currency) from non-stub rows
    modal = compute_modal_et_times(conn)
    print(f"\nModal-ET-time map covers {len(modal):,} (title, currency) groups.")

    # 2b. Apply modal + canonical fallback to stubs
    cm, cf, un = fix_stubs(conn, stub_meta, modal)
    print(f"\n-- Stub correction summary --")
    print(f"   corrected via MODAL:    {cm:,}")
    print(f"   corrected via FALLBACK: {cf:,}")
    print(f"   remaining time_known=0: {un:,}")

    # 2c. SANITY FLOOR - for canonical-map titles whose observed modal ET
    # is within +/-2h of canonical, snap every row of that title to the
    # canonical ET time on its own ET date. Catches cases like CPI y/y
    # at 7:30 ET (off by 1h, within tolerance) that should align with
    # CPI m/m at 8:30 ET.
    floor_adjusted, applied_log, skipped_log = apply_sanity_floor(conn)
    print(f"\n-- Sanity floor adjustments --")
    print(f"   total rows adjusted: {floor_adjusted:,}")
    print(f"   groups snapped to canonical: {len(applied_log)}")
    print(f"   groups skipped (modal diverges >2h): {len(skipped_log)}")
    if applied_log:
        print(f"\n   snapped groups (top 30 by row count):")
        applied_log.sort(key=lambda x: x[6], reverse=True)
        for (currency, title, mh, mm, ch, cm, adj, total) in applied_log[:30]:
            print(
                f"     [{currency or 'NULL'}] {title!r:55s}"
                f"  modal={mh:02d}:{mm:02d} canon={ch:02d}:{cm:02d}"
                f"  adjusted={adj}/{total}"
            )
    if skipped_log:
        print(f"\n   skipped groups (>2h divergence, sample):")
        for (currency, title, mh, mm, ch, cm, total) in skipped_log[:20]:
            print(
                f"     [{currency or 'NULL'}] {title!r:55s}"
                f"  modal={mh:02d}:{mm:02d} canon={ch:02d}:{cm:02d}"
                f"  total_rows={total}"
            )

    print_summary(conn)

    # 3. RE-VERIFY - ADP, CPI alignment, NFP, FOMC, winter NFP, Philly Fed
    print("\n-- VERIFY ADP Non-Farm Employment Change times --")
    assert_event_at(conn, "2023-06-01", "ADP Non-Farm Employment Change", "12:15")
    assert_event_at(conn, "2023-01-05", "ADP Non-Farm Employment Change", "13:15")

    print_cpi_release_day(
        conn,
        "VERIFY 2023-06-13 CPI release (summer, EDT)",
        "2023-06-13", "12:30",
    )
    print_cpi_release_day(
        conn,
        "VERIFY 2023-01-12 CPI release (winter, EST)",
        "2023-01-12", "13:30",
    )

    print_philly_fed_sample(conn)

    print_week(
        conn,
        "VERIFY 2021-07 NFP WEEK  (expect NFP 2021-07-02 12:30 UTC, EDT)",
        "2021-06-28", "2021-07-04",
    )
    assert_nfp_at(conn, "2021-07-02", "12:30")

    print_week(
        conn,
        "VERIFY 2023-06 NFP WEEK  (expect NFP 2023-06-02 12:30 UTC, EDT)",
        "2023-05-29", "2023-06-03",
    )
    assert_nfp_at(conn, "2023-06-02", "12:30")

    print_week(
        conn,
        "VERIFY 2023-01 WINTER NFP WEEK  (expect NFP 2023-01-06 13:30 UTC, EST)",
        "2023-01-02", "2023-01-08",
    )
    assert_nfp_at(conn, "2023-01-06", "13:30")

    print_week(
        conn,
        "VERIFY 2023-06 FOMC WEEK  (expect Federal Funds Rate 2023-06-14 18:00 UTC)",
        "2023-06-12", "2023-06-16",
    )

    cur = conn.cursor()
    (still_unknown,) = cur.execute(
        "SELECT COUNT(*) FROM economic_events WHERE time_known = 0"
    ).fetchone()
    print(f"\nRows remaining with time_known=0 after repair: {still_unknown:,}")

    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
