"""
Symbol map for Pocket Trade.
All display names use generic instrument labels — never exchange-specific.
"""

# Maps our internal symbol → user-facing display name
DISPLAY_NAMES = {
    "ES":   "S&P 500 E-Mini",
    "NQ":   "NASDAQ 100 E-Mini",
    "YM":   "Dow Jones E-Mini",
    "GC":   "Gold Futures",
}

# Maps our internal symbol → category grouping for the watchlist UI.
# Spot indexes are kept distinct from index futures so that, for example,
# NDX (spot) and NQ (E-Mini future) don't read as duplicate "NQ" rows.
CATEGORIES = {
    "ES":   "Futures",
    "NQ":   "Futures",
    "YM":   "Futures",
    "GC":   "Futures",
}

# pip = minimum price increment; contractSize = notional per lot
CONTRACT_SPECS = {
    #  symbol     pip       contractSize
    "ES":   {"pip": 0.25,    "contractSize": 50},
    "NQ":   {"pip": 0.25,    "contractSize": 1},
    "YM":   {"pip": 1.0,     "contractSize": 5},
    "GC":   {"pip": 0.10,    "contractSize": 100},
}

# Stooq ticker → internal symbol (daily data)
STOOQ_MAP = {
    "ES.F":  "ES",
    "NQ.F":  "NQ",
    "YM.F":  "YM",
    "GC.F":  "GC",
}

# Kaggle CSV filename → internal symbol
# SPY and QQQ intraday data is displayed as ES and NQ respectively
KAGGLE_MAP = {
    "clean_SPY.csv": "ES",
    "clean_QQQ.csv": "NQ",
}
