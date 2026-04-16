<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS = [
  { s: "s", label: "\u2660", cls: "text-slate-200" },
  { s: "h", label: "\u2665", cls: "text-rose-400" },
  { s: "d", label: "\u2666", cls: "text-rose-400" },
  { s: "c", label: "\u2663", cls: "text-slate-200" },
];

function suitGlyph(s: string): string {
  const m = SUITS.find((x) => x.s === s);
  return m ? m.label : s;
}
function suitCls(s: string): string {
  return s === "h" || s === "d" ? "text-rose-400" : "text-slate-200";
}

const SLOTS = ["flop1", "flop2", "flop3", "turn", "river"] as const;
type Slot = typeof SLOTS[number];
const LABELS: Record<Slot, string> = {
  flop1: "F1", flop2: "F2", flop3: "F3", turn: "T", river: "R",
};
const FLOP_SLOTS: Slot[] = ["flop1", "flop2", "flop3"];

// 13 cols (ranks) * 4 rows (suits) grid, row-major: index = suitIdx*13 + rankIdx.
const GRID_CARDS: string[] = [];
for (const suit of SUITS) {
  for (const r of RANKS) GRID_CARDS.push(r + suit.s);
}

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const assigned = ref<Record<Slot, string | null>>(
  Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<Slot, string | null>,
);
const active = ref<Slot>("flop1");
const activeCard = ref<string>(GRID_CARDS[0]);
const buttonRefs = ref<Record<string, HTMLButtonElement | null>>({});

const usedSet = computed(() => new Set(Object.values(assigned.value).filter(Boolean) as string[]));
const anyFilled = computed(() => SLOTS.some((s) => assigned.value[s]));

function nextEmptySlot(from: Slot): Slot {
  const idx = SLOTS.indexOf(from);
  for (let i = idx + 1; i < SLOTS.length; i++) {
    if (!assigned.value[SLOTS[i]]) return SLOTS[i];
  }
  // If none after current, try any empty.
  for (const s of SLOTS) if (!assigned.value[s]) return s;
  return from;
}

function pick(card: string) {
  if (usedSet.value.has(card) && assigned.value[active.value] !== card) return;
  assigned.value[active.value] = card;
  emitValue();
  const next = nextEmptySlot(active.value);
  if (next !== active.value) active.value = next;
}
function clearSlot(s: Slot) { assigned.value[s] = null; emitValue(); }
function clearAll() {
  for (const s of SLOTS) assigned.value[s] = null;
  emitValue();
}

function emitValue() {
  const board = SLOTS.map((s) => assigned.value[s]).filter(Boolean).join("");
  emit("update:modelValue", board);
}

function focusActive() {
  nextTick(() => {
    const btn = buttonRefs.value[activeCard.value];
    btn?.focus();
  });
}

function moveActive(delta: number) {
  const idx = GRID_CARDS.indexOf(activeCard.value);
  if (idx < 0) return;
  const next = idx + delta;
  if (next < 0 || next >= GRID_CARDS.length) return;
  activeCard.value = GRID_CARDS[next];
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "ArrowLeft":  e.preventDefault(); moveActive(-1); focusActive(); break;
    case "ArrowRight": e.preventDefault(); moveActive(1); focusActive(); break;
    case "ArrowUp":    e.preventDefault(); moveActive(-13); focusActive(); break;
    case "ArrowDown":  e.preventDefault(); moveActive(13); focusActive(); break;
    case "Enter":
    case " ":
      e.preventDefault();
      pick(activeCard.value);
      break;
  }
}

watch(() => props.modelValue, (v) => {
  const current = SLOTS.map((s) => assigned.value[s]).filter(Boolean).join("");
  if (v === current) return;
  for (const s of SLOTS) assigned.value[s] = null;
  const cards = (v || "").match(/.{1,2}/g) ?? [];
  cards.slice(0, SLOTS.length).forEach((card, i) => {
    assigned.value[SLOTS[i]] = card;
  });
}, { immediate: true });

function setBtnRef(card: string, el: Element | any) {
  buttonRefs.value[card] = (el as HTMLButtonElement) ?? null;
}

