// @vitest-environment jsdom
import type { PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { RenderedSlot } from "@get-bb/plugin-sdk/testing/app";
import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const SOURCE = {
  kind: "workspace" as const,
  threadId: null,
  environmentId: "env_1",
  projectId: null,
};

const ORIGINAL_CONTENT = "let a = 1;\n";

function fileOpenerProps(path = "src/a.ts"): PluginFileOpenerProps {
  return {
    path,
    source: SOURCE,
    experimental_lineRange: null,
    Original: () => <div>bb preview</div>,
  };
}

const mountedSlots: RenderedSlot[] = [];

afterEach(() => {
  for (const slot of mountedSlots.splice(0)) slot.lifecycle.unmount();
});

async function openEditor(options: {
  read?: (input: unknown) => unknown;
  write?: (input: unknown) => unknown;
} = {}) {
  const app = await loadPluginApp(() => import("../app"));
  const opener = app.fileOpeners[0];
  if (opener === undefined) throw new Error("no file opener registered");

  const slot = renderSlot(opener, fileOpenerProps(), {
    rpc: {
      read: (input: unknown) =>
        options.read?.(input) ?? {
          kind: "text",
          content: ORIGINAL_CONTENT,
          sha256: "sha_1",
        },
      write: (input: unknown) =>
        options.write?.(input) ?? { outcome: "written", sha256: "sha_2" },
    },
  });
  mountedSlots.push(slot);
  return slot;
}

async function waitForEditor(slot: RenderedSlot) {
  await waitFor(() => {
    if (slot.container.querySelector(".cm-content") === null) {
      throw new Error("editor not mounted");
    }
  });
}

function editorText(slot: RenderedSlot) {
  return slot.container.querySelector(".cm-content")?.textContent ?? "";
}
function writeCalls(slot: RenderedSlot) {
  return slot.inspection.rpcCalls.filter((call) => call.method === "write");
}


describe("CodeMirror file opener", () => {
  it("opens the file in a CodeMirror editor with line numbers", async () => {
    const slot = await openEditor();

    await waitForEditor(slot);
    expect(editorText(slot)).toContain(ORIGINAL_CONTENT.trim());
    expect(slot.container.querySelector(".cm-gutters")).not.toBeNull();
    expect(slot.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("saves the buffer with the hash it was loaded from", async () => {
    const writes: unknown[] = [];
    const slot = await openEditor({
      write: (input) => {
        writes.push(input);
        return { outcome: "written", sha256: "sha_2" };
      },
    });
    await waitForEditor(slot);

    fireEvent.click(slot.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      path: "src/a.ts",
      source: SOURCE,
      content: ORIGINAL_CONTENT,
      expectedSha256: "sha_1",
    });
  });

  it("offers the disk version and the draft when the file changed on disk", async () => {
    const writes: unknown[] = [];
    const slot = await openEditor({
      write: (input) => {
        writes.push(input);
        return { outcome: "conflict", currentSha256: "sha_disk" };
      },
    });
    await waitForEditor(slot);

    fireEvent.click(slot.getByRole("button", { name: "Save" }));

    await slot.findByText("File changed on disk, edits not saved.");
    expect(writes).toHaveLength(1);

    fireEvent.click(slot.getByRole("button", { name: "Save" }));
    expect(writes).toHaveLength(1);

    fireEvent.click(slot.getByRole("button", { name: "Save my edits" }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual({
      path: "src/a.ts",
      source: SOURCE,
      content: ORIGINAL_CONTENT,
      expectedSha256: "sha_disk",
    });
  });

  it("saves with the platform's save shortcut", async () => {
    const writes: unknown[] = [];
    const slot = await openEditor({
      write: (input) => {
        writes.push(input);
        return { outcome: "written", sha256: "sha_2" };
      },
    });
    await waitForEditor(slot);

    const content = slot.container.querySelector(".cm-content");
    if (content === null) throw new Error("no editor content");
    const modifier = navigator.platform.startsWith("Mac")
      ? { metaKey: true }
      : { ctrlKey: true };
    fireEvent.keyDown(content, { key: "s", code: "KeyS", ...modifier });

    await waitFor(() => expect(writes).toHaveLength(1));
  });

  it("loads the disk version again when the reload button is used", async () => {
    const contents = [ORIGINAL_CONTENT, "let a = 2;\n"];
    let reads = 0;
    const slot = await openEditor({
      read: () => {
        const index = Math.min(reads, contents.length - 1);
        reads += 1;
        return { kind: "text", content: contents[index], sha256: `sha_${reads}` };
      },
    });
    await waitForEditor(slot);
    expect(editorText(slot)).toContain("let a = 1;");

    fireEvent.click(slot.getByRole("button", { name: "Reload from disk" }));

    await waitFor(() => expect(editorText(slot)).toContain("let a = 2;"));
  });

  it("marks the buffer dirty and asks before discarding it", async () => {
    const slot = await openEditor();
    await waitForEditor(slot);

    const line = slot.container.querySelector(".cm-line");
    if (line === null) throw new Error("no editable line rendered");
    line.textContent = "let a = 3;";

    await slot.findByRole("status", { name: "Unsaved changes" });

    fireEvent.click(slot.getByRole("button", { name: "Reload from disk" }));

    expect(
      await slot.findByText(
        "Reload from disk and discard your unsaved changes?",
      ),
    ).toBeDefined();
  });

  it("delegates files bb cannot edit to bb's preview", async () => {
    const slot = await openEditor({
      read: () => ({ kind: "unsupported", reason: "This file is not text" }),
    });

    expect(await slot.findByText("bb preview")).toBeDefined();
    expect(slot.container.querySelector(".cm-content")).toBeNull();
    expect(writeCalls(slot)).toHaveLength(0);
  });
});
