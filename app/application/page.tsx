"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import AdminGuard from "@/components/admin-guard";
import DraftPanel from "@/components/draft-panel";
import { generateApplicationDocx } from "@/lib/export-docx";

/* ---------- types ---------- */
interface Question {
  id: number;
  question_code: string;
  area_label: string;
  question_text: string;
  tier: string;
  mappings: { coverage: string }[];
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

interface Draft {
  id: number;
  item_id: number;
  tier: string;
  narrative_text: string;
  word_count: number;
  status: string;
  last_ai_generated_at: string | null;
  last_edited_at: string | null;
}

/* ---------- constants ---------- */
const CATEGORY_ORDER = [0, 1, 2, 3, 4, 5, 6, 7]; // P(0), 1-7
const TIER = "excellence_builder";

function statusBadge(status: string) {
  switch (status) {
    case "final":
      return "bg-nia-green/20 text-nia-dark";
    case "review":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-nia-orange/20 text-nia-orange";
  }
}

/* ---------- component ---------- */
export default function ApplicationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set(CATEGORY_ORDER));
  const [draftPanel, setDraftPanel] = useState<Item | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`/api/criteria/drafts?tier=${TIER}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    document.title = "Application Drafts | NIA Excellence Hub";

    async function fetchData() {
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
    }

    fetchData();
  }, [fetchDrafts]);

  // Filter items to EB tier questions only and recompute stats
  const ebItems = useMemo(() => {
    return items.map((item) => {
      const ebQuestions = item.questions.filter((q) => q.tier === TIER);
      const mapped = ebQuestions.filter((q) =>
        q.mappings?.some((m) => m.coverage === "primary")
      ).length;
      return {
        ...item,
        questions: ebQuestions,
        totalQuestions: ebQuestions.length,
        mappedQuestions: mapped,
        coveragePct: ebQuestions.length > 0 ? Math.round((mapped / ebQuestions.length) * 100) : 0,
      };
    }).filter((item) => item.questions.length > 0);
  }, [items]);

  // Draft lookup by item_id
  const draftMap = useMemo(() => {
    const map = new Map<number, Draft>();
    for (const d of drafts) {
      map.set(d.item_id, d);
    }
    return map;
  }, [drafts]);

  // Group items by category
  const categories = useMemo(() => {
    const groups: { number: number; name: string; items: Item[]; totalPoints: number }[] = [];
    const catMap = new Map<number, { name: string; items: Item[]; totalPoints: number }>();

    for (const item of ebItems) {
      const existing = catMap.get(item.category_number) || {
        name: item.category_name,
        items: [],
        totalPoints: 0,
      };
      existing.items.push(item);
      existing.totalPoints += item.points;
      catMap.set(item.category_number, existing);
    }

    for (const catNum of CATEGORY_ORDER) {
      const cat = catMap.get(catNum);
      if (cat) {
        groups.push({ number: catNum, ...cat });
      }
    }

    return groups;
  }, [ebItems]);

  // Summary stats
  const totalWords = drafts.reduce((s, d) => s + d.word_count, 0);
  const totalItems = ebItems.length;
  const draftedItems = drafts.filter((d) => d.word_count > 0).length;
  const estPages = Math.round((totalWords / 500) * 10) / 10;
  const finalCount = drafts.filter((d) => d.status === "final").length;

  async function handleExport() {
    setExporting(true);
    try {
      // Build draft items array by joining ebItems with drafts
      const draftItems = ebItems.map((item) => {
        const draft = draftMap.get(item.id);
        return {
          item_code: item.item_code,
          item_name: item.item_name,
          category_number: item.category_number,
          category_name: item.category_name,
          points: item.points,
          item_type: item.item_type,
          narrative_text: draft?.narrative_text || "",
          word_count: draft?.word_count || 0,
          status: draft?.status || "draft",
        };
      });

      const blob = await generateApplicationDocx(draftItems);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NIA-Excellence-Builder-Application-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  function toggleCategory(catNum: number) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catNum)) next.delete(catNum);
      else next.add(catNum);
      return next;
    });
  }

  if (loading) {
    return (
      <AdminGuard>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-muted rounded w-64" />
          <div className="h-4 bg-surface-muted rounded w-full" />
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-surface-subtle rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-surface-subtle rounded-xl mt-4" />
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
            <h1 className="text-2xl font-bold text-nia-dark">Application Drafts</h1>
            <p className="text-text-tertiary mt-1">
              Excellence Builder (25-page) application narratives
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || totalWords === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nia-dark-solid text-white rounded-lg text-sm font-medium hover:bg-nia-dark-solid/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? "Exporting..." : "Export to Word"}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">{draftedItems}/{totalItems}</div>
            <div className="text-xs text-text-tertiary">Items Drafted</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">{totalWords.toLocaleString()}</div>
            <div className="text-xs text-text-tertiary">Total Words</div>
          </div>
          <div className={`bg-card rounded-xl border p-4 ${estPages > 25 ? "ring-2 ring-nia-red/30" : ""}`}>
            <div className={`text-2xl font-bold ${estPages > 25 ? "text-nia-red" : "text-nia-dark"}`}>
              {estPages}
            </div>
            <div className="text-xs text-text-tertiary">Est. Pages (of 25)</div>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-green">{finalCount}</div>
            <div className="text-xs text-text-tertiary">Marked Final</div>
          </div>
        </div>

        {/* Word budget progress bar */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-nia-dark">Word Budget</span>
            <span className="text-sm text-text-tertiary">
              {totalWords.toLocaleString()} / 12,500 words
            </span>
          </div>
          <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalWords > 12500 ? "bg-nia-red" : totalWords > 10000 ? "bg-nia-orange" : "bg-nia-green"
              }`}
              style={{ width: `${Math.min((totalWords / 12500) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Category sections */}
        {categories.map((cat) => {
          const isExpanded = expandedCategories.has(cat.number);
          const catDraftWords = cat.items.reduce((s, item) => {
            const draft = draftMap.get(item.id);
            return s + (draft?.word_count || 0);
          }, 0);
          const catDraftedCount = cat.items.filter((item) => draftMap.has(item.id) && draftMap.get(item.id)!.word_count > 0).length;

          return (
            <div key={cat.number} className="bg-card rounded-xl border overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat.number)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
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
                  <div className="text-left">
                    <h2 className="font-semibold text-nia-dark">
                      {cat.number === 0 ? "P" : cat.number}. {cat.name}
                    </h2>
                    <p className="text-xs text-text-muted">
                      {cat.totalPoints} pts &middot; {cat.items.length} items &middot; {catDraftedCount} drafted &middot; {catDraftWords.toLocaleString()} words
                    </p>
                  </div>
                </div>
                {/* Category progress */}
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-nia-green"
                      style={{ width: `${cat.items.length > 0 ? (catDraftedCount / cat.items.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-10 text-right">
                    {catDraftedCount}/{cat.items.length}
                  </span>
                </div>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="border-t divide-y">
                  {cat.items.map((item) => {
                    const draft = draftMap.get(item.id);
                    const hasContent = draft && draft.word_count > 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setDraftPanel(item)}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Status indicator */}
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              !hasContent
                                ? "bg-surface-muted"
                                : draft.status === "final"
                                ? "bg-nia-green"
                                : draft.status === "review"
                                ? "bg-blue-500"
                                : "bg-nia-orange"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-text-muted">{item.item_code}</span>
                              <span className="text-sm font-medium text-nia-dark truncate">{item.item_name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-text-muted">{item.points} pts</span>
                              <span className="text-xs text-text-muted">&middot;</span>
                              <span className="text-xs text-text-muted">
                                {item.mappedQuestions}/{item.totalQuestions} mapped
                              </span>
                              {hasContent && (
                                <>
                                  <span className="text-xs text-text-muted">&middot;</span>
                                  <span className="text-xs text-text-muted">
                                    {draft.word_count.toLocaleString()} words
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasContent ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(draft.status)}`}>
                              {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">No draft</span>
                          )}
                          <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Draft editor panel */}
      {draftPanel && (
        <DraftPanel
          item={draftPanel}
          tier={TIER}
          onClose={() => setDraftPanel(null)}
          onDraftSaved={fetchDrafts}
        />
      )}
    </AdminGuard>
  );
}