function slotRank(card: string | null): string {
  return card ? card[0] : "";
}
function slotSuit(card: string | null): string {
  return card ? card[1] : "";
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex gap-2 flex-wrap items-center">
      <div class="flex gap-1 p-1 rounded bg-slate-900/50 border border-slate-800">
        <div v-for="s in FLOP_SLOTS" :key="s" class="relative">
          <button
            type="button"
            class="relative w-12 h-16 rounded border flex flex-col justify-between p-1 font-mono transition-colors"
            :class="[
              assigned[s]
                ? 'bg-slate-100 text-slate-900 border-slate-300'
                : 'bg-transparent border-dashed border-slate-700 text-slate-600',
              active === s ? 'ring-2 ring-emerald-500/60' : '',
            ]"
            @click="active = s">
            <template v-if="assigned[s]">
              <span class="text-xs leading-none text-left">{{ slotRank(assigned[s]) }}</span>
              <span class="text-lg leading-none self-end" :class="suitCls(slotSuit(assigned[s]))">
                {{ suitGlyph(slotSuit(assigned[s])) }}
              </span>
            </template>
            <template v-else>
              <span class="text-[10px] leading-none text-left opacity-70">{{ LABELS[s] }}</span>
              <span class="text-[10px] leading-none self-center opacity-50">empty</span>
            </template>
          </button>
          <button
            v-if="assigned[s]"
            type="button"
            aria-label="Clear slot"
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[10px] leading-none text-slate-300 hover:text-rose-400 hover:border-rose-400 flex items-center justify-center"
            @click.stop="clearSlot(s)">✕</button>
        </div>
      </div>
      <span class="w-px h-10 bg-slate-800"></span>
      <div class="relative">
        <button
          type="button"
          class="relative w-12 h-16 rounded border flex flex-col justify-between p-1 font-mono transition-colors"
          :class="[
            assigned.turn
              ? 'bg-slate-100 text-slate-900 border-slate-300'
              : 'bg-transparent border-dashed border-slate-700 text-slate-600',
            active === 'turn' ? 'ring-2 ring-emerald-500/60' : '',
          ]"
          @click="active = 'turn'">
          <template v-if="assigned.turn">
            <span class="text-xs leading-none text-left">{{ slotRank(assigned.turn) }}</span>
            <span class="text-lg leading-none self-end" :class="suitCls(slotSuit(assigned.turn))">
              {{ suitGlyph(slotSuit(assigned.turn)) }}
            </span>
          </template>
          <template v-else>
            <span class="text-[10px] leading-none text-left opacity-70">{{ LABELS.turn }}</span>
            <span class="text-[10px] leading-none self-center opacity-50">empty</span>
          </template>
        </button>
        <button
          v-if="assigned.turn"
          type="button"
          aria-label="Clear slot"
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[10px] leading-none text-slate-300 hover:text-rose-400 hover:border-rose-400 flex items-center justify-center"
          @click.stop="clearSlot('turn')">✕</button>
      </div>
      <span class="w-px h-10 bg-slate-800"></span>
      <div class="relative">
        <button
          type="button"
          class="relative w-12 h-16 rounded border flex flex-col justify-between p-1 font-mono transition-colors"
          :class="[
            assigned.river
              ? 'bg-slate-100 text-slate-900 border-slate-300'
              : 'bg-transparent border-dashed border-slate-700 text-slate-600',
            active === 'river' ? 'ring-2 ring-emerald-500/60' : '',
          ]"
          @click="active = 'river'">
          <template v-if="assigned.river">
            <span class="text-xs leading-none text-left">{{ slotRank(assigned.river) }}</span>
            <span class="text-lg leading-none self-end" :class="suitCls(slotSuit(assigned.river))">
              {{ suitGlyph(slotSuit(assigned.river)) }}
            </span>
          </template>
          <template v-else>
            <span class="text-[10px] leading-none text-left opacity-70">{{ LABELS.river }}</span>
            <span class="text-[10px] leading-none self-center opacity-50">empty</span>
          </template>
        </button>
        <button
          v-if="assigned.river"
          type="button"
          aria-label="Clear slot"
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[10px] leading-none text-slate-300 hover:text-rose-400 hover:border-rose-400 flex items-center justify-center"
          @click.stop="clearSlot('river')">✕</button>
      </div>
      <button
        v-if="anyFilled"
        type="button"
        class="ml-auto text-[11px] text-slate-500 hover:text-rose-400"
        @click="clearAll">Clear board</button>
    </div>

    <div
      class="inline-grid gap-px bg-slate-800 p-px"
      :style="{ gridTemplateColumns: `repeat(14, minmax(0,1fr))` }"
      role="grid"
      @keydown="onKeydown">
      <!-- Header row: blank corner + suit glyphs -->
      <div class="min-h-[2.25rem] bg-slate-950"></div>
      <div
        v-for="r in RANKS" :key="'hdr-' + r"
        class="min-h-[2.25rem] flex items-center justify-center text-[10px] text-slate-500 bg-slate-950 font-mono">
        {{ r }}
      </div>

      <template v-for="suit in SUITS" :key="suit.s">
        <div
          class="min-h-[2.25rem] flex items-center justify-center text-[10px] bg-slate-950 font-mono"
          :class="suit.cls">
          {{ suit.label }}
        </div>
        <button v-for="r in RANKS" :key="r + suit.s"
          :ref="(el) => setBtnRef(r + suit.s, el)"
          :disabled="usedSet.has(r + suit.s) && assigned[active] !== (r + suit.s)"
          :tabindex="(r + suit.s) === activeCard ? 0 : -1"
          class="min-h-[2.25rem] text-xs font-mono flex items-center justify-center gap-0.5 focus:outline-none transition-colors"
          :class="[
            suit.cls,
            (usedSet.has(r + suit.s) && assigned[active] !== (r + suit.s))
              ? 'opacity-40 line-through bg-slate-900 cursor-not-allowed'
              : 'hover:bg-slate-700',
            assigned[active] === (r + suit.s)
              ? 'bg-sky-700'
              : ((usedSet.has(r + suit.s) && assigned[active] !== (r + suit.s)) ? '' : 'bg-slate-900'),
            (r + suit.s) === activeCard && assigned[active] !== (r + suit.s)
              ? 'ring-2 ring-emerald-500 ring-inset'
              : '',
          ]"
          @click="activeCard = (r + suit.s); pick(r + suit.s)"
          @focus="activeCard = (r + suit.s)">
          <span>{{ r }}</span>
          <span class="text-[10px]">{{ suit.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
