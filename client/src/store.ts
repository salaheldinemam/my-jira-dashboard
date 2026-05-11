import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StatusMappingState = Record<string, string[]>;

type UiState = {
  projectKeys: string[];
  setProjectKeys: (keys: string[]) => void;
  dateFrom: string;
  dateTo: string;
  setDateRange: (from: string, to: string) => void;
  jiraBaseUrl: string | null;
  setJiraBaseUrl: (baseUrl: string | null) => void;
};

const today = new Date();
const weekAgo = new Date(today);
weekAgo.setDate(weekAgo.getDate() - 14);

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      projectKeys: [],
      setProjectKeys: (keys) => set({ projectKeys: keys }),
      dateFrom: fmt(weekAgo),
      dateTo: fmt(today),
      setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
      jiraBaseUrl: null,
      setJiraBaseUrl: (baseUrl) => set({ jiraBaseUrl: baseUrl }),
    }),
    { name: "jira-insights-ui" }
  )
);
