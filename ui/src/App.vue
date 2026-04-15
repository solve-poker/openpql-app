<script setup lang="ts">
import { ref } from "vue";
import QueryEditor from "./components/QueryEditor.vue";
import ResultsPane from "./components/ResultsPane.vue";
import HistoryPane from "./components/HistoryPane.vue";
import RangeGrid from "./components/RangeGrid.vue";
import CardPicker from "./components/CardPicker.vue";
import { useRun } from "./stores/run";
import { useHistory } from "./stores/history";

const src = ref<string>(
`select avg(riverEquity(hero))
from
  game = 'holdem',
  hero = 'AsKs',
  villain = '*',
  board = '*'
`);

const heroRange = ref("AA,KK,QQ,JJ,AKs");

const run = useRun();
const history = useHistory();

function onRun() {
  history.add(src.value);
  run.run(src.value);
}
function onCancel() { run.cancel(); }
function loadFromHistory(s: string) { src.value = s; }
function applyRange() {
  src.value = src.value.replace(/hero\s*=\s*'[^']*'/, `hero = '${heroRange.value}'`);
}
function applyBoard(v: { hero: string; villain: string; board: string }) {
  if (v.hero) src.value = src.value.replace(/hero\s*=\s*'[^']*'/, `hero = '${v.hero}'`);
  if (v.villain) src.value = src.value.replace(/villain\s*=\s*'[^']*'/, `villain = '${v.villain}'`);
  if (v.board) src.value = src.value.replace(/board\s*=\s*'[^']*'/, `board = '${v.board}'`);
}

const tab = ref<"range" | "cards">("range");
</script>

<template>
  <div class="h-screen flex flex-col">
    <header class="px-4 py-3 border-b border-slate-800 flex items-center gap-4">
      <h1 class="text-lg font-semibold tracking-tight">Open PQL</h1>
      <div class="ml-auto flex gap-2">
        <button
          class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm"
          :disabled="run.running" @click="onRun">Run</button>
        <button
          class="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-sm"
          :disabled="!run.running" @click="onCancel">Cancel</button>
      </div>
    </header>

    <main class="flex-1 grid gap-3 p-3" style="grid-template-columns: 240px 1fr 1fr;">
      <HistoryPane @select="loadFromHistory" />

      <div class="flex flex-col gap-3 min-h-0">
        <div class="h-1/2 min-h-[200px]">
          <QueryEditor v-model="src" />
        </div>
        <div class="h-1/2 min-h-[200px] flex flex-col border border-slate-800 rounded">
          <div class="flex gap-2 px-2 pt-2 text-xs">
            <button class="px-2 py-1 rounded"
              :class="tab === 'range' ? 'bg-slate-700' : 'bg-slate-900'"
              @click="tab = 'range'">Range grid</button>
            <button class="px-2 py-1 rounded"
              :class="tab === 'cards' ? 'bg-slate-700' : 'bg-slate-900'"
              @click="tab = 'cards'">Card picker</button>
          </div>
          <div class="flex-1 p-3 overflow-auto">
            <div v-if="tab === 'range'" class="space-y-2">
              <RangeGrid v-model="heroRange" />
              <button class="text-xs px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded"
                @click="applyRange">Apply as hero range</button>
            </div>
            <CardPicker v-else @update="applyBoard" />
          </div>
        </div>
      </div>

      <ResultsPane />
    </main>
  </div>
</template>
