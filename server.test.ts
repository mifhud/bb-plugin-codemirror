import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import plugin from "./server";

const WORKSPACE_FILE = {
  path: "src/a.ts",
  source: {
    kind: "workspace" as const,
    threadId: null,
    environmentId: "env_1",
    projectId: null,
  },
};

const DEFAULT_ENVIRONMENT = { id: "env_1", path: "/repo", hostId: "host_1" };

const DEFAULT_PROJECT = {
  sources: [{ path: "/repo", hostId: "host_1", isDefault: true }],
};

const DEFAULT_FILE = {
  content: "let a = 1;\n",
  sha256: "sha_1",
  sizeBytes: 11,
  contentEncoding: "utf8",
};

async function boot(
  options: {
    read?: (input: unknown) => unknown;
    write?: (input: unknown) => unknown;
    environment?: Record<string, unknown>;
    project?: Record<string, unknown>;
  } = {},
) {
  const host = createFakePluginHost({
    pluginId: "codemirror",
    sdk: {
      environments: {
        get: async () => options.environment ?? DEFAULT_ENVIRONMENT,
      },
      projects: { get: async () => options.project ?? DEFAULT_PROJECT },
      threads: {
        storageLocation: async () => ({
          hostId: "host_1",
          storageRootPath: "/storage/thr_1",
        }),
      },
      files: {
        read: async (input: unknown) => options.read?.(input) ?? DEFAULT_FILE,
        write: async (input: unknown) =>
          options.write?.(input) ?? { outcome: "written", sha256: "sha_2" },
      },
    },
  });
  await plugin(host.bb);
  return host;
}

describe("rpc read", () => {
  it("resolves a workspace file against its environment checkout", async () => {
    const requests: unknown[] = [];
    const host = await boot({
      read: (input) => {
        requests.push(input);
        return DEFAULT_FILE;
      },
    });

    const result = await host.harness.behavior.callRpc("read", WORKSPACE_FILE);

    expect(result).toEqual({
      kind: "text",
      content: "let a = 1;\n",
      sha256: "sha_1",
    });
    expect(requests).toEqual([{ path: "/repo/src/a.ts", hostId: "host_1" }]);
  });

  it("resolves a thread-storage file against the thread's storage root", async () => {
    const requests: unknown[] = [];
    const host = await boot({
      read: (input) => {
        requests.push(input);
        return DEFAULT_FILE;
      },
    });

    await host.harness.behavior.callRpc("read", {
      path: "notes/a.md",
      source: {
        kind: "thread-storage",
        threadId: "thr_1",
        environmentId: null,
        projectId: null,
      },
    });

    expect(requests).toEqual([
      { path: "/storage/thr_1/notes/a.md", hostId: "host_1" },
    ]);
  });

  it("resolves a project file without an environment through the named host", async () => {
    const requests: unknown[] = [];
    const host = await boot({
      read: (input) => {
        requests.push(input);
        return DEFAULT_FILE;
      },
      project: {
        sources: [
          { path: "/primary", hostId: "host_a", isDefault: true },
          { path: "/secondary", hostId: "host_b" },
        ],
      },
    });

    await host.harness.behavior.callRpc("read", {
      path: "src/a.ts",
      source: {
        kind: "workspace",
        threadId: null,
        environmentId: null,
        projectId: "prj_1",
        experimental_hostId: "host_b",
      },
    });

    expect(requests).toEqual([
      { path: "/secondary/src/a.ts", hostId: "host_b" },
    ]);
  });

  it("delegates non-text files to bb's preview", async () => {
    const host = await boot({
      read: () => ({
        content: "",
        sha256: "sha_1",
        sizeBytes: 4,
        contentEncoding: "base64",
      }),
    });

    expect(await host.harness.behavior.callRpc("read", WORKSPACE_FILE)).toEqual({
      kind: "unsupported",
      reason: "This file is not text",
    });
  });

  it("delegates files above the editable size limit", async () => {
    const host = await boot({
      read: () => ({
        content: "",
        sha256: "sha_1",
        sizeBytes: 12 * 1024 * 1024,
        contentEncoding: "utf8",
      }),
    });

    expect(await host.harness.behavior.callRpc("read", WORKSPACE_FILE)).toEqual({
      kind: "unsupported",
      reason: "This file is too large to edit (12 MB)",
    });
  });

  it("resolves a host file against its absolute path", async () => {
    const requests: unknown[] = [];
    const host = await boot({
      read: (input) => {
        requests.push(input);
        return DEFAULT_FILE;
      },
    });

    await host.harness.behavior.callRpc("read", {
      path: "/srv/app/main.go",
      source: {
        kind: "host",
        threadId: null,
        environmentId: "env_1",
        projectId: null,
      },
    });

    expect(requests).toEqual([
      { path: "/srv/app/main.go", hostId: "host_1" },
    ]);
  });

  it("rejects a file with neither an environment nor a project", async () => {
    const host = await boot();

    await expect(
      host.harness.behavior.callRpc("read", {
        path: "src/a.ts",
        source: {
          kind: "workspace",
          threadId: null,
          environmentId: null,
          projectId: null,
        },
      }),
    ).rejects.toThrow("This file has no environment or project");
  });

  it("rejects a thread-storage file without a thread", async () => {
    const host = await boot();

    await expect(
      host.harness.behavior.callRpc("read", {
        path: "notes/a.md",
        source: {
          kind: "thread-storage",
          threadId: null,
          environmentId: null,
          projectId: null,
        },
      }),
    ).rejects.toThrow("This thread-storage file has no thread");
  });

  it("rejects a workspace root that is not absolute", async () => {
    const host = await boot({
      environment: { id: "env_1", path: "repo", hostId: "host_1" },
    });

    await expect(
      host.harness.behavior.callRpc("read", WORKSPACE_FILE),
    ).rejects.toThrow("Workspace path must be absolute");
  });

  it("rejects a file whose environment has no workspace path", async () => {
    const host = await boot({
      environment: { id: "env_1", path: null, hostId: "host_1" },
    });

    await expect(
      host.harness.behavior.callRpc("read", WORKSPACE_FILE),
    ).rejects.toThrow("This environment has no workspace path");
  });
});

describe("rpc write", () => {
  it("writes the edit with the hash it was loaded from", async () => {
    const requests: unknown[] = [];
    const host = await boot({
      write: (input) => {
        requests.push(input);
        return { outcome: "written", sha256: "sha_2" };
      },
    });

    const result = await host.harness.behavior.callRpc("write", {
      ...WORKSPACE_FILE,
      content: "let a = 2;\n",
      expectedSha256: "sha_1",
    });

    expect(result).toEqual({ outcome: "written", sha256: "sha_2" });
    expect(requests).toEqual([
      {
        path: "/repo/src/a.ts",
        hostId: "host_1",
        content: "let a = 2;\n",
        contentEncoding: "utf8",
        expectedSha256: "sha_1",
      },
    ]);
  });

  it("reports the on-disk hash when the file changed underneath", async () => {
    const host = await boot({
      write: () => ({ outcome: "conflict", currentSha256: "sha_disk" }),
    });

    const result = await host.harness.behavior.callRpc("write", {
      ...WORKSPACE_FILE,
      content: "let a = 2;\n",
      expectedSha256: "sha_1",
    });

    expect(result).toEqual({ outcome: "conflict", currentSha256: "sha_disk" });
  });
});
