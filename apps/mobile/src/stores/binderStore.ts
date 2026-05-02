import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type BinderState = {
  currentPage: number;
};

export type BinderActions = {
  nextPage: (totalPages: number) => void;
  prevPage: () => void;
  setPage: (page: number, totalPages: number) => void;
  reset: () => void;
};

const INITIAL_PAGE = 1;

const clamp = (page: number, totalPages: number): number => {
  if (page < 1) return 1;
  const ceiling = Math.max(1, totalPages);
  return page > ceiling ? ceiling : page;
};

export const useBinderStore = create<BinderState & BinderActions>()(
  subscribeWithSelector((set) => ({
    currentPage: INITIAL_PAGE,
    nextPage: (totalPages) =>
      set((s) => ({ currentPage: clamp(s.currentPage + 1, totalPages) })),
    prevPage: () => set((s) => ({ currentPage: clamp(s.currentPage - 1, Number.MAX_SAFE_INTEGER) })),
    setPage: (page, totalPages) => set({ currentPage: clamp(page, totalPages) }),
    reset: () => set({ currentPage: INITIAL_PAGE }),
  })),
);