<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { apiValidateRange } from "../api/rest";

const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const selected = ref<Set<string>>(new Set());
const dragging = ref<"add" | "remove" | null>(null);
const validation = ref<string>("");

function cellKey(r: number, c: number) {
  const hi = RANKS[Math.min(r, c)];
  const lo = RANKS[Math.max(r, c)];
  if (r === c) return hi + hi;
  if (r < c) return hi + lo + "s";
  return hi + lo + "o";
}

function toggle(key: string, force?: "add" | "remove") {
  const has = selected.value.has(key);
  const action = force ?? (has ? "remove" : "add");
  if (action === "add") selected.value.add(key);
  else selected.value.delete(key);
  selected.value = new Set(selected.value);
  emit("update:modelValue", [...selected.value].join(","));
}

function startDrag(r: number, c: number, e: MouseEvent) {
  e.preventDefault();
  const key = cellKey(r, c);
  dragging.value = selected.value.has(key) ? "remove" : "add";
  toggle(key, dragging.value);
}

function overDrag(r: number, c: number) {
  if (!dragging.value) return;
  toggle(cellKey(r, c), dragging.value);
}

function endDrag() { dragging.value = null; }

watch(() => props.modelValue, (v) => {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  const next = new Set(parts);
  if ([...next].sort().join(",") !== [...selected.value].sort().join(",")) {
    selected.value = next;
  }
}, { immediate: true });

watch(() => props.modelValue, async (v) => {
  if (!v.trim()) { validation.value = ""; return; }
  const r = await apiValidateRange("holdem", v);
  validation.value = r.ok === "true" ? "✓ valid" : `✗ ${r.message}`;
});

const statusClass = computed(() =>
  validation.value.startsWith("✓") ? "text-emerald-400" : "text-rose-400");
</script>

<template>
  <div class="flex flex-col gap-2" @mouseup="endDrag" @mouseleave="endDrag">
    <div class="inline-grid gap-px bg-slate-800 p-px select-none"
      :style="{ gridTemplateColumns: `repeat(13, minmax(0,1fr))` }">
      <template v-for="(_, r) in RANKS" :key="r">
        <button v-for="(__, c) in RANKS" :key="c"
          class="w-7 h-7 text-[10px] font-mono"
          :class="selected.has(cellKey(r, c))
            ? (r === c ? 'bg-emerald-600' : r < c ? 'bg-sky-600' : 'bg-indigo-600')
            : 'bg-slate-900 hover:bg-slate-700'"
          @mousedown="startDrag(r, c, $event)"
          @mouseenter="overDrag(r, c)">
          {{ cellKey(r, c) }}
        </button>
      </template>
    </div>
    <div class="flex items-center gap-2">
      <input class="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-xs"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        placeholder="e.g. AA,KK,AKs" />
      <span class="text-xs" :class="statusClass">{{ validation }}</span>
    </div>
  </div>
</template>
