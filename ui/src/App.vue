<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import QueryEditor from "./components/QueryEditor.vue";
import ResultsPane from "./components/ResultsPane.vue";
import BoardPicker from "./components/BoardPicker.vue";
import GameSelect from "./components/GameSelect.vue";
import HistoryPane from "./components/HistoryPane.vue";
import RangeGrid from "./components/RangeGrid.vue";
import { useRun } from "./stores/run";
import { useHistory, type HistoryEntry } from "./stores/history";
import { buildPql } from "./pql/build";
import { apiValidateRange } from "./api";
import { detectConflicts, type ConflictWarning } from "./pql/conflicts";

const game = ref("holdem");
const board = ref("");
const ranges = ref<string[]>(["AA", "KK"]);
const validations = ref<string[]>(["", ""]);
const rangeModes = ref<("text" | "grid")[]>(["text", "text"]);
const tab = ref<"results" | "pql" | "history">("results");

function setMode(i: number, mode: "text" | "grid") {
  if (run.running) return;
  while (rangeModes.value.length < ranges.value.length) rangeModes.value.push("text");
  rangeModes.value[i] = mode;
}

const run = useRun();
const history = useHistory();

function onLoadHistory(entry: HistoryEntry) {
  if (run.running) return;
  bumpAllValidateIds();
  game.value = entry.game;
  board.value = entry.board;
  ranges.value = [...entry.ranges];
  if (validations.value.length > entry.ranges.length) {
    validations.value.splice(entry.ranges.length);
  }
  while (validations.value.length < entry.ranges.length) {
    validations.value.push("");
  }
  for (let i = 0; i < validations.value.length; i++) validations.value[i] = "";
  rangeModes.value = entry.ranges.map(() => "text");
  tab.value = "results";
}

// Track run completion: running true → false with results → push history.
watch(
  () => run.running,
  (now, prev) => {
    if (prev && !now && run.results.length > 0 && !run.error) {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      history.add({
        id,
        ts: Date.now(),
        game: game.value,
        board: board.value,
        ranges: [...ranges.value],
        results: run.results.map((r) => ({ name: r.name, equity: r.equity })),
        elapsedMs: run.elapsedMs,
      });
    }
  },
);

const pql = computed(() => buildPql(game.value, board.value, ranges.value));

const firstInput = ref<HTMLInputElement | null>(null);

function addPlayer() {
  if (run.running) return;
  if (ranges.value.length >= 10) return;
  ranges.value.push("*");
  validations.value.push("");
  rangeModes.value.push("text");
}
function removePlayer(i: number) {
  if (run.running) return;
  if (ranges.value.length <= 2) return;
  ranges.value.splice(i, 1);
  validations.value.splice(i, 1);
  if (i < rangeModes.value.length) rangeModes.value.splice(i, 1);
}
function randomizeRow(i: number) {
  if (run.running) return;
  ranges.value[i] = "*";
}
function copyFromPrev(i: number) {
  if (run.running) return;
  if (i <= 0) return;
  ranges.value[i] = ranges.value[i - 1];
}

// Debounced per-row range validation with stale-response guards.
const validateTimers: Record<number, ReturnType<typeof setTimeout> | undefined> = {};
const validateReqIds: Record<number, number> = {};

function scheduleValidate(i: number) {
  if (validateTimers[i]) clearTimeout(validateTimers[i]);
  validateTimers[i] = setTimeout(() => validateOne(i), 250);
}

async function validateOne(i: number) {
  const raw = ranges.value[i] ?? "";
  const text = raw.trim();
  if (!text) { validations.value[i] = ""; return; }
  const reqId = (validateReqIds[i] ?? 0) + 1;
  validateReqIds[i] = reqId;
  try {
    const r = await apiValidateRange(game.value, text);
    if (validateReqIds[i] !== reqId) return;
    if (i >= ranges.value.length) return;
    validations.value[i] = r.ok === "true" ? "✓" : `✗ ${r.message ?? ""}`;
  } catch {
    if (validateReqIds[i] !== reqId) return;
    validations.value[i] = "✗ network error";
  }
}

