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
  const threshold = 0.005; // 0.5%
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
  <div class="h-full flex flex-col overflow-hidden">
    <div class="bg-slate-900/60 px-3 py-2 text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-between border-b border-slate-800">
      <span>Results</span>
      <div class="flex items-center gap-3">
        <span v-if="run.running" class="text-emerald-400 animate-pulse normal-case font-normal">● running</span>
        <template v-else-if="run.results.length || run.trials || run.elapsedMs">
          <div class="flex items-center gap-1.5 normal-case font-normal">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-400">
              <span class="text-slate-500">Trials</span>
              <span>{{ fmt(run.trials) }}</span>
            </span>
            <span v-if="run.successes > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-400">
              <span class="text-slate-500">Successes</span>
              <span>{{ fmt(run.successes) }}</span>
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-400">
              <span class="text-slate-500">Elapsed</span>
              <span>{{ fmtElapsedSec(run.elapsedMs) }}</span>
            </span>
          </div>
        </template>
        <span v-else class="text-slate-500 normal-case font-normal">idle</span>
        <button
          v-if="run.results.length"
          class="normal-case font-normal text-slate-300 bg-slate-800 hover:bg-slate-700 rounded px-2 py-0.5 text-[11px]"
          @click="copyResults">
          {{ copyLabel }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-3">
      <!-- Empty state -->
      <div v-if="!run.results.length && !run.stdout.length && !run.stderr.length && !run.running && !run.error"
        class="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500">
        <div class="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-500">▶</div>
        <div class="text-slate-400 text-sm">No results yet</div>
        <div class="text-xs">
          Press <kbd class="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">⌘↵</kbd> to run
        </div>
      </div>

      <!-- Error row -->
      <div v-if="run.error && !run.running"
        class="rounded border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-rose-300 text-xs mb-3">
        {{ run.error }}
      </div>

      <!-- Equity table -->
      <table v-if="run.results.length" class="w-full text-sm">
        <thead class="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <tr class="text-xs uppercase tracking-wider text-slate-500">
            <th class="text-left py-1 pr-2 font-semibold">Player</th>
            <th class="text-right py-1 px-2 font-semibold">Equity</th>
            <th v-if="showCi" class="text-right py-1 px-2 font-semibold">±</th>
            <th class="py-1 pl-2 font-semibold w-1/2">
              <span class="sr-only">Bar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in sorted"
            :key="r.index"
            class="border-t border-slate-800/60 hover:bg-slate-900/40 transition-colors"
          >
            <td class="py-1.5 pr-2 font-mono">
              <span class="inline-flex items-center gap-1.5">
                <span
                  v-if="leaderIndices.includes(r.index)"
                  class="px-1 py-0.5 text-[9px] rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wide"
                >LEAD</span>
                <span>{{ r.name }}</span>
              </span>
            </td>
            <td class="py-1.5 px-2 text-right font-mono tabular-nums">
              <span :title="tooltipFor(r.equity)">{{ fmtPct(r.equity) }}</span>
            </td>
            <td v-if="showCi" class="py-1.5 px-2 text-right font-mono tabular-nums text-slate-500 text-[11px]">
              ±{{ (ci95(r.equity) * 100).toFixed(2) }}%
            </td>
            <td class="py-1.5 pl-2">
              <div class="h-2 rounded bg-slate-800 overflow-hidden">
                <div class="h-full transition-[width] duration-300 ease-out"
                  :class="leaderIndices.includes(r.index) ? 'bg-emerald-500' : 'bg-slate-600'"
                  :style="{ width: Math.max(0, Math.min(100, r.equity * 100)) + '%' }"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Errors surfaced prominently -->
      <div v-if="run.stderr.length" class="mt-3 text-xs font-mono whitespace-pre-wrap text-rose-400">
        <div v-for="(l, i) in run.stderr" :key="'e' + i">{{ l }}</div>
      </div>

      <!-- Raw logs disclosure -->
      <div v-if="run.stdout.length" class="mt-3">
        <button
          class="text-xs text-slate-500 hover:text-slate-300"
          @click="showRaw = !showRaw">
          {{ showRaw ? '▾' : '▸' }} Raw logs ({{ run.stdout.length }})
        </button>
        <div v-if="showRaw" class="mt-2 p-2 bg-slate-900/60 rounded font-mono text-xs whitespace-pre-wrap max-h-64 overflow-auto border border-slate-800">
          <div v-for="(l, i) in run.stdout" :key="'o' + i">{{ l }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
