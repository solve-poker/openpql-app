<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiGames } from "../api/rest";

const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const games = ref<string[]>(["holdem", "omaha", "shortdeck"]);

onMounted(async () => {
  try {
    const g = await apiGames();
    if (g.length) games.value = g;
    if (!games.value.includes(props.modelValue)) {
      emit("update:modelValue", games.value[0]);
    }
  } catch {
    /* fall back to defaults */
  }
});
</script>

<template>
  <div class="relative inline-block">
    <select
      class="appearance-none bg-slate-900 border border-slate-800 rounded pl-2 pr-7 py-1 text-sm disabled:opacity-50"
      :value="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option v-for="g in games" :key="g" :value="g">{{ g }}</option>
    </select>
    <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 text-xs">▾</span>
  </div>
</template>
