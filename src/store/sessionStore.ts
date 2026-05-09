import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pocket_trade_session_id';

export interface SessionCandle {
  bar: number;
  time?: number;   // unix seconds — set by the backend, used for the chart's date axis
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SessionPosition {
  id: string;
  side: 'buy' | 'sell';
  lots: number;
  entry_price: number;
  stop_loss?: number;
  take_profit?: number;
  opened_at: number;
}

export interface SessionTrade {
  id: string;
  side: 'buy' | 'sell';
  lots: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pips: number;
  r_multiple?: number;
}

interface SessionState {
  sessionId: string | null;
  symbol: string;
  timeframe: string;
  accountSize: number;
  balance: number;
  candles: SessionCandle[];
  currentBar: number;
  positions: SessionPosition[];
  closedTrades: SessionTrade[];
  isEnded: boolean;

  startSession: (data: {
    session_id: string;
    symbol: string;
    timeframe: string;
    account_size: number;
    balance: number;
    candles: SessionCandle[];
    current_bar: number;
  }) => Promise<void>;

  restoreSession: (data: {
    session_id: string;
    symbol: string;
    timeframe: string;
    account_size: number;
    balance: number;
    candles: SessionCandle[];
    current_bar: number;
    open_positions: SessionPosition[];
    closed_trades: SessionTrade[];
    status: string;
  }) => void;

  appendCandles: (newCandles: SessionCandle[]) => void;

  addPosition: (pos: SessionPosition) => void;
  removePosition: (id: string) => void;
  addClosedTrade: (trade: SessionTrade) => void;
  setBalance: (balance: number) => void;
  endSession: () => Promise<void>;
  reset: () => Promise<void>;

  /** Returns stored session_id if one exists (for resume on app open). */
  getSavedSessionId: () => Promise<string | null>;
}

const EMPTY = {
  sessionId: null as string | null,
  symbol: '',
  timeframe: '',
  accountSize: 0,
  balance: 0,
  candles: [] as SessionCandle[],
  currentBar: 0,
  positions: [] as SessionPosition[],
  closedTrades: [] as SessionTrade[],
  isEnded: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...EMPTY,

  startSession: async (data) => {
    await AsyncStorage.setItem(STORAGE_KEY, data.session_id);
    set({
      sessionId: data.session_id,
      symbol: data.symbol,
      timeframe: data.timeframe,
      accountSize: data.account_size,
      balance: data.balance,
      candles: data.candles,
      currentBar: data.current_bar,
      positions: [],
      closedTrades: [],
      isEnded: false,
    });
  },

  restoreSession: (data) => {
    set({
      sessionId: data.session_id,
      symbol: data.symbol,
      timeframe: data.timeframe,
      accountSize: data.account_size,
      balance: data.balance,
      candles: data.candles,
      currentBar: data.current_bar,
      positions: data.open_positions,
      closedTrades: data.closed_trades,
      isEnded: data.status === 'ended',
    });
  },

  appendCandles: (newCandles) =>
    set((s) => ({
      candles: [...s.candles, ...newCandles],
      currentBar: newCandles.length > 0 ? newCandles[newCandles.length - 1].bar : s.currentBar,
    })),

  addPosition: (pos) => set((s) => ({ positions: [...s.positions, pos] })),

  removePosition: (id) =>
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),

  addClosedTrade: (trade) =>
    set((s) => ({ closedTrades: [...s.closedTrades, trade] })),

  setBalance: (balance) => set({ balance }),

  endSession: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ isEnded: true });
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set(EMPTY);
  },

  getSavedSessionId: async () => {
    return AsyncStorage.getItem(STORAGE_KEY);
  },
}));
