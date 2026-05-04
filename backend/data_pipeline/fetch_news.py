"""
News snapshot fetcher for Pocket Trade trade journal.

Each closed trade stores a news_snapshot: a list of up to 3 headline strings
from the approximate date of the trade, so users can reflect on what was
happening in the market at that time.

TODO: Wire up a real free source. Candidates:
  - NewsAPI.org   — free tier: 100 req/day, 1 month history (dev only)
  - GDELT Project — public domain, full history, complex API
  - Finnhub       — free tier: market news endpoint, limited history
  - MediaStack    — free tier: 500 req/month

For now this module returns an empty list so the rest of the app can ship.
Replace `fetch_headlines` with a real implementation when a source is chosen.
"""

from datetime import date
from typing import Optional


def fetch_headlines(symbol: str, on_date: date, limit: int = 3) -> list[str]:
    """
    Return up to `limit` market-relevant headlines for `symbol` on `on_date`.

    TODO: implement with a real news source.
    """
    return []


def news_snapshot(symbol: str, on_date: Optional[date] = None) -> list[str]:
    if on_date is None:
        on_date = date.today()
    return fetch_headlines(symbol, on_date)
