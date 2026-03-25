import { useState, useCallback } from "react";

const MAX_ITEMS = 10;

export function useHistory(storageKey: string) {
  const [items, setItems] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const add = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setItems((prev) => {
        const next = [trimmed, ...prev.filter((v) => v !== trimmed)].slice(
          0,
          MAX_ITEMS,
        );
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );

  return { items, add };
}
