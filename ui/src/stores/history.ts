import { defineStore } from "pinia";

export interface HistoryEntry {
  id: string;
  ts: number;
  game: string;
  board: string;
  ranges: string[];
  results: { name: string; equity: number }[];
  elapsedMs: number;
}

const STORAGE_KEY = "openpql:history";
const MAX_ENTRIES = 10;

function loadInitial(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is HistoryEntry => {
      return (
        e &&
        typeof e.id === "string" &&
        typeof e.ts === "number" &&
        typeof e.game === "string" &&
        typeof e.board === "string" &&
        Array.isArray(e.ranges) &&
        e.ranges.every((r: unknown) => typeof r === "string") &&
        Array.isArray(e.results) &&
        typeof e.elapsedMs === "number"
      );
    }).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export const useHistory = defineStore("history", {
  state: () => ({
    entries: loadInitial() as HistoryEntry[],
  }),
  actions: {
    add(entry: HistoryEntry) {
      this.entries.unshift(entry);
      if (this.entries.length > MAX_ENTRIES) {
        this.entries.length = MAX_ENTRIES;
      }
      persist(this.entries);
    },
    remove(id: string) {
      this.entries = this.entries.filter((e) => e.id !== id);
      persist(this.entries);
    },
    clear() {
      this.entries = [];
      persist(this.entries);
    },
  },
});
