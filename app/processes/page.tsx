"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CategoryGridSkeleton } from "@/components/skeleton";
import Link from "next/link";
import EmptyState from "@/components/empty-state";
import { Button, Badge, Card, Select } from "@/components/ui";
import HealthRing from "@/components/health-ring";
import { type HealthResult } from "@/lib/process-health";
import { fetchHealthData, type ProcessWithCategory } from "@/lib/fetch-health-data";
import { formatRelativeTime, getFreshnessColor, getFreshnessDays } from "@/lib/formatting";
import { useRole } from "@/lib/use-role";

interface ClassificationSuggestion {
  process_id: number;
  name: string;
  category: string;
  current_type: string;
  suggestion: "key" | "support";
  rationale: string;
  override?: "key" | "support"; // user override
}

interface CategorySummary {
  id: number;
  name: string;
  display_name: string;
  process_count: number;
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessWithCategory[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [healthScores, setHealthScores] = useState<Map<number, HealthResult>>(new Map());
  const [lastActivityMap, setLastActivityMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "key" | "support" | "unclassified">("all");
  const [sortBy, setSortBy] = useState<"name" | "health">("name");

  // Admin role
  const { isAdmin } = useRole();

  // Classification review state
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifySuggestions, setClassifySuggestions] = useState<ClassificationSuggestion[] | null>(null);
  const [classifySaving, setClassifySaving] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState<string | null>(null);

  // Bulk edit state
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [newOwner, setNewOwner] = useState("");
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Processes | NIA Excellence Hub";

    async function fetchData() {
      const healthData = await fetchHealthData();
      const { processes: procs, categories: cats, healthScores: scores } = healthData;

      // Build category summaries (page-specific)
      const catSummaries: CategorySummary[] = cats.map((c) => {
        const catProcesses = procs.filter((p) => p.category_id === c.id);
        return {
          id: c.id,
          name: c.name,
          display_name: c.display_name,
          process_count: catProcesses.length,
        };
      });

      setProcesses(procs);
      setCategories(catSummaries);
      setHealthScores(scores);
      setLastActivityMap(healthData.lastActivityMap);
      setLoading(false);
    }

    fetchData();
  }, []);

  async function setProcessType(id: number, newType: string) {
    await supabase.from("processes").update({ process_type: newType }).eq("id", id);
    setProcesses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, process_type: newType as "key" | "support" | "unclassified" } : p))
    );
  }

  // Bulk edit helpers
  const uniqueOwners = [...new Set(processes.map((p) => p.owner).filter(Boolean))] as string[];

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectByOwner(owner: string) {
    const ids = filtered.filter((p) => p.owner === owner).map((p) => p.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((p) => p.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function exitEditMode() {
    setEditMode(false);
    setSelected(new Set());
    setNewOwner("");
  }

  async function bulkUpdateOwner() {
    if (selected.size === 0 || !newOwner.trim()) return;
    setUpdating(true);
    const ids = [...selected];
    const trimmed = newOwner.trim();
    await supabase.from("processes").update({ owner: trimmed }).in("id", ids);
    setProcesses((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, owner: trimmed } : p))
    );
    setSuccessMsg(`Updated ${ids.length} process${ids.length > 1 ? "es" : ""} to "${trimmed}"`);
    exitEditMode();
    setTimeout(() => setSuccessMsg(null), 4000);
    setUpdating(false);
  }

  // Classification review functions
  async function runClassification() {
    setClassifyLoading(true);
    setClassifyMsg(null);
    try {
      const res = await fetch("/api/processes/classify", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setClassifyMsg(data.error || "Classification failed");
        setClassifyLoading(false);
        return;
      }
      const data = await res.json();
      setClassifySuggestions(data.suggestions);
    } catch {
      setClassifyMsg("Network error — please try again");
    }
    setClassifyLoading(false);
  }

  function setClassifyOverride(processId: number, value: "key" | "support") {
    setClassifySuggestions((prev) =>
      prev?.map((s) =>
        s.process_id === processId
          ? { ...s, override: s.override === value ? undefined : value }
          : s
      ) || null
    );
  }

  function acceptAllClassifications() {
    setClassifySuggestions((prev) =>
      prev?.map((s) => ({ ...s, override: undefined })) || null
    );
  }

  async function saveClassifications() {
    if (!classifySuggestions) return;
    setClassifySaving(true);
    const updates = classifySuggestions.map((s) => ({
      id: s.process_id,
      type: s.override || s.suggestion,
      rationale: s.rationale,
    }));
    // Update each process with type and rationale
    for (const u of updates) {
      await supabase.from("processes").update({
        process_type: u.type,
        classification_rationale: u.rationale,
      }).eq("id", u.id);
    }
    // Update local state
    setProcesses((prev) =>
      prev.map((p) => {
        const match = updates.find((u) => u.id === p.id);
        return match ? { ...p, process_type: match.type as "key" | "support" | "unclassified", classification_rationale: match.rationale } : p;
      })
    );
    const keyCount = updates.filter((u) => u.type === "key").length;
    const supportCount = updates.filter((u) => u.type === "support").length;
    setClassifyMsg(`Saved: ${keyCount} Key, ${supportCount} Support`);
    setClassifySuggestions(null);
    setClassifySaving(false);
    setTimeout(() => setClassifyMsg(null), 5000);
  }

  // Apply filters and sorting (must be above early return to satisfy Rules of Hooks)
  const filtered = useMemo(() => {
    const result = processes.filter((p) => {
      if (filterCategory !== null && p.category_id !== filterCategory) return false;
      if (typeFilter !== "all" && p.process_type !== typeFilter) return false;
      return true;
    });
    if (sortBy === "health") {
      result.sort((a, b) => {
        const aScore = healthScores.get(a.id)?.total ?? 0;
        const bScore = healthScores.get(b.id)?.total ?? 0;
        return aScore - bScore; // lowest first (needs most attention)
      });
    }
    return result;
  }, [processes, filterCategory, typeFilter, sortBy, healthScores]);

  if (loading) return <CategoryGridSkeleton />;

  return (
    <div className="space-y-6 content-appear">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">
            Processes{" "}
            {processes.length > 0 && (
              <span className="text-text-muted font-normal text-lg">({processes.length})</span>
            )}
          </h1>
          <p className="text-text-tertiary mt-1">
            Organizational processes aligned to the Baldrige Excellence Framework
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && !editMode && !classifySuggestions && (
            <Button
              variant="secondary"
              size="md"
              onClick={runClassification}
              disabled={classifyLoading}
            >
              {classifyLoading ? "Analyzing..." : "Review Classifications"}
            </Button>
          )}
          {!editMode && !classifySuggestions && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEditMode(true)}
            >
              Edit Owners
            </Button>
          )}
          <Button variant="secondary" size="md" href="/processes/import">
            Import from Asana
          </Button>
          <Button variant="primary" size="md" href="/processes/new">
            + Create New Process
          </Button>
        </div>
      </div>

      {/* Baldrige Coverage Grid (US-005) */}
      <div>
        <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Baldrige Category Coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            // Recompute counts when key filter is active
            const catProcesses = typeFilter !== "all"
              ? processes.filter((p) => p.category_id === cat.id && p.process_type === typeFilter)
              : processes.filter((p) => p.category_id === cat.id);
            const count = catProcesses.length;
            const isEmpty = count === 0;
            const isSelected = filterCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() =>
                  setFilterCategory(isSelected ? null : cat.id)
                }
                className={`rounded-xl p-3 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-nia-dark shadow-md"
                    : "shadow-sm card-hover-strong"
                } ${isEmpty ? "opacity-60" : ""}`}
                style={{ backgroundColor: isEmpty ? "#dc262608" : "#324a4d08", borderTop: `3px solid ${isEmpty ? "#dc2626" : "#55787c"}` }}
              >
                <div className={`text-2xl font-bold font-display ${isEmpty ? "text-nia-red" : "text-nia-dark"}`}>
                  {count}
                </div>
                <div className={`text-xs font-medium mt-1 leading-tight ${isEmpty ? "text-nia-red" : "text-nia-dark"}`}>
                  {cat.display_name}
                </div>
                {isEmpty && (
                  <div className="text-xs mt-1 text-nia-red">
                    No processes
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 bg-surface-subtle rounded-lg p-1">
          {(["all", "key", "support", "unclassified"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeFilter === t
                  ? "bg-card text-nia-dark shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t === "all" ? "All" : t === "key" ? "\u2605 Key" : t === "support" ? "Support" : "Unclassified"}
            </button>
          ))}
        </div>
        <Select
          value={filterCategory ?? ""}
          onChange={(e) =>
            setFilterCategory(e.target.value ? Number(e.target.value) : null)
          }
          size="sm"
          className="w-auto"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.display_name}
            </option>
          ))}
        </Select>
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "health")}
          size="sm"
          className="w-auto"
        >
          <option value="name">Sort: A-Z</option>
          <option value="health">Sort: Needs Attention</option>
        </Select>
        {(filterCategory !== null || typeFilter !== "all" || sortBy !== "name") && (
          <button
            onClick={() => {
              setFilterCategory(null);
              setTypeFilter("all");
              setSortBy("name");
            }}
            className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Success / info messages */}
      {successMsg && (
        <div className="bg-nia-green/10 border border-nia-green/30 text-nia-green rounded-lg px-4 py-3 text-sm font-medium">
          {successMsg}
        </div>
      )}
      {classifyMsg && !classifySuggestions && (
        <div className="bg-nia-grey-blue/10 border border-nia-grey-blue/30 text-nia-grey-blue rounded-lg px-4 py-3 text-sm font-medium">
          {classifyMsg}
        </div>
      )}

      {/* Classification Review Panel */}
      {classifySuggestions && (
        <Card className="border-2 border-nia-orange/30">
          <div className="p-4 border-b border-border-light flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-nia-dark">Review Process Classifications</h2>
              <p className="text-sm text-text-tertiary mt-0.5">
                AI suggests {classifySuggestions.filter((s) => (s.override || s.suggestion) === "key").length} Key
                {" "}and {classifySuggestions.filter((s) => (s.override || s.suggestion) === "support").length} Support processes.
                Click a badge to override.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={acceptAllClassifications}>
                Reset All to AI
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={saveClassifications}
                disabled={classifySaving}
              >
                {classifySaving ? "Saving..." : "Save All"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setClassifySuggestions(null); setClassifyMsg(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
          <div className="divide-y divide-border-light max-h-[60vh] overflow-y-auto">
            {classifySuggestions.map((s) => {
              const finalType = s.override || s.suggestion;
              const isOverridden = !!s.override;
              return (
                <div key={s.process_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-nia-dark truncate">{s.name}</div>
                    <div className="text-xs text-text-muted">{s.category}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setClassifyOverride(s.process_id, "key")}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                        finalType === "key"
                          ? "bg-nia-orange text-white shadow-sm"
                          : "bg-surface-subtle text-text-muted hover:bg-nia-orange/10 hover:text-nia-orange"
                      } ${isOverridden && finalType === "key" ? "ring-2 ring-nia-orange/40" : ""}`}
                    >
                      Key
                    </button>
                    <button
                      onClick={() => setClassifyOverride(s.process_id, "support")}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                        finalType === "support"
                          ? "bg-nia-grey-blue text-white shadow-sm"
                          : "bg-surface-subtle text-text-muted hover:bg-nia-grey-blue/10 hover:text-nia-grey-blue"
                      } ${isOverridden && finalType === "support" ? "ring-2 ring-nia-grey-blue/40" : ""}`}
                    >
                      Support
                    </button>
                  </div>
                  <div className="text-xs text-text-tertiary sm:max-w-[40%] leading-relaxed">
                    {s.rationale}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Edit mode toolbar */}
      {editMode && (
        <div className="flex flex-wrap items-center gap-3 bg-nia-dark/5 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-nia-dark">Select by owner:</span>
          <div className="flex flex-wrap gap-2">
            {uniqueOwners.map((owner) => {
              const ownerIds = filtered.filter((p) => p.owner === owner).map((p) => p.id);
              const allChecked = ownerIds.length > 0 && ownerIds.every((id) => selected.has(id));
              return (
                <button
                  key={owner}
                  onClick={() => selectByOwner(owner)}
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${
                    allChecked
                      ? "bg-nia-dark-solid text-white"
                      : "bg-card text-nia-dark border border-border hover:border-nia-dark"
                  }`}
                >
                  {owner}
                </button>
              );
            })}
          </div>
          <span className="text-text-muted">|</span>
          <button onClick={selectAll} className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors">
            Select All
          </button>
          <button onClick={deselectAll} className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors">
            Deselect All
          </button>
        </div>
      )}

      {/* Process List */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            illustration={processes.length === 0 ? "document" : "search"}
            title={processes.length === 0 ? "No processes yet" : "No processes found"}
            description={
              processes.length === 0
                ? "Create your first process to start documenting how your organization works."
                : "Try adjusting your filters or search terms."
            }
            action={
              processes.length === 0
                ? { label: "Create Process", href: "/processes/new" }
                : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {editMode && <th className="px-4 py-3 w-10"></th>}
                  <th className="px-4 py-3">Process</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((process) => (
                  <tr
                    key={process.id}
                    className="border-b border-border-light last:border-b-0 hover:bg-surface-hover/80 transition-colors"
                  >
                    {editMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(process.id)}
                          onChange={() => toggleSelect(process.id)}
                          className="w-4 h-4 rounded border-border text-nia-dark focus:ring-nia-grey-blue cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <ClassificationBadge
                          type={process.process_type}
                          onToggle={(newType) => setProcessType(process.id, newType)}
                        />
                        <Link
                          href={`/processes/${process.id}`}
                          className="font-medium text-nia-dark hover:text-nia-orange transition-colors"
                        >
                          {process.name}
                        </Link>
                        {process.asana_project_gid && (
                          <span className="text-text-muted ml-1" title="Linked to Asana">
                            <svg className="inline w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-label="Linked to Asana"><circle cx="12" cy="6" r="4"/><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/></svg>
                          </span>
                        )}
                      </span>
                      {process.baldrige_item && (
                        <span className="text-xs text-text-muted ml-2">
                          ({process.baldrige_item})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {process.category_display_name}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const health = healthScores.get(process.id);
                        if (!health) return null;
                        const dims = health.dimensions;
                        const tooltip = `Health: ${health.total}/100 (${health.level.label})\n` +
                          `Documentation: ${dims.documentation.score}/${dims.documentation.max}\n` +
                          `Maturity: ${dims.maturity.score}/${dims.maturity.max}\n` +
                          `Measurement: ${dims.measurement.score}/${dims.measurement.max}\n` +
                          `Operations: ${dims.operations.score}/${dims.operations.max}\n` +
                          `Freshness: ${dims.freshness.score}/${dims.freshness.max}`;
                        return (
                          <div className="flex items-center gap-2" title={tooltip}>
                            <HealthRing score={health.total} color={health.level.color} size={36} strokeWidth={3} />
                            <span className="text-xs text-text-muted">{health.level.label}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const lastDate = lastActivityMap.get(process.id);
                        if (!lastDate) return null;
                        const days = getFreshnessDays(lastDate);
                        const color = getFreshnessColor(lastDate);
                        return (
                          <span
                            className={`text-xs font-medium ${days > 90 ? "stale-pulse" : ""}`}
                            style={{ color }}
                            title={new Date(lastDate).toLocaleDateString()}
                          >
                            {formatRelativeTime(lastDate)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary">
                      {process.owner || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((process) => (
              <div key={process.id} className={editMode ? "flex items-start gap-3" : ""}>
                {editMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(process.id)}
                    onChange={() => toggleSelect(process.id)}
                    className="w-4 h-4 mt-4 rounded border-border text-nia-dark focus:ring-nia-grey-blue cursor-pointer flex-shrink-0"
                  />
                )}
              <Link
                href={`/processes/${process.id}`}
                className="block flex-1"
              >
                <Card variant="interactive" accent="dark" padding="sm" className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-nia-dark flex items-center gap-2">
                        <ClassificationBadge
                          type={process.process_type}
                          onToggle={(newType) => {
                            // Prevent link navigation on mobile
                            setProcessType(process.id, newType);
                          }}
                          preventNavigation
                        />
                        {process.name}
                        {process.asana_project_gid && (
                          <span className="text-text-muted ml-1" title="Linked to Asana">
                            <svg className="inline w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-label="Linked to Asana"><circle cx="12" cy="6" r="4"/><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/></svg>
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-text-tertiary mt-1">
                        {process.category_display_name}
                        {process.baldrige_item && (
                          <span className="text-text-muted">
                            {" "}
                            ({process.baldrige_item})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    {(() => {
                      const health = healthScores.get(process.id);
                      if (!health) return null;
                      return (
                        <span className="flex items-center gap-1.5" title={`Health: ${health.total} — ${health.level.label}`}>
                          <HealthRing score={health.total} color={health.level.color} size={24} strokeWidth={2.5} className="text-[9px]" />
                          <span style={{ color: health.level.color }}>{health.level.label}</span>
                        </span>
                      );
                    })()}
                    {process.owner && (
                      <>
                        <span>&middot;</span>
                        <span>{process.owner}</span>
                      </>
                    )}
                    {(() => {
                      const lastDate = lastActivityMap.get(process.id);
                      if (!lastDate) return null;
                      const color = getFreshnessColor(lastDate);
                      const days = getFreshnessDays(lastDate);
                      return (
                        <>
                          <span>&middot;</span>
                          <span className={days > 90 ? "stale-pulse" : ""} style={{ color }}>{formatRelativeTime(lastDate)}</span>
                        </>
                      );
                    })()}
                  </div>
                </Card>
              </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Floating action bar for edit mode */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-3">
            <span className="text-sm font-medium text-nia-dark whitespace-nowrap">
              {selected.size} process{selected.size !== 1 ? "es" : ""} selected
            </span>
            <div className="flex-1 relative w-full sm:max-w-xs">
              <input
                type="text"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="New owner name..."
                list="owner-suggestions"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-nia-dark bg-card placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue hover:border-border"
              />
              <datalist id="owner-suggestions">
                {uniqueOwners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={bulkUpdateOwner}
                disabled={selected.size === 0 || !newOwner.trim() || updating}
              >
                {updating ? "Updating..." : "Update Owner"}
              </Button>
              <Button variant="secondary" size="md" onClick={exitEditMode}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom padding when floating bar is visible */}
      {editMode && <div className="h-20" />}
    </div>
  );
}

function ClassificationBadge({
  type,
  onToggle,
  preventNavigation,
}: {
  type: string;
  onToggle: (newType: string) => void;
  preventNavigation?: boolean;
}) {
  const nextType = type === "key" ? "support" : type === "support" ? "unclassified" : "key";
  const labels: Record<string, string> = {
    key: "\u2605 Key",
    support: "Support",
    unclassified: "?",
  };
  const tooltips: Record<string, string> = {
    key: "Key process \u2014 click to change to Support",
    support: "Support process \u2014 click to change to Unclassified",
    unclassified: "Unclassified \u2014 click to set as Key",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (preventNavigation) e.preventDefault();
        onToggle(nextType);
      }}
      title={tooltips[type] || tooltips.unclassified}
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full transition-all whitespace-nowrap ${
        type === "key"
          ? "bg-nia-orange text-white hover:bg-nia-orange/80"
          : type === "support"
          ? "bg-nia-grey-blue text-white hover:bg-nia-grey-blue/80"
          : "bg-surface-subtle text-text-muted hover:bg-nia-orange/10 hover:text-nia-orange border border-border-light"
      }`}
    >
      {labels[type] || labels.unclassified}
    </button>
  );
}
