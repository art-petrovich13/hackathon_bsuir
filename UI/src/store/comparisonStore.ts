// frontend/src/store/comparisonStore.ts
import { create } from "zustand";

interface ComparisonStore {
  // Загруженные документы
  docOldId: string | null;
  docNewId: string | null;
  docOldName: string | null;
  docNewName: string | null;

  // Текущее сравнение
  comparisonId: string | null;

  // Сеттеры
  setDocOld: (id: string, name: string) => void;
  setDocNew: (id: string, name: string) => void;
  setComparisonId: (id: string) => void;

  // Сброс
  reset: () => void;
}

export const useComparisonStore = create<ComparisonStore>((set) => ({
  docOldId: null,
  docNewId: null,
  docOldName: null,
  docNewName: null,
  comparisonId: null,

  setDocOld: (id, name) => set({ docOldId: id, docOldName: name }),
  setDocNew: (id, name) => set({ docNewId: id, docNewName: name }),
  setComparisonId: (id) => set({ comparisonId: id }),

  reset: () =>
    set({
      docOldId: null,
      docNewId: null,
      docOldName: null,
      docNewName: null,
      comparisonId: null,
    }),
}));