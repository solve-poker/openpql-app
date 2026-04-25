<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const RANK_VAL: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, 12 - i]),
);

function cellLabel(rowRank: string, colRank: string): string {
  if (rowRank === colRank) return rowRank + rowRank;
  const rv = RANK_VAL[rowRank];
  const cv = RANK_VAL[colRank];
  const hi = rv > cv ? rowRank : colRank;
  const lo = rv > cv ? colRank : rowRank;
  if (rv > cv) return hi + "x" + lo + "x";
  return hi + "x" + lo + "y";
}

function cellDisplay(rowRank: string, colRank: string): string {
  if (rowRank === colRank) return rowRank + rowRank;
  const rv = RANK_VAL[rowRank];
  const cv = RANK_VAL[colRank];
  const hi = rv > cv ? rowRank : colRank;
  const lo = rv > cv ? colRank : rowRank;
  return hi + lo + (rv > cv ? "s" : "o");
}

const ALL_LABELS: string[] = [];
for (const r of RANKS) for (const c of RANKS) ALL_LABELS.push(cellLabel(r, c));
const LABEL_SET = new Set(ALL_LABELS);

const selected = ref<Set<string>>(new Set());
const hasUnrepresented = ref(false);

function serialize(set: Set<string>): string {
  const arr: string[] = [];
  for (const l of ALL_LABELS) if (set.has(l)) arr.push(l);
  return arr.join(",");
}

function parse(text: string): { set: Set<string>; unrepresented: boolean } {
  const set = new Set<string>();
  let unrep = false;
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { set, unrepresented: false };
  if (trimmed === "*") {
    for (const l of ALL_LABELS) set.add(l);
    return { set, unrepresented: false };
  }
  for (const raw of trimmed.split(",")) {
    const atom = raw.trim();
    if (!atom) continue;
    const norm = normalizeAtom(atom);
    if (norm && LABEL_SET.has(norm)) set.add(norm);
    else unrep = true;
  }
  return { set, unrepresented: unrep };
}

const SUIT_VARS = new Set(["w", "x", "y", "z"]);

function normalizeAtom(atom: string): string | null {
  if (atom.length === 2) {
    const a = atom[0].toUpperCase();
    const b = atom[1].toUpperCase();
    if (a === b && RANK_VAL[a] !== undefined) return a + b;
    return null;
  }
  if (atom.length === 4) {
    const r1 = atom[0].toUpperCase();
    const s1 = atom[1].toLowerCase();
    const r2 = atom[2].toUpperCase();
    const s2 = atom[3].toLowerCase();
    if (r1 === r2) return null;
    if (RANK_VAL[r1] === undefined || RANK_VAL[r2] === undefined) return null;
    if (!SUIT_VARS.has(s1) || !SUIT_VARS.has(s2)) return null;
    const hi = RANK_VAL[r1] > RANK_VAL[r2] ? r1 : r2;
    const lo = RANK_VAL[r1] > RANK_VAL[r2] ? r2 : r1;
    return s1 === s2 ? hi + "x" + lo + "x" : hi + "x" + lo + "y";
  }
  return null;
}

watch(
  () => props.modelValue,
  (v) => {
    const current = serialize(selected.value);
    if (v === current) return;
    const { set, unrepresented } = parse(v ?? "");
    selected.value = set;
    hasUnrepresented.value = unrepresented;
  },
  { immediate: true },
);

function emitCurrent() {
  emit("update:modelValue", serialize(selected.value));
}

const painting = ref(false);
const paintMode = ref<"select" | "deselect">("select");

function onCellDown(label: string, e: MouseEvent) {
  if (props.disabled) return;
  e.preventDefault();
  painting.value = true;
  paintMode.value = selected.value.has(label) ? "deselect" : "select";
  applyPaint(label);
}
function onCellEnter(label: string) {
  if (!painting.value || props.disabled) return;
  applyPaint(label);
}
function applyPaint(label: string) {
  const next = new Set(selected.value);
  if (paintMode.value === "select") next.add(label);
  else next.delete(label);
  selected.value = next;
  hasUnrepresented.value = false;
  emitCurrent();
}
function endPaint() {
  if (painting.value) painting.value = false;
}

const comboCount = computed(() => {
  let n = 0;
  for (const l of selected.value) {
    if (l.length === 2) n += 6;
    else if (l[1] === l[3]) n += 4;
    else n += 12;
  }
  return n;
});

function setFrom(labels: Iterable<string>) {
  if (props.disabled) return;
  const next = new Set<string>();
  for (const l of labels) if (LABEL_SET.has(l)) next.add(l);
  selected.value = next;
  hasUnrepresented.value = false;
  emitCurrent();
}

function presetAll() { setFrom(ALL_LABELS); }
function presetNone() { setFrom([]); }
function presetPairs() {
  setFrom(RANKS.map((r) => r + r));
}
function suited(hi: string, lo: string): string { return hi + "x" + lo + "x"; }
function offsuit(hi: string, lo: string): string { return hi + "x" + lo + "y"; }

