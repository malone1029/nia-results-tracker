"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProcessStatus } from "@/lib/types";
import Link from "next/link";

interface ProcessRow {
  id: number;
  name: string;
  category_id: number;
  category_display_name: string;
  status: ProcessStatus;
  template_type: "quick" | "full";
  owner: string | null;
  baldrige_item: string | null;
}

interface CategorySummary {
  id: number;
  name: string;
  display_name: string;
  process_count: number;
  approved_count: number;
}

const STATUS_CONFIG: Record<ProcessStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9ca3af" },
  ready_for_review: { label: "Ready for Review", color: "#f79935" },
  in_review: { label: "In Review", color: "#eab308" },
  revisions_needed: { label: "Revisions Needed", color: "#a855f7" },
  approved: { label: "Approved", color: "#b1bd37" },
};

const STATUS_OPTIONS: ProcessStatus[] = [
  "draft",
  "ready_for_review",
  "in_review",
  "revisions_needed",
  "approved",
];

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProcessStatus | null>(null);

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
          id, name, category_id, status, template_type, owner, baldrige_item,
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
            status: (p.status as ProcessStatus) || "draft",
            template_type: (p.template_type as "quick" | "full") || "quick",
            owner: p.owner as string | null,
            baldrige_item: p.baldrige_item as string | null,
          };
        }
      );

      // Build category summaries
      const catSummaries: CategorySummary[] = (catData || []).map(
        (c: Record<string, unknown>) => {
          const catProcesses = processRows.filter(
            (p) => p.category_id === (c.id as number)
          );
          return {
            id: c.id as number,
            name: c.name as string,
            display_name: c.display_name as string,
            process_count: catProcesses.length,
            approved_count: catProcesses.filter((p) => p.status === "approved")
              .length,
          };
        }
      );

      setProcesses(processRows);
      setCategories(catSummaries);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading processes...</div>
      </div>
    );
  }

  // Apply filters
  const filtered = processes.filter((p) => {
    if (filterCategory !== null && p.category_id !== filterCategory)
      return false;
    if (filterStatus !== null && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#324a4d]">Processes</h1>
          <p className="text-gray-500 mt-1">
            Organizational processes aligned to the Baldrige Excellence Framework
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/processes/import"
            className="bg-gray-200 text-[#324a4d] rounded-lg py-2 px-4 hover:bg-gray-300 text-sm font-medium text-center"
          >
            Import from Obsidian
          </Link>
          <Link
            href="/processes/new"
            className="bg-[#324a4d] text-white rounded-lg py-2 px-4 hover:opacity-90 text-sm font-medium text-center"
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
            let bgColor: string;
            let textColor: string;
            if (cat.approved_count > 0) {
              bgColor = "#b1bd37" + "20";
              textColor = "#6b7a1a";
            } else if (cat.process_count > 0) {
              bgColor = "#f79935" + "20";
              textColor = "#b06a10";
            } else {
              bgColor = "#dc2626" + "20";
              textColor = "#dc2626";
            }

            const isSelected = filterCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() =>
                  setFilterCategory(isSelected ? null : cat.id)
                }
                className={`rounded-lg p-3 text-center transition-all ${
                  isSelected
                    ? "ring-2 ring-[#324a4d] shadow-md"
                    : "hover:shadow-md"
                }`}
                style={{ backgroundColor: bgColor }}
              >
                <div
                  className="text-2xl font-bold"
                  style={{ color: textColor }}
                >
                  {cat.process_count}
                </div>
                <div className="text-xs font-medium text-[#324a4d] mt-1 leading-tight">
                  {cat.display_name}
                </div>
                {cat.approved_count > 0 && (
                  <div
                    className="text-xs mt-1"
                    style={{ color: "#6b7a1a" }}
                  >
                    {cat.approved_count} approved
                  </div>
                )}
                {cat.process_count > 0 && cat.approved_count === 0 && (
                  <div className="text-xs mt-1" style={{ color: "#b06a10" }}>
                    {cat.process_count} draft
                  </div>
                )}
                {cat.process_count === 0 && (
                  <div className="text-xs mt-1" style={{ color: "#dc2626" }}>
                    No processes
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterCategory ?? ""}
          onChange={(e) =>
            setFilterCategory(e.target.value ? Number(e.target.value) : null)
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>
        {(filterCategory !== null || filterStatus !== null) && (
          <button
            onClick={() => {
              setFilterCategory(null);
              setFilterStatus(null);
            }}
            className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Process List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-400 text-lg mb-2">No processes found</p>
          <p className="text-gray-400 text-sm">
            {processes.length === 0
              ? "Get started by creating your first process."
              : "Try adjusting your filters."}
          </p>
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
                  <th className="px-4 py-3">Type</th>
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
                      <Link
                        href={`/processes/${process.id}`}
                        className="font-medium text-[#324a4d] hover:text-[#f79935] transition-colors"
                      >
                        {process.name}
                      </Link>
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
                    <td className="px-4 py-3 text-sm text-gray-500 capitalize">
                      {process.template_type}
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
                className="block bg-white rounded-lg shadow p-4 border-l-4 border-[#f79935] hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-[#324a4d]">
                      {process.name}
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
                  <span className="capitalize">{process.template_type}</span>
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
