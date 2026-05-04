import { create } from 'zustand';

interface AuthState {
  uid: string | null;
  username: string;
  email: string;
  isReady: boolean;
  setUser: (uid: string, username: string, email: string) => void;
  clearUser: () => void;
  setReady: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  username: '',
  email: '',
  isReady: false,
  setUser: (uid, username, email) => set({ uid, username, email }),
  clearUser: () => set({ uid: null, username: '', email: '' }),
  setReady: () => set({ isReady: true }),
}));
