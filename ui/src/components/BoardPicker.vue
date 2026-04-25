<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS = [
  { s: "s", label: "♠" },
  { s: "h", label: "♥" },
  { s: "d", label: "♦" },
  { s: "c", label: "♣" },
];

function suitGlyph(s: string): string {
  const m = SUITS.find((x) => x.s === s);
  return m ? m.label : s;
}
function suitCls(s: string): string {
  return s === "h" || s === "d" ? "text-suit-red" : "text-suit-black";
}

const SLOTS = ["flop1", "flop2", "flop3", "turn", "river"] as const;
type Slot = typeof SLOTS[number];
const LABELS: Record<Slot, string> = {
  flop1: "F1", flop2: "F2", flop3: "F3", turn: "T", river: "R",
};
const FLOP_SLOTS: Slot[] = ["flop1", "flop2", "flop3"];

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
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex gap-1.5 rounded-lg border border-line bg-bg p-1.5">
        <div v-for="s in FLOP_SLOTS" :key="s" class="relative">
          <button
            type="button"
            class="relative flex h-16 w-12 flex-col justify-between rounded-md border p-1 font-mono transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            :class="[
              assigned[s]
                ? 'border-line bg-elevated text-fg shadow-card'
                : 'border-dashed border-line bg-transparent text-subtle',
              active === s ? 'ring-2 ring-primary' : '',
            ]"
            @click="active = s">
            <template v-if="assigned[s]">
              <span class="text-xs leading-none text-left">{{ slotRank(assigned[s]) }}</span>
              <span class="text-lg leading-none self-end" :class="suitCls(slotSuit(assigned[s]))">
                {{ suitGlyph(slotSuit(assigned[s])) }}
              </span>
            </template>
            <template v-else>
              <span class="text-2xs leading-none text-left font-semibold uppercase tracking-widest text-muted">{{ LABELS[s] }}</span>
              <span class="text-2xs leading-none self-center text-subtle">empty</span>
            </template>
          </button>
          <button
            v-if="assigned[s]"
            type="button"
            aria-label="Clear slot"
            class="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-line bg-elevated text-2xs leading-none text-muted transition hover:border-danger hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            @click.stop="clearSlot(s)">✕</button>
        </div>
      </div>
      <span class="h-10 w-px bg-line"></span>
      <div class="relative">
        <button
          type="button"
          class="relative flex h-16 w-12 flex-col justify-between rounded-md border p-1 font-mono transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          :class="[
            assigned.turn
              ? 'border-line bg-elevated text-fg shadow-card'
              : 'border-dashed border-line bg-transparent text-subtle',
            active === 'turn' ? 'ring-2 ring-primary' : '',
          ]"
          @click="active = 'turn'">
          <template v-if="assigned.turn">
            <span class="text-xs leading-none text-left">{{ slotRank(assigned.turn) }}</span>
            <span class="text-lg leading-none self-end" :class="suitCls(slotSuit(assigned.turn))">
              {{ suitGlyph(slotSuit(assigned.turn)) }}
            </span>
          </template>
          <template v-else>
            <span class="text-2xs leading-none text-left font-semibold uppercase tracking-widest text-muted">{{ LABELS.turn }}</span>
            <span class="text-2xs leading-none self-center text-subtle">empty</span>
          </template>
        </button>
        <button
          v-if="assigned.turn"
          type="button"
          aria-label="Clear slot"
          class="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-line bg-elevated text-2xs leading-none text-muted transition hover:border-danger hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          @click.stop="clearSlot('turn')">✕</button>
      </div>
      <span class="h-10 w-px bg-line"></span>
      <div class="relative">
        <button
          type="button"
          class="relative flex h-16 w-12 flex-col justify-between rounded-md border p-1 font-mono transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          :class="[
            assigned.river
              ? 'border-line bg-elevated text-fg shadow-card'
              : 'border-dashed border-line bg-transparent text-subtle',
            active === 'river' ? 'ring-2 ring-primary' : '',
          ]"
          @click="active = 'river'">
          <template v-if="assigned.river">
            <span class="text-xs leading-none text-left">{{ slotRank(assigned.river) }}</span>
            <span class="text-lg leading-none self-end" :class="suitCls(slotSuit(assigned.river))">
              {{ suitGlyph(slotSuit(assigned.river)) }}
            </span>
          </template>
          <template v-else>
            <span class="text-2xs leading-none text-left font-semibold uppercase tracking-widest text-muted">{{ LABELS.river }}</span>
            <span class="text-2xs leading-none self-center text-subtle">empty</span>
          </template>
        </button>
        <button
          v-if="assigned.river"
          type="button"
          aria-label="Clear slot"
          class="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-line bg-elevated text-2xs leading-none text-muted transition hover:border-danger hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          @click.stop="clearSlot('river')">✕</button>
      </div>
      <button
        v-if="anyFilled"
        type="button"
        class="ml-auto text-xs text-muted transition hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        @click="clearAll">Clear board</button>
    </div>

    <div
      class="inline-grid gap-px rounded-md border border-line bg-line p-px"
      :style="{ gridTemplateColumns: `repeat(14, minmax(0,1fr))` }"
      role="grid"
      @keydown="onKeydown">
      <div class="min-h-[2.25rem] bg-surface"></div>
      <div
        v-for="r in RANKS" :key="'hdr-' + r"
        class="flex min-h-[2.25rem] items-center justify-center bg-surface font-mono text-2xs text-muted">
        {{ r }}
      </div>

      <template v-for="suit in SUITS" :key="suit.s">
        <div
          class="flex min-h-[2.25rem] items-center justify-center bg-surface font-mono text-2xs"
          :class="suitCls(suit.s)">
          {{ suit.label }}
        </div>
        <button v-for="r in RANKS" :key="r + suit.s"
          :ref="(el) => setBtnRef(r + suit.s, el)"
          :disabled="usedSet.has(r + suit.s) && assigned[active] !== (r + suit.s)"
          :tabindex="(r + suit.s) === activeCard ? 0 : -1"
          class="flex min-h-[2.25rem] items-center justify-center gap-0.5 font-mono text-xs transition focus:outline-none"
          :class="[
            assigned[active] === (r + suit.s) ? '' : suitCls(suit.s),
            (usedSet.has(r + suit.s) && assigned[active] !== (r + suit.s))
              ? 'cursor-not-allowed bg-bg opacity-40 line-through'
              : 'bg-surface hover:bg-elevated',
            assigned[active] === (r + suit.s)
              ? 'bg-primary text-primary-fg hover:bg-primary'
              : '',
            (r + suit.s) === activeCard && assigned[active] !== (r + suit.s)
              ? 'ring-2 ring-inset ring-primary'
              : '',
          ]"
          @click="activeCard = (r + suit.s); pick(r + suit.s)"
          @focus="activeCard = (r + suit.s)">
          <span>{{ r }}</span>
          <span class="text-2xs">{{ suit.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
