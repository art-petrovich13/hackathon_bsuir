// frontend/src/store/uiStore.ts
import { create } from "zustand";
import type { FilterState, RiskLevel, ChangeType, SemanticType } from "../types";

interface UiStore {
  // Боковая панель деталей изменения
  sidePanelOpen: boolean;
  selectedDiffId: string | null;

  // Фильтры на странице сравнения
  filters: FilterState;

  // Активная вкладка на ComparePage
  activeTab: "diff" | "table" | "dashboard" | "prosecutor";

  // Actions
  openSidePanel: (diffId: string) => void;
  closeSidePanel: () => void;
  setFilter: (key: keyof FilterState, value: FilterState[keyof FilterState]) => void;
  resetFilters: () => void;
  setActiveTab: (tab: UiStore["activeTab"]) => void;
}

const defaultFilters: FilterState = {
  riskLevels: [],
  changeTypes: [],
  semanticTypes: [],
  searchQuery: "",
};

export const useUiStore = create<UiStore>((set) => ({
  sidePanelOpen: false,
  selectedDiffId: null,
  filters: defaultFilters,
  activeTab: "diff",

  openSidePanel: (diffId) => set({ sidePanelOpen: true, selectedDiffId: diffId }),
  closeSidePanel: () => set({ sidePanelOpen: false, selectedDiffId: null }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: defaultFilters }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));