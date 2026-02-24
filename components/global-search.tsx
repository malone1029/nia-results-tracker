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

type FilterKey = "all" | "process" | "metric" | "requirement";

const INITIAL_SHOW = 3;

function highlightMatch(text: string, query: string) {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-nia-orange">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch({
  mobile,
  onNavigate,
  variant = "dark",
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  variant?: "dark" | "light";
}) {
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
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset filter + expanded when query changes
  useEffect(() => {
    setExpandedGroups(new Set());
    setActiveFilter("all");
  }, [query]);

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
          .limit(8),
        supabase
          .from("metrics")
          .select("id, name, description, data_source")
          .or(
            `name.ilike.${pattern},description.ilike.${pattern},data_source.ilike.${pattern}`
          )
          .limit(8),
        supabase
          .from("key_requirements")
          .select("id, requirement, description, stakeholder_group")
          .or(
            `requirement.ilike.${pattern},description.ilike.${pattern},stakeholder_group.ilike.${pattern}`
          )
          .limit(8),
      ]);

      const processes: SearchResult[] = (procRes.data ?? []).map((p) => ({
        id: p.id,
        title: p.name,
        subtitle:
          [p.owner, p.baldrige_item].filter(Boolean).join(" · ") || "Process",
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

  // Apply active filter
  const filtered: GroupedResults =
    activeFilter === "process"
      ? { processes: results.processes, metrics: [], requirements: [] }
      : activeFilter === "metric"
      ? { processes: [], metrics: results.metrics, requirements: [] }
      : activeFilter === "requirement"
      ? { processes: [], metrics: [], requirements: results.requirements }
      : results;

  // Visible slices (respecting expand state)
  const visibleProcesses = expandedGroups.has("processes")
    ? filtered.processes
    : filtered.processes.slice(0, INITIAL_SHOW);
  const visibleMetrics = expandedGroups.has("metrics")
    ? filtered.metrics
    : filtered.metrics.slice(0, INITIAL_SHOW);
  const visibleRequirements = expandedGroups.has("requirements")
    ? filtered.requirements
    : filtered.requirements.slice(0, INITIAL_SHOW);

  // Flat list for keyboard navigation (only visible items)
  const flatResults = [
    ...visibleProcesses,
    ...visibleMetrics,
    ...visibleRequirements,
  ];

  const hasResults = flatResults.length > 0;
  const noResults =
    query.length >= 2 && !loading && filtered.processes.length === 0 &&
    filtered.metrics.length === 0 && filtered.requirements.length === 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Escape") {
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

  // Filter tab config — only show tabs that have results (except All)
  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    {
      key: "all",
      label: "All",
      count:
        results.processes.length +
        results.metrics.length +
        results.requirements.length,
    },
    { key: "process", label: "Processes", count: results.processes.length },
    { key: "metric", label: "Metrics", count: results.metrics.length },
    {
      key: "requirement",
      label: "Requirements",
      count: results.requirements.length,
    },
  ].filter((t) => t.key === "all" || t.count > 0);

  // Mutable index tracker for keyboard highlight alignment
  let globalIndex = 0;

  function renderGroup(
    label: string,
    allItems: SearchResult[],
    visibleItems: SearchResult[],
    key: string
  ) {
    if (allItems.length === 0) return null;
    const startIndex = globalIndex;
    globalIndex += visibleItems.length;
    const hiddenCount = allItems.length - visibleItems.length;

    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide border-t border-border">
          {label}
        </div>
        {visibleItems.map((item, i) => {
          const idx = startIndex + i;
          return (
            <button
              key={`${item.type}-${item.id}`}
              className={`w-full text-left px-3 py-2.5 flex flex-col transition-colors ${
                idx === highlightIndex
                  ? "bg-nia-grey-blue/20"
                  : "hover:bg-surface-hover"
              }`}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => navigate(item.href)}
            >
              <span className="text-sm font-medium text-foreground whitespace-normal leading-snug">
                {highlightMatch(item.title, query)}
              </span>
              <span className="text-xs text-text-muted mt-0.5">
                {item.subtitle}
              </span>
            </button>
          );
        })}
        {hiddenCount > 0 && (
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-nia-orange hover:underline transition-colors"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              setExpandedGroups((prev) => new Set([...prev, key]))
            }
          >
            Show {hiddenCount} more {label.toLowerCase()}
          </button>
        )}
      </div>
    );
  }

  function renderDropdown() {
    globalIndex = 0;
    return (
      <>
        {renderGroup("Processes", filtered.processes, visibleProcesses, "processes")}
        {renderGroup("Metrics", filtered.metrics, visibleMetrics, "metrics")}
        {renderGroup("Requirements", filtered.requirements, visibleRequirements, "requirements")}
      </>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${mobile ? "w-full" : "w-64"}`}>
      {/* Search input */}
      <div className="relative">
        <svg
          className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
            variant === "light" ? "text-text-muted" : "text-white/50"
          }`}
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
            if (query.length >= 2 && hasResults) setOpen(true);
          }}
          placeholder="Search… ⌘K"
          className={`w-full text-sm rounded-lg pl-8 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
            query ? "pr-7" : "pr-3"
          } ${
            variant === "light"
              ? "bg-surface-subtle text-foreground placeholder-text-muted focus:ring-nia-grey-blue/30 focus:bg-surface-hover"
              : "bg-white/15 text-white placeholder-white/50 focus:ring-nia-orange/50 focus:bg-white/25"
          }`}
        />
        {query && (
          <button
            className={`absolute right-2 top-1/2 -translate-y-1/2 transition-colors ${
              variant === "light"
                ? "text-text-muted hover:text-foreground"
                : "text-white/50 hover:text-white/80"
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setOpen(false);
              inputRef.current?.focus();
            }}
            tabIndex={-1}
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 w-[580px] bg-card rounded-lg shadow-lg border border-border z-[60] overflow-hidden flex flex-col">
          {/* Filter tabs */}
          {!loading && (hasResults || noResults) && filterTabs.length > 1 && (
            <div className="flex gap-1.5 px-3 py-2 border-b border-border flex-wrap">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setActiveFilter(tab.key);
                    setHighlightIndex(-1);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    activeFilter === tab.key
                      ? "bg-nia-orange text-white"
                      : "bg-surface-subtle text-text-muted hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {tab.key !== "all" ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>
          )}

          {/* Results list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="px-3 py-4 text-sm text-text-muted text-center">
                Searching…
              </div>
            )}
            {!loading && (hasResults || !noResults) && renderDropdown()}
            {noResults && (
              <div className="px-3 py-4 text-sm text-text-muted text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
