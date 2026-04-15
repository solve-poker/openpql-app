<script setup lang="ts">
import { computed, ref } from "vue";

const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS = [
  { s: "s", label: "♠", cls: "text-slate-200" },
  { s: "h", label: "♥", cls: "text-rose-400" },
  { s: "d", label: "♦", cls: "text-sky-400" },
  { s: "c", label: "♣", cls: "text-emerald-400" },
];

const SLOTS = ["hero", "villain", "flop1", "flop2", "flop3", "turn", "river"] as const;
type Slot = typeof SLOTS[number];

const assigned = ref<Record<Slot, string | null>>(
  Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<Slot, string | null>,
);
const active = ref<Slot>("hero");

const usedSet = computed(() => new Set(Object.values(assigned.value).filter(Boolean) as string[]));

function pick(card: string) {
  if (usedSet.value.has(card) && assigned.value[active.value] !== card) return;
  assigned.value[active.value] = card;
  emitValue();
}
function clearSlot(s: Slot) { assigned.value[s] = null; emitValue(); }

const emit = defineEmits<{ (e: "update", v: { hero: string; villain: string; board: string }): void }>();
function emitValue() {
  const hero = assigned.value.hero ?? "";
  const villain = assigned.value.villain ?? "";
  const board = [assigned.value.flop1, assigned.value.flop2, assigned.value.flop3,
    assigned.value.turn, assigned.value.river].filter(Boolean).join("");
  emit("update", { hero, villain, board });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2 flex-wrap text-xs">
      <button v-for="s in SLOTS" :key="s"
        class="px-2 py-1 rounded border"
        :class="active === s ? 'bg-sky-600 border-sky-400' : 'bg-slate-900 border-slate-800'"
        @click="active = s">
        {{ s }}: {{ assigned[s] ?? '—' }}
        <span v-if="assigned[s]" class="ml-1 text-slate-400 hover:text-rose-400"
          @click.stop="clearSlot(s)">✕</span>
      </button>
    </div>
    <div class="inline-grid gap-px bg-slate-800 p-px"
      :style="{ gridTemplateColumns: `repeat(13, minmax(0,1fr))` }">
      <template v-for="suit in SUITS" :key="suit.s">
        <button v-for="r in RANKS" :key="r + suit.s"
          :disabled="usedSet.has(r + suit.s) && assigned[active] !== (r + suit.s)"
          class="w-8 h-8 text-xs font-mono disabled:opacity-30"
          :class="[
            suit.cls,
            assigned[active] === (r + suit.s) ? 'bg-sky-700' : 'bg-slate-900 hover:bg-slate-700',
          ]"
          @click="pick(r + suit.s)">
          {{ r }}{{ suit.label }}
        </button>
      </template>
    </div>
  </div>
</template>
