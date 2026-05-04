"""
Symbol map for Pocket Trade.
All display names use generic instrument labels — never exchange-specific.
"""

# Maps our internal symbol → user-facing display name
DISPLAY_NAMES = {
    "SPX":  "S&P 500",
    "NDX":  "NASDAQ 100",
    "DJI":  "Dow Jones",
    "DAX":  "DAX 40",
    "FTSE": "FTSE 100",
    "N225": "Nikkei 225",
    "ES":   "S&P 500 E-Mini",
    "NQ":   "NASDAQ E-Mini",
    "YM":   "Dow E-Mini",
    "CL":   "Crude Oil (WTI)",
    "GC":   "Gold",
    "SI":   "Silver",
    "NG":   "Natural Gas",
    "ZB":   "T-Bond Futures",
}

# pip = minimum price increment; contractSize = notional per lot
CONTRACT_SPECS = {
    #  symbol     pip       contractSize
    "SPX":  {"pip": 0.25,    "contractSize": 50},
    "NDX":  {"pip": 0.25,    "contractSize": 20},
    "DJI":  {"pip": 1.0,     "contractSize": 1},
    "DAX":  {"pip": 0.5,     "contractSize": 25},
    "FTSE": {"pip": 0.5,     "contractSize": 10},
    "N225": {"pip": 5.0,     "contractSize": 1000},
    "ES":   {"pip": 0.25,    "contractSize": 50},
    "NQ":   {"pip": 0.25,    "contractSize": 20},
    "YM":   {"pip": 1.0,     "contractSize": 5},
    "CL":   {"pip": 0.01,    "contractSize": 1000},
    "GC":   {"pip": 0.1,     "contractSize": 100},
    "SI":   {"pip": 0.005,   "contractSize": 5000},
    "NG":   {"pip": 0.001,   "contractSize": 10000},
    "ZB":   {"pip": 0.03125, "contractSize": 1000},
}

# Stooq ticker → internal symbol (daily data)
STOOQ_MAP = {
    "^SPX":  "SPX",
    "^NDX":  "NDX",
    "^DJI":  "DJI",
    "^DAX":  "DAX",
    "^FTSE": "FTSE",
    "^N225": "N225",
    "ES.F":  "ES",
    "NQ.F":  "NQ",
    "YM.F":  "YM",
    "CL.F":  "CL",
    "GC.F":  "GC",
    "SI.F":  "SI",
    "NG.F":  "NG",
    "ZB.F":  "ZB",
}

# Kaggle CSV filename → internal symbol
# SPY and QQQ intraday data is displayed as ES and NQ respectively
KAGGLE_MAP = {
    "clean_SPY.csv": "ES",
    "clean_QQQ.csv": "NQ",
}
