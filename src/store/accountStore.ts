import { create } from 'zustand';
import { Account, Position, ClosedTrade } from '../types';

interface AccountState {
  account: Account | null;
  positions: Position[];
  trades: ClosedTrade[];
  setAccount: (account: Account) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  closePosition: (id: string, exitPrice: number) => void;
  clearAll: () => void;
}

const STARTING_BALANCE = 100000;

export const useAccountStore = create<AccountState>((set, get) => ({
  account: null,
  positions: [],
  trades: [],

  setAccount: (account) => set({ account }),

  addPosition: (position) =>
    set((state) => ({ positions: [...state.positions, position] })),

  updatePosition: (id, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  closePosition: (id, exitPrice) => {
    const state = get();
    const pos = state.positions.find((p) => p.id === id);
    if (!pos || !state.account) return;

    const pips = pos.side === 'buy'
      ? (exitPrice - pos.entryPrice) / pos.pip
      : (pos.entryPrice - exitPrice) / pos.pip;
    const pnl = pips * pos.lots * pos.contractSize;

    const closed: ClosedTrade = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      lots: pos.lots,
      entryPrice: pos.entryPrice,
      exitPrice,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      pnl,
      pips,
    };

    const newBalance = state.account.balance + pnl;
    const wins = state.trades.filter((t) => t.pnl > 0).length + (pnl > 0 ? 1 : 0);
    const total = state.trades.length + 1;

    set((s) => ({
      positions: s.positions.filter((p) => p.id !== id),
      trades: [...s.trades, closed],
      account: s.account
        ? {
            ...s.account,
            balance: newBalance,
            equity: newBalance,
            totalPnl: s.account.totalPnl + pnl,
            dailyPnl: s.account.dailyPnl + pnl,
            totalTrades: total,
            winRate: wins / total,
          }
        : null,
    }));
  },

  clearAll: () => set({ positions: [], trades: [] }),
}));
