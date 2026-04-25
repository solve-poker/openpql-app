<script setup lang="ts">
import QueryEditor from "./QueryEditor.vue";
import { useRun } from "../stores/run";

defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const run = useRun();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 p-4">
    <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div class="flex items-center justify-between border-b border-line bg-elevated/40 px-4 py-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">Editor</span>
        <span class="text-2xs text-subtle">Edit and run arbitrary PQL</span>
      </div>
      <div class="min-h-0 flex-1 bg-bg">
        <QueryEditor
          :model-value="modelValue"
          @update:model-value="(v) => emit('update:modelValue', v)" />
      </div>
    </section>

    <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div class="flex items-center justify-between border-b border-line bg-elevated/40 px-4 py-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">Output</span>
        <div class="flex items-center gap-2">
          <span
            v-if="run.running"
            aria-live="polite"
            class="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-2xs font-semibold text-info">
            <span class="h-1.5 w-1.5 rounded-full bg-info motion-safe:animate-pulse"></span>
            Running
          </span>
          <span
            v-else-if="run.elapsedMs > 0"
            class="inline-flex items-center gap-1.5 rounded-chip border border-line px-2 py-0.5 text-2xs font-medium text-muted">
            <span class="text-subtle uppercase tracking-wider">Elapsed</span>
            <span class="font-mono text-fg">{{ (run.elapsedMs / 1000).toFixed(1) }}s</span>
          </span>
          <span v-else class="text-2xs uppercase tracking-wider text-subtle">idle</span>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto bg-bg p-3 font-mono text-xs">
        <div
          v-if="run.error"
          role="alert"
          class="mb-2 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2">
          <span class="font-semibold text-danger">Error:</span>
          <span class="text-muted whitespace-pre-wrap">{{ run.error }}</span>
        </div>
        <div v-for="(l, i) in run.stderr" :key="'e' + i" class="whitespace-pre-wrap text-danger">{{ l }}</div>
        <div v-for="(l, i) in run.stdout" :key="'o' + i" class="whitespace-pre-wrap text-fg">{{ l }}</div>
        <div
          v-if="!run.stdout.length && !run.stderr.length && !run.running && !run.error"
          class="text-subtle">
          Press <kbd class="rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-2xs text-fg">⌘↵</kbd> to run.
        </div>
      </div>
    </section>
  </div>
</template>
