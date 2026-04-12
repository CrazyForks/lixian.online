"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/util";
import { ChevronDown, Search } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: string[];
}

interface SearchableSelectProps {
  value: string;
  options: Array<string | SearchableSelectOption>;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

type DropdownPosition = {
  anchor: number;
  left: number;
  maxHeight: number;
  side: "top" | "bottom";
  width: number;
};

export function SearchableSelect({
  value,
  options,
  placeholder = "选择...",
  onValueChange,
}: SearchableSelectProps) {
  const dropdownId = React.useId();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<DropdownPosition>({
    anchor: 0,
    left: 0,
    maxHeight: 320,
    side: "bottom",
    width: 0,
  });
  const [visibleCount, setVisibleCount] = React.useState(200);

  React.useEffect(() => setMounted(true), []);

  const normalizedOptions = React.useMemo(
    () =>
      options.map((option) => {
        if (typeof option === "string") {
          return {
            value: option,
            label: option,
            searchText: option.toLowerCase(),
          };
        }
        const keywordText = (option.keywords ?? []).join(" ").toLowerCase();
        return {
          value: option.value,
          label: option.label,
          searchText: `${option.label} ${option.value} ${keywordText}`.toLowerCase(),
        };
      }),
    [options],
  );

  const selectedLabel = React.useMemo(() => {
    return (
      normalizedOptions.find((option) => option.value === value)?.label ?? value
    );
  }, [normalizedOptions, value]);

  const LOAD_MORE_STEP = 200;
  const VIEWPORT_MARGIN = 12;
  const TRIGGER_GAP = 6;
  const IDEAL_DROPDOWN_HEIGHT = 360;
  const MIN_FLIP_HEIGHT = 220;

  const filtered = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return search
      ? normalizedOptions.filter((option) => option.searchText.includes(keyword))
      : normalizedOptions;
  }, [normalizedOptions, search]);

  const visibleOptions = React.useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const hasMore = visibleOptions.length < filtered.length;

  React.useEffect(() => {
    setVisibleCount(LOAD_MORE_STEP);
    listRef.current?.scrollTo({ top: 0 });
  }, [LOAD_MORE_STEP, normalizedOptions, search]);

  // Calculate dropdown position relative to viewport
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openAbove =
      spaceBelow < MIN_FLIP_HEIGHT && spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      (openAbove ? spaceAbove : spaceBelow) - TRIGGER_GAP,
      0,
    );
    const maxHeight =
      availableHeight > 0
        ? Math.min(IDEAL_DROPDOWN_HEIGHT, availableHeight)
        : IDEAL_DROPDOWN_HEIGHT;
    const width = Math.min(rect.width, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(
      Math.max(rect.left, VIEWPORT_MARGIN),
      window.innerWidth - VIEWPORT_MARGIN - width,
    );

    setPos({
      anchor: openAbove
        ? window.innerHeight - rect.top + TRIGGER_GAP
        : rect.bottom + TRIGGER_GAP,
      left,
      maxHeight,
      side: openAbove ? "top" : "bottom",
      width,
    });
  }, [IDEAL_DROPDOWN_HEIGHT, MIN_FLIP_HEIGHT, TRIGGER_GAP, VIEWPORT_MARGIN]);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const scrollOpts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setOpen(false);
      setSearch("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (option: string) => {
    onValueChange(option);
    setOpen(false);
    setSearch("");
  };

  const handleListScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore) return;
      const target = event.currentTarget;
      const remaining =
        target.scrollHeight - target.scrollTop - target.clientHeight;

      if (remaining > 40) return;
      setVisibleCount((current) =>
        Math.min(current + LOAD_MORE_STEP, filtered.length),
      );
    },
    [LOAD_MORE_STEP, filtered.length, hasMore],
  );

  const dropdown = open ? (
    <div
      id={dropdownId}
      ref={dropdownRef}
      style={{
        bottom: pos.side === "top" ? pos.anchor : undefined,
        left: pos.left,
        maxHeight: pos.maxHeight,
        top: pos.side === "bottom" ? pos.anchor : undefined,
        width: pos.width,
      }}
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-apple border border-border/70 bg-popover/92 shadow-apple-lg backdrop-blur-xl"
    >
      {normalizedOptions.length > 6 && (
        <div className="sticky top-0 z-10 border-b border-border/40 bg-popover/88 px-3 py-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Search className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="h-4 w-px bg-border/60" aria-hidden="true" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              autoComplete="off"
              data-1p-ignore
              className="min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent px-0 py-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            无匹配结果
          </p>
        ) : (
          <>
            {visibleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "flex w-full items-center justify-start rounded-apple-sm px-3 py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  option.value === value
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground hover:bg-secondary/80",
                )}
              >
                {option.label}
              </button>
            ))}
            {hasMore && (
              <p className="px-3 pb-2 pt-3 text-center text-xs text-muted-foreground">
                继续下滑加载更多（{visibleOptions.length}/{filtered.length}）
              </p>
            )}
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setSearch("");
            return;
          }
          updatePosition();
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-controls={dropdownId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-apple border border-border bg-background/60 backdrop-blur-sm px-4 py-3 text-sm font-medium shadow-apple-button transition-all duration-200",
          "hover:border-border/80 hover:bg-background/80",
          open && "ring-2 ring-ring ring-offset-2 border-ring/50 bg-background",
        )}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {mounted && dropdown && createPortal(dropdown, document.body)}
    </>
  );
}
