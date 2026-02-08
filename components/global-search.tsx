"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  id: number;
  title: string;
  subtitle: string;
  href: string;
  type: "process" | "metric" | "requirement";
}

interface GroupedResults {
  processes: SearchResult[];
  metrics: SearchResult[];
  requirements: SearchResult[];
}

export default function GlobalSearch({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupedResults>({
    processes: [],
    metrics: [],
    requirements: [],
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Flatten results for keyboard navigation
  const flatResults = [
    ...results.processes,
    ...results.metrics,
    ...results.requirements,
  ];

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ processes: [], metrics: [], requirements: [] });
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const pattern = `%${query}%`;

      const [procRes, metricRes, reqRes] = await Promise.all([
        supabase
          .from("processes")
          .select("id, name, description, owner, baldrige_item")
          .or(
            `name.ilike.${pattern},description.ilike.${pattern},owner.ilike.${pattern},baldrige_item.ilike.${pattern}`
          )
          .limit(5),
        supabase
          .from("metrics")
          .select("id, name, description, data_source")
          .or(
            `name.ilike.${pattern},description.ilike.${pattern},data_source.ilike.${pattern}`
          )
          .limit(5),
        supabase
          .from("key_requirements")
          .select("id, requirement, description, stakeholder_group")
          .or(
            `requirement.ilike.${pattern},description.ilike.${pattern},stakeholder_group.ilike.${pattern}`
          )
          .limit(5),
      ]);

      const processes: SearchResult[] = (procRes.data ?? []).map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: [p.owner, p.baldrige_item].filter(Boolean).join(" · ") || "Process",
        href: `/processes/${p.id}`,
        type: "process",
      }));

      const metrics: SearchResult[] = (metricRes.data ?? []).map((m) => ({
        id: m.id,
        title: m.name,
        subtitle: m.data_source || "Metric",
        href: `/metric/${m.id}`,
        type: "metric",
      }));

      const requirements: SearchResult[] = (reqRes.data ?? []).map((r) => ({
        id: r.id,
        title: r.requirement,
        subtitle: r.stakeholder_group || "Requirement",
        href: `/requirements`,
        type: "requirement",
      }));

      setResults({ processes, metrics, requirements });
      setOpen(true);
      setHighlightIndex(-1);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Cmd+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      onNavigate?.();
      router.push(href);
    },
    [router, onNavigate]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || flatResults.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatResults.length) {
          navigate(flatResults[highlightIndex].href);
        }
        break;
      case "Escape":
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  }

  const hasResults = flatResults.length > 0;
  const noResults = query.length >= 2 && !loading && !hasResults;

  // Track cumulative index for highlight matching
  let globalIndex = 0;

  function renderGroup(label: string, items: SearchResult[]) {
    if (items.length === 0) return null;
    const startIndex = globalIndex;
    globalIndex += items.length;

    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {label}
        </div>
        {items.map((item, i) => {
          const idx = startIndex + i;
          return (
            <button
              key={`${item.type}-${item.id}`}
              className={`w-full text-left px-3 py-2 flex flex-col transition-colors ${
                idx === highlightIndex
                  ? "bg-nia-grey-blue/20"
                  : "hover:bg-gray-50"
              }`}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => navigate(item.href)}
            >
              <span className="text-sm font-medium text-gray-800 truncate">
                {item.title}
              </span>
              <span className="text-xs text-gray-400 truncate">
                {item.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Reset globalIndex before each render of the dropdown
  function renderDropdown() {
    globalIndex = 0;
    return (
      <>
        {renderGroup("Processes", results.processes)}
        {renderGroup("Metrics", results.metrics)}
        {renderGroup("Requirements", results.requirements)}
      </>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${mobile ? "w-full" : "w-64"}`}>
      {/* Search input */}
      <div className="relative">
        {/* Magnifying glass icon */}
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2 && flatResults.length > 0) setOpen(true);
          }}
          placeholder="Search… ⌘K"
          className="w-full bg-white/15 text-white placeholder-white/50 text-sm rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-nia-orange/50 focus:bg-white/25 transition-colors"
        />
      </div>

      {/* Results dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-[60]">
          {loading && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              Searching…
            </div>
          )}
          {!loading && hasResults && renderDropdown()}
          {noResults && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
