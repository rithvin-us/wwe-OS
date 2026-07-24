"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "@bop/icons";

import { Button } from "@bop/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bop/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { TagDot, TagPill, type TagLike } from "@bop/ui/components/tag-pill";
import { cn } from "@bop/ui/lib/utils";

export interface TagPickerChange {
  tagIds: string[];
  tagNames: string[];
}

interface TagPickerProps {
  /** Tags currently attached to this object. */
  tags: TagLike[];
  /** The full tag vocabulary, for the picker's search list. */
  allTags: TagLike[];
  /** Called with the full desired set (existing ids + any newly-typed name)
   * every time the operator adds, removes, or creates a tag — the caller
   * replaces the object's tag set with this in one call. */
  onChange: (next: TagPickerChange) => void;
  disabled?: boolean;
  className?: string;
}

export function TagPicker({ tags, allTags, onChange, disabled, className }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(() => new Set(tags.map((t) => t.id)), [tags]);
  const trimmedQuery = query.trim();
  const hasExactMatch = allTags.some((t) => t.name.toLowerCase() === trimmedQuery.toLowerCase());

  function toggle(tag: TagLike) {
    const next = selectedIds.has(tag.id) ? tags.filter((t) => t.id !== tag.id) : [...tags, tag];
    onChange({ tagIds: next.map((t) => t.id), tagNames: [] });
  }

  function remove(tag: TagLike) {
    onChange({ tagIds: tags.filter((t) => t.id !== tag.id).map((t) => t.id), tagNames: [] });
  }

  function createAndAttach() {
    if (!trimmedQuery) return;
    onChange({ tagIds: tags.map((t) => t.id), tagNames: [trimmedQuery] });
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <TagPill key={tag.id} tag={tag} onRemove={disabled ? undefined : () => remove(tag)} />
      ))}
      {!disabled ? (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 rounded-full px-2 text-xs"
            >
              <Plus className="size-3" aria-hidden />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create a tag..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {trimmedQuery ? (
                    <button
                      type="button"
                      onClick={createAndAttach}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                    >
                      <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                      Create &ldquo;{trimmedQuery}&rdquo;
                    </button>
                  ) : (
                    "No tags yet."
                  )}
                </CommandEmpty>
                {allTags.length > 0 ? (
                  <CommandGroup>
                    {allTags.map((tag) => (
                      <CommandItem key={tag.id} value={tag.name} onSelect={() => toggle(tag)}>
                        <TagDot color={tag.color} />
                        {tag.name}
                        {selectedIds.has(tag.id) ? (
                          <Check className="ml-auto size-3.5" aria-hidden />
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {trimmedQuery && !hasExactMatch && allTags.length > 0 ? (
                  <CommandGroup>
                    <CommandItem value={`create-${trimmedQuery}`} onSelect={createAndAttach}>
                      <Plus className="size-3.5" aria-hidden />
                      Create &ldquo;{trimmedQuery}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
