"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel, formatValue } from "@/lib/review-status";
import type {
  ProcessStatus,
  Charter,
  AdliApproach,
  AdliDeployment,
  AdliLearning,
  AdliIntegration,
  Workflow,
  BaldigeConnections,
} from "@/lib/types";
import Link from "next/link";
import MarkdownContent from "@/components/markdown-content";
import AiChatPanel from "@/components/ai-chat-panel";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface ProcessDetail {
  id: number;
  name: string;
  description: string | null;
  category_id: number;
  category_display_name: string;
  baldrige_item: string | null;
  is_key: boolean;
  status: ProcessStatus;
  template_type: "quick" | "full";
  owner: string | null;
  reviewer: string | null;
  charter: Charter | null;
  basic_steps: string[] | null;
  participants: string[] | null;
  metrics_summary: string | null;
  connections: string | null;
  adli_approach: AdliApproach | null;
  adli_deployment: AdliDeployment | null;
  adli_learning: AdliLearning | null;
  adli_integration: AdliIntegration | null;
  workflow: Workflow | null;
  baldrige_connections: BaldigeConnections | null;
  updated_at: string;
}

interface LinkedMetric {
  id: number;
  name: string;
  last_value: number | null;
  unit: string;
  cadence: string;
  target_value: number | null;
  is_higher_better: boolean;
  review_status: "current" | "due-soon" | "overdue" | "no-data";
  on_target: boolean | null;
  sparkline: number[];
}

interface LinkedRequirement {
  id: number;
  requirement: string;
  stakeholder_group: string;
}

interface HistoryEntry {
  id: number;
  change_description: string;
  changed_at: string;
}

const STATUS_CONFIG: Record<ProcessStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9ca3af" },
  ready_for_review: { label: "Ready for Review", color: "#f79935" },
  in_review: { label: "In Review", color: "#eab308" },
  revisions_needed: { label: "Revisions Needed", color: "#a855f7" },
  approved: { label: "Approved", color: "#b1bd37" },
};

const STATUS_ORDER: ProcessStatus[] = [
  "draft",
  "ready_for_review",
  "in_review",
  "revisions_needed",
  "approved",
];

