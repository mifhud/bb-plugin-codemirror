import { useCallback, useEffect, useRef, useState } from "react";
import { experimental_copyToClipboard } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SaveIndicator = "clean" | "dirty" | "saving" | "error";

export interface EditorToolbarProps {
  path: string;
  indicator: SaveIndicator;
  saveDisabled: boolean;
  saveConflict: boolean;
  onSave: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function EditorToolbar({
  path,
  indicator,
  saveDisabled,
  saveConflict,
  onSave,
  isRefreshing,
  onRefresh,
}: EditorToolbarProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 bg-muted px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <FileGlyph
          path={path}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <CopyablePath path={path} />
        <ToolbarButton
          label={isRefreshing ? "Reloading file" : "Reload from disk"}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RotateIcon className={cn(isRefreshing && "animate-spin")} />
        </ToolbarButton>
      </div>
      <SaveDot indicator={indicator} />
      <ToolbarButton
        label={indicator === "saving" ? "Saving..." : "Save"}
        onClick={onSave}
        disabled={saveDisabled}
        unavailableReason={
          saveConflict ? "Resolve the file conflict below" : undefined
        }
      >
        <SaveIcon />
      </ToolbarButton>
    </div>
  );
}

function SaveDot({ indicator }: { indicator: SaveIndicator }) {
  if (indicator === "clean") {
    return <span className="size-4 shrink-0" aria-hidden />;
  }
  const label =
    indicator === "saving"
      ? "Saving..."
      : indicator === "error"
        ? "Could not save — unsaved changes"
        : "Unsaved changes";
  return (
    <span
      className="flex size-4 shrink-0 items-center justify-center"
      title={label}
      role="status"
      aria-label={label}
    >
      <span
        className={cn(
          "size-2 rounded-full transition-colors",
          indicator === "saving" && "animate-pulse bg-foreground",
          indicator === "dirty" && "bg-foreground",
          indicator === "error" && "bg-destructive",
        )}
      />
    </span>
  );
}

function CopyablePath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void experimental_copyToClipboard({ text: path }).then((copiedPath) => {
      if (!copiedPath) {
        toast.error("Failed to copy file path");
        return;
      }
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      toast.success("File path copied");
    });
  }, [path]);

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : "Copy file path"}
      aria-label="Copy file path"
      className={cn(
        "min-w-0 cursor-pointer truncate rounded-sm text-left font-mono text-sm",
        "font-medium leading-5 text-foreground underline-offset-2",
        "hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
      )}
      style={{ direction: "rtl", textAlign: "left" }}
    >
      <bdi>{path}</bdi>
    </button>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  unavailableReason,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  unavailableReason?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={unavailableReason ? undefined : onClick}
      disabled={disabled}
      title={unavailableReason ?? label}
      aria-label={label}
      aria-disabled={unavailableReason ? true : undefined}
      aria-description={unavailableReason}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
        unavailableReason
          ? "cursor-default opacity-50"
          : "cursor-pointer hover:bg-muted-foreground/15 hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h12l4 4v12a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RotateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-3.5", className)}
      aria-hidden
    >
      <path
        d="M3 2v6h6M3.51 15a9 9 0 102.13-9.36L3 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileGlyph({ path, className }: { path: string; className?: string }) {
  const extension = extensionForGlyph(path);
  if (DATA_EXTENSIONS.has(extension)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M8 3H7a2 2 0 00-2 2v4a2 2 0 01-2 2 2 2 0 012 2v4a2 2 0 002 2h1M16 3h1a2 2 0 012 2v4a2 2 0 002 2 2 2 0 00-2 2v4a2 2 0 01-2 2h-1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (DOC_EXTENSIONS.has(extension)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 2v6h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M8 6L2 12l6 6M16 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DATA_EXTENSIONS = new Set([
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "xml",
  "csv",
  "tsv",
]);

const DOC_EXTENSIONS = new Set([
  "md",
  "mdx",
  "markdown",
  "txt",
  "text",
  "rst",
  "adoc",
  "log",
]);

function extensionForGlyph(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  const dotIndex = name.lastIndexOf(".");
  return dotIndex <= 0 ? "" : name.slice(dotIndex + 1).toLowerCase();
}
