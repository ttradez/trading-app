import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Drawing, DrawingType, DEFAULT_STYLE, TOOL_BY_ID } from '../types/drawings';

const STORAGE_KEY = '@pocket_trade_drawings';
const FAV_KEY     = '@pocket_trade_drawing_favorites';
const MAGNET_KEY  = '@pocket_trade_magnet_mode';
const STICKY_KEY  = '@pocket_trade_sticky_drawing';

export type MagnetMode = 'off' | 'weak' | 'strong';

interface DrawingsState {
  drawings: Drawing[];
  activeTool: DrawingType;
  favorites: Set<DrawingType>;
  selectedId: string | null;
  /** Whether the bottom-sheet settings panel for the selected drawing is open.
   *  Decoupled from selectedId: single-tap on a drawing selects it (shows
   *  handles + enables body-drag) without opening settings; second tap on
   *  the same drawing within 350ms toggles this to true. */
  settingsOpen: boolean;
  pendingPoints: { time: number; price: number }[];
  /** Snap-to-OHLC magnet mode. */
  magnet: MagnetMode;
  /** When true the drawing tool stays active after each placement so the
   *  user can rapid-fire multiple of the same shape (TradingView "lock"). */
  stickyMode: boolean;

  setActiveTool: (tool: DrawingType) => void;
  addDrawing: (d: Drawing) => void;
  updateDrawing: (id: string, patch: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  clearAll: () => void;
  setSelected: (id: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleFavorite: (tool: DrawingType) => void;
  appendPendingPoint: (p: { time: number; price: number }) => void;
  resetPending: () => void;
  setMagnet: (m: MagnetMode) => void;
  setStickyMode: (s: boolean) => void;
  duplicateDrawing: (id: string) => void;

  hydrate: () => Promise<void>;
}

const persistDrawings = (drawings: Drawing[]) => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drawings)).catch(() => {});
};
const persistFavorites = (favs: Set<DrawingType>) => {
  AsyncStorage.setItem(FAV_KEY, JSON.stringify([...favs])).catch(() => {});
};

export const useDrawingsStore = create<DrawingsState>((set, get) => ({
  drawings: [],
  activeTool: 'cursor_cross',
  // Favorites — only IDs in the pruned 10-tool catalog. 'arrow' was deleted.
  favorites: new Set<DrawingType>(['trendline', 'hline', 'fib_retracement', 'rectangle', 'text']),
  selectedId: null,
  settingsOpen: false,
  pendingPoints: [],
  magnet: 'off' as MagnetMode,
  stickyMode: false,

  setActiveTool: (tool) =>
    set({ activeTool: tool, pendingPoints: [], selectedId: null, settingsOpen: false }),

  addDrawing: (d) => {
    // Don't auto-select after creation — user has to tap the drawing to open
    // its settings (TradingView default).
    const next = [...get().drawings, d];
    persistDrawings(next);
    set({ drawings: next, selectedId: null, settingsOpen: false, pendingPoints: [] });
  },

  updateDrawing: (id, patch) => {
    const next = get().drawings.map((d) => (d.id === id ? { ...d, ...patch, style: { ...d.style, ...patch.style } } : d));
    persistDrawings(next);
    set({ drawings: next });
  },

  removeDrawing: (id) => {
    const next = get().drawings.filter((d) => d.id !== id);
    persistDrawings(next);
    const wasSel = get().selectedId === id;
    set({
      drawings: next,
      selectedId: wasSel ? null : get().selectedId,
      settingsOpen: wasSel ? false : get().settingsOpen,
    });
  },

  clearAll: () => {
    persistDrawings([]);
    set({ drawings: [], selectedId: null, settingsOpen: false, pendingPoints: [] });
  },

  // Final tap behavior (reverses Phase 2A.1):
  //   single-tap = select + show handles, settings sheet stays closed
  //   double-tap = open settings sheet
  // setSelected only changes selection. settingsOpen toggles via setSettingsOpen.
  // Deselect (id=null) auto-closes settings since the modal targets a specific
  // drawing.
  setSelected: (id) =>
    set({ selectedId: id, settingsOpen: id == null ? false : get().settingsOpen }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  toggleFavorite: (tool) => {
    const favs = new Set(get().favorites);
    if (favs.has(tool)) favs.delete(tool); else favs.add(tool);
    persistFavorites(favs);
    set({ favorites: favs });
  },

  appendPendingPoint: (p) => set({ pendingPoints: [...get().pendingPoints, p] }),
  resetPending: () => set({ pendingPoints: [] }),

  setMagnet: (m) => {
    AsyncStorage.setItem(MAGNET_KEY, m).catch(() => {});
    set({ magnet: m });
  },

  setStickyMode: (s) => {
    AsyncStorage.setItem(STICKY_KEY, s ? '1' : '0').catch(() => {});
    set({ stickyMode: s });
  },

  duplicateDrawing: (id) => {
    const orig = get().drawings.find((d) => d.id === id);
    if (!orig) return;
    // Offset the duplicate slightly so it's visible (5% of price range, 5 bars).
    const dx = orig.points.length >= 2 ? (orig.points[1].time - orig.points[0].time) * 0.05 : 5;
    const dy = orig.points.reduce((acc, p, i) => i === 0 ? p.price : Math.abs(p.price - orig.points[0].price) + acc, 0) * 0.05 || 1;
    const copy: Drawing = {
      ...orig,
      id: `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      points: orig.points.map((p) => ({ time: p.time + dx, price: p.price - dy })),
    };
    const next = [...get().drawings, copy];
    persistDrawings(next);
    set({ drawings: next, selectedId: copy.id });
  },

  hydrate: async () => {
    try {
      const [d, f, m, s] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(FAV_KEY),
        AsyncStorage.getItem(MAGNET_KEY),
        AsyncStorage.getItem(STICKY_KEY),
      ]);
      const patch: Partial<DrawingsState> = {};
      // Tools deleted from the catalog after the 10-tool prune (DRAWING_TOOLS_AUDIT.md)
      // may still be in users' AsyncStorage. Filter both lists by current TOOL_BY_ID
      // membership so we never try to render or render-toolbar an unknown type.
      const isKnownType = (t: string): t is DrawingType => !!TOOL_BY_ID[t as DrawingType];
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed)) {
          patch.drawings = parsed.filter((dr: any) => dr && isKnownType(dr.type));
        }
      }
      if (f) {
        const parsed = JSON.parse(f);
        if (Array.isArray(parsed)) {
          patch.favorites = new Set<DrawingType>(parsed.filter(isKnownType));
        }
      }
      if (m === 'off' || m === 'weak' || m === 'strong') patch.magnet = m;
      if (s === '1') patch.stickyMode = true;
      if (Object.keys(patch).length) set(patch as any);
    } catch {}
  },
}));

export { DEFAULT_STYLE };
