"use client";

import { useEffect, useState, useRef, Suspense } from "react";
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
import { Card, Badge, Button, Input } from "@/components/ui";

import MarkdownContent from "@/components/markdown-content";
import AiChatPanel from "@/components/ai-chat-panel";
import TaskReviewPanel from "@/components/task-review-panel";
import ImprovementStepper from "@/components/improvement-stepper";
import { STEPS, getPrimaryAction, type StepActionDef } from "@/lib/step-actions";
import { useRole } from "@/lib/use-role";
import ProcessHealthCard from "@/components/process-health-card";
import MilestoneToast from "@/components/milestone-toast";
import ConfirmDeleteModal from "@/components/confirm-delete-modal";
// Survey builder moved to full page at /surveys/new and /surveys/[id]/edit
import SurveyCard from "@/components/survey-results";
import AdliRadar from "@/components/adli-radar";
import AdliScoringInfo from "@/components/adli-scoring-info";
import { calculateHealthScore, type HealthResult, type HealthMetricInput } from "@/lib/process-health";
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

interface AdliScoreData {
  approach_score: number;
  deployment_score: number;
  learning_score: number;
  integration_score: number;
  overall_score: number;
  assessed_at: string;
}

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
  const openAI = searchParams.get("openAI");       // e.g., "assessment", "deep_dive", "charter", "metrics"
  const openExport = searchParams.get("openExport") === "true";
  const id = params.id as string;
  const { isAdmin } = useRole();

  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [metrics, setMetrics] = useState<LinkedMetric[]>([]);
  const [requirements, setRequirements] = useState<LinkedRequirement[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [improvements, setImprovements] = useState<ImprovementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [asanaExporting, setAsanaExporting] = useState(false);
  const [asanaConfirm, setAsanaConfirm] = useState(false);
  const [asanaResult, setAsanaResult] = useState<{ action: string; asanaUrl: string; warning?: string; adliCreated?: number; adliUpdated?: number; backfillCount?: number } | null>(null);
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
  const [activeTab, setActiveTab] = useState<"overview" | "documentation" | "process-map" | "tasks" | "history">("overview");
  const [taskCount, setTaskCount] = useState(0);
  const [asanaResyncing, setAsanaResyncing] = useState(false);
  const [asanaResyncResult, setAsanaResyncResult] = useState<{ tasks: number; subtasks: number } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ id: number; file_name: string; file_type: string; file_size: number; uploaded_at: string }[]>([]);
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [adliScoreData, setAdliScoreData] = useState<AdliScoreData | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [hasAsanaToken, setHasAsanaToken] = useState<boolean | null>(null);
  const [ebMappings, setEbMappings] = useState<{ question_code: string; area_label: string; question_text: string; coverage: string; category_name: string; item_code: string }[]>([]);
  const [surveys, setSurveys] = useState<{ id: number; title: string; description: string | null; is_anonymous: boolean; is_public: boolean; question_count: number; latest_wave: { id: number; wave_number: number; status: string; share_token: string; opened_at: string; closed_at: string | null; response_count: number } | null; created_at: string }[]>([]);
  // Survey builder state removed — now a full page at /surveys/new and /surveys/[id]/edit
  const [unlinkConfirmId, setUnlinkConfirmId] = useState<number | null>(null);
  const [surveyDeploying, setSurveyDeploying] = useState<number | null>(null);
  const [surveyClosing, setSurveyClosing] = useState<number | null>(null);
  const deepLinkFiredRef = useRef(false);
  const [processMapMounted, setProcessMapMounted] = useState(false);

  // Maps scroll target IDs to the tab they live on
  function getTabForScrollTarget(target: string): "overview" | "documentation" | "process-map" | "tasks" | "history" {
    if (target === "section-tasks") return "tasks";
    if (target === "section-charter" || target === "section-adli") return "documentation";
    if (target === "section-workflow") return "process-map";
    if (target === "section-metrics" || target === "section-surveys") return "overview";
    return "overview";
  }

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

      let healthMetrics: HealthMetricInput[] = [];

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

        // Build health metric inputs while we have access to the entry maps
        healthMetrics = metricsData.map((m) => {
          const latest = latestByMetric.get(m.id);
          const entryCount = sparklinesByMetric.get(m.id)?.length || 0;
          let letci = 0;
          if (entryCount >= 1) letci++;
          if (entryCount >= 3) letci++;
          if (m.target_value !== null) letci++;
          letci++; // integration = linked to process
          return {
            has_recent_data: latest ? getReviewStatus(m.cadence, latest.date) === "current" : false,
            has_comparison: m.target_value !== null,
            letci_score: letci,
            entry_count: entryCount,
          };
        });
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

      // Fetch attached files + health score data + EB mappings in parallel
      const [filesRes, { data: adliScores }, { data: taskRows }, { data: ebMappingRows }] = await Promise.all([
        fetch(`/api/ai/files?processId=${id}`),
        supabase.from("process_adli_scores").select("approach_score, deployment_score, learning_score, integration_score, overall_score, assessed_at").eq("process_id", id).maybeSingle(),
        supabase.from("process_tasks").select("status").eq("process_id", id),
        supabase.from("process_question_mappings").select("coverage, baldrige_questions!inner(question_code, area_label, question_text, tier, baldrige_items!inner(item_code, category_name))").eq("process_id", id),
      ]);

      if (adliScores) setAdliScoreData(adliScores as AdliScoreData);

      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setAttachedFiles(filesData);
      }

      // Parse EB mappings from joined query
      if (ebMappingRows) {
        setEbMappings(
          ebMappingRows
            .filter((r) => {
              const q = r.baldrige_questions as unknown as { tier: string };
              return q?.tier === "excellence_builder";
            })
            .map((r) => {
              const q = r.baldrige_questions as unknown as {
                question_code: string;
                area_label: string;
                question_text: string;
                baldrige_items: { item_code: string; category_name: string };
              };
              return {
                question_code: q.question_code,
                area_label: q.area_label,
                question_text: q.question_text,
                coverage: r.coverage,
                item_code: q.baldrige_items.item_code,
                category_name: q.baldrige_items.category_name,
              };
            })
        );
      }

      // Calculate health score
      let pendingCount = 0;
      let exportedCount = 0;
      for (const t of taskRows || []) {
        if (t.status === "pending") pendingCount++;
        else exportedCount++;
      }

      const latestImpDate = impData && impData.length > 0 ? impData[0].committed_date : null;

      setHealthResult(calculateHealthScore(
        {
          id: proc.id,
          charter: proc.charter as Record<string, unknown> | null,
          adli_approach: proc.adli_approach as Record<string, unknown> | null,
          adli_deployment: proc.adli_deployment as Record<string, unknown> | null,
          adli_learning: proc.adli_learning as Record<string, unknown> | null,
          adli_integration: proc.adli_integration as Record<string, unknown> | null,
          workflow: proc.workflow as Record<string, unknown> | null,
          baldrige_connections: proc.baldrige_connections as Record<string, unknown> | null,
          status: proc.status,
          asana_project_gid: proc.asana_project_gid,
          asana_adli_task_gids: procData.asana_adli_task_gids as Record<string, string> | null,
          updated_at: proc.updated_at,
        },
        adliScores ? { overall_score: adliScores.overall_score } : null,
        healthMetrics,
        { pending_count: pendingCount, exported_count: exportedCount },
        { latest_date: latestImpDate },
      ));

      setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProcess(); fetchSurveys(); }, [id]);

  // Check if user has an Asana token (for nudge card)
  useEffect(() => {
    fetch("/api/asana/status").then((r) => r.ok ? r.json() : null).then((d) => {
      setHasAsanaToken(d?.connected ?? false);
    }).catch(() => setHasAsanaToken(false));
  }, []);

  // Deep-link handler: ?openAI=<step> opens AI panel with that step's prompt
  //                    ?openExport=true opens the Asana export dialog
  useEffect(() => {
    if (loading || !process || deepLinkFiredRef.current) return;
    deepLinkFiredRef.current = true;

    if (openExport) {
      setAsanaConfirm(true);
    }

    if (openAI) {
      // First try: step-level lookup (e.g., "assessment", "charter", "deep_dive")
      let matchedAction: StepActionDef | undefined = getPrimaryAction(openAI);
      if (!matchedAction) {
        // Fallback: search for a matching action key across all steps (e.g., "metrics")
        for (const step of STEPS) {
          const match = step.actions.find((a) => a.key === openAI);
          if (match) { matchedAction = match; break; }
        }
      }
      if (matchedAction) {
        // Switch to the correct tab for this action's scroll target
        const targetTab = matchedAction.switchTab || getTabForScrollTarget(matchedAction.scrollTarget);
        setActiveTab(targetTab);
        setPendingPrompt(matchedAction.prompt);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Keep Process Map mounted once viewed (prevents Mermaid re-render race conditions)
  useEffect(() => {
    if (activeTab === "process-map" && !processMapMounted) setProcessMapMounted(true);
  }, [activeTab, processMapMounted]);

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

  async function unlinkMetric(metricId: number) {
    await supabase
      .from("metric_processes")
      .delete()
      .eq("metric_id", metricId)
      .eq("process_id", Number(id));
    setUnlinkConfirmId(null);
    fetchProcess();
  }

  // --- Survey functions ---
  async function fetchSurveys() {
    const res = await fetch(`/api/surveys?processId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setSurveys(data);
    }
  }

  async function handleDeploySurvey(surveyId: number, scheduleOptions?: { openAt?: string; closeAfterDays?: number }) {
    setSurveyDeploying(surveyId);
    const res = await fetch(`/api/surveys/${surveyId}/waves`, {
      method: "POST",
      ...(scheduleOptions
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scheduleOptions),
          }
        : {}),
    });
    if (res.ok) {
      fetchSurveys();
    }
    setSurveyDeploying(null);
  }

  async function handleCloseSurveyWave(surveyId: number, waveId: number) {
    setSurveyClosing(surveyId);
    const res = await fetch(`/api/surveys/${surveyId}/waves`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waveId }),
    });
    if (res.ok) {
      fetchSurveys();
      fetchProcess(); // Refresh metrics in case auto-entries were created
    }
    setSurveyClosing(null);
  }

  function handleEditSurvey(survey: typeof surveys[0]) {
    router.push(`/surveys/${survey.id}/edit?processId=${id}`);
  }

  async function handleDeleteSurvey(surveyId: number) {
    const res = await fetch(`/api/surveys?id=${surveyId}`, { method: "DELETE" });
    if (res.ok) {
      fetchSurveys();
    }
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
        <p className="text-text-muted text-lg">Process not found</p>
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/processes"
        className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
      >
        &larr; Back to Processes
      </Link>

      {/* Header */}
      <div id="section-top" className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-nia-dark">{process.name}</h1>
            {process.is_key && (
              <Badge color="orange" size="sm">★ Key Process</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-text-tertiary">
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
          <Button variant="success" size="sm" onClick={() => setAsanaConfirm(true)}>
            {process.asana_project_gid ? "Sync to Asana" : "Export to Asana"}
          </Button>
          <Button size="sm" href={`/processes/${process.id}/edit`}>Edit</Button>
          {isAdmin && <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>Delete</Button>}
        </div>
      </div>

      {/* Asana export result */}
      {asanaResult && (
        <div className="success-celebrate bg-nia-green/20 border border-nia-green rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-nia-dark">
              {asanaResult.action === "created" ? "Exported to new Asana project!" : "Synced to Asana!"}
              {(asanaResult.adliCreated || asanaResult.adliUpdated) ? (
                <span className="text-xs text-nia-grey-blue ml-2">
                  ({asanaResult.adliCreated ? `${asanaResult.adliCreated} ADLI docs created` : ""}
                  {asanaResult.adliCreated && asanaResult.adliUpdated ? ", " : ""}
                  {asanaResult.adliUpdated ? `${asanaResult.adliUpdated} updated` : ""})
                </span>
              ) : null}
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
          {asanaResult.adliCreated === 0 && asanaResult.adliUpdated === 0 && (
            <p className="text-xs text-amber-700 mt-2">Warning: No ADLI documentation tasks were synced. Check Vercel logs for details.</p>
          )}
          {asanaResult.warning && (
            <p className="text-xs text-amber-700 mt-2">{asanaResult.warning}</p>
          )}
        </div>
      )}

      {/* Asana export error */}
      {asanaError && (
        <div className="banner-enter bg-nia-red/10 border border-nia-red/30 rounded-lg p-3 text-sm text-nia-red">
          {asanaError}
        </div>
      )}

      {/* Asana export dialog — radio-based option picker */}
      {asanaConfirm && (
        <div className="bg-nia-grey-blue/10 border border-nia-grey-blue rounded-lg p-4">
          <p className="text-sm text-nia-dark mb-3 font-medium">Export to Asana</p>
          <div className="space-y-2 mb-4">
            {process.asana_project_gid && (
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!asanaPickerOpen && !asanaExporting ? "border-nia-grey-blue bg-card" : "border-border hover:border-nia-grey-blue/50"}`}>
                <input
                  type="radio"
                  name="asana-export"
                  checked={!asanaPickerOpen}
                  onChange={() => setAsanaPickerOpen(false)}
                  className="mt-0.5 accent-[#55787c]"
                />
                <div>
                  <p className="text-sm font-medium text-nia-dark">Sync linked project</p>
                  <p className="text-xs text-text-tertiary">Update the currently linked Asana project with latest content</p>
                </div>
              </label>
            )}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${asanaPickerOpen ? "border-nia-grey-blue bg-card" : "border-border hover:border-nia-grey-blue/50"}`}>
              <input
                type="radio"
                name="asana-export"
                checked={asanaPickerOpen}
                onChange={() => { setAsanaPickerOpen(true); loadAsanaProjects(); }}
                className="mt-0.5 accent-[#55787c]"
              />
              <div>
                <p className="text-sm font-medium text-nia-dark">Link to existing project</p>
                <p className="text-xs text-text-tertiary">Choose an Asana project to connect</p>
              </div>
            </label>
          </div>

          {/* Project picker — shown when "Link to existing" is selected */}
          {asanaPickerOpen && (
            <div className="mb-4">
              {asanaProjectsLoading && (
                <p className="text-sm text-nia-grey-blue py-2">Loading projects...</p>
              )}
              {!asanaProjectsLoading && asanaProjects.length > 0 && (
                <>
                  <Input value={asanaSearch} onChange={(e) => setAsanaSearch(e.target.value)} placeholder="Search projects..." className="mb-3" />
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                    {asanaProjects
                      .filter((p) => p.name.toLowerCase().includes(asanaSearch.toLowerCase()))
                      .map((project) => (
                        <div
                          key={project.gid}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border-light hover:border-nia-grey-blue/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-nia-dark truncate">{project.name}</p>
                            <div className="flex gap-3 text-xs text-text-muted">
                              {project.team && <span>{project.team}</span>}
                              {project.modified_at && (
                                <span>Updated {new Date(project.modified_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <Button size="xs" onClick={() => handleLinkToProject(project.gid)} disabled={asanaExporting} loading={asanaExporting} className="flex-shrink-0">
                            {asanaExporting ? "Linking..." : "Link & Sync"}
                          </Button>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {!asanaProjectsLoading && asanaProjects.length === 0 && !asanaError && (
                <p className="text-sm text-text-muted py-2">No projects found in your Asana workspace.</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!asanaPickerOpen && (
              <Button size="sm" onClick={() => handleAsanaExport(false)} disabled={asanaExporting} loading={asanaExporting}>
                {asanaExporting ? "Syncing..." : process.asana_project_gid ? "Sync Now" : "Create New Project"}
              </Button>
            )}
            {!process.asana_project_gid && !asanaPickerOpen && (
              <Button size="sm" onClick={() => handleAsanaExport(true)} disabled={asanaExporting} loading={asanaExporting}>
                {asanaExporting ? "Creating..." : "Create New Project"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setAsanaConfirm(false); setAsanaPickerOpen(false); setAsanaSearch(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Asana resync result */}
      {asanaResyncResult && (
        <div className="banner-enter bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-blue-300">
            Asana data refreshed: {asanaResyncResult.tasks} tasks, {asanaResyncResult.subtasks} subtasks loaded. AI coach now has full context.
          </p>
          <Button variant="ghost" size="xs" onClick={() => setAsanaResyncResult(null)} className="ml-3">Dismiss</Button>
        </div>
      )}

      {/* Asana link */}
      {process.asana_project_url && !asanaConfirm && !asanaResult && (
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <span>Linked to Asana:</span>
          <a
            href={process.asana_project_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nia-grey-blue hover:text-nia-dark font-medium"
          >
            View project &rarr;
          </a>
          <span className="text-text-muted">|</span>
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
        <ConfirmDeleteModal
          title={`Delete "${process.name}"?`}
          description="This cannot be undone. Linked metrics will be preserved but unlinked from this process."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}

      {/* Milestone Celebrations */}
      <MilestoneToast
        processId={process.id}
        processName={process.name}
        health={healthResult}
        hasImprovements={improvements.length > 0}
        hasAsanaLink={!!process.asana_project_gid}
        allMetricsCurrent={metrics.length > 0 && metrics.every((m) => m.review_status === "current")}
      />

      {/* Improvement Stepper — or Asana nudge for unlinked processes */}
      {process.asana_project_gid && process.guided_step ? (
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
          onAction={async (step, _actionKey, prompt) => {
            // 1. Update guided_step
            const res = await fetch("/api/processes/step", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ processId: process.id, step }),
            });
            if (res.ok) {
              setProcess((prev) => prev ? { ...prev, guided_step: step } : prev);
            }
            // 2. Find the action definition for scroll/tab info
            const stepDef = STEPS.find((s) => s.key === step);
            const actionDef = stepDef?.actions.find((a) => a.key === _actionKey);
            // 3. Switch to the correct tab
            if (actionDef?.switchTab) {
              setActiveTab(actionDef.switchTab);
            } else if (actionDef?.scrollTarget) {
              setActiveTab(getTabForScrollTarget(actionDef.scrollTarget));
            }
            // 4. Send prompt to AI panel
            setPendingPrompt(prompt);
            // 5. Scroll to relevant section after a short delay
            setTimeout(() => {
              const target = actionDef?.scrollTarget || "section-top";
              document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 200);
          }}
        />
      ) : !process.asana_project_gid ? (
        <div className="relative bg-card rounded-xl shadow-sm border border-nia-orange/20 overflow-hidden">
          {/* Warm gradient accent on left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-nia-orange to-nia-green" />
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nia-orange/10 to-nia-green/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5.5 h-5.5 text-nia-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-nia-dark">Unlock guided coaching</p>
              <p className="text-xs text-text-tertiary mt-0.5">Link to Asana for step-by-step AI guidance through the improvement cycle.</p>
            </div>
            {hasAsanaToken === false ? (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1 text-sm font-semibold text-nia-orange hover:text-nia-dark transition-colors whitespace-nowrap"
              >
                Connect Asana
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <button
                onClick={() => setAsanaConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-nia-orange hover:bg-nia-orange-dark px-3.5 py-2 rounded-lg transition-all duration-150 shadow-sm hover:shadow whitespace-nowrap"
              >
                Link to Asana
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-subtle rounded-lg p-1 overflow-x-auto">
        {([
          { key: "overview", label: "Overview" },
          { key: "documentation", label: "Documentation" },
          { key: "process-map", label: "Process Map" },
          { key: "tasks", label: "Tasks", badge: taskCount > 0 ? taskCount : null },
          { key: "history", label: "History", badge: improvements.length > 0 ? improvements.length : null },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-sm font-medium rounded-md py-2 px-3 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-card text-nia-dark shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
            {"badge" in tab && tab.badge ? (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-nia-orange text-white">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Health + ADLI + Metrics */}
          <div className="space-y-6">
            {healthResult && <ProcessHealthCard health={healthResult} />}
            {adliScoreData ? (
        <div className="bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">ADLI Maturity</h3>
            <AdliScoringInfo />
          </div>
          <div className="flex flex-col sm:flex-row">
            {/* Radar — centered, properly sized */}
            <div className="flex items-center justify-center px-4 pt-2 pb-2 sm:py-3 sm:pl-5 sm:pr-2">
              <AdliRadar
                approach={adliScoreData.approach_score}
                deployment={adliScoreData.deployment_score}
                learning={adliScoreData.learning_score}
                integration={adliScoreData.integration_score}
                size={160}
                showLabels={true}
                color="#55787c"
              />
            </div>
            {/* Score details */}
            <div className="flex-1 px-5 pb-5 sm:py-5 sm:pl-2 flex flex-col justify-center">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-gradient tabular-nums">{adliScoreData.overall_score}</span>
                <span className="text-sm font-medium text-text-muted">/100</span>
              </div>
              {/* Dimension mini-bars */}
              <div className="space-y-1.5">
                {([
                  { key: "Approach", score: adliScoreData.approach_score, color: "#f79935" },
                  { key: "Deployment", score: adliScoreData.deployment_score, color: "#55787c" },
                  { key: "Learning", score: adliScoreData.learning_score, color: "#b1bd37" },
                  { key: "Integration", score: adliScoreData.integration_score, color: "#324a4d" },
                ] as const).map((dim) => (
                  <div key={dim.key} className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold w-3 text-center" style={{ color: dim.color }}>
                      {dim.key[0]}
                    </span>
                    <div className="flex-1 bg-surface-subtle rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${dim.score}%`, backgroundColor: dim.color }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-text-muted w-6 text-right tabular-nums">{dim.score}</span>
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light">
                <span className="text-[10px] text-text-muted">
                  Assessed {new Date(adliScoreData.assessed_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => setPendingPrompt("Run a fresh ADLI assessment. Score each dimension and compare to where we started. What's improved and what still needs work?")}
                  className="text-[11px] font-medium text-nia-grey-blue hover:text-nia-dark transition-colors"
                >
                  Re-assess &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
          <div className="relative px-5 py-6 flex flex-col items-center text-center">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, var(--nia-grey-blue) 1px, transparent 0)`,
              backgroundSize: "20px 20px",
            }} />
            {/* Empty radar placeholder */}
            <div className="relative mb-3">
              <AdliRadar approach={0} deployment={0} learning={0} integration={0} size={100} showLabels={false} color="var(--grid-line-strong)" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-text-muted">?</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-sm font-semibold text-nia-dark">No ADLI scores yet</p>
              <AdliScoringInfo />
            </div>
            <p className="text-xs text-text-tertiary max-w-[280px] mb-4">
              Run your first assessment to see maturity scores across all four dimensions.
            </p>
            <button
              onClick={() => setPendingPrompt("Run a full ADLI assessment. Score each dimension (Approach, Deployment, Learning, Integration) from 0-100. Identify the weakest dimensions and suggest the 2-3 most impactful improvements with effort estimates.")}
              className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-nia-dark-solid hover:bg-nia-grey-blue px-4 py-2 rounded-lg transition-all duration-150 shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Assessment
            </button>
          </div>
        </div>
      )}

            {/* Metrics & Results */}
            <Card accent="orange" id="section-metrics">
              <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
                <h2 className="text-lg font-semibold text-nia-dark">Metrics & Results ({metrics.length})</h2>
                <Button variant="secondary" size="xs" onClick={() => { setMetricDialogOpen(true); fetchAvailableMetrics(); }}>+ Add</Button>
              </div>
              <div className="px-4 py-3">
                {metrics.length > 0 ? (
                  <div className="space-y-2">
                    {metrics.map((m) => {
                      const sparkData = m.sparkline.map((v, i) => ({ i, v }));
                      const first = m.sparkline[0];
                      const last = m.sparkline[m.sparkline.length - 1];
                      const trend = m.sparkline.length >= 2 ? (last > first ? "up" : last < first ? "down" : "flat") : null;
                      const improving = trend && ((trend === "up" && m.is_higher_better) || (trend === "down" && !m.is_higher_better));
                      const sparkColor = improving ? "#b1bd37" : trend === "flat" ? "#55787c" : trend ? "#dc2626" : "var(--text-muted)";
                      return (
                        <div key={m.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors">
                          <Link href={`/metric/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(m.review_status) }} title={getStatusLabel(m.review_status)} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-nia-dark">{m.name}</span>
                              <span className="text-xs text-text-muted ml-2 capitalize">{m.cadence}</span>
                            </div>
                            {m.sparkline.length >= 2 ? (
                              <div className="w-16 h-6 flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%"><LineChart data={sparkData}><Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
                              </div>
                            ) : (
                              <span className="text-text-muted text-xs w-16 text-center flex-shrink-0">&mdash;</span>
                            )}
                            <div className="text-right flex-shrink-0 w-24">
                              {m.last_value !== null ? (
                                <>
                                  <div className="text-sm font-medium text-nia-dark">{formatValue(m.last_value, m.unit)}</div>
                                  {m.on_target !== null && <div className="text-xs" style={{ color: m.on_target ? "#b1bd37" : "#dc2626" }}>{m.on_target ? "On Target" : "Below"}</div>}
                                </>
                              ) : (
                                <span className="text-xs text-text-muted">No data</span>
                              )}
                            </div>
                            <Badge color={m.review_status === "current" ? "green" : m.review_status === "overdue" ? "red" : m.review_status === "due-soon" ? "orange" : "gray"} size="xs" className="flex-shrink-0">{getStatusLabel(m.review_status)}</Badge>
                          </Link>
                          {unlinkConfirmId === m.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => unlinkMetric(m.id)} className="text-xs text-nia-red hover:text-nia-red font-medium px-1.5 py-0.5 rounded hover:bg-nia-red/10">Unlink</button>
                              <button onClick={() => setUnlinkConfirmId(null)} className="text-xs text-text-muted hover:text-text-secondary px-1.5 py-0.5">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setUnlinkConfirmId(m.id)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-nia-red transition-all flex-shrink-0 p-1" title="Unlink metric from this process">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-6 px-4">
                    <h3 className="text-sm font-semibold text-nia-dark mb-1">No metrics linked</h3>
                    <p className="text-xs text-text-tertiary mb-3">Add metrics to track results and build LeTCI evidence for this process.</p>
                    <Button size="sm" onClick={() => { setMetricDialogOpen(true); fetchAvailableMetrics(); }}>+ Add Metric</Button>
                  </div>
                )}
              </div>
            </Card>
          </div>{/* end left column */}

          {/* Right column: Surveys + Quick Info */}
          <div className="space-y-6">
            <Card accent="orange" id="section-surveys">
              <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
                <h2 className="text-lg font-semibold text-nia-dark">Surveys{surveys.length > 0 ? ` (${surveys.length})` : ""}</h2>
                <Button variant="secondary" size="xs" onClick={() => router.push(`/surveys/new?processId=${id}`)}>+ New</Button>
              </div>
              <div className="px-4 py-3">
                {surveys.length > 0 ? (
                  <div className="space-y-3">
                    {surveys.map((s) => (
                      <SurveyCard key={s.id} survey={s} processId={Number(id)} onDeploy={handleDeploySurvey} onClose={handleCloseSurveyWave} onEdit={handleEditSurvey} onDelete={handleDeleteSurvey} deploying={surveyDeploying === s.id} closing={surveyClosing === s.id} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-6 px-4">
                    <h3 className="text-sm font-semibold text-nia-dark mb-1">No surveys yet</h3>
                    <p className="text-xs text-text-tertiary mb-3">Create a micro-survey to collect stakeholder feedback.</p>
                    <Button size="sm" onClick={() => router.push(`/surveys/new?processId=${id}`)}>Create Survey</Button>
                  </div>
                )}
              </div>
            </Card>

            <Card accent="orange">
              <div className="px-4 py-3 border-b border-border-light">
                <h2 className="text-lg font-semibold text-nia-dark">Quick Info</h2>
              </div>
              <div className="px-4 py-3 space-y-3">
                {ebMappings.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">EB Connections</span>
                    <Link href="/criteria" className="text-sm font-medium text-nia-green hover:underline">{ebMappings.length} question{ebMappings.length !== 1 ? "s" : ""} &rarr;</Link>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Attached Files</span>
                  <span className="text-sm font-medium text-nia-dark">{attachedFiles.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Key Requirements</span>
                  <span className="text-sm font-medium text-nia-dark">{requirements.length}</span>
                </div>
                {process.asana_project_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Asana Project</span>
                    <a href={process.asana_project_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-nia-grey-blue hover:text-nia-dark">View &rarr;</a>
                  </div>
                )}
                {!process.charter?.content && process.description && (
                  <div className="pt-2 border-t border-border-light">
                    <span className="text-xs font-medium text-text-muted uppercase">Description</span>
                    <p className="text-sm text-nia-dark mt-1">{process.description}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ DOCUMENTATION TAB ═══ */}
      {activeTab === "documentation" && (
        <div className="space-y-6">
          <Card accent="orange" id="section-charter">
            <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
              <h2 className="text-lg font-semibold text-nia-dark">Charter</h2>
              <SectionEditLink processId={process.id} section="charter" />
            </div>
            <div className="px-4 py-4">
              {process.charter ? (
                <>
                  {process.charter.content ? (
                    <>
                      <MarkdownContent content={process.charter.content} />
                      {process.charter.stakeholders && process.charter.stakeholders.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border-light">
                          <span className="text-sm font-medium text-text-tertiary">Stakeholders</span>
                          <p className="text-sm text-nia-dark mt-1">
                            {process.charter.stakeholders.join(", ")}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Field label="Purpose" value={process.charter.purpose} />
                      {process.charter.stakeholders && process.charter.stakeholders.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-text-tertiary">Stakeholders</span>
                          <p className="text-sm text-nia-dark mt-1">
                            {process.charter.stakeholders.join(", ")}
                          </p>
                        </div>
                      )}
                      <Field label="Scope (Includes)" value={process.charter.scope_includes} />
                      <Field label="Scope (Excludes)" value={process.charter.scope_excludes} />
                      <Field label="Mission Alignment" value={process.charter.mission_alignment} />
                    </div>
                  )}
                </>
              ) : (
                <EmptyText />
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="section-adli">
            <AdliCard title="Approach" data={process.adli_approach} processId={process.id} section="adli_approach" />
            <AdliCard title="Deployment" data={process.adli_deployment} processId={process.id} section="adli_deployment" />
            <AdliCard title="Learning" data={process.adli_learning} processId={process.id} section="adli_learning" />
            <AdliCard title="Integration" data={process.adli_integration} processId={process.id} section="adli_integration" />
          </div>

          <Card accent="orange">
            <div className="px-4 py-3 border-b border-border-light">
              <h2 className="text-lg font-semibold text-nia-dark">Linked Key Requirements</h2>
            </div>
            <div className="px-4 py-3">
              {requirements.length > 0 ? (
                <div className="space-y-2">
                  {requirements.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-hover">
                      <span className="text-sm text-nia-dark">{r.requirement}</span>
                      <span className="text-xs text-text-muted">{r.stakeholder_group}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted italic">No key requirements linked yet. Use the Edit page to link requirements.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ PROCESS MAP TAB — mounted once viewed, kept alive via CSS hidden ═══ */}
      {processMapMounted && (
        <div id="section-workflow" className={activeTab !== "process-map" ? "hidden" : ""}>
          {process.workflow?.content ? (
            <ProcessMapView
              content={process.workflow.content}
              processName={process.name}
              onRefine={() => setPendingPrompt("The current process map needs adjustments. Here's what I'd like to change:")}
              onRegenerate={() => setPendingPrompt("Regenerate the process map from scratch based on the current charter and ADLI content. Create a fresh Mermaid flowchart.")}
            />
          ) : (
            <div className="text-center py-12">
              <svg className="w-10 h-10 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <p className="text-sm font-medium text-nia-dark mb-1">No process map yet</p>
              <p className="text-xs text-text-muted mb-4 max-w-xs mx-auto">A visual flowchart of your process steps, decision points, and outputs.</p>
              <button
                onClick={() => setPendingPrompt("Generate a process map for this process. Create a Mermaid flowchart that shows the key steps, decision points, responsible parties, and outputs based on the charter and ADLI content.")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-nia-dark-solid hover:bg-nia-grey-blue px-4 py-2 rounded-lg transition-all duration-150 shadow-sm hover:shadow"
              >
                <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Generate Process Map
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ TASKS TAB ═══ */}
      {activeTab === "tasks" && (
        <div id="section-tasks">
          <TaskReviewPanel processId={process.id} onTaskCountChange={setTaskCount} />
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {improvements.length > 0 ? (
            <Card accent="orange">
              <div className="px-4 py-3 border-b border-border-light">
                <h2 className="text-lg font-semibold text-nia-dark">Improvement History ({improvements.length})</h2>
              </div>
              <div className="px-4 py-3 space-y-3">
                {improvements.map((imp) => (
                  <ImprovementCard
                    key={imp.id}
                    improvement={imp}
                    onStatusUpdate={async (newStatus) => {
                      const res = await fetch("/api/improvements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: imp.id, status: newStatus }) });
                      if (res.ok) {
                        setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: newStatus, ...(newStatus === "implemented" ? { implemented_date: new Date().toISOString() } : {}) } : i));
                      }
                    }}
                    onDelete={async () => {
                      const res = await fetch(`/api/improvements?id=${imp.id}`, { method: "DELETE" });
                      if (res.ok) { setImprovements((prev) => prev.filter((i) => i.id !== imp.id)); }
                    }}
                  />
                ))}
              </div>
            </Card>
          ) : (
            <Card accent="orange">
              <div className="px-4 py-3 border-b border-border-light">
                <h2 className="text-lg font-semibold text-nia-dark">Improvement History</h2>
              </div>
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-text-muted">No improvements recorded yet. Use AI coaching to generate and apply improvements.</p>
              </div>
            </Card>
          )}

          {history.length > 0 && (
            <Card accent="orange">
              <div className="px-4 py-3 border-b border-border-light">
                <h2 className="text-lg font-semibold text-nia-dark">Change Log</h2>
              </div>
              <div className="px-4 py-3 space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-nia-dark">{h.change_description}</span>
                    <span className="text-text-muted text-xs">{new Date(h.changed_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {attachedFiles.length > 0 && (
            <Card accent="orange">
              <div className="px-4 py-3 border-b border-border-light">
                <h2 className="text-lg font-semibold text-nia-dark">Attached Files ({attachedFiles.length})</h2>
              </div>
              <div className="px-4 py-3">
                <div className="space-y-1">
                  {attachedFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between py-2 px-1 border-b border-border-light last:border-b-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                        <span className="text-sm text-nia-dark truncate">{f.file_name}</span>
                        <span className="text-xs text-text-muted flex-shrink-0">{f.file_size < 1024 ? `${f.file_size} B` : f.file_size < 1048576 ? `${Math.round(f.file_size / 1024)} KB` : `${(f.file_size / 1048576).toFixed(1)} MB`}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-text-muted">{new Date(f.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <button onClick={async () => { const res = await fetch(`/api/ai/files?fileId=${f.id}`, { method: "DELETE" }); if (res.ok) { setAttachedFiles((prev) => prev.filter((file) => file.id !== f.id)); } }} className="text-text-muted hover:text-nia-red transition-colors p-0.5" title="Delete file">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">These files are used as context for AI coaching. Upload more via the AI chat panel.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Add Metric Dialog — outside tabs so it works from any tab */}
      {metricDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setMetricDialogOpen(false); setMetricPickerOpen(false); setMetricSearch(""); }}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-light">
              <h3 className="text-lg font-semibold text-nia-dark">Add Metric</h3>
              <p className="text-sm text-text-tertiary mt-1">Link an existing metric or create a new one for this process.</p>
            </div>
            {!metricPickerOpen ? (
              <div className="p-5 space-y-3">
                <button onClick={() => setMetricPickerOpen(true)} className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-nia-grey-blue hover:bg-nia-grey-blue/5 transition-colors group">
                  <div className="text-sm font-medium text-nia-dark group-hover:text-nia-grey-blue">Link Existing Metric</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Choose from metrics not already linked to this process</div>
                </button>
                <Link href={`/metric/new?processId=${id}`} className="block w-full text-left px-4 py-3 rounded-lg border border-border hover:border-nia-grey-blue hover:bg-nia-grey-blue/5 transition-colors group">
                  <div className="text-sm font-medium text-nia-dark group-hover:text-nia-grey-blue">Create New Metric</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Build a new metric and link it to this process</div>
                </Link>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <Button variant="ghost" size="xs" onClick={() => setMetricPickerOpen(false)}>← Back</Button>
                <Input placeholder="Search metrics..." value={metricSearch} onChange={(e) => setMetricSearch(e.target.value)} autoFocus />
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {availableMetrics.filter((m) => m.name.toLowerCase().includes(metricSearch.toLowerCase())).map((m) => (
                    <button key={m.id} onClick={() => linkExistingMetric(m.id)} disabled={linkingMetric === m.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors flex items-center justify-between disabled:opacity-50">
                      <div>
                        <div className="text-sm font-medium text-nia-dark">{m.name}</div>
                        <div className="text-xs text-text-muted capitalize">{m.cadence} · {m.unit}</div>
                      </div>
                      {linkingMetric === m.id ? <span className="text-xs text-text-muted">Linking...</span> : <span className="text-xs text-nia-grey-blue font-medium">Link</span>}
                    </button>
                  ))}
                  {availableMetrics.filter((m) => m.name.toLowerCase().includes(metricSearch.toLowerCase())).length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-text-tertiary">No unlinked metrics found</p>
                      <Link href={`/metric/new?processId=${id}`} className="text-sm text-nia-grey-blue hover:underline mt-1 inline-block">Create a new metric instead</Link>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="px-5 py-3 border-t border-border-light">
              <Button variant="ghost" size="sm" onClick={() => { setMetricDialogOpen(false); setMetricPickerOpen(false); setMetricSearch(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Panel */}
      <AiChatPanel processId={process.id} processName={process.name} onProcessUpdated={fetchProcess} autoAnalyze={autoAnalyze} guidedStep={process.guided_step} pendingPrompt={pendingPrompt} onPromptConsumed={() => setPendingPrompt(null)} />
    </div>
  );
}

// Helper components

function EmptyText() {
  return (
    <p className="text-sm text-text-muted italic">Not yet documented</p>
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
      <span className="text-sm font-medium text-text-tertiary">{label}</span>
      <p className="text-nia-dark mt-0.5">
        {value || (
          <span className="text-sm text-text-muted italic">
            Not yet documented
          </span>
        )}
      </p>
    </div>
  );
}

// Always-expanded ADLI card for the Documentation tab (no collapsible wrapper)
function AdliCard({
  title,
  data,
  processId,
  section,
}: {
  title: string;
  data: AdliApproach | AdliDeployment | AdliLearning | AdliIntegration | null;
  processId: number;
  section: string;
}) {
  return (
    <Card accent="orange">
      <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
        <h2 className="text-lg font-semibold text-nia-dark">ADLI: {title}</h2>
        <SectionEditLink processId={processId} section={section} />
      </div>
      <div className="px-4 py-4">
        {!data ? (
          <EmptyText />
        ) : "content" in data && data.content ? (
          <MarkdownContent content={data.content} />
        ) : (
          <div className="space-y-3">
            {Object.entries(data).map(([key, value]) => {
              if (key === "content") return null;
              const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              if (Array.isArray(value)) {
                return value.length > 0 ? (
                  <div key={key}>
                    <span className="text-sm font-medium text-text-tertiary">{label}</span>
                    <ul className="list-disc list-inside mt-1 text-nia-dark">
                      {value.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                ) : null;
              }
              return value ? <Field key={key} label={label} value={value as string} /> : null;
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// Small pencil icon that links to the edit page for a specific section
function SectionEditLink({ processId, section }: { processId: number; section: string }) {
  return (
    <Link
      href={`/processes/${processId}/edit#${section}`}
      className="text-text-muted hover:text-nia-dark transition-colors p-1 rounded hover:bg-surface-hover"
      title={`Edit ${section.replace(/_/g, " ")}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    </Link>
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
    <div className="border border-border-light rounded-lg p-3 hover:border-border transition-colors">
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
            <span className="text-xs text-text-muted" title="AI suggestion">AI</span>
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
        <p className="text-xs text-text-tertiary mt-1.5">{improvement.description}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-text-muted">
          {new Date(improvement.committed_date).toLocaleDateString()}
          {improvement.implemented_date && (
            <> &middot; Implemented {new Date(improvement.implemented_date).toLocaleDateString()}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          {(improvement.before_snapshot || improvement.after_snapshot) && (
            <Button variant="ghost" size="xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide details" : "Show details"}
            </Button>
          )}
          {nextAction && (
            <Button variant="ghost" size="xs" onClick={() => onStatusUpdate(nextAction)}>
              {nextAction === "in_progress" ? "Start" : "Mark Done"}
            </Button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-text-muted hover:text-nia-red transition-colors"
            title="Delete improvement"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="mt-2 p-2 bg-nia-red/10 border border-nia-red/30 rounded-lg flex items-center justify-between">
          <span className="text-xs text-nia-red">Delete this improvement?</span>
          <div className="flex gap-2">
            <Button variant="danger" size="xs" onClick={onDelete}>Delete</Button>
            <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {expanded && (improvement.before_snapshot || improvement.after_snapshot) && (
        <div className="mt-3 pt-3 border-t border-border-light grid grid-cols-2 gap-3">
          {improvement.before_snapshot && (
            <div>
              <span className="text-xs font-medium text-text-muted uppercase">Before</span>
              <pre className="text-xs text-text-secondary mt-1 bg-surface-hover rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                {typeof improvement.before_snapshot === "object" && (improvement.before_snapshot as Record<string, unknown>).content
                  ? String((improvement.before_snapshot as Record<string, unknown>).content).slice(0, 500)
                  : JSON.stringify(improvement.before_snapshot, null, 2).slice(0, 500)}
              </pre>
            </div>
          )}
          {improvement.after_snapshot && (
            <div>
              <span className="text-xs font-medium text-text-muted uppercase">After</span>
              <pre className="text-xs text-text-secondary mt-1 bg-surface-hover rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
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

// ─── Process Map View with Download ──────────────────────────────

function ProcessMapView({ content, processName, onRefine, onRegenerate }: { content: string; processName: string; onRefine: () => void; onRegenerate: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadSVG() {
    if (!mapRef.current) return;
    const svg = mapRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${processName.replace(/[^a-zA-Z0-9]/g, "-")}-process-map.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPNG() {
    if (!mapRef.current) return;
    const svg = mapRef.current.querySelector("svg");
    if (!svg) return;
    setDownloading(true);

    try {
      // Get SVG dimensions
      const bbox = svg.getBoundingClientRect();
      const scale = 2; // 2x for retina quality
      const canvas = document.createElement("canvas");
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);

      // Draw SVG onto canvas
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });

      URL.revokeObjectURL(url);

      // Download as PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${processName.replace(/[^a-zA-Z0-9]/g, "-")}-process-map.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div ref={mapRef}>
        <MarkdownContent content={content} />
      </div>
      {/* Unified toolbar — downloads + AI actions */}
      <div className="mt-3 pt-3 border-t border-border-light flex flex-wrap items-center gap-2">
        <button
          onClick={downloadSVG}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-nia-grey-blue bg-nia-grey-blue/8 hover:bg-nia-grey-blue/15 px-3 py-1.5 rounded-full transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          SVG
        </button>
        <button
          onClick={downloadPNG}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-nia-grey-blue bg-nia-grey-blue/8 hover:bg-nia-grey-blue/15 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? "Exporting..." : "PNG"}
        </button>
        <span className="w-px h-4 bg-surface-muted mx-1" />
        <button
          onClick={onRefine}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-nia-dark bg-nia-green/15 hover:bg-nia-green/25 px-3 py-1.5 rounded-full transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          Refine with AI
        </button>
        <button
          onClick={onRegenerate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary bg-surface-subtle hover:bg-surface-muted px-3 py-1.5 rounded-full transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Regenerate
        </button>
      </div>
    </div>
  );
}
