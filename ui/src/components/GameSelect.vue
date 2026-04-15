<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiGames } from "../api/rest";

const props = defineProps<{ modelValue: string }>();
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
  <select
    class="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm"
    :value="modelValue"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option v-for="g in games" :key="g" :value="g">{{ g }}</option>
  </select>
</template>