function presetSuited() {
  const out: string[] = [];
  for (const l of ALL_LABELS) if (l.length === 4 && l[1] === l[3]) out.push(l);
  setFrom(out);
}
function presetBroadway() {
  const broadwayRanks = ["A", "K", "Q", "J", "T"];
  const out: string[] = ["AA", "KK", "QQ", "JJ", "TT"];
  for (let i = 0; i < broadwayRanks.length; i++) {
    for (let j = i + 1; j < broadwayRanks.length; j++) {
      const hi = broadwayRanks[i];
      const lo = broadwayRanks[j];
      out.push(suited(hi, lo));
      out.push(offsuit(hi, lo));
    }
  }
  setFrom(out);
}
function presetTop10() {
  const out: string[] = [];
  for (const r of RANKS) out.push(r + r);
  for (const r of RANKS) if (r !== "A") out.push(suited("A", r));
  for (const r of ["Q", "J", "T", "9"]) out.push(suited("K", r));
  for (const r of ["J", "T"]) out.push(suited("Q", r));
  out.push(suited("J", "T"));
  for (const r of ["K", "Q", "J", "T"]) out.push(offsuit("A", r));
  for (const r of ["Q", "J"]) out.push(offsuit("K", r));
  setFrom(out);
}

// Keyboard navigation — arrow keys move the active cell; space/enter toggles.
const activeRow = ref(0);
const activeCol = ref(0);
const gridFocused = ref(false);

function onGridKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  const key = e.key;
  if (key === "ArrowUp") {
    e.preventDefault();
    activeRow.value = (activeRow.value - 1 + RANKS.length) % RANKS.length;
  } else if (key === "ArrowDown") {
    e.preventDefault();
    activeRow.value = (activeRow.value + 1) % RANKS.length;
  } else if (key === "ArrowLeft") {
    e.preventDefault();
    activeCol.value = (activeCol.value - 1 + RANKS.length) % RANKS.length;
  } else if (key === "ArrowRight") {
    e.preventDefault();
    activeCol.value = (activeCol.value + 1) % RANKS.length;
  } else if (key === " " || key === "Enter") {
    e.preventDefault();
    const label = cellLabel(RANKS[activeRow.value], RANKS[activeCol.value]);
    const next = new Set(selected.value);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    selected.value = next;
    hasUnrepresented.value = false;
    emitCurrent();
  }
}

function cellClasses(label: string, isPair: boolean, isActive: boolean): string {
  const base = "aspect-square flex items-center justify-center font-mono text-2xs cursor-pointer select-none border transition";
  const on = "bg-primary text-primary-fg border-primary font-semibold";
  const off = "bg-elevated text-muted hover:bg-primary-soft hover:text-primary border-transparent";
  const pairRing = isPair ? " ring-1 ring-inset ring-line" : "";
  const activeRing = isActive && gridFocused.value ? " ring-2 ring-inset ring-primary" : "";
  const dis = props.disabled ? " opacity-50 pointer-events-none" : "";
  return base + " " + (selected.value.has(label) ? on : off) + pairRing + activeRing + dis;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="grid gap-px rounded-md border border-line bg-line p-px focus:outline-none"
      :style="{ gridTemplateColumns: 'repeat(13, minmax(2.125rem, 1fr))' }"
      tabindex="0"
      role="grid"
      aria-label="Hand range grid"
      @focus="gridFocused = true"
      @blur="gridFocused = false"
      @keydown="onGridKeydown"
      @mouseup="endPaint"
      @mouseleave="endPaint">
      <template v-for="(rowRank, ri) in RANKS" :key="rowRank">
        <div
          v-for="(colRank, ci) in RANKS"
          :key="rowRank + '-' + colRank"
          :class="cellClasses(cellLabel(rowRank, colRank), ri === ci, ri === activeRow && ci === activeCol)"
          :style="{ minWidth: '2.125rem' }"
          role="gridcell"
          :aria-selected="selected.has(cellLabel(rowRank, colRank))"
          @mousedown="onCellDown(cellLabel(rowRank, colRank), $event)"
          @mouseenter="onCellEnter(cellLabel(rowRank, colRank))">
          {{ cellDisplay(rowRank, colRank) }}
        </div>
      </template>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        class="rounded-chip border border-line bg-surface px-3 py-1 text-2xs font-medium text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetAll">All</button>
      <button
        type="button"
        class="rounded-chip border border-line bg-surface px-3 py-1 text-2xs font-medium text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetNone">None</button>
      <button
        type="button"
        class="rounded-chip border border-line bg-surface px-3 py-1 text-2xs font-medium text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetPairs">Pairs (22+)</button>
      <button
        type="button"
        class="rounded-chip border border-line bg-surface px-3 py-1 text-2xs font-medium text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetSuited">Suited (all)</button>
      <button
        type="button"
        class="rounded-chip border border-line bg-surface px-3 py-1 text-2xs font-medium text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetBroadway">Broadway</button>
      <button
        type="button"
        class="rounded-chip border border-line bg-surface px-3 py-1 text-2xs font-medium text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetTop10">Top 10%</button>
    </div>

    <div class="flex items-center gap-2">
      <span class="label">selected</span>
      <span class="font-mono tabular-nums text-fg">{{ comboCount }}</span>
      <span class="text-2xs text-muted">/ 1326 combos</span>
    </div>
    <div v-if="hasUnrepresented" class="text-2xs text-warning">
      Some range parts can't be shown in the grid.
    </div>
  </div>
</template>
