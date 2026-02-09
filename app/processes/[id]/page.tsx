"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DetailSkeleton } from "@/components/skeleton";
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
import EmptyState from "@/components/empty-state";
import MarkdownContent from "@/components/markdown-content";
import AiChatPanel from "@/components/ai-chat-panel";
import TaskReviewPanel from "@/components/task-review-panel";
import ImprovementStepper from "@/components/improvement-stepper";
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
  owner: string | null;
  reviewer: string | null;
  charter: Charter | null;
  adli_approach: AdliApproach | null;
  adli_deployment: AdliDeployment | null;
  adli_learning: AdliLearning | null;
  adli_integration: AdliIntegration | null;
  workflow: Workflow | null;
  baldrige_connections: BaldigeConnections | null;
  updated_at: string;
  asana_project_gid: string | null;
  asana_project_url: string | null;
  guided_step: string | null;
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

interface ImprovementEntry {
  id: number;
  section_affected: string;
  change_type: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  committed_date: string;
  implemented_date: string | null;
  impact_notes: string | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  trigger_detail: string | null;
}

const STATUS_CONFIG: Record<ProcessStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9ca3af" },
  ready_for_review: { label: "Ready for Review", color: "#f79935" },
  approved: { label: "Approved", color: "#b1bd37" },
};

const STATUS_ORDER: ProcessStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
];

export default function ProcessDetailPage() {
  return (
    <Suspense>
      <ProcessDetailContent />
    </Suspense>
  );
}

function ProcessDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoAnalyze = searchParams.get("analyze") === "true";
  const id = params.id as string;

  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [metrics, setMetrics] = useState<LinkedMetric[]>([]);
  const [requirements, setRequirements] = useState<LinkedRequirement[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [improvements, setImprovements] = useState<ImprovementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [asanaExporting, setAsanaExporting] = useState(false);
  const [asanaConfirm, setAsanaConfirm] = useState(false);
  const [asanaResult, setAsanaResult] = useState<{ action: string; asanaUrl: string } | null>(null);
  const [asanaError, setAsanaError] = useState("");
  const [asanaPickerOpen, setAsanaPickerOpen] = useState(false);
  const [asanaProjects, setAsanaProjects] = useState<{ gid: string; name: string; description: string; team: string | null; modified_at: string }[]>([]);
  const [asanaProjectsLoading, setAsanaProjectsLoading] = useState(false);
  const [asanaSearch, setAsanaSearch] = useState("");
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const [availableMetrics, setAvailableMetrics] = useState<{ id: number; name: string; unit: string; cadence: string }[]>([]);
  const [metricSearch, setMetricSearch] = useState("");
  const [linkingMetric, setLinkingMetric] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "tasks">("content");
  const [taskCount, setTaskCount] = useState(0);
  const [asanaResyncing, setAsanaResyncing] = useState(false);
  const [asanaResyncResult, setAsanaResyncResult] = useState<{ tasks: number; subtasks: number } | null>(null);

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

      // Fetch linked metrics via junction table
      const { data: metricLinks } = await supabase
        .from("metric_processes")
        .select("metric_id")
        .eq("process_id", id);

      const metricIds = (metricLinks || []).map((l) => l.metric_id);

      const { data: metricsData } = metricIds.length > 0
        ? await supabase
            .from("metrics")
            .select("id, name, unit, cadence, target_value, is_higher_better")
            .in("id", metricIds)
        : { data: [] as { id: number; name: string; unit: string; cadence: string; target_value: number | null; is_higher_better: boolean }[] };

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

      // Fetch improvements
      const { data: impData } = await supabase
        .from("process_improvements")
        .select("*")
        .eq("process_id", id)
        .order("committed_date", { ascending: false });

      if (impData) setImprovements(impData);

      setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProcess(); }, [id]);

  async function fetchAvailableMetrics() {
    // Get metric IDs already linked to this process
    const { data: existingLinks } = await supabase
      .from("metric_processes")
      .select("metric_id")
      .eq("process_id", id);
    const linkedIds = (existingLinks || []).map((l) => l.metric_id);

    // Get all metrics, then filter out already-linked ones
    const { data } = await supabase
      .from("metrics")
      .select("id, name, unit, cadence")
      .order("name");
    if (data) {
      setAvailableMetrics(
        linkedIds.length > 0
          ? data.filter((m) => !linkedIds.includes(m.id))
          : data
      );
    }
  }

  async function linkExistingMetric(metricId: number) {
    setLinkingMetric(metricId);
    const { error } = await supabase
      .from("metric_processes")
      .insert({ metric_id: metricId, process_id: Number(id) });
    if (!error) {
      setMetricPickerOpen(false);
      setMetricDialogOpen(false);
      setMetricSearch("");
      fetchProcess();
    }
    setLinkingMetric(null);
  }

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
    // metric_processes junction rows are cleaned up by CASCADE on delete
    // Metrics themselves survive — they just lose this process link
    await supabase.from("processes").delete().eq("id", process.id);
    router.push("/processes");
  }

  async function handleAsanaResync() {
    if (!process) return;
    setAsanaResyncing(true);
    setAsanaResyncResult(null);
    setAsanaError("");
    try {
      const res = await fetch("/api/asana/resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: process.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAsanaError(data.message || data.error || "Refresh failed");
      } else {
        setAsanaResyncResult({ tasks: data.tasks, subtasks: data.subtasks });
        fetchProcess(); // Refresh to pick up updated charter, ADLI, and guided_step
      }
    } catch (e) {
      setAsanaError("Refresh failed: " + (e as Error).message);
    }
    setAsanaResyncing(false);
  }

  async function handleAsanaExport(forceNew = false) {
    if (!process) return;
    setAsanaExporting(true);
    setAsanaError("");
    setAsanaResult(null);
    try {
      const res = await fetch("/api/asana/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: process.id, forceNew }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAsanaError(data.error || "Export failed");
      } else {
        setAsanaResult(data);
        setAsanaConfirm(false);
        fetchProcess(); // Refresh to pick up new asana_project_gid
      }
    } catch (e) {
      setAsanaError("Export failed: " + (e as Error).message);
    }
    setAsanaExporting(false);
  }

  async function loadAsanaProjects() {
    setAsanaProjectsLoading(true);
    try {
      const res = await fetch("/api/asana/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setAsanaProjects(data.projects || []);
    } catch {
      setAsanaError("Failed to load Asana projects");
    }
    setAsanaProjectsLoading(false);
  }

  async function handleLinkToProject(projectGid: string) {
    if (!process) return;
    setAsanaExporting(true);
    setAsanaError("");
    try {
      // Update the Hub's link to point to the selected Asana project
      const { error } = await supabase
        .from("processes")
        .update({
          asana_project_gid: projectGid,
          asana_project_url: `https://app.asana.com/0/${projectGid}`,
        })
        .eq("id", process.id);
      if (error) throw error;

      // Now sync to that project
      const res = await fetch("/api/asana/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: process.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAsanaError(data.error || "Sync failed");
      } else {
        setAsanaResult(data);
        setAsanaConfirm(false);
        setAsanaPickerOpen(false);
        fetchProcess();
      }
    } catch (e) {
      setAsanaError("Link failed: " + (e as Error).message);
    }
    setAsanaExporting(false);
  }

  if (loading) return <DetailSkeleton sections={5} />;

  if (!process) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Process not found</p>
        <Link
          href="/processes"
          className="text-nia-grey-blue hover:text-nia-dark mt-4 inline-block"
        >
          Back to Processes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/processes"
        className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
      >
        &larr; Back to Processes
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-nia-dark">{process.name}</h1>
            {process.is_key && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-nia-orange/15 text-nia-orange-dark">
                <span className="text-nia-orange">&#9733;</span> Key Process
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
          <button
            onClick={() => setAsanaConfirm(true)}
            className="bg-nia-green text-white rounded-lg py-2 px-4 hover:opacity-90 text-sm font-medium"
          >
            {process.asana_project_gid ? "Sync to Asana" : "Export to Asana"}
          </button>
          <Link
            href={`/processes/${process.id}/edit`}
            className="bg-nia-dark text-white rounded-lg py-2 px-4 hover:opacity-90 text-sm font-medium"
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

      {/* Asana export result */}
      {asanaResult && (
        <div className="banner-enter bg-nia-green/20 border border-nia-green rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-nia-dark">
            {asanaResult.action === "created" ? "Exported to new Asana project!" : "Synced to Asana!"}
          </p>
          <a
            href={asanaResult.asanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-nia-grey-blue hover:text-nia-dark"
          >
            View in Asana &rarr;
          </a>
        </div>
      )}

      {/* Asana export error */}
      {asanaError && (
        <div className="banner-enter bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {asanaError}
        </div>
      )}

      {/* Asana export confirmation */}
      {asanaConfirm && (
        <div className="bg-nia-grey-blue/10 border border-nia-grey-blue rounded-lg p-4">
          <p className="text-sm text-nia-dark mb-1 font-medium">Export to Asana</p>
          {!asanaPickerOpen ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {process.asana_project_gid
                  ? "Sync the linked project, link to a different project, or create a new one."
                  : `Create a new Asana project or link to an existing one.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {process.asana_project_gid && (
                  <button
                    onClick={() => handleAsanaExport(false)}
                    disabled={asanaExporting}
                    className="bg-nia-green text-white rounded-lg py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {asanaExporting ? "Syncing..." : "Sync Linked Project"}
                  </button>
                )}
                <button
                  onClick={() => { setAsanaPickerOpen(true); loadAsanaProjects(); }}
                  disabled={asanaExporting}
                  className="bg-nia-grey-blue text-white rounded-lg py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Link to Existing Project
                </button>
                <button
                  onClick={() => handleAsanaExport(true)}
                  disabled={asanaExporting}
                  className="bg-nia-dark text-white rounded-lg py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {asanaExporting ? "Creating..." : "Create New Project"}
                </button>
                <button
                  onClick={() => setAsanaConfirm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Select an Asana project to link and sync with this process.
              </p>
              {asanaProjectsLoading && (
                <p className="text-sm text-nia-grey-blue py-2">Loading projects...</p>
              )}
              {!asanaProjectsLoading && asanaProjects.length > 0 && (
                <>
                  <input
                    type="text"
                    value={asanaSearch}
                    onChange={(e) => setAsanaSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                  />
                  <div className="space-y-1.5 max-h-64 overflow-y-auto mb-3">
                    {asanaProjects
                      .filter((p) => p.name.toLowerCase().includes(asanaSearch.toLowerCase()))
                      .map((project) => (
                        <div
                          key={project.gid}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100 hover:border-nia-grey-blue/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-nia-dark truncate">{project.name}</p>
                            <div className="flex gap-3 text-xs text-gray-400">
                              {project.team && <span>{project.team}</span>}
                              {project.modified_at && (
                                <span>Updated {new Date(project.modified_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleLinkToProject(project.gid)}
                            disabled={asanaExporting}
                            className="bg-nia-dark text-white rounded py-1 px-3 text-xs font-medium hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                          >
                            {asanaExporting ? "Linking..." : "Link"}
                          </button>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {!asanaProjectsLoading && asanaProjects.length === 0 && !asanaError && (
                <p className="text-sm text-gray-400 py-2">No projects found in your Asana workspace.</p>
              )}
              <button
                onClick={() => { setAsanaPickerOpen(false); setAsanaSearch(""); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Back
              </button>
            </>
          )}
        </div>
      )}

      {/* Asana resync result */}
      {asanaResyncResult && (
        <div className="banner-enter bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            Asana data refreshed: {asanaResyncResult.tasks} tasks, {asanaResyncResult.subtasks} subtasks loaded. AI coach now has full context.
          </p>
          <button onClick={() => setAsanaResyncResult(null)} className="text-blue-500 hover:text-blue-700 text-sm ml-3">Dismiss</button>
        </div>
      )}

      {/* Asana link */}
      {process.asana_project_url && !asanaConfirm && !asanaResult && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Linked to Asana:</span>
          <a
            href={process.asana_project_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nia-grey-blue hover:text-nia-dark font-medium"
          >
            View project &rarr;
          </a>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleAsanaResync}
            disabled={asanaResyncing}
            className="text-nia-grey-blue hover:text-nia-dark font-medium disabled:opacity-50"
          >
            {asanaResyncing ? "Refreshing..." : "Refresh Asana Data"}
          </button>
        </div>
      )}

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

      {/* Improvement Stepper — only shown when linked to Asana */}
      {process.asana_project_gid && process.guided_step && (
        <ImprovementStepper
          currentStep={process.guided_step}
          onStepClick={async (step) => {
            const res = await fetch("/api/processes/step", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ processId: process.id, step }),
            });
            if (res.ok) {
              setProcess({ ...process, guided_step: step });
            }
          }}
        />
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("content")}
          className={`flex-1 text-sm font-medium rounded-md py-2 px-4 transition-colors ${
            activeTab === "content"
              ? "bg-white text-nia-dark shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex-1 text-sm font-medium rounded-md py-2 px-4 transition-colors relative ${
            activeTab === "tasks"
              ? "bg-white text-nia-dark shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Tasks
          {taskCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-nia-orange text-white">
              {taskCount}
            </span>
          )}
        </button>
      </div>

      {/* Tasks tab */}
      {activeTab === "tasks" && (
        <TaskReviewPanel processId={process.id} onTaskCountChange={setTaskCount} />
      )}

      {/* Content tab */}
      {activeTab === "content" && <>

      {/* Workflow Status */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Workflow Status
          </h2>
          <select
            value={process.status}
            onChange={(e) => handleStatusChange(e.target.value as ProcessStatus)}
            className="text-sm font-medium rounded-lg px-3 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
            style={{
              borderColor: STATUS_CONFIG[process.status].color + "40",
              color: STATUS_CONFIG[process.status].color,
              backgroundColor: STATUS_CONFIG[process.status].color + "10",
            }}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>
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
                    <span className="text-sm font-medium text-nia-dark">{m.name}</span>
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
                        <div className="text-sm font-medium text-nia-dark">
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
            {/* Add metric button when metrics already exist */}
            <button
              onClick={() => { setMetricDialogOpen(true); fetchAvailableMetrics(); }}
              className="w-full text-sm text-nia-grey-blue hover:text-nia-dark py-2 rounded-lg border border-dashed border-gray-300 hover:border-nia-grey-blue transition-colors"
            >
              + Add Metric
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-6 px-4">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-sm font-semibold text-nia-dark mb-1">No metrics linked</h3>
            <p className="text-xs text-gray-500 mb-3">Add metrics to track results and build LeTCI evidence for this process.</p>
            <button
              onClick={() => { setMetricDialogOpen(true); fetchAvailableMetrics(); }}
              className="text-sm font-medium text-white bg-nia-dark rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            >
              + Add Metric
            </button>
          </div>
        )}
      </Section>

      {/* Add Metric Dialog */}
      {metricDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setMetricDialogOpen(false); setMetricPickerOpen(false); setMetricSearch(""); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-nia-dark">Add Metric</h3>
              <p className="text-sm text-gray-500 mt-1">Link an existing metric or create a new one for this process.</p>
            </div>

            {!metricPickerOpen ? (
              <div className="p-5 space-y-3">
                <button
                  onClick={() => setMetricPickerOpen(true)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-nia-grey-blue hover:bg-nia-grey-blue/5 transition-colors group"
                >
                  <div className="text-sm font-medium text-nia-dark group-hover:text-nia-grey-blue">Link Existing Metric</div>
                  <div className="text-xs text-gray-500 mt-0.5">Choose from metrics not already linked to this process</div>
                </button>
                <Link
                  href={`/metric/new?processId=${id}`}
                  className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-nia-grey-blue hover:bg-nia-grey-blue/5 transition-colors group"
                >
                  <div className="text-sm font-medium text-nia-dark group-hover:text-nia-grey-blue">Create New Metric</div>
                  <div className="text-xs text-gray-500 mt-0.5">Build a new metric and link it to this process</div>
                </Link>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <button onClick={() => setMetricPickerOpen(false)} className="text-xs text-gray-500 hover:text-nia-dark flex items-center gap-1">
                  ← Back
                </button>
                <input
                  type="text"
                  placeholder="Search metrics..."
                  value={metricSearch}
                  onChange={(e) => setMetricSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
                  autoFocus
                />
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {availableMetrics
                    .filter((m) => m.name.toLowerCase().includes(metricSearch.toLowerCase()))
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => linkExistingMetric(m.id)}
                        disabled={linkingMetric === m.id}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between disabled:opacity-50"
                      >
                        <div>
                          <div className="text-sm font-medium text-nia-dark">{m.name}</div>
                          <div className="text-xs text-gray-400 capitalize">{m.cadence} · {m.unit}</div>
                        </div>
                        {linkingMetric === m.id ? (
                          <span className="text-xs text-gray-400">Linking...</span>
                        ) : (
                          <span className="text-xs text-nia-grey-blue font-medium">Link</span>
                        )}
                      </button>
                    ))}
                  {availableMetrics.filter((m) => m.name.toLowerCase().includes(metricSearch.toLowerCase())).length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No unlinked metrics found</p>
                      <Link
                        href={`/metric/new?processId=${id}`}
                        className="text-sm text-nia-grey-blue hover:underline mt-1 inline-block"
                      >
                        Create a new metric instead
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => { setMetricDialogOpen(false); setMetricPickerOpen(false); setMetricSearch(""); }}
                className="text-sm text-gray-500 hover:text-nia-dark"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description — only show when no charter content */}
      {!process.charter?.content && (
        <Section title="What is this process?">
          <TextContent text={process.description} />
        </Section>
      )}

      {/* Charter & ADLI Sections */}
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
                              className="bg-nia-grey-blue/10 text-nia-dark px-3 py-1 rounded-full text-sm"
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
                    <ul className="list-disc list-inside mt-1 text-nia-dark">
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
                          <div className="font-medium text-nia-dark">
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
                    <ul className="list-disc list-inside mt-1 text-nia-dark">
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
                      <ul className="list-disc list-inside mt-1 text-nia-dark">
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
                      <ul className="list-disc list-inside mt-1 text-nia-dark">
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
                          <p className="text-sm text-nia-dark mt-0.5">
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

      {/* Linked Key Requirements */}
      <Section title="Linked Key Requirements">
        {requirements.length > 0 ? (
          <div className="space-y-2">
            {requirements.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50"
              >
                <span className="text-sm text-nia-dark">{r.requirement}</span>
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

      {/* Improvement History */}
      {improvements.length > 0 && (
        <Section title={`Improvement History (${improvements.length})`}>
          <div className="space-y-3">
            {improvements.map((imp) => (
              <ImprovementCard
                key={imp.id}
                improvement={imp}
                onStatusUpdate={async (newStatus) => {
                  const res = await fetch("/api/improvements", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: imp.id, status: newStatus }),
                  });
                  if (res.ok) {
                    setImprovements((prev) =>
                      prev.map((i) =>
                        i.id === imp.id
                          ? { ...i, status: newStatus, ...(newStatus === "implemented" ? { implemented_date: new Date().toISOString() } : {}) }
                          : i
                      )
                    );
                  }
                }}
                onDelete={async () => {
                  const res = await fetch(`/api/improvements?id=${imp.id}`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    setImprovements((prev) => prev.filter((i) => i.id !== imp.id));
                  }
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Change Log */}
      {history.length > 0 && (
        <Section title="Change Log">
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-nia-dark">{h.change_description}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(h.changed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      </>}

      {/* AI Chat Panel */}
      <AiChatPanel processId={process.id} processName={process.name} onProcessUpdated={fetchProcess} autoAnalyze={autoAnalyze} guidedStep={process.guided_step} />
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
    <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-nia-orange">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`section-chevron text-gray-400 text-sm ${isOpen ? "open" : ""}`}>
            ▶
          </span>
          <h2 className="text-lg font-semibold text-nia-dark">{title}</h2>
        </div>
      </button>
      <div className={`section-body ${isOpen ? "open" : ""}`}>
        <div>
          <div className="border-t border-gray-100 px-4 py-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TextContent({ text }: { text: string | null | undefined }) {
  return text ? (
    <p className="text-nia-dark whitespace-pre-wrap">{text}</p>
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
      <p className="text-nia-dark mt-0.5">
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
                <ul className="list-disc list-inside mt-1 text-nia-dark">
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

const SECTION_COLORS: Record<string, string> = {
  approach: "#55787c",
  deployment: "#f79935",
  learning: "#b1bd37",
  integration: "#324a4d",
  charter: "#6b7280",
  workflow: "#a855f7",
};

const STATUS_PILLS: Record<string, { label: string; bg: string; text: string }> = {
  committed: { label: "Committed", bg: "#dbeafe", text: "#2563eb" },
  in_progress: { label: "In Progress", bg: "#fef3c7", text: "#d97706" },
  implemented: { label: "Implemented", bg: "#dcfce7", text: "#16a34a" },
  deferred: { label: "Deferred", bg: "#f3f4f6", text: "#6b7280" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", text: "#dc2626" },
};

function ImprovementCard({
  improvement,
  onStatusUpdate,
  onDelete,
}: {
  improvement: ImprovementEntry;
  onStatusUpdate: (status: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sectionColor = SECTION_COLORS[improvement.section_affected] || "#6b7280";
  const statusPill = STATUS_PILLS[improvement.status] || STATUS_PILLS.committed;

  const nextStatus: Record<string, string> = {
    committed: "in_progress",
    in_progress: "implemented",
  };
  const nextAction = nextStatus[improvement.status];

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded capitalize flex-shrink-0"
            style={{ backgroundColor: sectionColor + "15", color: sectionColor }}
          >
            {improvement.section_affected}
          </span>
          <span className="text-sm font-medium text-nia-dark truncate">
            {improvement.title}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ backgroundColor: statusPill.bg, color: statusPill.text }}
          >
            {statusPill.label}
          </span>
          {improvement.source === "ai_suggestion" && (
            <span className="text-xs text-gray-400" title="AI suggestion">AI</span>
          )}
          {improvement.trigger_detail && improvement.trigger_detail.startsWith("http") && (
            <a
              href={improvement.trigger_detail}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nia-grey-blue hover:text-nia-dark transition-colors"
              title="View Asana task"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="18" r="4" />
                <circle cx="5" cy="8" r="4" />
                <circle cx="19" cy="8" r="4" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {improvement.description && (
        <p className="text-xs text-gray-500 mt-1.5">{improvement.description}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {new Date(improvement.committed_date).toLocaleDateString()}
          {improvement.implemented_date && (
            <> &middot; Implemented {new Date(improvement.implemented_date).toLocaleDateString()}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          {(improvement.before_snapshot || improvement.after_snapshot) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-nia-grey-blue hover:text-nia-dark"
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
          {nextAction && (
            <button
              onClick={() => onStatusUpdate(nextAction)}
              className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium"
            >
              {nextAction === "in_progress" ? "Start" : "Mark Done"}
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors"
            title="Delete improvement"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span className="text-xs text-red-700">Delete this improvement?</span>
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              className="text-xs font-medium text-white bg-red-500 px-2 py-0.5 rounded hover:bg-red-600"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (improvement.before_snapshot || improvement.after_snapshot) && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
          {improvement.before_snapshot && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase">Before</span>
              <pre className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                {typeof improvement.before_snapshot === "object" && (improvement.before_snapshot as Record<string, unknown>).content
                  ? String((improvement.before_snapshot as Record<string, unknown>).content).slice(0, 500)
                  : JSON.stringify(improvement.before_snapshot, null, 2).slice(0, 500)}
              </pre>
            </div>
          )}
          {improvement.after_snapshot && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase">After</span>
              <pre className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                {typeof improvement.after_snapshot === "object" && (improvement.after_snapshot as Record<string, unknown>).content
                  ? String((improvement.after_snapshot as Record<string, unknown>).content).slice(0, 500)
                  : JSON.stringify(improvement.after_snapshot, null, 2).slice(0, 500)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
