<script setup lang="ts">
import { computed, ref, watch } from "vue";
import QueryEditor from "./components/QueryEditor.vue";
import ResultsPane from "./components/ResultsPane.vue";
import BoardPicker from "./components/BoardPicker.vue";
import GameSelect from "./components/GameSelect.vue";
import { useRun } from "./stores/run";
import { buildPql } from "./pql/build";
import { apiValidateRange } from "./api/rest";

const game = ref("holdem");
const board = ref("");
const ranges = ref<string[]>(["AA", "KK"]);
const validations = ref<string[]>(["", ""]);
const tab = ref<"results" | "pql">("results");

const run = useRun();

const pql = computed(() => buildPql(game.value, board.value, ranges.value));

function addPlayer() {
  if (ranges.value.length >= 10) return;
  ranges.value.push("*");
  validations.value.push("");
}
function removePlayer(i: number) {
  if (ranges.value.length <= 2) return;
  ranges.value.splice(i, 1);
  validations.value.splice(i, 1);
}

async function validateOne(i: number) {
  const text = ranges.value[i];
  if (!text.trim()) { validations.value[i] = ""; return; }
  const r = await apiValidateRange(game.value, text);
  validations.value[i] = r.ok === "true" ? "✓" : `✗ ${r.message ?? ""}`;
}

watch([ranges, game], () => {
  ranges.value.forEach((_, i) => validateOne(i));
}, { deep: true, immediate: true });

function onRun() { run.run(pql.value); }
function onCancel() { run.cancel(); }
</script>

<template>
  <div class="h-screen flex flex-col">
    <header class="px-4 py-3 border-b border-slate-800 flex items-center gap-4">
      <h1 class="text-lg font-semibold tracking-tight">Open PQL — Winrate Simulator</h1>
      <div class="ml-auto flex gap-2">
        <button
          class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm"
          :disabled="run.running" @click="onRun">Run</button>
        <button
          class="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-sm"
          :disabled="!run.running" @click="onCancel">Cancel</button>
      </div>
    </header>

    <main class="flex-1 grid gap-3 p-3 min-h-0" style="grid-template-columns: 1fr 1fr;">
      <div class="flex flex-col gap-4 overflow-auto pr-2">
        <section class="flex items-center gap-3">
          <label class="text-xs uppercase tracking-wide text-slate-400 w-16">Game</label>
          <GameSelect v-model="game" />
        </section>

        <section class="flex flex-col gap-2">
          <label class="text-xs uppercase tracking-wide text-slate-400">Board</label>
          <BoardPicker v-model="board" />
        </section>

        <section class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-xs uppercase tracking-wide text-slate-400">Players ({{ ranges.length }})</label>
            <div class="flex gap-1">
              <button
                class="px-2 py-0.5 text-xs rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                :disabled="ranges.length >= 10" @click="addPlayer">+ add</button>
              <button
                class="px-2 py-0.5 text-xs rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                :disabled="ranges.length <= 2" @click="removePlayer(ranges.length - 1)">− remove</button>
            </div>
          </div>
          <div v-for="(_, i) in ranges" :key="i" class="flex items-center gap-2">
            <span class="text-xs font-mono text-slate-400 w-16">Player {{ i + 1 }}</span>
            <input
              class="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-xs"
              v-model="ranges[i]"
              placeholder="e.g. AA,KK,AKs or *" />
            <span class="text-xs w-40 truncate"
              :class="validations[i].startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'">
              {{ validations[i] }}
            </span>
            <button
              class="text-xs px-2 py-1 text-slate-500 hover:text-rose-400 disabled:opacity-20"
              :disabled="ranges.length <= 2"
              @click="removePlayer(i)">✕</button>
          </div>
        </section>
      </div>

      <div class="flex flex-col border border-slate-800 rounded overflow-hidden min-h-0">
        <div class="flex gap-2 px-2 pt-2 text-xs border-b border-slate-800 pb-2">
          <button class="px-2 py-1 rounded"
            :class="tab === 'results' ? 'bg-slate-700' : 'bg-slate-900'"
            @click="tab = 'results'">Results</button>
          <button class="px-2 py-1 rounded"
            :class="tab === 'pql' ? 'bg-slate-700' : 'bg-slate-900'"
            @click="tab = 'pql'">PQL</button>
        </div>
        <div class="flex-1 min-h-0">
          <ResultsPane v-if="tab === 'results'" />
          <QueryEditor v-else :model-value="pql" readonly />
        </div>
      </div>
    </main>
  </div>
</template>
