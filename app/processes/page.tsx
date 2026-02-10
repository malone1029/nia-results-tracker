"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { ProcessStatus } from "@/lib/types";
import { CategoryGridSkeleton } from "@/components/skeleton";
import Link from "next/link";
import EmptyState from "@/components/empty-state";
import { Button, Badge, Card, Select } from "@/components/ui";
import HealthRing from "@/components/health-ring";
import { type HealthResult } from "@/lib/process-health";
import { fetchHealthData, type ProcessWithCategory } from "@/lib/fetch-health-data";

interface CategorySummary {
  id: number;
  name: string;
  display_name: string;
  process_count: number;
  approved_count: number;
  in_progress_count: number; // ready_for_review
}

const STATUS_CONFIG: Record<ProcessStatus, { label: string; badgeColor: "gray" | "orange" | "green" }> = {
  draft: { label: "Draft", badgeColor: "gray" },
  ready_for_review: { label: "Ready for Review", badgeColor: "orange" },
  approved: { label: "Approved", badgeColor: "green" },
};

const STATUS_OPTIONS: ProcessStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
];

// Format an ISO date string as relative time ("3 days ago", "2 months ago")
function formatRelativeTime(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Color for freshness: green (≤30d), gray (31-60d), orange (61-90d), red (90+d)
function getFreshnessColor(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return "#b1bd37"; // NIA green
  if (days <= 60) return "#9ca3af"; // gray
  if (days <= 90) return "#f79935"; // NIA orange
  return "#dc2626"; // red
}

function getFreshnessDays(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessWithCategory[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [healthScores, setHealthScores] = useState<Map<number, HealthResult>>(new Map());
  const [lastActivityMap, setLastActivityMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProcessStatus | null>(null);
  const [showKeyOnly, setShowKeyOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "health">("name");

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
        const approved = catProcesses.filter((p) => p.status === "approved").length;
        const inProgress = catProcesses.filter((p) => p.status === "ready_for_review").length;
        return {
          id: c.id,
          name: c.name,
          display_name: c.display_name,
          process_count: catProcesses.length,
          approved_count: approved,
          in_progress_count: inProgress,
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

  async function toggleKeyProcess(id: number, currentValue: boolean) {
    await supabase
      .from("processes")
      .update({ is_key: !currentValue })
      .eq("id", id);
    setProcesses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_key: !currentValue } : p))
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

  // Apply filters and sorting (must be above early return to satisfy Rules of Hooks)
  const filtered = useMemo(() => {
    const result = processes.filter((p) => {
      if (filterCategory !== null && p.category_id !== filterCategory) return false;
      if (filterStatus !== null && p.status !== filterStatus) return false;
      if (showKeyOnly && !p.is_key) return false;
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
  }, [processes, filterCategory, filterStatus, showKeyOnly, sortBy, healthScores]);

  if (loading) return <CategoryGridSkeleton />;

  return (
    <div className="space-y-6 content-appear">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">
            Processes{" "}
            {processes.length > 0 && (
              <span className="text-gray-400 font-normal text-lg">({processes.length})</span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">
            Organizational processes aligned to the Baldrige Excellence Framework
          </p>
        </div>
        <div className="flex gap-2">
          {!editMode && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEditMode(true)}
            >
              Edit Owners
            </Button>
          )}
          <Button variant="secondary" size="md" href="/processes/import">
            Import Processes
          </Button>
          <Button variant="primary" size="md" href="/processes/new">
            + Create New Process
          </Button>
        </div>
      </div>

      {/* Baldrige Coverage Grid (US-005) */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Baldrige Category Coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            // Recompute counts when key filter is active
            const catProcesses = showKeyOnly
              ? processes.filter((p) => p.category_id === cat.id && p.is_key)
              : processes.filter((p) => p.category_id === cat.id);
            const count = catProcesses.length;
            const approved = catProcesses.filter((p) => p.status === "approved").length;
            const inProgress = catProcesses.filter((p) =>
              p.status === "ready_for_review"
            ).length;
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
                {isEmpty ? (
                  <div className="text-xs mt-1 text-nia-red">
                    No processes
                  </div>
                ) : (
                  <div className="text-xs mt-1 text-gray-500 space-x-1">
                    {approved > 0 && (
                      <span className="text-nia-green">{approved} approved</span>
                    )}
                    {inProgress > 0 && (
                      <span className="text-nia-orange">{inProgress} in review</span>
                    )}
                    {count - approved - inProgress > 0 && (
                      <span>
                        {count - approved - inProgress} draft
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          onClick={() => setShowKeyOnly(!showKeyOnly)}
          className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
            showKeyOnly
              ? "bg-nia-orange text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {showKeyOnly ? "\u2605 Key Only" : "\u2606 Key Only"}
        </button>
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
          value={filterStatus ?? ""}
          onChange={(e) =>
            setFilterStatus(
              e.target.value ? (e.target.value as ProcessStatus) : null
            )
          }
          size="sm"
          className="w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
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
        {(filterCategory !== null || filterStatus !== null || showKeyOnly || sortBy !== "name") && (
          <button
            onClick={() => {
              setFilterCategory(null);
              setFilterStatus(null);
              setShowKeyOnly(false);
              setSortBy("name");
            }}
            className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm font-medium">
          {successMsg}
        </div>
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
                      ? "bg-nia-dark text-white"
                      : "bg-white text-nia-dark border border-gray-300 hover:border-nia-dark"
                  }`}
                >
                  {owner}
                </button>
              );
            })}
          </div>
          <span className="text-gray-300">|</span>
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
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {editMode && <th className="px-4 py-3 w-10"></th>}
                  <th className="px-4 py-3">Process</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((process) => (
                  <tr
                    key={process.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/80 transition-colors"
                  >
                    {editMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(process.id)}
                          onChange={() => toggleSelect(process.id)}
                          className="w-4 h-4 rounded border-gray-300 text-nia-dark focus:ring-nia-grey-blue cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleKeyProcess(process.id, process.is_key);
                          }}
                          className={`text-base leading-none transition-colors ${
                            process.is_key
                              ? "text-nia-orange hover:text-nia-orange-dark"
                              : "text-gray-300 hover:text-nia-orange"
                          }`}
                          title={process.is_key ? "Remove key process flag" : "Mark as key process"}
                        >
                          {process.is_key ? "\u2605" : "\u2606"}
                        </button>
                        <Link
                          href={`/processes/${process.id}`}
                          className="font-medium text-nia-dark hover:text-nia-orange transition-colors"
                        >
                          {process.name}
                        </Link>
                        {process.asana_project_gid && (
                          <span className="text-gray-400 ml-1" title="Linked to Asana">
                            <svg className="inline w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-label="Linked to Asana"><circle cx="12" cy="6" r="4"/><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/></svg>
                          </span>
                        )}
                      </span>
                      {process.baldrige_item && (
                        <span className="text-xs text-gray-400 ml-2">
                          ({process.baldrige_item})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {process.category_display_name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_CONFIG[process.status].badgeColor} size="sm">
                        {STATUS_CONFIG[process.status].label}
                      </Badge>
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
                            <span className="text-xs text-gray-400">{health.level.label}</span>
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
                    <td className="px-4 py-3 text-sm text-gray-500">
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
                    className="w-4 h-4 mt-4 rounded border-gray-300 text-nia-dark focus:ring-nia-grey-blue cursor-pointer flex-shrink-0"
                  />
                )}
              <Link
                href={`/processes/${process.id}`}
                className="block flex-1"
              >
                <Card variant="interactive" accent="dark" padding="sm" className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-nia-dark flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleKeyProcess(process.id, process.is_key);
                          }}
                          className={`text-base leading-none transition-colors ${
                            process.is_key
                              ? "text-nia-orange hover:text-nia-orange-dark"
                              : "text-gray-300 hover:text-nia-orange"
                          }`}
                          title={process.is_key ? "Remove key process flag" : "Mark as key process"}
                        >
                          {process.is_key ? "\u2605" : "\u2606"}
                        </button>
                        {process.name}
                        {process.asana_project_gid && (
                          <span className="text-gray-400 ml-1" title="Linked to Asana">
                            <svg className="inline w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-label="Linked to Asana"><circle cx="12" cy="6" r="4"/><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/></svg>
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {process.category_display_name}
                        {process.baldrige_item && (
                          <span className="text-gray-400">
                            {" "}
                            ({process.baldrige_item})
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      color={STATUS_CONFIG[process.status].badgeColor}
                      size="xs"
                      className="flex-shrink-0"
                    >
                      {STATUS_CONFIG[process.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {(() => {
                      const health = healthScores.get(process.id);
                      if (!health) return null;
                      return (
                        <span className="flex items-center gap-1.5">
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 px-4 py-3">
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-nia-dark bg-white placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue hover:border-gray-400"
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
    </div>
  );
}
