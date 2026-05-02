import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type SessionStatus = 'idle' | 'active' | 'expired';

export type SessionState = {
  jwt: string | null;
  iat: number | null;
  userId: string | null;
  email: string | null;
  status: SessionStatus;
};

export type SessionActions = {
  setSession: (input: { jwt: string; iat: number; userId: string; email: string }) => void;
  clearSession: () => void;
  markExpired: () => void;
};

const initialState: SessionState = {
  jwt: null,
  iat: null,
  userId: null,
  email: null,
  status: 'idle',
};

export const useSessionStore = create<SessionState & SessionActions>()(
  subscribeWithSelector((set) => ({
    ...initialState,
    setSession: ({ jwt, iat, userId, email }) =>
      set({ jwt, iat, userId, email, status: 'active' }),
    clearSession: () => set({ ...initialState }),
    markExpired: () => set((s) => ({ ...s, status: 'expired' })),
  })),
);