import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";

export interface EditorSetupOptions {
  theme: Extension[];
  language: Extension | null;
  save: () => void;
  onDocChanged: () => void;
}

export function editorSetupExtensions({
  theme,
  language,
  save,
  onDocChanged,
}: EditorSetupOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(2),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          save();
          return true;
        },
      },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
    ...(language === null ? [] : [language]),
    ...theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChanged();
    }),
  ];
}

export function revealLineRange(
  view: EditorView,
  range: { startLineNumber: number; endLineNumber: number },
): void {
  const doc = view.state.doc;
  const startLineNumber = Math.min(
    Math.max(range.startLineNumber, 1),
    doc.lines,
  );
  const endLineNumber = Math.min(
    Math.max(range.endLineNumber, startLineNumber),
    doc.lines,
  );
  const from = doc.line(startLineNumber).from;
  const to = doc.line(endLineNumber).to;
  view.dispatch({
    selection: { anchor: from, head: to },
    effects: EditorView.scrollIntoView(from, { y: "center" }),
  });
}
