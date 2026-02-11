"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminGuard from "@/components/admin-guard";
import DraftPanel from "@/components/draft-panel";

/* ---------- types ---------- */
interface Mapping {
  id: number;
  process_id: number;
  question_id: number;
  coverage: "primary" | "supporting" | "partial";
  notes: string | null;
  mapped_by: string;
  processes: { id: number; name: string; owner: string | null; baldrige_item: string | null } | null;
}

interface Question {
  id: number;
  item_id: number;
  question_code: string;
  area_label: string;
  question_text: string;
  question_type: string;
  tier: "excellence_builder" | "full";
  mappings: Mapping[];
}

interface Item {
  id: number;
  item_code: string;
  item_name: string;
  category_number: number;
  category_name: string;
  item_type: string;
  points: number;
  questions: Question[];
  totalQuestions: number;
  mappedQuestions: number;
  coveragePct: number;
}

/* ---------- constants ---------- */
const COVERAGE_COLORS = {
  primary: "bg-nia-green text-nia-dark",
  supporting: "bg-blue-100 text-blue-700",
  partial: "bg-nia-orange/20 text-nia-orange",
};

const COVERAGE_BAR_COLORS: Record<string, string> = {
  full: "bg-nia-green",
  partial: "bg-nia-orange",
  none: "bg-nia-red/30",
};

function coverageBarColor(pct: number) {
  if (pct >= 80) return COVERAGE_BAR_COLORS.full;
  if (pct > 0) return COVERAGE_BAR_COLORS.partial;
  return COVERAGE_BAR_COLORS.none;
}

/* ---------- AI suggestion types ---------- */
interface AiSuggestion {
  process_id: number;
  process_name: string;
  coverage: "primary" | "supporting" | "partial";
  rationale: string;
}

