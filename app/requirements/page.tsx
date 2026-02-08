"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getTrendDirection } from "@/lib/review-status";
import type { KeyRequirementWithStatus } from "@/lib/types";
import Link from "next/link";

// The display order for stakeholder groups
const GROUP_ORDER = [
  "Member Districts",
  "Non-Member Entities",
  "Workforce",
  "Students",
  "Parents",
];

interface AllMetric {
  id: number;
  name: string;
  process_name: string;
  category_display_name: string;
}

interface LinkedProcess {
  id: number;
  name: string;
  is_key: boolean;
}

interface EnrichedRequirement extends KeyRequirementWithStatus {
  linked_processes: LinkedProcess[];
}

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<EnrichedRequirement[]>([]);
  const [allMetrics, setAllMetrics] = useState<AllMetric[]>([]);
  const [allCategories, setAllCategories] = useState<{ display_name: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editingReq, setEditingReq] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ requirement: "", stakeholder_segment: "", stakeholder_group: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newReqForm, setNewReqForm] = useState({ requirement: "", description: "" });

  useEffect(() => {
    document.title = "Key Requirements | NIA Excellence Hub";

    async function fetchData() {
      // Fetch all Baldrige categories
      const { data: catData } = await supabase
        .from("categories")
        .select("display_name, sort_order")
        .order("sort_order");

      if (catData) {
        setAllCategories(catData);
      }

      // Fetch all key requirements
      const { data: reqData } = await supabase
        .from("key_requirements")
        .select("*")
        .order("sort_order");

      // Fetch all metric-requirement links with metric info
      const { data: linkData } = await supabase
        .from("metric_requirements")
        .select(`
          requirement_id,
          metric_id,
          metrics!inner (
            id, name, target_value, is_higher_better
          )
        `);

      // Fetch all metrics for the "Add Metric" picker
      const { data: allMetricsData } = await supabase
        .from("metrics")
        .select(`
          id, name,
          processes!inner (
            name,
            categories!inner ( display_name )
          )
        `)
        .order("name");

      if (allMetricsData) {
        setAllMetrics(
          allMetricsData.map((m: Record<string, unknown>) => {
            const proc = m.processes as Record<string, unknown>;
            const cat = proc.categories as Record<string, unknown>;
            return {
              id: m.id as number,
              name: m.name as string,
              process_name: proc.name as string,
              category_display_name: cat.display_name as string,
            };
          })
        );
      }

      // Fetch process-requirement links with process info
      const { data: procLinkData } = await supabase
        .from("process_requirements")
        .select(`
          requirement_id,
          processes!inner ( id, name, is_key )
        `);

      // Build map of requirement_id -> linked processes
      const procsByReq = new Map<number, LinkedProcess[]>();
      if (procLinkData) {
        for (const link of procLinkData) {
          const proc = link.processes as unknown as { id: number; name: string; is_key: boolean };
          if (!procsByReq.has(link.requirement_id)) {
            procsByReq.set(link.requirement_id, []);
          }
          procsByReq.get(link.requirement_id)!.push({
            id: proc.id,
            name: proc.name,
            is_key: proc.is_key,
          });
        }
      }

      // Fetch all entries for trend/value calculations
      const { data: entriesData } = await supabase
        .from("entries")
        .select("metric_id, value, date")
        .order("date", { ascending: true });

      // Group entries by metric
      const entriesByMetric = new Map<number, { value: number; date: string }[]>();
      if (entriesData) {
        for (const entry of entriesData) {
          if (!entriesByMetric.has(entry.metric_id)) {
            entriesByMetric.set(entry.metric_id, []);
          }
          entriesByMetric.get(entry.metric_id)!.push({
            value: entry.value,
            date: entry.date,
          });
        }
      }

      // Group links by requirement_id
      const linksByReq = new Map<number, typeof linkData>();
      if (linkData) {
        for (const link of linkData) {
          if (!linksByReq.has(link.requirement_id)) {
            linksByReq.set(link.requirement_id, []);
          }
          linksByReq.get(link.requirement_id)!.push(link);
        }
      }

      // Build enriched requirements
      const enriched: EnrichedRequirement[] = (reqData || []).map((req) => {
        const links = linksByReq.get(req.id) || [];

        const linkedMetrics = links.map((link) => {
          const metric = link.metrics as unknown as {
            id: number;
            name: string;
            target_value: number | null;
            is_higher_better: boolean;
          };
          const entries = entriesByMetric.get(metric.id) || [];
          const values = entries.map((e) => e.value);
          const latestValue = values.length > 0 ? values[values.length - 1] : null;
          const trendDir = getTrendDirection(values, metric.is_higher_better);

          let onTarget: boolean | null = null;
          if (metric.target_value !== null && latestValue !== null) {
            onTarget = metric.is_higher_better
              ? latestValue >= metric.target_value
              : latestValue <= metric.target_value;
          }

          return {
            id: metric.id,
            name: metric.name,
            latest_value: latestValue,
            target_value: metric.target_value,
            is_higher_better: metric.is_higher_better,
            trend_direction: trendDir,
            on_target: onTarget,
          };
        });

        // Calculate health
        let health: "green" | "yellow" | "red" | "no-data" = "no-data";
        if (linkedMetrics.length > 0) {
          const withTargets = linkedMetrics.filter((m) => m.on_target !== null);
          if (withTargets.length === 0) {
            // Has metrics but no targets set — yellow
            health = "yellow";
          } else {
            const onTargetCount = withTargets.filter((m) => m.on_target).length;
            const ratio = onTargetCount / withTargets.length;
            if (ratio === 1) health = "green";
            else if (ratio >= 0.5) health = "yellow";
            else health = "red";
          }
        }

        return {
          ...req,
          linked_metrics: linkedMetrics,
          linked_processes: procsByReq.get(req.id) || [],
          health,
        };
      });

      setRequirements(enriched);
      setLoading(false);
    }

    fetchData();
  }, [refreshKey]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddMetric(requirementId: number, metricId: number) {
    await supabase.from("metric_requirements").insert({
      metric_id: metricId,
      requirement_id: requirementId,
    });
    setAddingTo(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleUnlinkMetric(requirementId: number, metricId: number) {
    await supabase
      .from("metric_requirements")
      .delete()
      .eq("metric_id", metricId)
      .eq("requirement_id", requirementId);
    setRefreshKey((k) => k + 1);
  }

  function startEdit(req: KeyRequirementWithStatus) {
    setEditingReq(req.id);
    setEditForm({
      requirement: req.requirement,
      stakeholder_segment: req.stakeholder_segment,
      stakeholder_group: req.stakeholder_group,
      description: req.description || "",
    });
  }

  async function saveEdit(id: number) {
    await supabase.from("key_requirements").update({
      requirement: editForm.requirement,
      stakeholder_segment: editForm.stakeholder_segment,
      stakeholder_group: editForm.stakeholder_group,
      description: editForm.description || null,
    }).eq("id", id);
    setEditingReq(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: number) {
    await supabase.from("metric_requirements").delete().eq("requirement_id", id);
    await supabase.from("key_requirements").delete().eq("id", id);
    setDeleteConfirm(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleAddRequirement(segment: string, group: string) {
    if (!newReqForm.requirement.trim()) return;
    const maxSort = Math.max(...requirements.map((r) => r.sort_order), 0);
    await supabase.from("key_requirements").insert({
      stakeholder_segment: segment,
      stakeholder_group: group,
      requirement: newReqForm.requirement.trim(),
      description: newReqForm.description.trim() || null,
      sort_order: maxSort + 1,
    });
    setAddingToGroup(null);
    setNewReqForm({ requirement: "", description: "" });
    setRefreshKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading key requirements...</div>
      </div>
    );
  }

  // Summary stats
  const total = requirements.length;
  const withMetrics = requirements.filter((r) => r.linked_metrics.length > 0).length;
  const gaps = total - withMetrics;
  const meetingTargets = requirements.filter((r) => r.health === "green").length;

  // Group requirements by segment then group, in GROUP_ORDER
  const grouped = new Map<string, EnrichedRequirement[]>();
  for (const req of requirements) {
    const key = req.stakeholder_group;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(req);
  }
  const orderedGroups = GROUP_ORDER.filter((g) => grouped.has(g));

  const healthColor = (h: string) => {
    switch (h) {
      case "green": return "#b1bd37";
      case "yellow": return "#f79935";
      case "red": return "#dc2626";
      default: return "#e5e7eb";
    }
  };

  const healthLabel = (h: string) => {
    switch (h) {
      case "green": return "On Target";
      case "yellow": return "Mixed";
      case "red": return "Below Target";
      default: return "No Metrics";
    }
  };

  const trendIcon = (dir: string) => {
    switch (dir) {
      case "improving": return "\u2191";
      case "declining": return "\u2193";
      case "flat": return "\u2192";
      default: return "\u2014";
    }
  };

  const trendColor = (dir: string) => {
    switch (dir) {
      case "improving": return "#b1bd37";
      case "declining": return "#dc2626";
      case "flat": return "#55787c";
      default: return "#9ca3af";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">Key Requirements</h1>
        <p className="text-gray-500 mt-1">
          Stakeholder needs from the Organizational Profile — linked to metrics that provide evidence
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Source: NIA Organizational Profile, Figure P-6
        </p>
        </div>
        <button
          onClick={() => { setEditMode(!editMode); setEditingReq(null); setDeleteConfirm(null); setAddingToGroup(null); }}
          className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
            editMode
              ? "bg-[#324a4d] text-white"
              : "bg-gray-200 text-[#324a4d] hover:bg-gray-300"
          }`}
        >
          {editMode ? "Done Editing" : "Edit Requirements"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-[#324a4d]">{total}</div>
          <div className="text-xs text-gray-400">Total Requirements</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: withMetrics > 0 ? "#b1bd37" : "#dc2626" }}>
            {withMetrics}
          </div>
          <div className="text-xs text-gray-400">With Metrics Linked</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: gaps > 0 ? "#f79935" : "#b1bd37" }}>
            {gaps}
          </div>
          <div className="text-xs text-gray-400">Gaps (No Metrics)</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: meetingTargets > 0 ? "#b1bd37" : "#9ca3af" }}>
            {meetingTargets}
          </div>
          <div className="text-xs text-gray-400">Meeting Targets</div>
        </div>
      </div>

      {/* Coverage Heatmap */}
      {(() => {
        // Build metric_id -> category lookup from allMetrics
        const metricCategory = new Map<number, string>();
        for (const m of allMetrics) {
          metricCategory.set(m.id, m.category_display_name);
        }

        // Use all categories from the database (sorted by sort_order)
        const categoryNames = allCategories.map((c) => c.display_name);

        if (categoryNames.length === 0 || orderedGroups.length === 0) return null;

        // Build matrix: group -> category -> count
        const matrix = new Map<string, Map<string, number>>();
        for (const groupName of orderedGroups) {
          const catCounts = new Map<string, number>();
          for (const cat of categoryNames) catCounts.set(cat, 0);
          matrix.set(groupName, catCounts);
        }

        for (const req of requirements) {
          const groupCounts = matrix.get(req.stakeholder_group);
          if (!groupCounts) continue;
          for (const m of req.linked_metrics) {
            const cat = metricCategory.get(m.id);
            if (cat && groupCounts.has(cat)) {
              groupCounts.set(cat, (groupCounts.get(cat) || 0) + 1);
            }
          }
        }

        return (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-bold text-[#324a4d] mb-3">Coverage Heatmap</h2>
            <p className="text-xs text-gray-400 mb-3">Metric coverage by stakeholder group and Baldrige category</p>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Stakeholder</th>
                    {categoryNames.map((cat) => (
                      <th key={cat} className="px-3 py-2 text-xs text-gray-400 font-medium text-center">{cat}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderedGroups.map((groupName) => {
                    const catCounts = matrix.get(groupName)!;
                    return (
                      <tr key={groupName} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-sm font-medium text-[#324a4d]">{groupName}</td>
                        {categoryNames.map((cat) => {
                          const count = catCounts.get(cat) || 0;
                          const bgColor = count === 0
                            ? "bg-gray-100"
                            : count <= 2
                              ? "bg-[#f79935]/20"
                              : "bg-[#b1bd37]/20";
                          const textColor = count === 0
                            ? "text-gray-300"
                            : count <= 2
                              ? "text-[#b06a10]"
                              : "text-[#6b7a1a]";
                          return (
                            <td key={cat} className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${bgColor} ${textColor}`}>
                                {count === 0 ? "\u2014" : count}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Requirements by group */}
      {orderedGroups.map((groupName) => {
        const groupReqs = grouped.get(groupName)!;
        const segment = groupReqs[0].stakeholder_segment;

        return (
          <div key={groupName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {segment}
              </span>
              <h2 className="text-lg font-semibold text-[#324a4d]">{groupName}</h2>
            </div>

            {groupReqs.map((req) => {
              const isExpanded = expanded.has(req.id);
              const isGap = req.linked_metrics.length === 0;

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-[#f79935]"
                >
                  {/* Inline edit form */}
                  {editMode && editingReq === req.id ? (
                    <div className="px-4 py-3 space-y-2 bg-gray-50">
                      <input
                        type="text"
                        value={editForm.requirement}
                        onChange={(e) => setEditForm({ ...editForm, requirement: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                        placeholder="Requirement name"
                      />
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                        placeholder="Description (optional)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(req.id)}
                          className="text-sm bg-[#324a4d] text-white px-3 py-1 rounded-lg hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingReq(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : deleteConfirm === req.id ? (
                    <div className="px-4 py-3 bg-red-50">
                      <p className="text-sm text-red-700 mb-2">
                        Delete &quot;{req.requirement}&quot;?
                        {req.linked_metrics.length > 0 && (
                          <> This will unlink <strong>{req.linked_metrics.length} metric{req.linked_metrics.length !== 1 ? "s" : ""}</strong>.</>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="text-sm bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Requirement header */
                    <button
                      onClick={() => !editMode && toggleExpand(req.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {!editMode && (
                          <span className="text-gray-400 text-sm">
                            {isExpanded ? "\u25BC" : "\u25B6"}
                          </span>
                        )}
                        <span className="font-medium text-[#324a4d]">{req.requirement}</span>
                        {isGap && !editMode && (
                          <span className="text-xs bg-[#f79935]/10 text-[#f79935] px-2 py-0.5 rounded-full font-medium">
                            No metrics linked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {editMode ? (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(req); }}
                              className="text-xs text-[#55787c] hover:text-[#324a4d]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(req.id); }}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            {!isGap && (
                              <span className="text-xs text-gray-400">
                                {req.linked_metrics.length} metric{req.linked_metrics.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: healthColor(req.health) }}
                              title={healthLabel(req.health)}
                            />
                          </>
                        )}
                      </div>
                    </button>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                      {/* Linked processes */}
                      {req.linked_processes.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Processes
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {req.linked_processes.map((proc) => (
                              <Link
                                key={proc.id}
                                href={`/processes/${proc.id}`}
                                className="inline-flex items-center gap-1 text-sm bg-[#55787c]/10 text-[#324a4d] px-3 py-1 rounded-full hover:bg-[#55787c]/20 transition-colors"
                              >
                                {proc.is_key && <span className="text-[#f79935]">&#9733;</span>}
                                {proc.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {req.linked_metrics.length === 0 && req.linked_processes.length === 0 && (
                        <p className="text-sm text-gray-400 italic">
                          No processes or metrics are linked to this requirement yet.
                        </p>
                      )}
                      {req.linked_metrics.length === 0 && req.linked_processes.length > 0 && (
                        <p className="text-sm text-gray-400 italic">
                          No metrics are linked to this requirement yet.
                        </p>
                      )}
                      {req.linked_metrics.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Metrics
                          </span>
                          <div className="space-y-1 mt-1">
                          {req.linked_metrics.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                            >
                              <Link
                                href={`/metric/${m.id}`}
                                className="text-sm text-[#324a4d] hover:text-[#f79935] transition-colors"
                              >
                                {m.name}
                              </Link>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-gray-500">
                                  {m.latest_value !== null ? m.latest_value : "\u2014"}
                                </span>
                                {m.target_value !== null && m.latest_value !== null && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: m.on_target ? "#b1bd37" + "20" : "#dc2626" + "20",
                                      color: m.on_target ? "#b1bd37" : "#dc2626",
                                    }}
                                  >
                                    {m.on_target ? "On Target" : "Below"}
                                  </span>
                                )}
                                <span
                                  className="font-bold"
                                  style={{ color: trendColor(m.trend_direction) }}
                                  title={m.trend_direction}
                                >
                                  {trendIcon(m.trend_direction)}
                                </span>
                                <button
                                  onClick={() => handleUnlinkMetric(req.id, m.id)}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity"
                                  title="Unlink metric"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                          </div>
                        </div>
                      )}

                      {/* Add Metric picker */}
                      {addingTo === req.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleAddMetric(req.id, Number(e.target.value));
                            }}
                          >
                            <option value="" disabled>Select a metric to link...</option>
                            {(() => {
                              const linkedIds = new Set(req.linked_metrics.map((m) => m.id));
                              const available = allMetrics.filter((m) => !linkedIds.has(m.id));
                              const byCategory = new Map<string, AllMetric[]>();
                              for (const m of available) {
                                const key = m.category_display_name;
                                if (!byCategory.has(key)) byCategory.set(key, []);
                                byCategory.get(key)!.push(m);
                              }
                              return Array.from(byCategory.entries()).map(([cat, metrics]) => (
                                <optgroup key={cat} label={cat}>
                                  {metrics.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.process_name} — {m.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ));
                            })()}
                          </select>
                          <button
                            onClick={() => setAddingTo(null)}
                            className="text-sm text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingTo(req.id)}
                          className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors font-medium"
                        >
                          + Add Metric
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Requirement button (edit mode only) */}
            {editMode && (
              addingToGroup === groupName ? (
                <div className="bg-white rounded-lg shadow p-4 space-y-2">
                  <input
                    type="text"
                    value={newReqForm.requirement}
                    onChange={(e) => setNewReqForm({ ...newReqForm, requirement: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                    placeholder="Requirement name"
                  />
                  <input
                    type="text"
                    value={newReqForm.description}
                    onChange={(e) => setNewReqForm({ ...newReqForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddRequirement(segment, groupName)}
                      className="text-sm bg-[#324a4d] text-white px-3 py-1 rounded-lg hover:opacity-90"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingToGroup(null); setNewReqForm({ requirement: "", description: "" }); }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingToGroup(groupName)}
                  className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors font-medium"
                >
                  + Add Requirement
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
