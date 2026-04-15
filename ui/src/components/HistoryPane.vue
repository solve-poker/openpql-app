<script setup lang="ts">
import { computed } from "vue";
import { useHistory } from "../stores/history";

const emit = defineEmits<{ (e: "select", src: string): void }>();
const h = useHistory();
const sorted = computed(() => [
  ...h.entries.filter((e) => e.pinned),
  ...h.entries.filter((e) => !e.pinned),
]);
</script>

<template>
  <div class="h-full flex flex-col border border-slate-800 rounded overflow-hidden">
    <div class="bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
      History
    </div>
    <div class="flex-1 overflow-auto divide-y divide-slate-800">
      <div v-if="!sorted.length" class="p-3 text-slate-500 text-sm">(empty)</div>
      <div v-for="e in sorted" :key="e.id" class="p-2 hover:bg-slate-900 group">
        <button class="text-left w-full text-xs font-mono truncate text-slate-200"
          @click="emit('select', e.src)">
          {{ e.src.split('\n')[0].slice(0, 80) }}
        </button>
        <div class="flex gap-2 text-[10px] mt-1 text-slate-500">
          <button @click="h.togglePin(e.id)" class="hover:text-amber-400">
            {{ e.pinned ? '★ pinned' : '☆ pin' }}
          </button>
          <button @click="h.remove(e.id)" class="hover:text-rose-400">delete</button>
          <span class="ml-auto">{{ new Date(e.ts).toLocaleTimeString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
