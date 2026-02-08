"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, formatDate, formatValue } from "@/lib/review-status";
import { FormSkeleton } from "@/components/skeleton";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricOption extends Metric {
  process_name: string;
  category_display_name: string;
  last_entry_date: string | null;
  review_status: "current" | "due-soon" | "overdue" | "no-data";
}

export default function LogDataPage() {
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Form state
  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [noteAnalysis, setNoteAnalysis] = useState("");
  const [noteCourseCorrection, setNoteCourseCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Bulk form state
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split("T")[0]);
  const [bulkValues, setBulkValues] = useState<Map<number, string>>(new Map());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Search/filter
  const [search, setSearch] = useState("");
  const [filterCadence, setFilterCadence] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  async function fetchMetrics() {
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

    const { data: entriesData } = await supabase
      .from("entries")
      .select("metric_id, date")
      .order("date", { ascending: false });

    const latestEntries = new Map<number, string>();
    if (entriesData) {
      for (const entry of entriesData) {
        if (!latestEntries.has(entry.metric_id)) {
          latestEntries.set(entry.metric_id, entry.date);
        }
      }
    }

    const rows: MetricOption[] = (data || []).map((m: Record<string, unknown>) => {
      const process = m.processes as Record<string, unknown>;
      const category = process.categories as Record<string, unknown>;
      const lastDate = latestEntries.get(m.id as number) || null;
      return {
        ...(m as unknown as Metric),
        process_name: process.name as string,
        category_display_name: category.display_name as string,
        last_entry_date: lastDate,
        review_status: getReviewStatus(m.cadence as string, lastDate),
      };
    });

    setMetrics(rows);
    setLoading(false);
  }

  useEffect(() => {
    document.title = "Log Data | NIA Excellence Hub";
    fetchMetrics();
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

  // Bulk save
  async function handleBulkSave() {
    const entries = Array.from(bulkValues.entries())
      .filter(([, val]) => val.trim() !== "")
      .map(([metricId, val]) => ({
        metric_id: metricId,
        value: parseFloat(val),
        date: bulkDate,
        note_analysis: null,
        note_course_correction: null,
      }));

    if (entries.length === 0) return;

    setBulkSaving(true);
    const { error } = await supabase.from("entries").insert(entries);

    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      setSuccessMessage(`Logged ${entries.length} value${entries.length !== 1 ? "s" : ""}`);
      setBulkValues(new Map());
      await fetchMetrics();
      setTimeout(() => setSuccessMessage(""), 4000);
    }
    setBulkSaving(false);
  }

  // Metrics that need review (for bulk mode)
  const dueMetrics = metrics.filter(
    (m) => m.review_status === "overdue" || m.review_status === "due-soon" || m.review_status === "no-data"
  );

  if (loading) return <FormSkeleton fields={3} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">Log Data</h1>
          <p className="text-gray-500 mt-1">
            {mode === "single" ? "Search for a metric and log a new value" : "Log values for all due metrics at once"}
          </p>
        </div>
        <div className="flex bg-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => setMode("single")}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              mode === "single" ? "bg-white text-nia-dark shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            Single
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              mode === "bulk" ? "bg-white text-nia-dark shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            Bulk Review
            {dueMetrics.length > 0 && (
              <span className="ml-1.5 text-xs bg-nia-orange/10 text-nia-orange px-1.5 py-0.5 rounded-full font-medium">
                {dueMetrics.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="banner-enter bg-nia-green/20 border border-nia-green text-nia-dark px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMessage}</span>
          <Link href="/" className="text-sm text-nia-grey-blue hover:underline">
            Back to Dashboard
          </Link>
        </div>
      )}

      {/* Bulk Review mode */}
      {mode === "bulk" && (
        <div className="space-y-4">
          {dueMetrics.length === 0 ? (
            <div className="bg-nia-green/10 border border-nia-green/30 rounded-lg px-6 py-8 text-center">
              <div className="text-2xl mb-2">All caught up!</div>
              <p className="text-nia-dark text-sm">
                No metrics are due for review right now.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-nia-orange">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-nia-dark">
                    {dueMetrics.length} metric{dueMetrics.length !== 1 ? "s" : ""} due for review
                  </h2>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-500">Date for all:</label>
                    <input
                      type="date"
                      value={bulkDate}
                      onChange={(e) => setBulkDate(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Enter values for the metrics you want to log. Leave blank to skip.
                </p>

                <div className="space-y-2">
                  {dueMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/metric/${metric.id}`}
                          className="text-sm font-medium text-nia-dark hover:text-nia-orange transition-colors"
                        >
                          {metric.name}
                        </Link>
                        <div className="text-xs text-gray-400">
                          {metric.category_display_name} &middot; {metric.process_name} &middot;{" "}
                          <span className="capitalize">{metric.cadence}</span>
                          {metric.target_value !== null && (
                            <> &middot; Target: {formatValue(metric.target_value, metric.unit)}</>
                          )}
                          {metric.last_entry_date && (
                            <> &middot; Last: {formatDate(metric.last_entry_date)}</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={bulkValues.get(metric.id) || ""}
                          onChange={(e) => {
                            const next = new Map(bulkValues);
                            next.set(metric.id, e.target.value);
                            setBulkValues(next);
                          }}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                          placeholder="Value"
                        />
                        <span className="text-xs text-gray-400 w-6">{metric.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {Array.from(bulkValues.values()).filter((v) => v.trim() !== "").length} of{" "}
                    {dueMetrics.length} filled in
                  </span>
                  <button
                    onClick={handleBulkSave}
                    disabled={bulkSaving || Array.from(bulkValues.values()).filter((v) => v.trim() !== "").length === 0}
                    className="bg-nia-dark text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium text-sm"
                  >
                    {bulkSaving ? "Saving..." : "Save All"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Single mode */}
      {mode === "single" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Metric picker */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-nia-dark mb-3">1. Select a Metric</h2>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, process, or data source..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            />

            {/* Filters */}
            <div className="flex gap-3 mb-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
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
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
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
                        ? "bg-nia-grey-blue/10 border-l-4 border-l-nia-grey-blue"
                        : ""
                    }`}
                  >
                    <div className="font-medium text-nia-dark text-sm">{metric.name}</div>
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
            <h2 className="font-bold text-nia-dark mb-3">2. Enter Data</h2>

            {!selectedMetric ? (
              <div className="text-gray-400 text-sm py-8 text-center">
                Select a metric from the list to log a value
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selected metric info */}
                <div className="bg-nia-grey-blue/5 rounded-lg p-3 border border-nia-grey-blue/20">
                  <div className="font-medium text-nia-dark">{selectedMetric.name}</div>
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
                    <label className="block text-sm font-medium text-nia-dark mb-1">
                      Value *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                        placeholder="Enter value"
                      />
                      <span className="text-sm text-gray-400 whitespace-nowrap">
                        {selectedMetric.unit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nia-dark mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                    />
                  </div>
                </div>

                {/* Analysis Note */}
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">
                    Analysis Note{" "}
                    <span className="text-gray-400 font-normal">(context or explanation)</span>
                  </label>
                  <input
                    type="text"
                    value={noteAnalysis}
                    onChange={(e) => setNoteAnalysis(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                    placeholder="e.g., New survey methodology this cycle"
                  />
                </div>

                {/* Course Correction */}
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">
                    Course Correction{" "}
                    <span className="text-gray-400 font-normal">
                      (action taken if missing target)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={noteCourseCorrection}
                    onChange={(e) => setNoteCourseCorrection(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
                    placeholder="e.g., Added re-training for repeat offenders"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-nia-dark text-white rounded-lg py-2.5 px-4 hover:opacity-90 disabled:opacity-50 font-medium"
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
      )}
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
      <h3 className="text-sm font-bold text-nia-dark mb-2">Recent Entries</h3>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
            <span className="text-gray-500">{formatDate(entry.date)}</span>
            <span className="font-medium text-nia-dark">
              {formatValue(entry.value, unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
