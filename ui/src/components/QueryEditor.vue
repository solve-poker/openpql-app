<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { pqlLang } from "../pql/highlight";

const props = defineProps<{ modelValue: string; readonly?: boolean }>();
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
        EditorState.readOnly.of(!!props.readonly),
        EditorView.editable.of(!props.readonly),
        // CodeMirror theme uses live CSS vars so it follows the design tokens
        // through theme toggles without a re-mount.
        EditorView.theme({
          "&": {
            backgroundColor: "var(--bg)",
            color: "var(--fg)",
          },
          ".cm-content": { caretColor: "var(--primary)" },
          ".cm-gutters": {
            backgroundColor: "var(--bg)",
            color: "var(--subtle)",
            border: "none",
          },
          ".cm-activeLine": {
            backgroundColor: "color-mix(in srgb, var(--elevated) 50%, transparent)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "color-mix(in srgb, var(--elevated) 70%, transparent)",
          },
          ".cm-cursor": { borderLeftColor: "var(--primary)" },
          ".cm-selectionBackground, ::selection": {
            backgroundColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
          },
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
  <div ref="root" class="h-full w-full overflow-hidden bg-bg"></div>
</template>
