import { X } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";

/**
 * Tag colors reuse the categorical chart palette (--chart-1..5) — see
 * docs/design/design-bible.md's Tags section. Never a 6th color or free-form
 * hex; if more variety is needed later, propose it in the bible first.
 */
export type TagColor = "blue" | "green" | "amber" | "violet" | "rose";

export interface TagLike {
  id: string;
  name: string;
  color: TagColor;
}

const TAG_COLOR_DOT: Record<TagColor, string> = {
  blue: "bg-chart-1",
  green: "bg-chart-2",
  amber: "bg-chart-3",
  violet: "bg-chart-4",
  rose: "bg-chart-5",
};

export const TAG_COLORS: TagColor[] = ["blue", "green", "amber", "violet", "rose"];

export function TagDot({ color, className }: { color: TagColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", TAG_COLOR_DOT[color], className)}
    />
  );
}

export function TagPill({
  tag,
  onRemove,
  className,
}: {
  tag: TagLike;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground",
        className,
      )}
    >
      <TagDot color={tag.color} />
      {tag.name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag.name}`}
          className="-mr-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
