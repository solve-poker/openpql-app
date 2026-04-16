<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useHistory, type HistoryEntry } from "../stores/history";

const history = useHistory();

const emit = defineEmits<{
  (e: "load", entry: HistoryEntry): void;
}>();

const entries = computed(() => history.entries);

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function fmtAgo(ts: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 10) return `just now`;
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function fmtPct(x: number): string {
  return (x * 100).toFixed(2) + "%";
}

function fmtElapsedSec(ms: number): string {
  return (ms / 1000).toFixed(1) + "s";
}

function topResult(entry: HistoryEntry): { name: string; equity: number } | null {
  if (!entry.results.length) return null;
  return [...entry.results].sort((a, b) => b.equity - a.equity)[0];
}

function leaderIdx(entry: HistoryEntry): number {
  if (!entry.results.length) return -1;
  let maxI = 0;
  for (let i = 1; i < entry.results.length; i++) {
    if (entry.results[i].equity > entry.results[maxI].equity) maxI = i;
  }
  return maxI;
}

function gameBadgeClass(game: string): string {
  const g = game.toLowerCase();
  if (g.includes("shortdeck")) return "bg-amber-500/20 text-amber-300";
  if (g.includes("omaha")) return "bg-violet-500/20 text-violet-300";
  if (g.includes("holdem") || g.includes("hold'em") || g.includes("holdm")) return "bg-emerald-500/20 text-emerald-300";
  return "bg-slate-700 text-slate-300";
}

function onLoad(entry: HistoryEntry) {
  emit("load", entry);
}

function onRemove(id: string) {
  history.remove(id);
}

function onClearAll() {
  history.clear();
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="bg-slate-900/60 px-3 py-2 text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-between border-b border-slate-800">
      <span>History</span>
      <button
        v-if="entries.length"
        class="normal-case font-normal text-slate-300 bg-slate-800 hover:bg-slate-700 rounded px-2 py-0.5 text-[11px]"
        @click="onClearAll">Clear all</button>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="!entries.length" class="h-full flex items-center justify-center text-slate-500 text-sm">
        No runs yet
      </div>
      <ul v-else class="divide-y divide-slate-800/60">
        <li
          v-for="entry in entries"
          :key="entry.id"
          tabindex="0"
          class="px-3 py-2 hover:bg-slate-900/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/60 rounded transition-colors"
          @keydown.enter="onLoad(entry)"
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <!-- Top line -->
              <div class="flex items-center gap-2 text-[11px] text-slate-500">
                <span class="tabular-nums">{{ fmtAgo(entry.ts, now) }}</span>
                <span
                  class="px-1.5 py-0.5 text-[10px] uppercase tracking-wide rounded"
                  :class="gameBadgeClass(entry.game)"
                >{{ entry.game }}</span>
                <span class="px-1.5 py-0.5 text-[10px] uppercase tracking-wide rounded bg-slate-800 text-slate-400">
                  {{ entry.ranges.length }}-way
                </span>
                <span class="tabular-nums ml-auto">{{ fmtElapsedSec(entry.elapsedMs) }}</span>
              </div>

              <!-- Middle line: top player -->
              <div class="mt-1 text-sm font-medium text-slate-200 font-mono truncate">
                <template v-if="topResult(entry)">
                  {{ topResult(entry)!.name }}
                  <span class="text-emerald-400 tabular-nums">{{ fmtPct(topResult(entry)!.equity) }}</span>
                </template>
                <template v-else>
                  <span class="text-slate-500">—</span>
                </template>
              </div>

              <!-- Bottom: equity bar -->
              <div v-if="entry.results.length" class="mt-1.5 flex w-full h-1.5 rounded overflow-hidden bg-slate-800">
                <div
                  v-for="(r, i) in entry.results"
                  :key="i"
                  class="h-full"
                  :class="i === leaderIdx(entry) ? 'bg-emerald-500' : 'bg-slate-500'"
                  :style="{ width: Math.max(0, Math.min(100, r.equity * 100)) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Right-aligned buttons -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                class="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                @click="onLoad(entry)">Load</button>
              <button
                class="px-1.5 py-0.5 text-[11px] rounded text-slate-500 hover:text-rose-400"
                :title="'Delete'"
                @click="onRemove(entry.id)">✕</button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
