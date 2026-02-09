"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProcessStatus } from "@/lib/types";
import { CategoryGridSkeleton } from "@/components/skeleton";
import Link from "next/link";
import EmptyState from "@/components/empty-state";

interface ProcessRow {
  id: number;
  name: string;
  category_id: number;
  category_display_name: string;
  is_key: boolean;
  status: ProcessStatus;
  owner: string | null;
  baldrige_item: string | null;
  // JSONB fields for completeness check
  charter: Record<string, unknown> | null;
  adli_approach: Record<string, unknown> | null;
  adli_deployment: Record<string, unknown> | null;
  adli_learning: Record<string, unknown> | null;
  adli_integration: Record<string, unknown> | null;
  asana_project_gid: string | null;
}

interface CompletenessSection {
  label: string;
  filled: boolean;
}

function getCompleteness(p: ProcessRow): CompletenessSection[] {
  return [
    { label: "Charter", filled: p.charter !== null },
    { label: "Approach", filled: p.adli_approach !== null },
    { label: "Deployment", filled: p.adli_deployment !== null },
    { label: "Learning", filled: p.adli_learning !== null },
    { label: "Integration", filled: p.adli_integration !== null },
  ];
}

interface CategorySummary {
  id: number;
  name: string;
  display_name: string;
  process_count: number;
  approved_count: number;
  in_progress_count: number; // ready_for_review
}

const STATUS_CONFIG: Record<ProcessStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9ca3af" },
  ready_for_review: { label: "Ready for Review", color: "#f79935" },
  approved: { label: "Approved", color: "#b1bd37" },
};