/* ---------- component ---------- */
export default function CriteriaMapPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // AI suggestion state
  const [suggestingFor, setSuggestingFor] = useState<number | null>(null); // question_id being analyzed
  const [suggestions, setSuggestions] = useState<Map<number, AiSuggestion[]>>(new Map());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");

  // Tier filter
  const [tierFilter, setTierFilter] = useState<"excellence_builder" | "full" | "all">("excellence_builder");

  // Draft state
  const [draftPanel, setDraftPanel] = useState<Item | null>(null);
  const [latestDrafts, setLatestDrafts] = useState<Map<number, { word_count: number; status: string }>>(new Map());

  const fetchDrafts = useCallback(async () => {
    try {
      const tier = tierFilter !== "all" ? tierFilter : "excellence_builder";
      const res = await fetch(`/api/criteria/drafts?tier=${tier}`);
      if (res.ok) {
        const data = await res.json();
        const map = new Map<number, { word_count: number; status: string }>();
        for (const d of data) {
          map.set(d.item_id, { word_count: d.word_count, status: d.status });
        }
        setLatestDrafts(map);
      }
    } catch { /* silent */ }
  }, [tierFilter]);

  const fetchData = useCallback(async () => {
    try {
      const [criteriaRes] = await Promise.all([
        fetch("/api/criteria"),
        fetchDrafts(),
      ]);
      if (criteriaRes.ok) {
        const data = await criteriaRes.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchDrafts]);

  useEffect(() => {
    document.title = "Criteria Map | NIA Excellence Hub";
    fetchData();
  }, [fetchData]);

  // Filter items by tier (filter questions within each item, recompute stats)
  const filteredItems = tierFilter === "all" ? items : items.map((item) => {
    const questions = item.questions.filter((q) => q.tier === tierFilter);
    const totalQuestions = questions.length;
    const mappedQuestions = questions.filter((q) =>
      q.mappings.some((m) => m.coverage === "primary")
    ).length;
    return {
      ...item,
      questions,
      totalQuestions,
      mappedQuestions,
      coveragePct: totalQuestions > 0 ? Math.round((mappedQuestions / totalQuestions) * 100) : 0,
    };
  }).filter((item) => item.totalQuestions > 0); // Hide items with 0 questions in this tier

  // Group items by category
  const categories = filteredItems.reduce(
    (acc, item) => {
      const key = item.category_number;
      if (!acc[key]) {
        acc[key] = {
          number: key,
          name: item.category_name,
          items: [],
          totalPoints: 0,
          totalQuestions: 0,
          mappedQuestions: 0,
        };
      }
      acc[key].items.push(item);
      acc[key].totalPoints += item.points;
      acc[key].totalQuestions += item.totalQuestions;
      acc[key].mappedQuestions += item.mappedQuestions;
      return acc;
    },
    {} as Record<
      number,
      {
        number: number;
        name: string;
        items: Item[];
        totalPoints: number;
        totalQuestions: number;
        mappedQuestions: number;
      }
    >
  );

  // Overall stats (computed from filtered items)
  const totalQuestions = filteredItems.reduce((s, i) => s + i.totalQuestions, 0);
  const mappedQuestions = filteredItems.reduce((s, i) => s + i.mappedQuestions, 0);
  const overallPct = totalQuestions > 0 ? Math.round((mappedQuestions / totalQuestions) * 100) : 0;
  const totalPoints = filteredItems.reduce((s, i) => s + i.points, 0);
  const coveredPoints = filteredItems
    .filter((i) => i.coveragePct >= 80)
    .reduce((s, i) => s + i.points, 0);

  // Page budget from saved drafts
  const totalDraftWords = [...latestDrafts.values()].reduce((s, d) => s + d.word_count, 0);
  const estPages = Math.round((totalDraftWords / 500) * 10) / 10; // ~500 words/page

  function toggleItem(itemId: number) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleQuestion(questionId: number) {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  async function removeMapping(mappingId: number) {
    const res = await fetch(`/api/criteria/mappings?id=${mappingId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchData();
  }

  async function suggestMappings(questionId: number) {
    setSuggestingFor(questionId);
    // Also expand the question
    setExpandedQuestions((prev) => new Set([...prev, questionId]));
    try {
      const res = await fetch("/api/criteria/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) => {
          const next = new Map(prev);
          next.set(questionId, data.suggestions || []);
          return next;
        });
      }
    } finally {
      setSuggestingFor(null);
    }
  }

  async function acceptSuggestion(questionId: number, suggestion: AiSuggestion) {
    const res = await fetch("/api/criteria/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        process_id: suggestion.process_id,
        question_id: questionId,
        coverage: suggestion.coverage,
        notes: suggestion.rationale,
        mapped_by: "ai_confirmed",
      }),
    });
    if (res.ok) {
      // Remove from suggestions
      setSuggestions((prev) => {
        const next = new Map(prev);
        const current = next.get(questionId) || [];
        next.set(questionId, current.filter((s) => s.process_id !== suggestion.process_id));
        return next;
      });
      fetchData();
    }
  }

  async function dismissSuggestion(questionId: number, processId: number) {
    setSuggestions((prev) => {
      const next = new Map(prev);
      const current = next.get(questionId) || [];
      next.set(questionId, current.filter((s) => s.process_id !== processId));
      return next;
    });
  }

  async function runBulkScan() {
    setScanning(true);
    setScanProgress("Starting AI scan...");
    try {
      const res = await fetch("/api/criteria/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tierFilter !== "all" ? { tier: tierFilter } : {}),
      });
      if (res.ok) {
        const data = await res.json();
        // Populate suggestions map from scan results
        const newSuggestions = new Map(suggestions);
        for (const result of data.results || []) {
          if (result.suggestions.length > 0) {
            newSuggestions.set(result.question_id, result.suggestions);
          }
        }
        setSuggestions(newSuggestions);
        setScanProgress(
          `Done! ${data.withSuggestions} questions with suggestions, ${data.noMatch} with no match.`
        );
        // Expand all items that have suggestions
        const itemsWithSuggestions = new Set<number>();
        for (const result of data.results || []) {
          if (result.suggestions.length > 0) {
            const q = items.flatMap((i) => i.questions).find((q) => q.id === result.question_id);
            if (q) itemsWithSuggestions.add(q.item_id);
          }
        }
        setExpandedItems((prev) => new Set([...prev, ...itemsWithSuggestions]));
      } else {
        setScanProgress("Scan failed. Please try again.");
      }
    } catch {
      setScanProgress("Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  async function acceptAllSuggestions() {
    for (const [questionId, qSuggestions] of suggestions) {
      for (const suggestion of qSuggestions) {
        await fetch("/api/criteria/mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            process_id: suggestion.process_id,
            question_id: questionId,
            coverage: suggestion.coverage,
            notes: suggestion.rationale,
            mapped_by: "ai_confirmed",
          }),
        });
      }
    }
    setSuggestions(new Map());
    fetchData();
  }

  if (loading) {
    return (
      <AdminGuard>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-muted rounded w-64" />
          <div className="h-4 bg-surface-muted rounded w-full" />
          <div className="h-4 bg-surface-muted rounded w-3/4" />
          <div className="h-64 bg-surface-subtle rounded" />
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-nia-dark">Baldrige Criteria Map</h1>
            <p className="text-text-tertiary mt-1">
              Map your processes to Baldrige criteria questions
            </p>
          </div>
          {/* Tier filter toggle */}
          <div className="flex items-center gap-1 bg-surface-subtle rounded-lg p-1">
            {([
              { key: "excellence_builder", label: "Excellence Builder" },
              { key: "full", label: "Full Framework" },
              { key: "all", label: "All" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTierFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tierFilter === key
                    ? "bg-card text-nia-dark shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={runBulkScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-nia-dark-solid text-white rounded-lg text-sm font-medium hover:bg-nia-dark-solid/90 transition-colors disabled:opacity-50"
            >
              {scanning ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
              {scanning ? "Scanning..." : "AI Scan All"}
            </button>
            <Link
              href="/criteria/gaps"
              className="inline-flex items-center gap-2 px-4 py-2 bg-nia-orange text-white rounded-lg text-sm font-medium hover:bg-nia-orange/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              View Gaps
            </Link>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">{overallPct}%</div>
            <div className="text-xs text-text-tertiary">Questions Mapped</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">
              {mappedQuestions}
              <span className="text-lg text-text-muted font-normal">/{totalQuestions}</span>
            </div>
            <div className="text-xs text-text-tertiary">Questions with Primary Process</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">
              {coveredPoints}
              <span className="text-lg text-text-muted font-normal">/{totalPoints}</span>
            </div>
            <div className="text-xs text-text-tertiary">Points Covered (80%+ items)</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">
              {filteredItems.filter((i) => i.coveragePct === 0 && i.item_type !== "profile").length}
            </div>
            <div className="text-xs text-text-tertiary">Items with Zero Coverage</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className={`text-2xl font-bold ${estPages > 25 ? "text-nia-red" : "text-nia-dark"}`}>
              {estPages}
              <span className="text-lg text-text-muted font-normal">/25</span>
            </div>
            <div className="text-xs text-text-tertiary">
              Est. Pages ({totalDraftWords.toLocaleString()} words)
            </div>
          </div>
        </div>

        {/* Scan progress / Accept All banner */}
        {scanProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-700">{scanProgress}</span>
            <div className="flex gap-2">
              {suggestions.size > 0 && (
                <button
                  onClick={acceptAllSuggestions}
                  className="text-xs px-3 py-1 bg-nia-green text-nia-dark rounded font-medium hover:bg-nia-green/80"
                >
                  Accept All ({[...suggestions.values()].reduce((s, a) => s + a.length, 0)} suggestions)
                </button>
              )}
              <button
                onClick={() => { setScanProgress(""); setSuggestions(new Map()); }}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Category accordion */}
        <div className="space-y-3">
          {Object.values(categories)
            .sort((a, b) => a.number - b.number)
            .map((cat) => {
              const catPct =
                cat.totalQuestions > 0
                  ? Math.round((cat.mappedQuestions / cat.totalQuestions) * 100)
                  : 0;

              return (
                <div key={cat.number} className="bg-card rounded-xl border overflow-hidden">
                  {/* Category header */}
                  <div className="px-5 py-4 border-b bg-surface-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-nia-dark">
                          {cat.number === 0 ? "P" : cat.number}. {cat.name}
                        </h2>
                        <div className="text-xs text-text-tertiary mt-0.5">
                          {cat.mappedQuestions}/{cat.totalQuestions} questions mapped
                          {cat.totalPoints > 0 && ` · ${cat.totalPoints} points`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-surface-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${coverageBarColor(catPct)}`}
                            style={{ width: `${catPct}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-text-secondary w-10 text-right">
                          {catPct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items within category */}
                  <div className="divide-y">
                    {cat.items.map((item) => {
                      const isExpanded = expandedItems.has(item.id);

                      return (
                        <div key={item.id}>
                          {/* Item row */}
                          <button
                            onClick={() => toggleItem(item.id)}
                            className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <svg
                                className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <div>
                                <span className="font-medium text-nia-dark">
                                  {item.item_code} {item.item_name}
                                </span>
                                {item.points > 0 && (
                                  <span className="ml-2 text-xs text-text-muted">
                                    {item.points} pts
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Draft badge — only for process items with mappings */}
                              {item.item_type === "process" && item.mappedQuestions > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDraftPanel(item);
                                  }}
                                  className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
                                    latestDrafts.has(item.id)
                                      ? "bg-nia-green/20 text-nia-dark hover:bg-nia-green/40"
                                      : "bg-surface-subtle text-text-muted hover:bg-surface-muted"
                                  }`}
                                  title={latestDrafts.has(item.id) ? `${latestDrafts.get(item.id)!.word_count} words` : "No draft yet"}
                                >
                                  {latestDrafts.has(item.id) ? latestDrafts.get(item.id)!.status.charAt(0).toUpperCase() + latestDrafts.get(item.id)!.status.slice(1) : "Draft"}
                                </button>
                              )}
                              <div className="w-16 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${coverageBarColor(item.coveragePct)}`}
                                  style={{ width: `${item.coveragePct}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-tertiary w-8 text-right">
                                {item.mappedQuestions}/{item.totalQuestions}
                              </span>
                            </div>
                          </button>

                          {/* Expanded questions */}
                          {isExpanded && (
                            <div className="px-5 pb-4 pl-12 space-y-2">
                              {/* Draft Narrative button — for process items only */}
                              {item.item_type === "process" && (
                                <div className="flex items-center justify-between pb-2 mb-1 border-b border-border-light">
                                  <span className="text-xs text-text-muted">
                                    {item.questions.length} questions
                                    {latestDrafts.has(item.id) && (
                                      <> &middot; {latestDrafts.get(item.id)!.word_count.toLocaleString()} words ({latestDrafts.get(item.id)!.status})</>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => setDraftPanel(item)}
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-nia-dark-solid text-white rounded-md font-medium hover:bg-nia-dark-solid/90 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {latestDrafts.has(item.id) ? "View Draft" : "Draft Narrative"}
                                  </button>
                                </div>
                              )}

                              {item.questions.map((q) => {
                                const isQExpanded = expandedQuestions.has(q.id);
                                const hasMappings = q.mappings.length > 0;

                                return (
                                  <div
                                    key={q.id}
                                    className={`rounded-lg border p-3 ${
                                      hasMappings
                                        ? "border-nia-green/30 bg-nia-green/5"
                                        : "border-border bg-card"
                                    }`}
                                  >
                                    <button
                                      onClick={() => toggleQuestion(q.id)}
                                      className="w-full text-left"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <span className="text-xs font-mono text-text-muted">
                                            {q.question_code}
                                          </span>
                                          <span className="ml-2 text-xs text-nia-grey-blue font-medium">
                                            {q.area_label}
                                          </span>
                                          <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                                            {q.question_text}
                                          </p>
                                        </div>
                                        {hasMappings && (
                                          <div className="flex-shrink-0">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-nia-green/20 text-nia-dark">
                                              {q.mappings.length} mapped
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </button>

                                    {/* Expanded question detail */}
                                    {isQExpanded && (
                                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                                        {/* Full question text */}
                                        <p className="text-sm text-text-secondary">
                                          {q.question_text}
                                        </p>

                                        {/* Mapped processes */}
                                        {q.mappings.length > 0 && (
                                          <div className="space-y-1.5">
                                            <div className="text-xs font-medium text-text-tertiary uppercase">
                                              Mapped Processes
                                            </div>
                                            {q.mappings.map((m) => (
                                              <div
                                                key={m.id}
                                                className="flex items-center justify-between bg-card rounded-md px-3 py-2 border"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <Link
                                                    href={`/processes/${m.process_id}`}
                                                    className="text-sm font-medium text-nia-dark hover:underline"
                                                  >
                                                    {(m.processes as unknown as { name: string })?.name || `Process #${m.process_id}`}
                                                  </Link>
                                                  <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${COVERAGE_COLORS[m.coverage]}`}
                                                  >
                                                    {m.coverage}
                                                  </span>
                                                </div>
                                                <button
                                                  onClick={() => removeMapping(m.id)}
                                                  className="text-xs text-nia-red/60 hover:text-nia-red"
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* AI Suggestions for this question */}
                                        {(suggestions.get(q.id) || []).length > 0 && (
                                          <div className="space-y-1.5">
                                            <div className="text-xs font-medium text-blue-600 uppercase">
                                              AI Suggestions
                                            </div>
                                            {(suggestions.get(q.id) || []).map((s) => (
                                              <div
                                                key={s.process_id}
                                                className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <div>
                                                    <span className="text-sm font-medium text-nia-dark">
                                                      {s.process_name}
                                                    </span>
                                                    <span
                                                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${COVERAGE_COLORS[s.coverage]}`}
                                                    >
                                                      {s.coverage}
                                                    </span>
                                                    <p className="text-xs text-text-secondary mt-1">
                                                      {s.rationale}
                                                    </p>
                                                  </div>
                                                  <div className="flex gap-1 flex-shrink-0">
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); acceptSuggestion(q.id, s); }}
                                                      className="text-xs px-2 py-1 bg-nia-green text-nia-dark rounded font-medium hover:bg-nia-green/80"
                                                    >
                                                      Accept
                                                    </button>
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); dismissSuggestion(q.id, s.process_id); }}
                                                      className="text-xs px-2 py-1 text-text-muted hover:text-text-secondary"
                                                    >
                                                      Dismiss
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); suggestMappings(q.id); }}
                                            disabled={suggestingFor === q.id}
                                            className="text-xs px-3 py-1.5 bg-nia-dark/10 text-nia-dark rounded-md font-medium hover:bg-nia-dark/20 transition-colors disabled:opacity-50"
                                          >
                                            {suggestingFor === q.id ? "Analyzing..." : "Suggest Mappings"}
                                          </button>
                                          <Link
                                            href={`/processes/new?baldrige_question_id=${q.id}`}
                                            className="text-xs px-3 py-1.5 border border-border text-text-secondary rounded-md font-medium hover:bg-surface-hover transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Create Process
                                          </Link>
                                        </div>

                                        {/* No mappings state */}
                                        {q.mappings.length === 0 && !suggestions.has(q.id) && (
                                          <div className="text-sm text-text-muted italic">
                                            No processes mapped to this question yet.
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Draft panel drawer */}
      {draftPanel && (
        <DraftPanel
          item={draftPanel}
          tier={tierFilter !== "all" ? tierFilter : "excellence_builder"}
          onClose={() => setDraftPanel(null)}
          onDraftSaved={fetchDrafts}
        />
      )}
    </AdminGuard>
  );
}
