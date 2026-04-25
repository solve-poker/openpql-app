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

// Game label gets a soft-tinted token chip — reserved by variant, not bespoke colors.
function gameBadgeClass(game: string): string {
  const g = game.toLowerCase();
  if (g.includes("shortdeck"))
    return "bg-accent-soft text-accent border-accent/30";
  if (g.includes("omaha"))
    return "bg-primary-soft text-primary border-primary/30";
  if (g.includes("holdem") || g.includes("hold'em") || g.includes("holdm"))
    return "bg-success/10 text-success border-success/30";
  return "bg-elevated text-muted border-line";
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
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-line bg-elevated/40 px-4 py-2">
      <span class="label">History</span>
      <button
        v-if="entries.length"
        type="button"
        class="rounded-md border border-line bg-surface px-2.5 py-0.5 text-2xs font-semibold text-fg transition hover:bg-elevated hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        @click="onClearAll">Clear all</button>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="!entries.length" class="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
        No runs yet
      </div>
      <ul v-else class="divide-y divide-line">
        <li
          v-for="entry in entries"
          :key="entry.id"
          tabindex="0"
          class="px-4 py-3 transition hover:bg-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          @keydown.enter="onLoad(entry)"
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <!-- Top line -->
              <div class="flex items-center gap-2 text-2xs text-muted">
                <span class="font-mono tabular-nums">{{ fmtAgo(entry.ts, now) }}</span>
                <span
                  class="rounded-chip border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider"
                  :class="gameBadgeClass(entry.game)"
                >{{ entry.game }}</span>
                <span class="rounded-chip border border-line bg-surface px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-muted">
                  {{ entry.ranges.length }}-way
                </span>
                <span class="ml-auto font-mono tabular-nums">{{ fmtElapsedSec(entry.elapsedMs) }}</span>
              </div>

              <!-- Middle line: top player -->
              <div class="mt-1.5 truncate font-mono text-sm font-medium text-fg">
                <template v-if="topResult(entry)">
                  {{ topResult(entry)!.name }}
                  <span class="text-primary tabular-nums">▲ {{ fmtPct(topResult(entry)!.equity) }}</span>
                </template>
                <template v-else>
                  <span class="text-subtle">—</span>
                </template>
              </div>

              <!-- Bottom: equity bar -->
              <div v-if="entry.results.length" class="mt-2 flex h-1.5 w-full overflow-hidden rounded-chip bg-elevated">
                <div
                  v-for="(r, i) in entry.results"
                  :key="i"
                  class="h-full"
                  :class="i === leaderIdx(entry) ? 'bg-primary' : 'bg-subtle'"
                  :style="{ width: Math.max(0, Math.min(100, r.equity * 100)) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Right-aligned buttons -->
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded-md border border-line bg-surface px-2.5 py-0.5 text-2xs font-semibold text-fg transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                @click="onLoad(entry)">Load</button>
              <button
                type="button"
                class="rounded-md px-1.5 py-0.5 text-2xs text-muted transition hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                title="Delete"
                aria-label="Delete history entry"
                @click="onRemove(entry.id)">✕</button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
