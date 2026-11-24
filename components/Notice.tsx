import { cn } from "@/lib/utils";

export function NoticeRow({
  children,
  tone,
  focusRef,
  label,
}: {
  children: React.ReactNode;
  tone: "error" | "warning" | "neutral";
  focusRef?: React.Ref<HTMLDivElement>;
  label?: string;
}) {
  return (
    <div
      ref={focusRef}
      role="status"
      aria-label={label}
      tabIndex={focusRef ? 0 : undefined}
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 px-4 py-1.5 text-xs",
        "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "warning" && "bg-muted text-foreground",
        tone === "neutral" && "bg-muted text-foreground",
      )}
    >
      {children}
    </div>
  );
}

export function NoticeAction({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="ml-auto cursor-pointer whitespace-nowrap rounded-sm font-medium underline underline-offset-2 hover:opacity-80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}