watch([ranges, game], () => {
  ranges.value.forEach((_, i) => scheduleValidate(i));
}, { deep: true, immediate: true });

function isOk(i: number): boolean {
  return (validations.value[i] ?? "").startsWith("✓");
}
function validationError(i: number): string {
  const v = validations.value[i] ?? "";
  return v.startsWith("✗") ? v.slice(1).trim() : "";
}

function onRun() { run.run(pql.value); }
function onCancel() { run.cancel(); }

// Presets
interface Preset { label: string; game: string; board: string; ranges: string[]; }
const PRESETS: Preset[] = [
  { label: "AA vs random", game: "holdem", board: "", ranges: ["AA", "*"] },
  { label: "AKs vs QQ+", game: "holdem", board: "", ranges: ["AKs", "QQ+"] },
  { label: "BTN 3-bet vs BB call", game: "holdem", board: "",
    ranges: ["QQ+,AKs,AKo", "TT-77,AQs,AJs,KQs"] },
];

function bumpAllValidateIds() {
  for (const k of Object.keys(validateTimers)) {
    const i = Number(k);
    if (validateTimers[i]) {
      clearTimeout(validateTimers[i]);
      validateTimers[i] = undefined;
    }
  }
  for (const k of Object.keys(validateReqIds)) {
    const i = Number(k);
    validateReqIds[i] = (validateReqIds[i] ?? 0) + 1;
  }
}

function applyPreset(p: Preset) {
  if (run.running) return;
  bumpAllValidateIds();
  game.value = p.game;
  board.value = p.board;
  ranges.value = [...p.ranges];
  validations.value = p.ranges.map(() => "");
  rangeModes.value = p.ranges.map(() => "text");
}

function clearAll() {
  if (run.running) return;
  bumpAllValidateIds();
  ranges.value = ["*", "*"];
  validations.value = ["", ""];
  rangeModes.value = ["text", "text"];
  board.value = "";
}

// Copy PQL
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
async function copyPql() {
  try {
    await navigator.clipboard.writeText(pql.value);
    copied.value = true;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    // ignore
  }
}

// Persistence
const STORAGE_KEY = "openpql:session";
let hydrating = true;
onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.game === "string") game.value = s.game;
      if (typeof s.board === "string") board.value = s.board;
      if (Array.isArray(s.ranges) && s.ranges.every((r: unknown) => typeof r === "string") && s.ranges.length >= 2) {
        ranges.value = [...s.ranges];
        validations.value = s.ranges.map(() => "");
        if (
          Array.isArray(s.rangeModes) &&
          s.rangeModes.length === s.ranges.length &&
          s.rangeModes.every((m: unknown) => m === "text" || m === "grid")
        ) {
          rangeModes.value = [...s.rangeModes];
        } else {
          rangeModes.value = s.ranges.map(() => "text");
        }
      }
    }
  } catch {
    // ignore corrupted JSON
  }
  hydrating = false;
  firstInput.value?.focus();
});

watch([game, board, ranges, rangeModes], () => {
  if (hydrating) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      game: game.value,
      board: board.value,
      ranges: ranges.value,
      rangeModes: rangeModes.value,
    }));
  } catch {
    // ignore
  }
}, { deep: true });

// Debounced conflict detection (150ms) over [board, ranges].
const conflicts = ref<ConflictWarning[]>([]);
let conflictsTimer: ReturnType<typeof setTimeout> | undefined;
watch([board, ranges], () => {
  if (conflictsTimer) clearTimeout(conflictsTimer);
  conflictsTimer = setTimeout(() => {
    conflicts.value = detectConflicts(board.value, ranges.value);
  }, 150);
}, { deep: true, immediate: true });

