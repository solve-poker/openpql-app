<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiGames } from "../api";

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
      class="block appearance-none rounded-lg border border-line bg-bg pl-3 pr-8 py-1.5 text-sm text-fg transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:pointer-events-none"
      :value="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option v-for="g in games" :key="g" :value="g">{{ g }}</option>
    </select>
    <span aria-hidden="true" class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted">▾</span>
  </div>
</template>
