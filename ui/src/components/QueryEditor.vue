<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { pqlLang } from "../pql/highlight";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const root = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;

onMounted(() => {
  view = new EditorView({
    parent: root.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        pqlLang,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.theme({
          "&": { backgroundColor: "#0f172a", color: "#e2e8f0" },
          ".cm-gutters": { backgroundColor: "#0f172a", color: "#64748b", border: "none" },
          ".cm-activeLine": { backgroundColor: "#1e293b" },
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit("update:modelValue", u.state.doc.toString());
        }),
      ],
    }),
  });
});

watch(() => props.modelValue, (v) => {
  if (view && v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
  }
});

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="root" class="h-full w-full border border-slate-800 rounded overflow-hidden"></div>
</template>