// Keyboard: Cmd/Ctrl+Enter → Run, Esc → Cancel.
function onKey(e: KeyboardEvent) {
  const isModEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
  if (isModEnter) {
    e.preventDefault();
    if (!run.running) onRun();
    return;
  }
  // Input guard: skip non-modified keys when an input is focused.
  const ae = document.activeElement;
  const tag = ae?.tagName;
  const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  if (inField && !e.metaKey && !e.ctrlKey && !e.altKey) return;
  if (e.key === "Escape") {
    if (run.running) { e.preventDefault(); onCancel(); }
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="h-screen flex flex-col">
    <header class="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-4">
      <h1 class="text-[15px] tracking-tight">
        <span class="text-slate-500 font-normal">Open PQL</span>
        <span class="font-semibold text-slate-100"> Winrate Simulator</span>
      </h1>
      <div class="ml-auto flex flex-wrap gap-2 items-center">
        <span class="hidden sm:inline-flex items-center gap-1 text-slate-500">
          <kbd class="px-1 py-0.5 bg-slate-800 rounded text-slate-400 text-[10px]">⌘↵</kbd>
          <span class="text-[10px]">·</span>
          <kbd class="px-1 py-0.5 bg-slate-800 rounded text-slate-400 text-[10px]">Esc</kbd>
        </span>
        <button
          class="px-4 py-1.5 text-sm font-medium shadow-sm shadow-emerald-900/50 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
          :disabled="run.running" @click="onRun">Run</button>
        <button
          class="px-3 py-1.5 rounded text-sm transition-colors"
          :class="run.running
            ? 'bg-rose-600 hover:bg-rose-500 text-white font-medium'
            : 'bg-transparent border border-slate-700 text-slate-400 hover:border-rose-500 hover:text-rose-400'"
          :disabled="!run.running" @click="onCancel">Cancel</button>
      </div>
    </header>

    <main class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 min-h-0">
      <div class="flex flex-col gap-3 md:overflow-auto md:pr-2">
        <!-- Presets -->
        <section class="border-none bg-transparent p-0">
          <div class="flex gap-2 flex-wrap items-center">
            <span class="text-xs text-slate-500 mr-2 self-center">Try:</span>
            <button v-for="p in PRESETS" :key="p.label"
              class="px-2 py-1 text-xs rounded bg-slate-800 border border-transparent hover:border-emerald-600/50 hover:text-emerald-300 disabled:opacity-40"
              :disabled="run.running"
              @click="applyPreset(p)">
              {{ p.label }}
            </button>
            <button
              class="ml-auto px-2 py-1 text-xs rounded bg-slate-800 border border-transparent hover:border-rose-600/50 hover:text-rose-300 disabled:opacity-40"
              :disabled="run.running"
              @click="clearAll">Clear</button>
          </div>
        </section>

        <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <label class="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2 block">Game</label>
          <GameSelect v-model="game" :disabled="run.running" />
        </section>

        <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <label class="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2 block">Board</label>
          <div class="overflow-x-auto">
            <BoardPicker v-model="board" />
          </div>
        </section>

        <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs uppercase tracking-wider text-slate-500 font-semibold block">Players ({{ ranges.length }})</label>
            <div class="flex gap-1">
              <button
                class="px-2 py-0.5 text-xs rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                :disabled="run.running || ranges.length >= 10" @click="addPlayer">+ add</button>
              <button
                class="px-2 py-0.5 text-xs rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                :disabled="run.running || ranges.length <= 2" @click="removePlayer(ranges.length - 1)">− remove</button>
            </div>
          </div>
          <div v-for="(_, i) in ranges" :key="i" class="mb-2 last:mb-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-slate-400 w-16">Player {{ i + 1 }}</span>
              <div class="relative flex-1">
                <input
                  :ref="el => { if (i === 0) firstInput = el as HTMLInputElement | null; }"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 pr-6 font-mono text-xs"
                  v-model="ranges[i]"
                  placeholder="e.g. AA,KK,AKs or *" />
                <span
                  class="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                  :class="!ranges[i]?.trim()
                    ? 'bg-slate-700'
                    : (isOk(i) ? 'bg-emerald-500' : (validations[i]?.startsWith('✗') ? 'bg-rose-500' : 'bg-slate-600'))">
                </span>
              </div>
              <button
                class="text-xs px-1.5 py-1 text-slate-500 hover:text-emerald-400 disabled:opacity-20"
                :disabled="run.running"
                title="Random (*)"
                @click="randomizeRow(i)">*</button>
              <div class="inline-flex rounded border border-slate-800 overflow-hidden text-[10px]">
                <button
                  class="px-1.5 py-0.5 transition-colors"
                  :class="(rangeModes[i] ?? 'text') === 'text'
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'"
                  :disabled="run.running"
                  @click="setMode(i, 'text')">Text</button>
                <button
                  class="px-1.5 py-0.5 transition-colors"
                  :class="(rangeModes[i] ?? 'text') === 'grid'
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'"
                  :disabled="run.running"
                  @click="setMode(i, 'grid')">Grid</button>
              </div>
              <button
                v-if="i > 0"
                class="text-xs px-1.5 py-1 text-slate-500 hover:text-slate-200 disabled:opacity-20"
                :disabled="run.running"
                :title="`Copy from Player ${i}`"
                @click="copyFromPrev(i)">⎘</button>
              <button
                class="text-xs px-2 py-1 text-slate-500 hover:text-rose-400 disabled:opacity-20"
                :disabled="run.running || ranges.length <= 2"
                @click="removePlayer(i)">✕</button>
            </div>
            <div v-if="validations[i]?.startsWith('✗')"
              class="text-[11px] text-rose-400 mt-0.5 pl-[4.5rem]">
              {{ validationError(i) }}
            </div>
            <div v-if="rangeModes[i] === 'grid'" class="mt-2 pl-[4.5rem]">
              <RangeGrid v-model="ranges[i]" :disabled="run.running" />
            </div>
          </div>
          <details class="mt-2">
            <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Range syntax</summary>
            <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400">
              <div><span class="text-slate-200">AA</span> — pocket aces</div>
              <div><span class="text-slate-200">QQ+</span> — QQ,KK,AA</div>
              <div><span class="text-slate-200">AKs</span> — suited only</div>
              <div><span class="text-slate-200">AKo</span> — offsuit only</div>
              <div><span class="text-slate-200">TT-77</span> — range of pairs</div>
              <div><span class="text-slate-200">AA,KK,AKs</span> — comma list</div>
              <div><span class="text-slate-200">*</span> — any two cards</div>
            </div>
          </details>
          <div v-if="conflicts.length > 0"
            class="mt-3 rounded border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-rose-300 text-xs space-y-0.5">
            <div class="font-medium text-rose-200">Range/board conflicts</div>
            <div v-for="(c, idx) in conflicts" :key="idx">• {{ c.message }}</div>
          </div>
        </section>
      </div>

      <div class="flex flex-col border border-slate-800 rounded overflow-hidden min-h-0">
        <div class="flex items-center gap-0 px-2 pt-0 text-xs border-b border-slate-800">
          <button
            class="px-3 py-2 border-b-2 -mb-px"
            :class="tab === 'results'
              ? 'border-emerald-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'"
            @click="tab = 'results'">Results</button>
          <button
            class="px-3 py-2 border-b-2 -mb-px"
            :class="tab === 'pql'
              ? 'border-emerald-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'"
            @click="tab = 'pql'">PQL</button>
          <button
            class="px-3 py-2 border-b-2 -mb-px"
            :class="tab === 'history'
              ? 'border-emerald-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'"
            @click="tab = 'history'">History</button>
          <button
            v-if="tab === 'pql'"
            class="ml-auto px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            @click="copyPql">{{ copied ? "Copied ✓" : "Copy" }}</button>
        </div>
        <div class="flex-1 min-h-0">
          <ResultsPane v-if="tab === 'results'" />
          <QueryEditor v-else-if="tab === 'pql'" :model-value="pql" readonly />
          <HistoryPane v-else @load="onLoadHistory" />
        </div>
      </div>
    </main>
  </div>
</template>
