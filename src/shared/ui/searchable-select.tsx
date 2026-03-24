"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/util";
import { ChevronDown, Search } from "lucide-react";

interface SearchableSelectProps {
  value: string;
  options: string[];
  placeholder?: string;
  onValueChange: (value: string) => void;
}

export function SearchableSelect({
  value,
  options,
  placeholder = "选择...",
  onValueChange,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 });

  const MAX_VISIBLE = 50;

  const filtered = React.useMemo(() => {
    const list = search
      ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
      : options;
    return list.slice(0, MAX_VISIBLE);
  }, [options, search]);

  // Calculate dropdown position relative to viewport
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
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

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className="fixed z-[9999] rounded-apple border border-border bg-popover shadow-apple-lg overflow-hidden"
    >
      {options.length > 6 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            autoComplete="off"
            data-1p-ignore
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            无匹配结果
          </p>
        ) : (
          filtered.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={cn(
                "flex w-full items-center rounded-apple-sm px-3 py-2 text-sm transition-colors",
                option === value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              {option}
            </button>
          ))
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
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-apple border border-border bg-background/60 backdrop-blur-sm px-4 py-3 text-sm font-medium shadow-apple-button transition-all duration-200",
          "hover:border-border/80 hover:bg-background/80",
          open && "ring-2 ring-ring ring-offset-2 border-ring/50 bg-background",
        )}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </>
  );
}
