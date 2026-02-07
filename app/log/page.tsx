"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricOption extends Metric {
  process_name: string;
  category_display_name: string;
}

export default function LogDataPage() {
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [noteAnalysis, setNoteAnalysis] = useState("");
  const [noteCourseCorrection, setNoteCourseCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Search/filter
  const [search, setSearch] = useState("");
  const [filterCadence, setFilterCadence] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("metrics")
        .select(`
          *,
          processes!inner (
            name,
            categories!inner ( display_name )
          )
        `)
        .order("name");

      const rows: MetricOption[] = (data || []).map((m: Record<string, unknown>) => {
        const process = m.processes as Record<string, unknown>;
        const category = process.categories as Record<string, unknown>;
        return {
          ...(m as unknown as Metric),
          process_name: process.name as string,
          category_display_name: category.display_name as string,
        };
      });

      setMetrics(rows);
      setLoading(false);
    }
    fetch();
  }, []);

  const selectedMetric = metrics.find((m) => m.id === selectedMetricId) || null;

  // Filter metrics for the picker
  const filtered = metrics.filter((m) => {
    if (search) {
      const q = search.toLowerCase();
      const matchesName = m.name.toLowerCase().includes(q);
      const matchesProcess = m.process_name.toLowerCase().includes(q);
      const matchesSource = (m.data_source || "").toLowerCase().includes(q);
      if (!matchesName && !matchesProcess && !matchesSource) return false;
    }
    if (filterCadence !== "all" && m.cadence !== filterCadence) return false;
    if (filterCategory !== "all" && m.category_display_name !== filterCategory) return false;
    return true;
  });

  const categoryOptions = Array.from(
    new Set(metrics.map((m) => m.category_display_name))
  ).sort();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMetricId || !value) return;

    setSaving(true);
    const { error } = await supabase.from("entries").insert({
      metric_id: selectedMetricId,
      value: parseFloat(value),
      date,
      note_analysis: noteAnalysis || null,
      note_course_correction: noteCourseCorrection || null,
    });

    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      const metricName = selectedMetric?.name || "metric";
      setSuccessMessage(`Logged ${value} for ${metricName}`);
      // Reset form but keep the date
      setSelectedMetricId(null);
      setValue("");
      setNoteAnalysis("");
      setNoteCourseCorrection("");
      setTimeout(() => setSuccessMessage(""), 4000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading metrics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">Log Data</h1>
        <p className="text-gray-500 mt-1">
          Search for a metric and log a new value
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="bg-[#b1bd37]/20 border border-[#b1bd37] text-[#324a4d] px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMessage}</span>
          <Link href="/" className="text-sm text-[#55787c] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Metric picker */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-[#324a4d] mb-3">1. Select a Metric</h2>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, process, or data source..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            />

            {/* Filters */}
            <div className="flex gap-3 mb-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
              >
                <option value="all">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={filterCadence}
                onChange={(e) => setFilterCadence(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
              >
                <option value="all">All Cadences</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi-annual">Semi-Annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            {/* Metric list */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {filtered.length === 0 ? (
                <div className="p-4 text-gray-400 text-sm text-center">
                  No metrics match your search
                </div>
              ) : (
                filtered.map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => setSelectedMetricId(metric.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedMetricId === metric.id
                        ? "bg-[#55787c]/10 border-l-4 border-l-[#55787c]"
                        : ""
                    }`}
                  >
                    <div className="font-medium text-[#324a4d] text-sm">{metric.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {metric.category_display_name} &middot; {metric.process_name} &middot;{" "}
                      <span className="capitalize">{metric.cadence}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {filtered.length} of {metrics.length} metrics shown
            </div>
          </div>
        </div>

        {/* Right: Entry form */}
        <div>
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-[#324a4d] mb-3">2. Enter Data</h2>

            {!selectedMetric ? (
              <div className="text-gray-400 text-sm py-8 text-center">
                Select a metric from the list to log a value
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selected metric info */}
                <div className="bg-[#55787c]/5 rounded-lg p-3 border border-[#55787c]/20">
                  <div className="font-medium text-[#324a4d]">{selectedMetric.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedMetric.process_name} &middot;{" "}
                    <span className="capitalize">{selectedMetric.cadence}</span> &middot;{" "}
                    Unit: {selectedMetric.unit}
                    {selectedMetric.target_value !== null && (
                      <> &middot; Target: {selectedMetric.target_value}</>
                    )}
                  </div>
                  {selectedMetric.data_source && (
                    <div className="text-xs text-gray-400 mt-1">
                      Source: {selectedMetric.data_source}
                    </div>
                  )}
                </div>

                {/* Value and Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#324a4d] mb-1">
                      Value *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                        placeholder="Enter value"
                      />
                      <span className="text-sm text-gray-400 whitespace-nowrap">
                        {selectedMetric.unit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#324a4d] mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                    />
                  </div>
                </div>

                {/* Analysis Note */}
                <div>
                  <label className="block text-sm font-medium text-[#324a4d] mb-1">
                    Analysis Note{" "}
                    <span className="text-gray-400 font-normal">(context or explanation)</span>
                  </label>
                  <input
                    type="text"
                    value={noteAnalysis}
                    onChange={(e) => setNoteAnalysis(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                    placeholder="e.g., New survey methodology this cycle"
                  />
                </div>

                {/* Course Correction */}
                <div>
                  <label className="block text-sm font-medium text-[#324a4d] mb-1">
                    Course Correction{" "}
                    <span className="text-gray-400 font-normal">
                      (action taken if missing target)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={noteCourseCorrection}
                    onChange={(e) => setNoteCourseCorrection(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                    placeholder="e.g., Added re-training for repeat offenders"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#324a4d] text-white rounded-lg py-2.5 px-4 hover:opacity-90 disabled:opacity-50 font-medium"
                >
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </form>
            )}
          </div>

          {/* Recent entries for selected metric */}
          {selectedMetric && <RecentEntries metricId={selectedMetric.id} unit={selectedMetric.unit} />}
        </div>
      </div>
    </div>
  );
}

function RecentEntries({ metricId, unit }: { metricId: number; unit: string }) {
  const [entries, setEntries] = useState<
    { id: number; value: number; date: string; note_analysis: string | null }[]
  >([]);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("entries")
        .select("id, value, date, note_analysis")
        .eq("metric_id", metricId)
        .order("date", { ascending: false })
        .limit(5);
      setEntries(data || []);
    }
    fetch();
  }, [metricId]);

  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4 mt-4">
      <h3 className="text-sm font-bold text-[#324a4d] mb-2">Recent Entries</h3>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
            <span className="text-gray-500">{entry.date}</span>
            <span className="font-medium text-[#324a4d]">
              {entry.value}{unit === "%" ? "%" : ` ${unit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
