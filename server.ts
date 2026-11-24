import {
  experimental_getHostPathDirname as getHostPathDirname,
  experimental_joinHostPath as joinHostPath,
  defineRpcContract,
  type BbPluginApi,
} from "@get-bb/plugin-sdk";
import { z } from "zod";

const MAX_EDITABLE_BYTES = 8 * 1024 * 1024;

const sourceSchema = z
  .object({
    kind: z.enum(["workspace", "host", "thread-storage"]),
    threadId: z.string().nullable(),
    environmentId: z.string().nullable(),
    projectId: z.string().nullable(),
    experimental_hostId: z.string().optional(),
  })
  .strict();

const fileSchema = z
  .object({ path: z.string().min(1), source: sourceSchema })
  .strict();

export const rpcContract = defineRpcContract({
  read: {
    input: fileSchema,
    output: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("text"),
        content: z.string(),
        sha256: z.string(),
      }),
      z.object({ kind: z.literal("unsupported"), reason: z.string() }),
    ]),
  },
  write: {
    input: fileSchema.extend({
      content: z.string(),
      expectedSha256: z.string().nullable(),
    }),
    output: z.discriminatedUnion("outcome", [
      z.object({ outcome: z.literal("written"), sha256: z.string() }),
      z.object({
        outcome: z.literal("conflict"),
        currentSha256: z.string().nullable(),
      }),
    ]),
  },
});

function workspacePath(rootPath: string, relativePath: string): string {
  const path = joinHostPath({ rootPath, relativePath });
  if (path === null) throw new Error("Workspace path must be absolute");
  return path;
}

export default async function plugin(bb: BbPluginApi) {
  async function resolveTarget(
    source: z.infer<typeof sourceSchema>,
    filePath: string,
  ): Promise<{ path: string; hostId?: string }> {
    if (source.kind === "thread-storage") {
      if (source.threadId === null) {
        throw new Error("This thread-storage file has no thread");
      }
      const { hostId, storageRootPath } = await bb.sdk.threads.storageLocation({
        threadId: source.threadId,
      });
      return {
        path: workspacePath(storageRootPath, filePath),
        hostId,
      };
    }

    if (source.kind === "workspace" && source.environmentId === null) {
      if (source.projectId === null) {
        throw new Error("This file has no environment or project");
      }
      const project = await bb.sdk.projects.get({
        projectId: source.projectId,
      });
      const sources = project.sources;
      const checkout =
        source.experimental_hostId === undefined
          ? (sources.find((entry) => entry.isDefault) ?? sources[0])
          : sources.find(
              (entry) => entry.hostId === source.experimental_hostId,
            );
      if (checkout === undefined) {
        throw new Error("This project has no matching source checkout");
      }
      return {
        path: workspacePath(checkout.path, filePath),
        hostId: checkout.hostId,
      };
    }

    if (source.environmentId === null) {
      throw new Error("This file has no environment to resolve it against");
    }
    const environment = await bb.sdk.environments.get({
      environmentId: source.environmentId,
    });

    if (source.kind === "host") {
      const rootPath = getHostPathDirname(filePath);
      if (rootPath === null) {
        throw new Error("Host file paths must be absolute");
      }
      return {
        path: filePath,
        ...(environment.hostId ? { hostId: environment.hostId } : {}),
      };
    }

    if (!environment.path) {
      throw new Error("This environment has no workspace path");
    }
    return {
      path: workspacePath(environment.path, filePath),
      ...(environment.hostId ? { hostId: environment.hostId } : {}),
    };
  }

  bb.rpc.register(rpcContract, {
    async read({ path: filePath, source }) {
      const target = await resolveTarget(source, filePath);
      const file = await bb.sdk.files.read(target);

      if (file.contentEncoding !== "utf8") {
        return {
          kind: "unsupported" as const,
          reason: "This file is not text",
        };
      }
      if (file.sizeBytes > MAX_EDITABLE_BYTES) {
        return {
          kind: "unsupported" as const,
          reason: `This file is too large to edit (${Math.round(file.sizeBytes / 1024 / 1024)} MB)`,
        };
      }
      return {
        kind: "text" as const,
        content: file.content,
        sha256: file.sha256,
      };
    },

    async write({ path: filePath, source, content, expectedSha256 }) {
      const target = await resolveTarget(source, filePath);
      const result = await bb.sdk.files.write({
        ...target,
        content,
        contentEncoding: "utf8",
        expectedSha256,
      });
      if (result.outcome === "written") bb.internal_DO_NOT_USE_recordPluginUse();
      return result.outcome === "written"
        ? { outcome: "written" as const, sha256: result.sha256 }
        : { outcome: "conflict" as const, currentSha256: result.currentSha256 };
    },
  });
}
