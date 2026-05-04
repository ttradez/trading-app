export interface Candle {
  time: number; // unix timestamp seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Market {
  symbol: string;
  name: string;
  category: 'crypto' | 'index' | 'futures' | 'commodity';
  pip: number;      // minimum price move
  contractSize: number;
  baseCurrency: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
  unrealizedPnl: number;
  pip: number;
  contractSize: number;
}

export interface TradingSession {
  sessionId: string;
  symbol: string;
  timeframe: Timeframe;
  accountSize: number;
  balance: number;
  currentBar: number;
  status: 'active' | 'ended';
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
  closedAt: number;
  pnl: number;
  pips: number;
}

export interface Account {
  uid: string;
  username: string;
  email: string;
  balance: number;
  startingBalance: number;
  equity: number;
  totalPnl: number;
  dailyPnl: number;
  winRate: number;
  totalTrades: number;
  createdAt: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W';
