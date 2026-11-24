import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  experimental_useCodeTheme,
  useRpc,
  type PluginFileOpenerProps,
} from "@get-bb/plugin-sdk/app";
import { EditorToolbar, type SaveIndicator } from "@/components/EditorToolbar";
import { NoticeAction, NoticeRow } from "@/components/Notice";
import { editorSetupExtensions, revealLineRange } from "@/lib/editor";
import { languageSupportFor } from "@/lib/languages";
import { codeThemeExtensions } from "@/lib/theme";
import type { rpcContract } from "@/server";

type SaveState =
  | { kind: "clean" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; currentSha256: string | null }
  | {
      kind: "reloaded";
      discardedContent: string;
      discardedSha256: string | null;
    };

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "delegate"; reason: string }
  | { kind: "error"; message: string };

function indicatorFor(saveState: SaveState, status: Status): SaveIndicator {
  if (status.kind === "error") return "error";
  switch (saveState.kind) {
    case "saving":
      return "saving";
    case "dirty":
      return "dirty";
    case "error":
    case "conflict":
      return "error";
    default:
      return "clean";
  }
}

export function CodeMirrorFileOpener({
  path,
  source,
  Original,
  experimental_lineRange,
}: PluginFileOpenerProps) {
  const rpc = useRpc<typeof rpcContract>();
  const codeTheme = experimental_useCodeTheme();
  const themeCompartment = useMemo(() => new Compartment(), []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const conflictNoticeRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sha256Ref = useRef<string | null>(null);
  const saveStateRef = useRef<SaveState>({ kind: "clean" });
  const applyingExternalRef = useRef(false);
  const codeThemeRef = useRef(codeTheme);
  codeThemeRef.current = codeTheme;
  const navigationRef = useRef({ path, lineRange: experimental_lineRange });

  const [saveState, setSaveStateValue] = useState<SaveState>({ kind: "clean" });
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState(false);

  const setSaveState = useCallback((next: SaveState) => {
    saveStateRef.current = next;
    setSaveStateValue(next);
  }, []);

  const applyContent = useCallback((content: string) => {
    const view = viewRef.current;
    if (view === null) return;
    applyingExternalRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      selection: { anchor: 0 },
      scrollIntoView: false,
    });
    applyingExternalRef.current = false;
  }, []);

  const writeEditorContent = useCallback(
    async (expectedSha256: string | null) => {
      const view = viewRef.current;
      if (view === null) return;
      setSaveState({ kind: "saving" });
      try {
        const result = await rpc.call("write", {
          path,
          source,
          content: view.state.doc.toString(),
          expectedSha256,
        });
        if (result.outcome === "conflict") {
          setSaveState({
            kind: "conflict",
            currentSha256: result.currentSha256,
          });
          return;
        }
        sha256Ref.current = result.sha256;
        setSaveState({ kind: "clean" });
      } catch (error) {
        setSaveState({
          kind: "error",
          message: error instanceof Error ? error.message : "Save failed",
        });
      }
    },
    [path, rpc, setSaveState, source],
  );

  const save = useCallback(async () => {
    if (saveStateRef.current.kind === "saving") return;
    if (saveStateRef.current.kind === "conflict") {
      conflictNoticeRef.current?.focus();
      return;
    }
    await writeEditorContent(sha256Ref.current);
  }, [writeEditorContent]);

  const saveRef = useRef(save);
  saveRef.current = save;

  const reloadFromDisk = useCallback(async () => {
    const view = viewRef.current;
    if (view === null) return;
    setIsRefreshing(true);
    try {
      const file = await rpc.call("read", { path, source });
      if (viewRef.current !== view) return;
      if (file.kind !== "text") {
        setStatus({ kind: "delegate", reason: file.reason });
        return;
      }
      const conflict = saveStateRef.current.kind === "conflict";
      const discardedContent = conflict ? view.state.doc.toString() : null;
      const discardedSha256 = sha256Ref.current;
      sha256Ref.current = file.sha256;
      applyContent(file.content);
      setSaveState(
        discardedContent === null
          ? { kind: "clean" }
          : { kind: "reloaded", discardedContent, discardedSha256 },
      );
    } catch (error) {
      if (viewRef.current !== view) return;
      setSaveState({
        kind: "error",
        message: error instanceof Error ? error.message : "Reload failed",
      });
    } finally {
      if (viewRef.current === view) setIsRefreshing(false);
    }
  }, [applyContent, path, rpc, setSaveState, source]);

  const undoReload = useCallback(() => {
    const current = saveStateRef.current;
    if (current.kind !== "reloaded") return;
    const view = viewRef.current;
    if (view === null) return;
    const currentSha256 = sha256Ref.current;
    sha256Ref.current = current.discardedSha256;
    applyContent(current.discardedContent);
    setSaveState({ kind: "conflict", currentSha256 });
    view.focus();
  }, [applyContent, setSaveState]);

  const requestRefresh = useCallback(() => {
    if (saveStateRef.current.kind === "dirty") {
      setPendingDiscard(true);
      return;
    }
    void reloadFromDisk();
  }, [reloadFromDisk]);

  const overwrite = useCallback(async () => {
    const current = saveStateRef.current;
    if (current.kind !== "conflict") return;
    await writeEditorContent(current.currentSha256);
  }, [writeEditorContent]);

  useEffect(() => {
    if (saveState.kind === "reloaded") conflictNoticeRef.current?.focus();
  }, [saveState.kind]);

  useEffect(() => {
    let disposed = false;
    setStatus({ kind: "loading" });
    setIsRefreshing(false);
    setPendingDiscard(false);
    setSaveState({ kind: "clean" });
    sha256Ref.current = null;

    void (async () => {
      try {
        const file = await rpc.call("read", { path, source });
        if (disposed) return;
        if (file.kind !== "text") {
          setStatus({ kind: "delegate", reason: file.reason });
          return;
        }
        const container = containerRef.current;
        if (container === null) return;

        sha256Ref.current = file.sha256;
        const view = new EditorView({
          state: EditorState.create({
            doc: file.content,
            extensions: editorSetupExtensions({
              theme: [
                themeCompartment.of(codeThemeExtensions(codeThemeRef.current)),
              ],
              language: languageSupportFor(path),
              save: () => void saveRef.current(),
              onDocChanged: () => {
                if (applyingExternalRef.current) return;
                const current = saveStateRef.current;
                if (current.kind === "clean" || current.kind === "reloaded") {
                  setSaveState({ kind: "dirty" });
                }
              },
            }),
          }),
          parent: container,
        });
        viewRef.current = view;
        const range =
          navigationRef.current.path === path
            ? navigationRef.current.lineRange
            : null;
        if (range != null) revealLineRange(view, range);
        setStatus({ kind: "ready" });
      } catch (error) {
        if (disposed) return;
        setStatus({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Could not open this file",
        });
      }
    })();

    return () => {
      disposed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [path, rpc, setSaveState, source, themeCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(codeThemeExtensions(codeTheme)),
    });
  }, [codeTheme, status, themeCompartment]);

  useEffect(() => {
    navigationRef.current = { path, lineRange: experimental_lineRange };
    const view = viewRef.current;
    if (view === null) return;
    if (experimental_lineRange != null) {
      revealLineRange(view, experimental_lineRange);
    }
  }, [path, experimental_lineRange]);

  if (status.kind === "delegate") return <Original />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar
        path={path}
        indicator={indicatorFor(saveState, status)}
        saveConflict={saveState.kind === "conflict"}
        saveDisabled={
          status.kind !== "ready" ||
          isRefreshing ||
          saveState.kind === "saving"
        }
        onSave={() => void save()}
        isRefreshing={isRefreshing}
        onRefresh={requestRefresh}
      />
      <Notice
        conflictNoticeRef={conflictNoticeRef}
        isRefreshing={isRefreshing}
        onDiscardCancel={() => setPendingDiscard(false)}
        onDiscardConfirm={() => {
          setPendingDiscard(false);
          void reloadFromDisk();
        }}
        onOverwrite={() => void overwrite()}
        onReload={() => void reloadFromDisk()}
        onUndoReload={undoReload}
        pendingDiscard={pendingDiscard}
        saveState={saveState}
        status={status}
      />
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}