export default function ProcessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [metrics, setMetrics] = useState<LinkedMetric[]>([]);
  const [requirements, setRequirements] = useState<LinkedRequirement[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    async function fetchProcess() {
      // Fetch process with category name
      const { data: procData, error } = await supabase
        .from("processes")
        .select(`*, categories!inner ( display_name )`)
        .eq("id", id)
        .single();

      if (error || !procData) {
        console.error("Error fetching process:", error);
        setLoading(false);
        return;
      }

      const cat = procData.categories as Record<string, unknown>;
      const proc: ProcessDetail = {
        ...(procData as unknown as Omit<ProcessDetail, "category_display_name">),
        category_display_name: cat.display_name as string,
      };
      setProcess(proc);
      document.title = `${proc.name} | NIA Excellence Hub`;

      // Fetch linked metrics
      const { data: metricsData } = await supabase
        .from("metrics")
        .select("id, name, unit, cadence, target_value, is_higher_better")
        .eq("process_id", id);

      if (metricsData) {
        // Get entries for each metric (desc for latest, collect up to 6 for sparklines)
        const { data: entries } = await supabase
          .from("entries")
          .select("metric_id, value, date")
          .in("metric_id", metricsData.map((m) => m.id))
          .order("date", { ascending: false });

        const latestByMetric = new Map<number, { value: number; date: string }>();
        const sparklinesByMetric = new Map<number, number[]>();
        if (entries) {
          for (const e of entries) {
            if (!latestByMetric.has(e.metric_id)) {
              latestByMetric.set(e.metric_id, { value: e.value, date: e.date });
            }
            const existing = sparklinesByMetric.get(e.metric_id) || [];
            if (existing.length < 6) {
              existing.push(e.value);
              sparklinesByMetric.set(e.metric_id, existing);
            }
          }
          // Reverse to chronological order
          for (const [mid, vals] of sparklinesByMetric) {
            sparklinesByMetric.set(mid, vals.reverse());
          }
        }

        setMetrics(
          metricsData.map((m) => {
            const latest = latestByMetric.get(m.id);
            const lastValue = latest?.value ?? null;
            let onTarget: boolean | null = null;
            if (m.target_value !== null && lastValue !== null) {
              onTarget = m.is_higher_better
                ? lastValue >= m.target_value
                : lastValue <= m.target_value;
            }
            return {
              id: m.id,
              name: m.name,
              last_value: lastValue,
              unit: m.unit,
              cadence: m.cadence,
              target_value: m.target_value,
              is_higher_better: m.is_higher_better,
              review_status: getReviewStatus(m.cadence, latest?.date || null),
              on_target: onTarget,
              sparkline: sparklinesByMetric.get(m.id) || [],
            };
          })
        );
      }

      // Fetch linked requirements
      const { data: reqLinks } = await supabase
        .from("process_requirements")
        .select(`
          requirement_id,
          key_requirements!inner ( id, requirement, stakeholder_group )
        `)
        .eq("process_id", id);

      if (reqLinks) {
        setRequirements(
          reqLinks.map((link) => {
            const req = link.key_requirements as unknown as {
              id: number;
              requirement: string;
              stakeholder_group: string;
            };
            return {
              id: req.id,
              requirement: req.requirement,
              stakeholder_group: req.stakeholder_group,
            };
          })
        );
      }

      // Fetch history
      const { data: histData } = await supabase
        .from("process_history")
        .select("*")
        .eq("process_id", id)
        .order("changed_at", { ascending: false });

      if (histData) setHistory(histData);

      setLoading(false);
    }

    fetchProcess();
  }, [id]);

  async function handleStatusChange(newStatus: ProcessStatus) {
    if (!process) return;

    await supabase
      .from("processes")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", process.id);

    await supabase.from("process_history").insert({
      process_id: process.id,
      change_description: `Status changed from "${STATUS_CONFIG[process.status].label}" to "${STATUS_CONFIG[newStatus].label}"`,
    });

    setProcess({ ...process, status: newStatus });
    setHistory([
      {
        id: Date.now(),
        change_description: `Status changed from "${STATUS_CONFIG[process.status].label}" to "${STATUS_CONFIG[newStatus].label}"`,
        changed_at: new Date().toISOString(),
      },
      ...history,
    ]);
  }

  async function handleDelete() {
    if (!process) return;
    await supabase.from("process_history").delete().eq("process_id", process.id);
    await supabase.from("process_requirements").delete().eq("process_id", process.id);
    // Unlink metrics (set process_id to null) - but since process_id is FK with cascade,
    // we just need to handle it. Actually, we want to NOT delete metrics.
    // The cascade on processes will delete metrics too. We need to unlink first.
    await supabase
      .from("metrics")
      .update({ process_id: null as unknown as number })
      .eq("process_id", process.id);
    await supabase.from("processes").delete().eq("id", process.id);
    router.push("/processes");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading process...</div>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Process not found</p>
        <Link
          href="/processes"
          className="text-[#55787c] hover:text-[#324a4d] mt-4 inline-block"
        >
          Back to Processes
        </Link>
      </div>
    );
  }

  // Determine next status for "Advance" button
  const currentIdx = STATUS_ORDER.indexOf(process.status);
  const nextStatus =
    currentIdx < STATUS_ORDER.length - 1 && process.status !== "revisions_needed"
      ? STATUS_ORDER[currentIdx + 1]
      : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/processes"
        className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors"
      >
        &larr; Back to Processes
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#324a4d]">{process.name}</h1>
            {process.is_key && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[#f79935]/15 text-[#b06a10]">
                <span className="text-[#f79935]">&#9733;</span> Key Process
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
            <span>{process.category_display_name}</span>
            {process.baldrige_item && (
              <>
                <span>&middot;</span>
                <span>Item {process.baldrige_item}</span>
              </>
            )}
            <span>&middot;</span>
            <span className="capitalize">{process.template_type} template</span>
            {process.owner && (
              <>
                <span>&middot;</span>
                <span>Owner: {process.owner}</span>
              </>
            )}
            {process.reviewer && (
              <>
                <span>&middot;</span>
                <span>Reviewer: {process.reviewer}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/processes/${process.id}/edit`}
            className="bg-[#324a4d] text-white rounded-lg py-2 px-4 hover:opacity-90 text-sm font-medium"
          >
            Edit
          </Link>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="bg-red-100 text-red-600 rounded-lg py-2 px-4 hover:bg-red-200 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm mb-3">
            Are you sure you want to delete &quot;{process.name}&quot;? This
            cannot be undone. Linked metrics will be preserved but unlinked.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white rounded-lg py-1.5 px-4 text-sm hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status Workflow Stepper */}
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#f79935]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Status
          </h2>
          <div className="flex gap-2">
            {nextStatus && (
              <button
                onClick={() => handleStatusChange(nextStatus)}
                className="text-xs bg-[#324a4d] text-white px-3 py-1 rounded-lg hover:opacity-90"
              >
                Advance to {STATUS_CONFIG[nextStatus].label}
              </button>
            )}
            {process.status === "in_review" && (
              <button
                onClick={() => handleStatusChange("revisions_needed")}
                className="text-xs bg-[#a855f7]/10 text-[#a855f7] px-3 py-1 rounded-lg hover:bg-[#a855f7]/20"
              >
                Revisions Needed
              </button>
            )}
            {process.status === "revisions_needed" && (
              <button
                onClick={() => handleStatusChange("ready_for_review")}
                className="text-xs bg-[#f79935]/10 text-[#f79935] px-3 py-1 rounded-lg hover:bg-[#f79935]/20"
              >
                Resubmit for Review
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {STATUS_ORDER.filter((s) => s !== "revisions_needed").map(
            (status, i, arr) => {
              const statusIdx = STATUS_ORDER.indexOf(status);
              const currentStatusIdx = STATUS_ORDER.indexOf(process.status);
              const isActive = status === process.status;
              const isCompleted = statusIdx < currentStatusIdx;
              const color = STATUS_CONFIG[status].color;

              return (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive || isCompleted
                          ? "text-white"
                          : "text-gray-400 bg-gray-100"
                      }`}
                      style={
                        isActive || isCompleted
                          ? { backgroundColor: color }
                          : undefined
                      }
                    >
                      {isCompleted ? "\u2713" : i + 1}
                    </div>
                    <span className="text-xs text-gray-500 mt-1 text-center leading-tight">
                      {STATUS_CONFIG[status].label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div
                      className="h-0.5 flex-1 mx-1"
                      style={{
                        backgroundColor: isCompleted ? color : "#e5e7eb",
                      }}
                    />
                  )}
                </div>
              );
            }
          )}
        </div>
        {process.status === "revisions_needed" && (
          <div className="mt-2 text-xs text-[#a855f7] font-medium">
            Revisions needed — address feedback and resubmit for review
          </div>
        )}
      </div>

      {/* Metrics & Results — prominent position before documentation */}
      <Section title={`Metrics & Results (${metrics.length})`}>
        {metrics.length > 0 ? (
          <div className="space-y-2">
            {metrics.map((m) => {
              const sparkData = m.sparkline.map((v, i) => ({ i, v }));
              const first = m.sparkline[0];
              const last = m.sparkline[m.sparkline.length - 1];
              const trend = m.sparkline.length >= 2
                ? (last > first ? "up" : last < first ? "down" : "flat")
                : null;
              const improving = trend && ((trend === "up" && m.is_higher_better) || (trend === "down" && !m.is_higher_better));
              const sparkColor = improving ? "#b1bd37" : trend === "flat" ? "#55787c" : trend ? "#dc2626" : "#9ca3af";

              return (
                <Link
                  key={m.id}
                  href={`/metric/${m.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getStatusColor(m.review_status) }}
                    title={getStatusLabel(m.review_status)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#324a4d]">{m.name}</span>
                    <span className="text-xs text-gray-400 ml-2 capitalize">{m.cadence}</span>
                  </div>
                  {m.sparkline.length >= 2 ? (
                    <div className="w-16 h-6 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                          <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs w-16 text-center flex-shrink-0">&mdash;</span>
                  )}
                  <div className="text-right flex-shrink-0 w-24">
                    {m.last_value !== null ? (
                      <>
                        <div className="text-sm font-medium text-[#324a4d]">
                          {formatValue(m.last_value, m.unit)}
                        </div>
                        {m.on_target !== null && (
                          <div className="text-xs" style={{ color: m.on_target ? "#b1bd37" : "#dc2626" }}>
                            {m.on_target ? "On Target" : "Below"}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">No data</span>
                    )}
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{
                      backgroundColor: getStatusColor(m.review_status) + "20",
                      color: getStatusColor(m.review_status),
                    }}
                  >
                    {getStatusLabel(m.review_status)}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#f79935]/10 border border-[#f79935]/30 rounded-lg px-4 py-3 text-sm text-[#324a4d] flex items-center justify-between">
            <span>No metrics linked yet — adding metrics lets you track results and build LeTCI evidence for this process.</span>
            <Link
              href="/metric/new"
              className="text-[#f79935] font-medium hover:underline whitespace-nowrap ml-4"
            >
              + Add Metric
            </Link>
          </div>
        )}
      </Section>

      {/* Description — hide for full templates when Charter has the full content */}
      {!(process.template_type === "full" && process.charter?.content) && (
        <Section title="What is this process?">
          <TextContent text={process.description} />
        </Section>
      )}

      {/* These quick-only fields are redundant for full templates (covered by Charter + ADLI) */}
      {process.template_type === "quick" && (
        <>
          <Section title="How do we do it?">
            {process.basic_steps && process.basic_steps.length > 0 ? (
              <ol className="list-decimal list-inside space-y-1 text-[#324a4d]">
                {process.basic_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            ) : (
              <EmptyText />
            )}
          </Section>

          <Section title="Who's involved?">
            {process.participants && process.participants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {process.participants.map((p, i) => (
                  <span
                    key={i}
                    className="bg-[#55787c]/10 text-[#324a4d] px-3 py-1 rounded-full text-sm"
                  >
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyText />
            )}
          </Section>

          <Section title="How do we know it's working?">
            <TextContent text={process.metrics_summary} />
          </Section>

          <Section title="What does this connect to?">
            <TextContent text={process.connections} />
          </Section>
        </>
      )}

      {/* Full Template Sections (only for full template type) */}
      {process.template_type === "full" && (
        <>
          <Section title="Charter">
            {process.charter ? (
              process.charter.content ? (
                <MarkdownContent content={process.charter.content} />
              ) : (
                <div className="space-y-3">
                  <Field label="Purpose" value={process.charter.purpose} />
                  <Field
                    label="Scope (Includes)"
                    value={process.charter.scope_includes}
                  />
                  <Field
                    label="Scope (Excludes)"
                    value={process.charter.scope_excludes}
                  />
                  <Field
                    label="Mission Alignment"
                    value={process.charter.mission_alignment}
                  />
                  {process.charter.stakeholders &&
                    process.charter.stakeholders.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Stakeholders
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {process.charter.stakeholders.map((s, i) => (
                            <span
                              key={i}
                              className="bg-[#55787c]/10 text-[#324a4d] px-3 py-1 rounded-full text-sm"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )
            ) : (
              <EmptyText />
            )}
          </Section>

          <AdliSection title="Approach" data={process.adli_approach} />
          <AdliSection title="Deployment" data={process.adli_deployment} />
          <AdliSection title="Learning" data={process.adli_learning} />
          <AdliSection title="Integration" data={process.adli_integration} />

          <Section title="Workflow">
            {process.workflow?.content ? (
              <MarkdownContent content={process.workflow.content} />
            ) : process.workflow ? (
              <div className="space-y-4">
                {process.workflow.inputs && process.workflow.inputs.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Inputs</span>
                    <ul className="list-disc list-inside mt-1 text-[#324a4d]">
                      {process.workflow.inputs.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {process.workflow.steps && process.workflow.steps.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Steps</span>
                    <div className="space-y-2 mt-1">
                      {process.workflow.steps.map((step, i) => (
                        <div
                          key={i}
                          className="bg-gray-50 rounded-lg p-3 text-sm"
                        >
                          <div className="font-medium text-[#324a4d]">
                            {i + 1}. {step.action}
                          </div>
                          <div className="text-gray-500 mt-1">
                            {step.responsible && (
                              <span>Responsible: {step.responsible}</span>
                            )}
                            {step.timing && (
                              <span className="ml-3">Timing: {step.timing}</span>
                            )}
                            {step.output && (
                              <span className="ml-3">Output: {step.output}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {process.workflow.outputs && process.workflow.outputs.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Outputs</span>
                    <ul className="list-disc list-inside mt-1 text-[#324a4d]">
                      {process.workflow.outputs.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {process.workflow.quality_controls &&
                  process.workflow.quality_controls.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Quality Controls
                      </span>
                      <ul className="list-disc list-inside mt-1 text-[#324a4d]">
                        {process.workflow.quality_controls.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            ) : (
              <EmptyText />
            )}
          </Section>

          <Section title="Baldrige Connections">
            {process.baldrige_connections?.content ? (
              <MarkdownContent content={process.baldrige_connections.content} />
            ) : process.baldrige_connections ? (
              <div className="space-y-3">
                {process.baldrige_connections.questions_addressed &&
                  process.baldrige_connections.questions_addressed.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Questions Addressed
                      </span>
                      <ul className="list-disc list-inside mt-1 text-[#324a4d]">
                        {process.baldrige_connections.questions_addressed.map(
                          (q, i) => (
                            <li key={i}>{q}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                {process.baldrige_connections.evidence_by_dimension && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">
                      Evidence by ADLI Dimension
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {Object.entries(
                        process.baldrige_connections.evidence_by_dimension
                      ).map(([dim, evidence]) => (
                        <div key={dim} className="bg-gray-50 rounded-lg p-2">
                          <span className="text-xs font-medium text-gray-500 capitalize">
                            {dim}
                          </span>
                          <p className="text-sm text-[#324a4d] mt-0.5">
                            {evidence || "Not yet documented"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyText />
            )}
          </Section>
        </>
      )}

      {/* Linked Key Requirements */}
      <Section title="Linked Key Requirements">
        {requirements.length > 0 ? (
          <div className="space-y-2">
            {requirements.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50"
              >
                <span className="text-sm text-[#324a4d]">{r.requirement}</span>
                <span className="text-xs text-gray-400">
                  {r.stakeholder_group}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No key requirements linked yet. Use the Edit page to link
            requirements.
          </p>
        )}
      </Section>

      {/* History */}
      {history.length > 0 && (
        <Section title="History">
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[#324a4d]">{h.change_description}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(h.changed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* AI Chat Panel */}
      <AiChatPanel processId={process.id} processName={process.name} />
    </div>
  );
}

// Helper components

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-[#f79935]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            {isOpen ? "\u25BC" : "\u25B6"}
          </span>
          <h2 className="font-semibold text-[#324a4d]">{title}</h2>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3">{children}</div>
      )}
    </div>
  );
}

function TextContent({ text }: { text: string | null | undefined }) {
  return text ? (
    <p className="text-[#324a4d] whitespace-pre-wrap">{text}</p>
  ) : (
    <EmptyText />
  );
}

function EmptyText() {
  return (
    <p className="text-sm text-gray-400 italic">Not yet documented</p>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <p className="text-[#324a4d] mt-0.5">
        {value || (
          <span className="text-sm text-gray-400 italic">
            Not yet documented
          </span>
        )}
      </p>
    </div>
  );
}

function AdliSection({
  title,
  data,
}: {
  title: string;
  data: AdliApproach | AdliDeployment | AdliLearning | AdliIntegration | null;
}) {
  if (!data) {
    return (
      <Section title={`ADLI: ${title}`}>
        <EmptyText />
      </Section>
    );
  }

  // If full content was imported, show that instead of individual fields
  if ("content" in data && data.content) {
    return (
      <Section title={`ADLI: ${title}`}>
        <MarkdownContent content={data.content} />
      </Section>
    );
  }

  return (
    <Section title={`ADLI: ${title}`}>
      <div className="space-y-3">
        {Object.entries(data).map(([key, value]) => {
          if (key === "content") return null;
          const label = key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          if (Array.isArray(value)) {
            return value.length > 0 ? (
              <div key={key}>
                <span className="text-sm font-medium text-gray-500">
                  {label}
                </span>
                <ul className="list-disc list-inside mt-1 text-[#324a4d]">
                  {value.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          }
          return value ? (
            <Field key={key} label={label} value={value as string} />
          ) : null;
        })}
      </div>
    </Section>
  );
}
