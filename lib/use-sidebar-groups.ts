"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "nia-sidebar-groups";
const DEFAULT_EXPANDED = ["Overview", "Processes"];

export function useSidebarGroups() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(DEFAULT_EXPANDED)
  );
  const [hydrated, setHydrated] = useState(false);

  // On mount: read stored preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setExpandedGroups(new Set(parsed));
      }
    } catch {
      // Ignore parse errors — use defaults
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((groups: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
  }, []);

  const toggleGroup = useCallback(
    (label: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(label)) {
          next.delete(label);
        } else {
          next.add(label);
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const expandGroup = useCallback(
    (label: string) => {
      setExpandedGroups((prev) => {
        if (prev.has(label)) return prev;
        const next = new Set(prev);
        next.add(label);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { expandedGroups, toggleGroup, expandGroup, hydrated };
}