function Notice({
  conflictNoticeRef,
  isRefreshing,
  onDiscardCancel,
  onDiscardConfirm,
  onOverwrite,
  onReload,
  onUndoReload,
  pendingDiscard,
  saveState,
  status,
}: {
  conflictNoticeRef: React.RefObject<HTMLDivElement | null>;
  isRefreshing: boolean;
  onDiscardCancel: () => void;
  onDiscardConfirm: () => void;
  onOverwrite: () => void;
  onReload: () => void;
  onUndoReload: () => void;
  pendingDiscard: boolean;
  saveState: SaveState;
  status: Status;
}) {
  if (status.kind === "error") {
    return <NoticeRow tone="error">{status.message}</NoticeRow>;
  }
  if (saveState.kind === "conflict") {
    return (
      <NoticeRow tone="warning" focusRef={conflictNoticeRef} label="File changed on disk, edits not saved.">
        <span className="min-w-0 text-left leading-5">
          File changed on disk, edits not saved.
        </span>
        <NoticeAction
          disabled={isRefreshing}
          onClick={onReload}
          title="Discard your edits and load the latest saved file"
        >
          Keep disk version
        </NoticeAction>
        <NoticeAction
          disabled={isRefreshing}
          onClick={onOverwrite}
          title="Replace the saved file with your edits"
        >
          Save my edits
        </NoticeAction>
      </NoticeRow>
    );
  }
  if (pendingDiscard) {
    return (
      <NoticeRow tone="neutral">
        Reload from disk and discard your unsaved changes?
        <NoticeAction onClick={onDiscardConfirm}>Discard</NoticeAction>
        <NoticeAction onClick={onDiscardCancel}>Cancel</NoticeAction>
      </NoticeRow>
    );
  }
  if (saveState.kind === "error") {
    return <NoticeRow tone="error">{saveState.message}</NoticeRow>;
  }
  if (saveState.kind === "reloaded") {
    return (
      <NoticeRow tone="neutral" focusRef={conflictNoticeRef} label="Disk version loaded.">
        <span>Disk version loaded.</span>
        <NoticeAction disabled={isRefreshing} onClick={onUndoReload}>
          Undo
        </NoticeAction>
      </NoticeRow>
    );
  }
  return null;
}
