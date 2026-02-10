"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AdminGuard from "@/components/admin-guard";

/* ---------- types ---------- */
interface Mapping {
  id: number;
  process_id: number;
  coverage: string;
  processes: { id: number; name: string } | null;
}

interface Question {
  id: number;
  item_id: number;
  question_code: string;
  area_label: string;
  question_text: string;
  question_type: string;
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
function getPriorityTag(catCoverage: number) {
  if (catCoverage === 0)
    return { label: "Critical", className: "bg-red-100 text-red-700" };
  if (catCoverage < 50)
    return { label: "Important", className: "bg-nia-orange/20 text-nia-orange" };
  return { label: "Strengthen", className: "bg-blue-100 text-blue-700" };
}

/* ---------- component ---------- */
export default function GapAnalysisPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    document.title = "Application Gaps | NIA Excellence Hub";

    async function fetchData() {
      try {
        const res = await fetch("/api/criteria");
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Compute category coverage percentages for priority tags
  const categoryCoverage = useMemo(() => {
    const map = new Map<number, { total: number; mapped: number }>();
    for (const item of items) {
      const existing = map.get(item.category_number) || { total: 0, mapped: 0 };
      existing.total += item.totalQuestions;
      existing.mapped += item.mappedQuestions;
      map.set(item.category_number, existing);
    }
    const result = new Map<number, number>();
    for (const [catNum, data] of map) {
      result.set(catNum, data.total > 0 ? Math.round((data.mapped / data.total) * 100) : 0);
    }
    return result;
  }, [items]);

  // Get all unmapped questions grouped by category
  const gapsByCategory = useMemo(() => {
    const gaps: {
      categoryNumber: number;
      categoryName: string;
      questions: (Question & { itemCode: string; itemPoints: number })[];
      totalPoints: number;
    }[] = [];

    // Group by category
    const catMap = new Map<
      number,
      {
        name: string;
        questions: (Question & { itemCode: string; itemPoints: number })[];
        totalPoints: number;
      }
    >();

    for (const item of items) {
      for (const q of item.questions) {
        // A question is a "gap" if it has no primary mapping
        const hasPrimary = q.mappings.some((m) => m.coverage === "primary");
        if (hasPrimary) continue;

        // Filter by search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matches =
            q.question_code.toLowerCase().includes(query) ||
            q.question_text.toLowerCase().includes(query) ||
            q.area_label.toLowerCase().includes(query) ||
            item.item_name.toLowerCase().includes(query);
          if (!matches) continue;
        }

        const existing = catMap.get(item.category_number) || {
          name: item.category_name,
          questions: [],
          totalPoints: 0,
        };
        existing.questions.push({
          ...q,
          itemCode: item.item_code,
          itemPoints: item.points,
        });
        // Only count points once per item (not per question)
        catMap.set(item.category_number, existing);
      }
    }

    for (const [catNum, data] of catMap) {
      // Sum unique item points at risk
      const uniqueItems = new Set(data.questions.map((q) => q.itemCode));
      let pointsAtRisk = 0;
      for (const itemCode of uniqueItems) {
        const item = items.find((i) => i.item_code === itemCode);
        if (item && item.coveragePct < 80) pointsAtRisk += item.points;
      }

      gaps.push({
        categoryNumber: catNum,
        categoryName: data.name,
        questions: data.questions,
        totalPoints: pointsAtRisk,
      });
    }

    // Sort by points at risk (highest first)
    gaps.sort((a, b) => b.totalPoints - a.totalPoints);
    return gaps;
  }, [items, searchQuery]);

  const totalGaps = gapsByCategory.reduce((s, g) => s + g.questions.length, 0);
  const totalPointsAtRisk = gapsByCategory.reduce((s, g) => s + g.totalPoints, 0);
  const categoriesWithGaps = gapsByCategory.length;

  if (loading) {
    return (
      <AdminGuard>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-64 bg-gray-100 rounded" />
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
            <h1 className="text-2xl font-bold text-nia-dark">Application Gaps</h1>
            <p className="text-gray-500 mt-1">
              Questions without a primary process — prioritized by point value
            </p>
          </div>
          <Link
            href="/criteria"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Criteria Map
          </Link>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-red-600">{totalGaps}</div>
            <div className="text-xs text-gray-500">Unmapped Questions</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-orange">{categoriesWithGaps}</div>
            <div className="text-xs text-gray-500">Categories with Gaps</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-nia-dark">{totalPointsAtRisk}</div>
            <div className="text-xs text-gray-500">Points at Risk</div>
          </div>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nia-green/50"
          />
        </div>

        {/* Gaps by category */}
        {totalGaps === 0 ? (
          <div className="bg-nia-green/10 border border-nia-green/30 rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">&#127942;</div>
            <h3 className="text-lg font-semibold text-nia-dark">
              All Questions Mapped!
            </h3>
            <p className="text-gray-600 mt-1">
              Every Baldrige criteria question has at least one primary process.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {gapsByCategory.map((cat) => {
              const catCov = categoryCoverage.get(cat.categoryNumber) || 0;
              const priority = getPriorityTag(catCov);

              return (
                <div key={cat.categoryNumber} className="bg-white rounded-xl border overflow-hidden">
                  {/* Category header */}
                  <div className="px-5 py-4 border-b bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.className}`}
                      >
                        {priority.label}
                      </span>
                      <h2 className="font-semibold text-nia-dark">
                        {cat.categoryNumber === 0 ? "P" : cat.categoryNumber}. {cat.categoryName}
                      </h2>
                    </div>
                    <div className="text-sm text-gray-500">
                      {cat.questions.length} gaps · {cat.totalPoints} pts at risk
                    </div>
                  </div>

                  {/* Gap questions */}
                  <div className="divide-y">
                    {cat.questions.map((q) => (
                      <div key={q.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-400">
                                {q.question_code}
                              </span>
                              <span className="text-xs text-nia-grey-blue font-medium">
                                {q.area_label}
                              </span>
                              <span className="text-xs text-gray-300">
                                {q.itemCode} · {q.itemPoints} pts
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{q.question_text}</p>

                            {/* Partial/supporting mappings if any */}
                            {q.mappings.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {q.mappings.map((m) => (
                                  <span
                                    key={m.id}
                                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                                  >
                                    {(m.processes as unknown as { name: string })?.name} ({m.coverage})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex-shrink-0 flex gap-2">
                            <Link
                              href={`/processes/new?baldrige_question_id=${q.id}`}
                              className="text-xs px-3 py-1.5 bg-nia-green text-nia-dark rounded-md font-medium hover:bg-nia-green/80 transition-colors"
                            >
                              Create Process
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
