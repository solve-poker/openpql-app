<script setup lang="ts">
import { computed, ref } from "vue";
import { useRun } from "../stores/run";
const run = useRun();
const showRaw = ref(false);
const copyLabel = ref("Copy");

const sorted = computed(() =>
  [...run.results].sort((a, b) => b.equity - a.equity),
);

const leaderIndices = computed<number[]>(() => {
  if (!sorted.value.length) return [];
  const top = sorted.value[0].equity;
  const threshold = 0.005;
  return sorted.value
    .filter((r) => Math.abs(r.equity - top) <= threshold)
    .map((r) => r.index);
});

const nFmt = new Intl.NumberFormat("en-US");
function fmt(n: number) {
  return nFmt.format(n);
}
function fmtPct(x: number) {
  return (x * 100).toFixed(2) + "%";
}
function fmtElapsedSec(ms: number) {
  return (ms / 1000).toFixed(1) + "s";
}

const effectiveN = computed(() => {
  if (run.trials > 0) return run.trials;
  if (run.successes > 0) return run.successes;
  return 0;
});

const showCi = computed(() => effectiveN.value > 0);

function ci95(p: number) {
  const n = effectiveN.value;
  if (n <= 0) return 0;
  const clamped = Math.max(0, Math.min(1, p));
  return 1.96 * Math.sqrt((clamped * (1 - clamped)) / n);
}

function tooltipFor(equity: number) {
  const lines = [`Win%: ${(equity * 100).toFixed(4)}%`];
  if (showCi.value) {
    lines.push(`CI 95%: ±${(ci95(equity) * 100).toFixed(4)}%`);
    lines.push(`Based on ${fmt(run.trials || run.successes)} trials`);
  }
  return lines.join("\n");
}

async function copyResults() {
  const rows = sorted.value.map((r) => `${r.name}\t${fmtPct(r.equity)}`);
  const text = ["Player\tEquity", ...rows].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copyLabel.value = "Copied ✓";
    setTimeout(() => (copyLabel.value = "Copy"), 1500);
  } catch {
    copyLabel.value = "Failed";
    setTimeout(() => (copyLabel.value = "Copy"), 1500);
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-line bg-elevated/40 px-4 py-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-muted">Results</span>
      <div class="flex items-center gap-2">
        <span v-if="run.running" aria-live="polite" class="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-2xs font-semibold text-info">
          <span class="h-1.5 w-1.5 rounded-full bg-info motion-safe:animate-pulse"></span>
          Running
        </span>
        <template v-else-if="run.results.length || run.trials || run.elapsedMs">
          <div class="flex items-center gap-1.5">
            <span class="inline-flex items-center gap-1.5 rounded-chip border border-line px-2 py-0.5 text-2xs font-medium text-muted">
              <span class="text-subtle uppercase tracking-wider">Trials</span>
              <span class="font-mono text-fg">{{ fmt(run.trials) }}</span>
            </span>
            <span v-if="run.successes > 0" class="inline-flex items-center gap-1.5 rounded-chip border border-line px-2 py-0.5 text-2xs font-medium text-muted">
              <span class="text-subtle uppercase tracking-wider">Hits</span>
              <span class="font-mono text-fg">{{ fmt(run.successes) }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-chip border border-line px-2 py-0.5 text-2xs font-medium text-muted">
              <span class="text-subtle uppercase tracking-wider">Elapsed</span>
              <span class="font-mono text-fg">{{ fmtElapsedSec(run.elapsedMs) }}</span>
            </span>
          </div>
        </template>
        <span v-else class="text-2xs uppercase tracking-wider text-subtle">idle</span>
        <button
          v-if="run.results.length"
          type="button"
          class="rounded-md border border-line bg-surface px-2.5 py-0.5 text-2xs font-semibold text-fg transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          @click="copyResults">
          {{ copyLabel }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- Empty state -->
      <div v-if="!run.results.length && !run.stdout.length && !run.stderr.length && !run.running && !run.error"
        class="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
        <div class="grid h-12 w-12 place-items-center rounded-full border border-line text-muted">▶</div>
        <div class="text-sm font-medium text-fg">No results yet</div>
        <div class="text-xs text-muted">
          Press <kbd class="rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-2xs text-fg">⌘↵</kbd> to run
        </div>
      </div>

      <!-- Error row -->
      <div v-if="run.error && !run.running"
        role="alert"
        class="mb-3 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs">
        <span aria-hidden="true" class="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-2xs font-bold text-white">!</span>
        <div>
          <div class="font-semibold text-danger">Run failed</div>
          <div class="mt-0.5 text-muted">{{ run.error }}</div>
        </div>
      </div>

      <!-- Equity table -->
      <table v-if="run.results.length" class="w-full text-sm">
        <thead class="sticky top-0 z-10 bg-surface/95 backdrop-blur">
          <tr class="text-2xs uppercase tracking-wider text-muted">
            <th class="py-2 pr-2 text-left font-semibold">Player</th>
            <th class="px-2 py-2 text-right font-semibold">Equity</th>
            <th v-if="showCi" class="px-2 py-2 text-right font-semibold">±</th>
            <th class="w-1/2 py-2 pl-2 font-semibold">
              <span class="sr-only">Bar</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="r in sorted"
            :key="r.index"
            class="transition hover:bg-elevated/50"
          >
            <td class="py-2 pr-2 font-mono text-fg">
              <span class="inline-flex items-center gap-1.5">
                <span
                  v-if="leaderIndices.includes(r.index)"
                  class="rounded-chip bg-success/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-success"
                >▲ Lead</span>
                <span>{{ r.name }}</span>
              </span>
            </td>
            <td class="px-2 py-2 text-right font-mono tabular-nums text-fg">
              <span :title="tooltipFor(r.equity)">{{ fmtPct(r.equity) }}</span>
            </td>
            <td v-if="showCi" class="px-2 py-2 text-right font-mono text-2xs tabular-nums text-muted">
              ±{{ (ci95(r.equity) * 100).toFixed(2) }}%
            </td>
            <td class="py-2 pl-2">
              <div class="h-2 overflow-hidden rounded-chip bg-elevated">
                <div class="h-full transition-[width] duration-300 motion-reduce:transition-none"
                  :class="leaderIndices.includes(r.index) ? 'bg-primary' : 'bg-subtle'"
                  :style="{ width: Math.max(0, Math.min(100, r.equity * 100)) + '%' }"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Errors surfaced prominently -->
      <div v-if="run.stderr.length" class="mt-3 whitespace-pre-wrap font-mono text-xs text-danger">
        <div v-for="(l, i) in run.stderr" :key="'e' + i">{{ l }}</div>
      </div>

      <!-- Raw logs disclosure -->
      <div v-if="run.stdout.length" class="mt-3">
        <button
          type="button"
          class="text-xs text-muted transition hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          @click="showRaw = !showRaw">
          {{ showRaw ? '▾' : '▸' }} Raw logs ({{ run.stdout.length }})
        </button>
        <div v-if="showRaw" class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-mono text-xs text-fg">
          <div v-for="(l, i) in run.stdout" :key="'o' + i">{{ l }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
