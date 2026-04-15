<script setup lang="ts">
import { useRun } from "../stores/run";
const run = useRun();
</script>

<template>
  <div class="h-full flex flex-col border border-slate-800 rounded overflow-hidden">
    <div class="bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-slate-400 flex items-center justify-between">
      <span>Results</span>
      <span v-if="run.running" class="text-emerald-400 animate-pulse">● running</span>
      <span v-else class="text-slate-500">idle</span>
    </div>
    <div class="flex-1 overflow-auto p-3 font-mono text-sm whitespace-pre-wrap">
      <div v-for="(l, i) in run.stdout" :key="'o' + i">{{ l }}</div>
      <div v-for="(l, i) in run.stderr" :key="'e' + i" class="text-rose-400">{{ l }}</div>
      <div v-if="!run.stdout.length && !run.stderr.length && !run.running" class="text-slate-500">
        No results yet. Click Run.
      </div>
    </div>
  </div>
</template>
