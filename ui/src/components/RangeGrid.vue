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
  if (rv > cv) return rowRank + colRank + "s";
  return colRank + rowRank + "o";
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

function normalizeAtom(atom: string): string | null {
  if (atom.length === 2) {
    const a = atom[0].toUpperCase();
    const b = atom[1].toUpperCase();
    if (a === b && RANK_VAL[a] !== undefined) return a + b;
    return null;
  }
  if (atom.length === 3) {
    const a = atom[0].toUpperCase();
    const b = atom[1].toUpperCase();
    const s = atom[2].toLowerCase();
    if (a === b) return null;
    if (RANK_VAL[a] === undefined || RANK_VAL[b] === undefined) return null;
    if (s !== "s" && s !== "o") return null;
    const hi = RANK_VAL[a] > RANK_VAL[b] ? a : b;
    const lo = RANK_VAL[a] > RANK_VAL[b] ? b : a;
    return hi + lo + s;
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
    else if (l.endsWith("s")) n += 4;
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
function presetSuited() {
  const out: string[] = [];
  for (const l of ALL_LABELS) if (l.length === 3 && l.endsWith("s")) out.push(l);
  setFrom(out);
}
function presetBroadway() {
  const broadwayRanks = ["A", "K", "Q", "J", "T"];
  const out: string[] = ["AA", "KK", "QQ", "JJ", "TT"];
  for (let i = 0; i < broadwayRanks.length; i++) {
    for (let j = i + 1; j < broadwayRanks.length; j++) {
      const hi = broadwayRanks[i];
      const lo = broadwayRanks[j];
      out.push(hi + lo + "s");
      out.push(hi + lo + "o");
    }
  }
  setFrom(out);
}
function presetTop10() {
  const out: string[] = [];
  for (const r of RANKS) out.push(r + r);
  for (const r of RANKS) if (r !== "A") out.push("A" + r + "s");
  for (const r of ["Q", "J", "T", "9"]) out.push("K" + r + "s");
  for (const r of ["J", "T"]) out.push("Q" + r + "s");
  out.push("JTs");
  for (const r of ["K", "Q", "J", "T"]) out.push("A" + r + "o");
  for (const r of ["Q", "J"]) out.push("K" + r + "o");
  setFrom(out);
}

function cellClasses(label: string, isPair: boolean): string {
  const base = "aspect-square flex items-center justify-center font-mono text-2xs cursor-pointer select-none border transition";
  const on = "bg-primary text-primary-fg border-primary";
  const off = "bg-elevated text-muted hover:bg-primary-soft hover:text-primary border-transparent";
  const ring = isPair ? " ring-1 ring-inset ring-line" : "";
  const dis = props.disabled ? " opacity-50 pointer-events-none" : "";
  return base + " " + (selected.value.has(label) ? on : off) + ring + dis;
}
</script>

<template>
  <div class="flex max-w-[520px] flex-col gap-2">
    <div
      class="grid gap-px rounded-md border border-line bg-line p-px"
      :style="{ gridTemplateColumns: 'repeat(13, minmax(1.2rem, 1fr))' }"
      @mouseup="endPaint"
      @mouseleave="endPaint">
      <template v-for="(rowRank, ri) in RANKS" :key="rowRank">
        <div
          v-for="(colRank, ci) in RANKS"
          :key="rowRank + '-' + colRank"
          :class="cellClasses(cellLabel(rowRank, colRank), ri === ci)"
          :style="{ minWidth: '1.2rem' }"
          @mousedown="onCellDown(cellLabel(rowRank, colRank), $event)"
          @mouseenter="onCellEnter(cellLabel(rowRank, colRank))">
          {{ cellLabel(rowRank, colRank) }}
        </div>
      </template>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetAll">All</button>
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetNone">None</button>
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetPairs">Pairs (22+)</button>
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetSuited">Suited (all)</button>
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetBroadway">Broadway</button>
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-fg transition hover:bg-elevated disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        :disabled="disabled" @click="presetTop10">Top 10%</button>
    </div>

    <div class="font-mono text-2xs text-muted">{{ comboCount }} combos selected</div>
    <div v-if="hasUnrepresented" class="text-2xs text-warning">
      Some parts of this range can't be shown in the grid.
    </div>
  </div>
</template>
