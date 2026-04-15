import { defineStore } from "pinia";

export interface HistoryEntry {
  id: string;
  src: string;
  ts: number;
  pinned?: boolean;
}

export const useHistory = defineStore("history", {
  state: () => ({ entries: [] as HistoryEntry[] }),
  actions: {
    add(src: string) {
      if (!src.trim()) return;
      const trimmed = src.trim();
      if (this.entries[0]?.src === trimmed) return;
      this.entries.unshift({
        id: crypto.randomUUID(),
        src: trimmed,
        ts: Date.now(),
      });
      const keep = this.entries.filter((e) => e.pinned);
      const recent = this.entries.filter((e) => !e.pinned).slice(0, 50);
      this.entries = [...keep, ...recent].slice(0, 100);
    },
    togglePin(id: string) {
      const e = this.entries.find((x) => x.id === id);
      if (e) e.pinned = !e.pinned;
    },
    remove(id: string) {
      this.entries = this.entries.filter((e) => e.id !== id);
    },
  },
  persist: true,
});
