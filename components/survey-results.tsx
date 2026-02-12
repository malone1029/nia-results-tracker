"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Badge } from "@/components/ui";
import dynamic from "next/dynamic";

// Lazy-load QR modal (only needed when user clicks QR button)
const SurveyQrModal = dynamic(() => import("@/components/survey-qr-modal"), {
  ssr: false,
});

interface SurveyWave {
  id: number;
  wave_number: number;
  status: string;
  share_token: string;
  opened_at: string;
  closed_at: string | null;
  response_count: number;
  scheduled_open_at?: string | null;
  scheduled_close_at?: string | null;
}

interface SurveyData {
  id: number;
  title: string;
  description: string | null;
  is_public: boolean;
  is_anonymous: boolean;
  question_count: number;
  latest_wave: SurveyWave | null;
  created_at: string;
  response_target?: number | null;
  recurrence_enabled?: boolean;
  recurrence_cadence?: string | null;
}

interface QuestionResult {
  question_id: number;
  question_text: string;
  question_type: string;
  avg_value: number;
  response_count: number;
  distribution?: number[];
  previous_avg?: number | null;
  // NPS
  nps_score?: number;
  nps_segments?: { detractors: number; passives: number; promoters: number };
  // Multiple choice / Checkbox
  option_counts?: number[];
  option_labels?: string[];
  other_count?: number;
  other_texts?: string[];
  total_respondents?: number;
  // Open text
  text_responses?: string[];
  // Matrix
  matrix_rows?: { row_label: string; avg_value: number; response_count: number; distribution: number[] }[];
  column_labels?: string[];
}

interface WaveResults {
  wave: SurveyWave;
  questions: QuestionResult[];
  comments: string[];
}

interface SurveyResultsProps {
  survey: SurveyData;
  processId: number;
  onDeploy: (surveyId: number, scheduleOptions?: { openAt?: string; closeAfterDays?: number }) => void;
  onClose: (surveyId: number, waveId: number) => void;
  onEdit: (survey: SurveyData) => void;
  onDelete: (surveyId: number) => void;
  deploying?: boolean;
  closing?: boolean;
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SurveyCard({
  survey,
  onDeploy,
  onClose,
  onEdit,
  onDelete,
  deploying,
  closing,
}: SurveyResultsProps) {
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<WaveResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [waves, setWaves] = useState<SurveyWave[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleOpenAt, setScheduleOpenAt] = useState("");
  const [scheduleCloseAfter, setScheduleCloseAfter] = useState<number>(0);
  const [cancellingWaveId, setCancellingWaveId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const wave = survey.latest_wave;
  const isOpen = wave?.status === "open";
  const isScheduled = wave?.status === "scheduled";
  const hasMultipleWaves = wave && wave.wave_number > 1;
  const shareUrl = wave && isOpen
    ? `${window.location.origin}/survey/respond/${wave.share_token}`
    : "";

  // Scheduled waves (from the full waves list)
  const scheduledWaves = waves.filter((w) => w.status === "scheduled");

  // Response target progress
  const target = survey.response_target;
  const responseCount = wave?.response_count ?? 0;
  const targetPct = target && target > 0 ? Math.min(Math.round((responseCount / target) * 100), 100) : null;
  const closingSoon = wave?.scheduled_close_at
    ? new Date(wave.scheduled_close_at).getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000
    : false;
  const targetColor =
    targetPct !== null
      ? targetPct >= 100
        ? "bg-nia-green"
        : targetPct < 50 && closingSoon
          ? "bg-nia-orange"
          : "bg-nia-dark-solid"
      : "";

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function fetchResults(waveId: number) {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/results?waveId=${waveId}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        console.error("Failed to fetch survey results:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch survey results:", err);
    }
    setLoadingResults(false);
  }

  async function fetchWaves() {
    try {
      const res = await fetch(`/api/surveys/${survey.id}/waves`);
      if (res.ok) {
        const data = await res.json();
        setWaves(data);
      }
    } catch (err) {
      console.error("Failed to fetch survey waves:", err);
    }
  }

  function toggleResults() {
    if (!showResults && wave) {
      fetchResults(wave.id);
      fetchWaves();
    }
    setShowResults(!showResults);
  }

  function handleDeploy() {
    if (showSchedule && scheduleOpenAt) {
      // Scheduled deployment
      onDeploy(survey.id, {
        openAt: scheduleOpenAt,
        closeAfterDays: scheduleCloseAfter || undefined,
      });
    } else if (showSchedule && scheduleCloseAfter > 0) {
      // Immediate open with auto-close
      onDeploy(survey.id, {
        closeAfterDays: scheduleCloseAfter,
      });
    } else {
      // Immediate deployment (no scheduling)
      onDeploy(survey.id);
    }
    setShowSchedule(false);
    setScheduleOpenAt("");
    setScheduleCloseAfter(0);
  }

  async function cancelScheduledWave(waveId: number) {
    setCancellingWaveId(waveId);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/waves/${waveId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWaves((prev) => prev.filter((w) => w.id !== waveId));
      }
    } catch (err) {
      console.error("Failed to cancel scheduled wave:", err);
    }
    setCancellingWaveId(null);
  }