const STATUS_OPTIONS: ProcessStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
];

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProcessStatus | null>(null);
  const [showKeyOnly, setShowKeyOnly] = useState(false);

  useEffect(() => {
    document.title = "Processes | NIA Excellence Hub";

    async function fetchData() {
      // Fetch all categories
      const { data: catData } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");

      // Fetch all processes with category info
      const { data: procData } = await supabase
        .from("processes")
        .select(`
          id, name, category_id, is_key, status, owner, baldrige_item,
          charter, adli_approach, adli_deployment, adli_learning, adli_integration,
          asana_project_gid,
          categories!inner ( display_name )
        `)
        .order("name");

      const processRows: ProcessRow[] = (procData || []).map(
        (p: Record<string, unknown>) => {
          const cat = p.categories as Record<string, unknown>;
          return {
            id: p.id as number,
            name: p.name as string,
            category_id: p.category_id as number,
            category_display_name: cat.display_name as string,
            is_key: p.is_key as boolean,
            status: (p.status as ProcessStatus) || "draft",
            owner: p.owner as string | null,
            baldrige_item: p.baldrige_item as string | null,
            charter: p.charter as Record<string, unknown> | null,
            adli_approach: p.adli_approach as Record<string, unknown> | null,
            adli_deployment: p.adli_deployment as Record<string, unknown> | null,
            adli_learning: p.adli_learning as Record<string, unknown> | null,
            adli_integration: p.adli_integration as Record<string, unknown> | null,
            asana_project_gid: p.asana_project_gid as string | null,
          };
        }
      );

      // Build category summaries
      const catSummaries: CategorySummary[] = (catData || []).map(
        (c: Record<string, unknown>) => {
          const catProcesses = processRows.filter(
            (p) => p.category_id === (c.id as number)
          );
          const approved = catProcesses.filter((p) => p.status === "approved").length;
          const inProgress = catProcesses.filter((p) =>
            p.status === "ready_for_review"
          ).length;
          return {
            id: c.id as number,
            name: c.name as string,
            display_name: c.display_name as string,
            process_count: catProcesses.length,
            approved_count: approved,
            in_progress_count: inProgress,
          };
        }
      );

      setProcesses(processRows);
      setCategories(catSummaries);
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

  if (loading) return <CategoryGridSkeleton />;

  // Apply filters
  const filtered = processes.filter((p) => {
    if (filterCategory !== null && p.category_id !== filterCategory)
      return false;
    if (filterStatus !== null && p.status !== filterStatus) return false;
    if (showKeyOnly && !p.is_key) return false;
    return true;
  });

  return (
    <div className="space-y-6">
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
          <Link
            href="/processes/import"
            className="bg-gray-200 text-nia-dark rounded-lg py-2 px-4 hover:bg-gray-300 text-sm font-medium text-center"
          >
            Import Processes
          </Link>
          <Link
            href="/processes/new"
            className="bg-nia-dark text-white rounded-lg py-2 px-4 hover:opacity-90 text-sm font-medium text-center"
          >
            + Create New Process
          </Link>
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
                className={`rounded-lg shadow p-3 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-nia-dark shadow-md"
                    : "hover:shadow-md hover:-translate-y-0.5"
                } ${isEmpty ? "opacity-60" : ""}`}
                style={{ backgroundColor: isEmpty ? "#dc262608" : "#324a4d08", borderTop: `3px solid ${isEmpty ? "#dc2626" : "#55787c"}` }}
              >
                <div className={`text-2xl font-bold ${isEmpty ? "text-nia-red" : "text-nia-dark"}`}>
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
        <select
          value={filterCategory ?? ""}
          onChange={(e) =>
            setFilterCategory(e.target.value ? Number(e.target.value) : null)
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.display_name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus ?? ""}
          onChange={(e) =>
            setFilterStatus(
              e.target.value ? (e.target.value as ProcessStatus) : null
            )
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>
        {(filterCategory !== null || filterStatus !== null || showKeyOnly) && (
          <button
            onClick={() => {
              setFilterCategory(null);
              setFilterStatus(null);
              setShowKeyOnly(false);
            }}
            className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Process List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm">
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
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Process</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Completeness</th>
                  <th className="px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((process) => (
                  <tr
                    key={process.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
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
                          <span className="text-xs text-gray-400 ml-1" title="Linked to Asana">
                            <svg className="inline w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="4"/><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/></svg>
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
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor:
                            STATUS_CONFIG[process.status].color + "20",
                          color: STATUS_CONFIG[process.status].color,
                        }}
                      >
                        {STATUS_CONFIG[process.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const sections = getCompleteness(process);
                        const filled = sections.filter((s) => s.filled).length;
                        const tooltip = sections.map((s) => `${s.filled ? "\u2713" : "\u2717"} ${s.label}`).join("\n");
                        return (
                          <div className="flex items-center gap-1" title={tooltip}>
                            {sections.map((s, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${s.filled ? "bg-nia-green" : "bg-gray-200"}`}
                              />
                            ))}
                            <span className="text-xs text-gray-400 ml-1">
                              {filled}/{sections.length}
                            </span>
                          </div>
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
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((process) => (
              <Link
                key={process.id}
                href={`/processes/${process.id}`}
                className="block bg-white rounded-lg shadow p-4 border-l-4 border-nia-grey-blue hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
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
                          <svg className="inline w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="4"/><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/></svg>
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
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
                    style={{
                      backgroundColor:
                        STATUS_CONFIG[process.status].color + "20",
                      color: STATUS_CONFIG[process.status].color,
                    }}
                  >
                    {STATUS_CONFIG[process.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  {(() => {
                    const sections = getCompleteness(process);
                    const filled = sections.filter((s) => s.filled).length;
                    return (
                      <span className="flex items-center gap-0.5">
                        {sections.map((s, i) => (
                          <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${s.filled ? "bg-nia-green" : "bg-gray-200"}`} />
                        ))}
                        <span className="ml-1">{filled}/{sections.length}</span>
                      </span>
                    );
                  })()}
                  {process.owner && (
                    <>
                      <span>&middot;</span>
                      <span>{process.owner}</span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
