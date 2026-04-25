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

interface Preset { label: string; game: string; board: string; ranges: string[]; }
const PRESETS: Preset[] = [
  { label: "AA vs random", game: "holdem", board: "", ranges: ["AA", "*"] },
  { label: "AKs vs QQ+", game: "holdem", board: "", ranges: ["AxKx", "QQ+"] },
  { label: "BTN 3-bet vs BB call", game: "holdem", board: "",
    ranges: ["QQ+,AK", "TT-77,AxQx,AxJx,KxQx"] },
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

const conflicts = ref<ConflictWarning[]>([]);
let conflictsTimer: ReturnType<typeof setTimeout> | undefined;
watch([board, ranges], () => {
  if (conflictsTimer) clearTimeout(conflictsTimer);
  conflictsTimer = setTimeout(() => {
    conflicts.value = detectConflicts(board.value, ranges.value);
  }, 150);
}, { deep: true, immediate: true });

function onKey(e: KeyboardEvent) {
  const isModEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
  if (isModEnter) {
    e.preventDefault();
    if (!run.running) onRun();
    return;
  }
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

// Theme: light/dark toggle persisted to localStorage. The pre-paint script
// in index.html applies the initial class so this only mirrors current state.
const isDark = ref(false);
onMounted(() => {
  isDark.value = document.documentElement.classList.contains("dark");
});
function toggleTheme() {
  const root = document.documentElement;
  const next = !root.classList.contains("dark");
  root.classList.toggle("dark", next);
  isDark.value = next;
  try { localStorage.setItem("openpql:theme", next ? "dark" : "light"); } catch { /* ignore */ }
}
</script>

<template>
  <div class="h-screen flex flex-col bg-bg text-fg">
    <header class="px-5 py-3 border-b border-line bg-surface flex flex-wrap items-center gap-4">
      <h1 class="flex items-center gap-2 text-base">
        <span class="inline-flex items-center gap-2 rounded-chip border border-primary/30 bg-primary-soft px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-widest text-primary">
          <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
          Open PQL
        </span>
        <span class="font-display font-semibold tracking-tight text-fg">Winrate Simulator</span>
      </h1>
      <div class="ml-auto flex flex-wrap gap-2 items-center">
        <span class="hidden sm:inline-flex items-center gap-1 text-muted">
          <kbd class="px-1.5 py-0.5 rounded-md border border-line bg-elevated text-2xs font-mono text-muted">⌘↵</kbd>
          <span class="text-2xs">·</span>
          <kbd class="px-1.5 py-0.5 rounded-md border border-line bg-elevated text-2xs font-mono text-muted">Esc</kbd>
        </span>
        <button
          type="button"
          :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          class="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          @click="toggleTheme">
          <span aria-hidden="true">{{ isDark ? "☀" : "☾" }}</span>
        </button>
        <button
          type="button"
          class="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:hover:shadow-glow"
          :disabled="run.running" @click="onRun">Run</button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          :class="run.running
            ? 'bg-danger text-white hover:opacity-90'
            : 'border border-line bg-surface text-muted hover:bg-elevated hover:text-fg'"
          :disabled="!run.running" @click="onCancel">Cancel</button>
      </div>
    </header>

    <main class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-0">
      <div class="flex flex-col gap-4 md:overflow-auto md:pr-2">
        <!-- Presets -->
        <section>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Try</span>
            <button v-for="p in PRESETS" :key="p.label"
              type="button"
              class="rounded-chip border border-line bg-surface px-3 py-1 text-xs font-medium text-fg transition hover:border-primary/50 hover:bg-primary-soft hover:text-primary disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              :disabled="run.running"
              @click="applyPreset(p)">
              {{ p.label }}
            </button>
            <button
              type="button"
              class="ml-auto rounded-chip border border-line bg-surface px-3 py-1 text-xs font-medium text-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              :disabled="run.running"
              @click="clearAll">Clear</button>
          </div>
        </section>

        <section class="rounded-card border border-line bg-surface p-5 shadow-card">
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Game</label>
          <GameSelect v-model="game" :disabled="run.running" />
        </section>

        <section class="rounded-card border border-line bg-surface p-5 shadow-card">
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Board</label>
          <div class="overflow-x-auto">
            <BoardPicker v-model="board" />
          </div>
        </section>

        <section class="rounded-card border border-line bg-surface p-5 shadow-card">
          <div class="flex items-center justify-between mb-3">
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted">
              Players <span class="font-mono text-fg">({{ ranges.length }})</span>
            </label>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                :disabled="run.running || ranges.length >= 10" @click="addPlayer">+ add</button>
              <button
                type="button"
                class="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                :disabled="run.running || ranges.length <= 2" @click="removePlayer(ranges.length - 1)">− remove</button>
            </div>
          </div>
          <div v-for="(_, i) in ranges" :key="i" class="mb-3 last:mb-0">
            <div class="flex items-center gap-2">
              <span class="w-16 font-mono text-xs text-muted">P{{ i + 1 }}</span>
              <div class="relative flex-1">
                <input
                  :ref="el => { if (i === 0) firstInput = el as HTMLInputElement | null; }"
                  class="block w-full rounded-lg border border-line bg-bg px-3 py-1.5 pr-7 font-mono text-xs text-fg placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  :class="validations[i]?.startsWith('✗') ? 'border-danger focus:border-danger focus:ring-danger/30' : ''"
                  v-model="ranges[i]"
                  :aria-invalid="validations[i]?.startsWith('✗') ? 'true' : 'false'"
                  placeholder="e.g. AA,KK,AKs or *" />
                <span
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
                  :class="!ranges[i]?.trim()
                    ? 'bg-line'
                    : (isOk(i) ? 'bg-success' : (validations[i]?.startsWith('✗') ? 'bg-danger' : 'bg-subtle'))">
                </span>
              </div>
              <button
                type="button"
                class="rounded-md px-1.5 py-1 font-mono text-xs text-muted transition hover:bg-elevated hover:text-accent disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                :disabled="run.running"
                title="Random (*)"
                aria-label="Set to any two cards"
                @click="randomizeRow(i)">*</button>
              <div class="inline-flex overflow-hidden rounded-md border border-line text-2xs">
                <button
                  type="button"
                  class="px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  :class="(rangeModes[i] ?? 'text') === 'text'
                    ? 'bg-primary text-primary-fg'
                    : 'bg-surface text-muted hover:bg-elevated hover:text-fg'"
                  :disabled="run.running"
                  @click="setMode(i, 'text')">Text</button>
                <button
                  type="button"
                  class="px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  :class="(rangeModes[i] ?? 'text') === 'grid'
                    ? 'bg-primary text-primary-fg'
                    : 'bg-surface text-muted hover:bg-elevated hover:text-fg'"
                  :disabled="run.running"
                  @click="setMode(i, 'grid')">Grid</button>
              </div>
              <button
                v-if="i > 0"
                type="button"
                class="rounded-md px-1.5 py-1 text-xs text-muted transition hover:bg-elevated hover:text-fg disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                :disabled="run.running"
                :title="`Copy from Player ${i}`"
                :aria-label="`Copy range from player ${i}`"
                @click="copyFromPrev(i)">⎘</button>
              <button
                type="button"
                class="rounded-md px-1.5 py-1 text-xs text-muted transition hover:text-danger disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                :disabled="run.running || ranges.length <= 2"
                :aria-label="`Remove player ${i + 1}`"
                @click="removePlayer(i)">✕</button>
            </div>
            <div v-if="validations[i]?.startsWith('✗')"
              class="mt-1 pl-[4.5rem] text-2xs text-danger">
              {{ validationError(i) }}
            </div>
            <div v-if="rangeModes[i] === 'grid'" class="mt-2 pl-[4.5rem]">
              <RangeGrid v-model="ranges[i]" :disabled="run.running" />
            </div>
          </div>
          <details class="mt-3">
            <summary class="cursor-pointer text-xs text-muted transition hover:text-fg">Range syntax</summary>
            <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-2xs text-muted">
              <div><span class="text-fg">AA</span> — pocket aces</div>
              <div><span class="text-fg">QQ+</span> — QQ,KK,AA</div>
              <div><span class="text-fg">AxKx</span> — suited only</div>
              <div><span class="text-fg">AxKy</span> — offsuit only</div>
              <div><span class="text-fg">TT-77</span> — range of pairs</div>
              <div><span class="text-fg">AA,KK,AKs</span> — comma list</div>
              <div><span class="text-fg">*</span> — any two cards</div>
            </div>
          </details>
          <div v-if="conflicts.length > 0"
            role="alert"
            class="mt-3 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs">
            <span aria-hidden="true" class="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-2xs font-bold text-white">!</span>
            <div class="space-y-0.5">
              <div class="font-semibold text-danger">Range / board conflicts</div>
              <div v-for="(c, idx) in conflicts" :key="idx" class="text-muted">{{ c.message }}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div class="flex items-center gap-0 border-b border-line bg-elevated/40 px-3 text-sm">
          <button
            type="button"
            class="-mb-px border-b-2 px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            :class="tab === 'results'
              ? 'border-primary font-semibold text-primary'
              : 'border-transparent text-muted hover:text-fg'"
            @click="tab = 'results'">Results</button>
          <button
            type="button"
            class="-mb-px border-b-2 px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            :class="tab === 'pql'
              ? 'border-primary font-semibold text-primary'
              : 'border-transparent text-muted hover:text-fg'"
            @click="tab = 'pql'">PQL</button>
          <button
            type="button"
            class="-mb-px border-b-2 px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            :class="tab === 'history'
              ? 'border-primary font-semibold text-primary'
              : 'border-transparent text-muted hover:text-fg'"
            @click="tab = 'history'">History</button>
          <button
            v-if="tab === 'pql'"
            type="button"
            class="ml-auto my-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-2xs font-semibold text-fg transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