  // Load waves on mount to show scheduled ones
  useEffect(() => {
    fetchWaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.id]);

  // Inline helper components for results rendering
  function TrendArrow({ current, previous }: { current: number; previous: number }) {
    const cls = current > previous ? "text-nia-green" : current < previous ? "text-nia-red" : "text-text-muted";
    const icon = current > previous ? "\u25B2" : current < previous ? "\u25BC" : "\u2500";
    return <span className={`text-xs ${cls}`}>{icon}</span>;
  }

  function RatingBar({ distribution, count }: { distribution: number[]; count: number }) {
    const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500"];
    return (
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-muted">
        {distribution.map((c, idx) => {
          const pct = count > 0 ? (c / count) * 100 : 0;
          return pct > 0 ? (
            <div key={idx} className={colors[idx % colors.length]} style={{ width: `${pct}%` }} title={`${idx + 1}: ${c} (${Math.round(pct)}%)`} />
          ) : null;
        })}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Survey header */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-nia-dark truncate">
              {survey.title}
            </h4>
            <Badge
              color={isOpen ? "green" : isScheduled ? "blue" : wave ? "gray" : "orange"}
              size="xs"
            >
              {isOpen
                ? "Live"
                : isScheduled
                  ? "Scheduled"
                  : wave
                    ? hasMultipleWaves
                      ? `Round ${wave.wave_number} closed`
                      : "Closed"
                    : "Draft"}
            </Badge>
            {survey.recurrence_enabled && survey.recurrence_cadence && (
              <Badge color="purple" size="xs">
                Recurring: {survey.recurrence_cadence === "monthly" ? "Monthly" : "Quarterly"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-text-tertiary">
              {survey.question_count} question{survey.question_count !== 1 ? "s" : ""}
            </span>
            {wave && (
              <span className="text-xs text-text-tertiary">
                {wave.response_count} response{wave.response_count !== 1 ? "s" : ""}
              </span>
            )}
            {isScheduled && wave?.scheduled_open_at && (
              <span className="text-xs text-nia-grey-blue">
                Opens {formatDateTime(wave.scheduled_open_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOpen ? (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowLink(!showLink)}
              >
                {showLink ? "Hide" : "Share"}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                loading={closing}
                disabled={closing}
                onClick={() => onClose(survey.id, wave!.id)}
              >
                Close
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="xs"
              loading={deploying}
              disabled={deploying}
              onClick={() => {
                if (showSchedule) {
                  handleDeploy();
                } else {
                  onDeploy(survey.id);
                }
              }}
            >
              {wave ? "New Round" : "Share"}
            </Button>
          )}

          {/* Schedule toggle (only when not open) */}
          {!isOpen && (
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className={`p-1.5 rounded-md transition-colors ${
                showSchedule
                  ? "text-nia-dark bg-nia-dark/10"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-subtle"
              }`}
              title="Schedule deployment"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {wave && wave.response_count > 0 && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={toggleResults}
              >
                {showResults ? "Hide" : "Results"}
              </Button>
              <a
                href={`/surveys/${survey.id}/results?waveId=${wave.id}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-nia-green hover:text-nia-dark transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                Dashboard
              </a>
            </>
          )}

          {/* More menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-text-muted hover:text-text-secondary rounded-md hover:bg-surface-subtle"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 w-32 z-10">
                {!isOpen && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(survey); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-nia-red hover:bg-nia-red/10"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response target progress bar */}
      {isOpen && target && target > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">
              {responseCount} / {target} responses
            </span>
            <span className={`font-medium ${targetPct! >= 100 ? "text-nia-green" : "text-text-secondary"}`}>
              {targetPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-surface-muted">
            <div
              className={`h-full rounded-full transition-all ${targetColor}`}
              style={{ width: `${targetPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Schedule deployment panel */}
      {showSchedule && !isOpen && (
        <div className="px-4 py-3 border-t border-border-light bg-surface-hover space-y-3">
          <div className="text-xs font-medium text-text-secondary">Schedule Deployment</div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Open Date</label>
              <input
                type="datetime-local"
                value={scheduleOpenAt}
                onChange={(e) => setScheduleOpenAt(e.target.value)}
                className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-card text-text-secondary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Close After</label>
              <select
                value={scheduleCloseAfter}
                onChange={(e) => setScheduleCloseAfter(Number(e.target.value))}
                className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-card text-text-secondary"
              >
                <option value={0}>Never (manual)</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              loading={deploying}
              onClick={handleDeploy}
            >
              {scheduleOpenAt ? "Schedule" : wave ? "Deploy Now" : "Share Now"}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setShowSchedule(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Share link row + QR button */}
      {showLink && isOpen && (
        <div className="px-4 py-2 bg-nia-green/5 border-t border-border-light flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 text-xs bg-card border border-border rounded-md px-2.5 py-1.5 text-text-secondary select-all"
            onFocus={(e) => e.target.select()}
          />
          <Button variant="secondary" size="xs" onClick={copyLink}>
            {copied ? "Copied!" : "Copy"}
          </Button>
          <button
            onClick={() => setShowQr(true)}
            className="p-1.5 text-text-muted hover:text-nia-dark rounded-md hover:bg-surface-subtle transition-colors"
            title="Show QR Code"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
          </button>
        </div>
      )}

      {/* Scheduled waves list */}
      {scheduledWaves.length > 0 && (
        <div className="px-4 py-2 border-t border-border-light bg-surface-hover">
          <div className="text-xs font-medium text-text-muted mb-1.5">Upcoming</div>
          {scheduledWaves.map((sw) => (
            <div key={sw.id} className="flex items-center justify-between text-xs py-1">
              <span className="text-text-secondary">
                Round {sw.wave_number}
                {sw.scheduled_open_at && (
                  <> &mdash; Opens {formatDateTime(sw.scheduled_open_at)}</>
                )}
                {sw.scheduled_close_at && (
                  <>, Closes {formatDate(sw.scheduled_close_at)}</>
                )}
              </span>
              <button
                onClick={() => cancelScheduledWave(sw.id)}
                disabled={cancellingWaveId === sw.id}
                className="text-xs text-text-muted hover:text-nia-red transition-colors disabled:opacity-50"
              >
                {cancellingWaveId === sw.id ? "..." : "Cancel"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results section */}
      {showResults && (
        <div className="px-4 py-3 border-t border-border-light bg-surface-hover">
          {/* Round selector (only if multiple rounds) */}
          {waves.filter((w) => w.status !== "scheduled").length > 1 && (
            <div className="flex items-center gap-2 mb-3 overflow-x-auto">
              <span className="text-xs text-text-tertiary flex-shrink-0">Round:</span>
              {waves.filter((w) => w.status !== "scheduled").map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelectedWaveId(w.id);
                    fetchResults(w.id);
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    (selectedWaveId || wave?.id) === w.id
                      ? "bg-nia-dark-solid text-white"
                      : "bg-card text-text-secondary border border-border hover:border-text-muted"
                  }`}
                >
                  Round {w.wave_number} ({w.response_count})
                </button>
              ))}
            </div>
          )}

          {loadingResults ? (
            <div className="text-xs text-text-muted py-2">Loading results...</div>
          ) : results ? (
            <div className="space-y-3">
              {results.questions.map((q) => (
                <div key={q.question_id}>
                  {/* Question header with value + trend */}
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm text-nia-dark">{q.question_text}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {q.question_type !== "open_text" && q.question_type !== "multiple_choice" && q.question_type !== "checkbox" && (
                        <span className="text-sm font-semibold text-nia-dark">
                          {q.question_type === "yes_no"
                            ? `${Math.round(q.avg_value * 100)}%`
                            : q.question_type === "nps"
                            ? `${q.avg_value > 0 ? "+" : ""}${q.avg_value}`
                            : q.avg_value.toFixed(1)}
                        </span>
                      )}
                      {q.previous_avg != null && (
                        <TrendArrow current={q.avg_value} previous={q.previous_avg} />
                      )}
                    </div>
                  </div>

                  {/* Rating distribution bar */}
                  {q.question_type === "rating" && q.distribution && q.distribution.length > 0 && (
                    <RatingBar distribution={q.distribution} count={q.response_count} />
                  )}

                  {/* Yes/No bar */}
                  {q.question_type === "yes_no" && (
                    <div className="flex h-2 rounded-full overflow-hidden bg-surface-muted">
                      <div className="bg-green-500" style={{ width: `${q.avg_value * 100}%` }} />
                    </div>
                  )}

                  {/* NPS segments */}
                  {q.question_type === "nps" && q.nps_segments && (
                    <div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-surface-muted">
                        {q.response_count > 0 && (
                          <>
                            <div className="bg-red-400" style={{ width: `${(q.nps_segments.detractors / q.response_count) * 100}%` }} title={`Detractors: ${q.nps_segments.detractors}`} />
                            <div className="bg-yellow-400" style={{ width: `${(q.nps_segments.passives / q.response_count) * 100}%` }} title={`Passives: ${q.nps_segments.passives}`} />
                            <div className="bg-green-500" style={{ width: `${(q.nps_segments.promoters / q.response_count) * 100}%` }} title={`Promoters: ${q.nps_segments.promoters}`} />
                          </>
                        )}
                      </div>
                      <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                        <span className="text-red-400">Detractors {q.nps_segments.detractors}</span>
                        <span className="text-yellow-500">Passives {q.nps_segments.passives}</span>
                        <span className="text-green-500">Promoters {q.nps_segments.promoters}</span>
                      </div>
                    </div>
                  )}

                  {/* Multiple Choice / Checkbox — option bars */}
                  {(q.question_type === "multiple_choice" || q.question_type === "checkbox") && q.option_counts && q.option_labels && (
                    <div className="space-y-1">
                      {q.option_labels.map((label, idx) => {
                        const count = q.option_counts![idx] || 0;
                        const total = q.response_count;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-text-secondary truncate">{label}</span>
                              <span className="text-text-muted ml-2 flex-shrink-0">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-surface-muted">
                              <div className="h-full bg-nia-grey-blue rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {q.other_count != null && q.other_count > 0 && (
                        <div className="text-xs text-text-muted mt-1">
                          + {q.other_count} &ldquo;Other&rdquo; response{q.other_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Open Text — response list */}
                  {q.question_type === "open_text" && q.text_responses && q.text_responses.length > 0 && (
                    <div className="space-y-1">
                      {q.text_responses.slice(0, 5).map((text, i) => (
                        <p key={i} className="text-xs text-text-secondary bg-card rounded-md px-2.5 py-1.5 border border-border-light">
                          &ldquo;{text}&rdquo;
                        </p>
                      ))}
                      {q.text_responses.length > 5 && (
                        <p className="text-xs text-text-muted">+ {q.text_responses.length - 5} more responses</p>
                      )}
                    </div>
                  )}

                  {/* Matrix — per-row averages */}
                  {q.question_type === "matrix" && q.matrix_rows && q.column_labels && (
                    <div className="space-y-1.5">
                      {q.matrix_rows.map((row, idx) => (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-text-secondary">{row.row_label}</span>
                            <span className="text-text-muted font-medium">{row.avg_value.toFixed(1)}</span>
                          </div>
                          <RatingBar distribution={row.distribution} count={row.response_count} />
                        </div>
                      ))}
                      <div className="flex gap-2 mt-1 text-[10px] text-text-muted flex-wrap">
                        {q.column_labels.map((label, idx) => (
                          <span key={idx}>{idx}: {label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {results.comments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <h5 className="text-xs font-medium text-text-tertiary mb-1.5">Comments</h5>
                  <div className="space-y-1.5">
                    {results.comments.map((c, i) => (
                      <p key={i} className="text-xs text-text-secondary bg-card rounded-md px-2.5 py-1.5 border border-border-light">
                        &ldquo;{c}&rdquo;
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-text-muted py-2">No results available yet.</div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-3 border-t border-nia-red/20 bg-nia-red/10 flex items-center justify-between gap-2">
          <span className="text-sm text-nia-red">
            Delete this survey and all responses?
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="xs"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete(survey.id);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQr && shareUrl && (
        <SurveyQrModal
          url={shareUrl}
          surveyTitle={survey.title}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
