"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FormSkeleton } from "@/components/skeleton";
import Link from "next/link";

interface ProcessOption {
  id: number;
  name: string;
  category_display_name: string;
}

interface RequirementOption {
  id: number;
  stakeholder_segment: string;
  stakeholder_group: string;
  requirement: string;
}

export default function EditMetricPage() {
  const params = useParams();
  const router = useRouter();
  const metricId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [processId, setProcessId] = useState<number>(0);
  const [cadence, setCadence] = useState("quarterly");
  const [targetValue, setTargetValue] = useState("");
  const [comparisonValue, setComparisonValue] = useState("");
  const [comparisonSource, setComparisonSource] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [collectionMethod, setCollectionMethod] = useState("");
  const [unit, setUnit] = useState("%");
  const [isHigherBetter, setIsHigherBetter] = useState(true);
  const [allRequirements, setAllRequirements] = useState<RequirementOption[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetch() {
      // Fetch processes for dropdown
      const { data: processData } = await supabase
        .from("processes")
        .select(`
          id, name,
          categories!inner ( display_name )
        `)
        .order("name");

      if (processData) {
        setProcesses(
          processData.map((p: Record<string, unknown>) => ({
            id: p.id as number,
            name: p.name as string,
            category_display_name: (p.categories as Record<string, unknown>).display_name as string,
          }))
        );
      }

      // Fetch current metric
      const { data: metric } = await supabase
        .from("metrics")
        .select("*")
        .eq("id", metricId)
        .single();

      if (metric) {
        setName(metric.name);
        setDescription(metric.description || "");
        setProcessId(metric.process_id);
        setCadence(metric.cadence);
        setTargetValue(metric.target_value !== null ? String(metric.target_value) : "");
        setComparisonValue(metric.comparison_value !== null ? String(metric.comparison_value) : "");
        setComparisonSource(metric.comparison_source || "");
        setDataSource(metric.data_source || "");
        setCollectionMethod(metric.collection_method || "");
        setUnit(metric.unit || "%");
        setIsHigherBetter(metric.is_higher_better);
      }

      // Fetch all key requirements
      const { data: reqData } = await supabase
        .from("key_requirements")
        .select("id, stakeholder_segment, stakeholder_group, requirement")
        .order("sort_order");
      if (reqData) setAllRequirements(reqData);

      // Fetch existing links for this metric
      const { data: linkData } = await supabase
        .from("metric_requirements")
        .select("requirement_id")
        .eq("metric_id", metricId);
      if (linkData) {
        setSelectedReqIds(new Set(linkData.map((l) => l.requirement_id)));
      }

      // Count entries for delete warning
      const { count } = await supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("metric_id", metricId);
      setEntryCount(count || 0);

      setLoading(false);
    }
    fetch();
  }, [metricId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("metrics")
      .update({
        name,
        description: description || null,
        process_id: processId,
        cadence,
        target_value: targetValue ? parseFloat(targetValue) : null,
        comparison_value: comparisonValue ? parseFloat(comparisonValue) : null,
        comparison_source: comparisonSource || null,
        data_source: dataSource || null,
        collection_method: collectionMethod || null,
        unit,
        is_higher_better: isHigherBetter,
      })
      .eq("id", metricId);

    if (error) {
      alert("Failed to save: " + error.message);
      setSaving(false);
      return;
    }

    // Save requirement links: delete existing, insert new
    await supabase.from("metric_requirements").delete().eq("metric_id", metricId);
    if (selectedReqIds.size > 0) {
      await supabase.from("metric_requirements").insert(
        Array.from(selectedReqIds).map((reqId) => ({
          metric_id: metricId,
          requirement_id: reqId,
        }))
      );
    }

    router.push(`/metric/${metricId}`);
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);

    // Delete entries first, then metric
    await supabase.from("entries").delete().eq("metric_id", metricId);
    const { error } = await supabase.from("metrics").delete().eq("id", metricId);

    if (error) {
      alert("Failed to delete: " + error.message);
      setDeleting(false);
    } else {
      router.push("/");
    }
  }

  if (loading) return <FormSkeleton fields={6} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/" className="hover:text-nia-grey-blue">Dashboard</Link>
        {" / "}
        <Link href={`/metric/${metricId}`} className="hover:text-nia-grey-blue">{name}</Link>
        {" / "}
        <span className="text-nia-dark">Edit</span>
      </div>

      <h1 className="text-3xl font-bold text-nia-dark">Edit Metric</h1>

      <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-nia-dark mb-1">Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-nia-dark mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            placeholder="What does this metric measure and why does it matter?"
          />
        </div>

        {/* Process and Cadence */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">Process *</label>
            <select
              required
              value={processId}
              onChange={(e) => setProcessId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            >
              <option value={0} disabled>Select a process</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.category_display_name} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">Cadence *</label>
            <select
              required
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semi-annual">Semi-Annual</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>

        {/* Unit and Direction */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            >
              <option value="%">% (Percentage)</option>
              <option value="score">Score</option>
              <option value="count">Count</option>
              <option value="currency">Currency ($)</option>
              <option value="days">Days</option>
              <option value="rate">Rate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">
              Trend Direction
            </label>
            <select
              value={isHigherBetter ? "higher" : "lower"}
              onChange={(e) => setIsHigherBetter(e.target.value === "higher")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            >
              <option value="higher">Higher is better (e.g., satisfaction score)</option>
              <option value="lower">Lower is better (e.g., phishing click rate)</option>
            </select>
          </div>
        </div>

        {/* Target */}
        <div>
          <label className="block text-sm font-medium text-nia-dark mb-1">
            Target Value <span className="text-gray-400 font-normal">(for LeTCI Levels)</span>
          </label>
          <input
            type="number"
            step="any"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
            placeholder="Leave blank if TBD"
          />
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">
              Comparison Value <span className="text-gray-400 font-normal">(for LeTCI Comparisons)</span>
            </label>
            <input
              type="number"
              step="any"
              value={comparisonValue}
              onChange={(e) => setComparisonValue(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
              placeholder="Benchmark or peer value"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">
              Comparison Source
            </label>
            <input
              type="text"
              value={comparisonSource}
              onChange={(e) => setComparisonSource(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
              placeholder="e.g., National average, Studer benchmark"
            />
          </div>
        </div>

        {/* Data Source and Collection Method */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">Data Source</label>
            <input
              type="text"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
              placeholder="e.g., Studer EE Survey"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">Collection Method</label>
            <input
              type="text"
              value={collectionMethod}
              onChange={(e) => setCollectionMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
              placeholder="e.g., Semi-annual survey"
            />
          </div>
        </div>

        {/* Key Requirements (LeTCI Integration) */}
        <div className="bg-nia-grey-blue/5 border border-nia-grey-blue/20 rounded-lg p-4 space-y-3">
          <div>
            <span className="font-medium text-nia-dark">Key Requirements (LeTCI Integration)</span>
            <p className="text-xs text-gray-500 mt-1">
              Select the stakeholder requirements this metric provides evidence for.
              Linking to at least one requirement marks this metric as Integrated (LeTCI).
            </p>
          </div>
          {(() => {
            // Group requirements by stakeholder_group
            const groups = new Map<string, RequirementOption[]>();
            for (const req of allRequirements) {
              if (!groups.has(req.stakeholder_group)) groups.set(req.stakeholder_group, []);
              groups.get(req.stakeholder_group)!.push(req);
            }
            return Array.from(groups.entries()).map(([group, reqs]) => (
              <div key={group}>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">
                  {reqs[0].stakeholder_segment} — {group}
                </div>
                <div className="space-y-1 ml-1">
                  {reqs.map((req) => (
                    <label key={req.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedReqIds.has(req.id)}
                        onChange={() => {
                          setSelectedReqIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(req.id)) next.delete(req.id);
                            else next.add(req.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 accent-nia-green"
                      />
                      <span className="text-sm text-nia-dark">{req.requirement}</span>
                    </label>
                  ))}
                </div>
              </div>
            ));
          })()}
          {selectedReqIds.size > 0 && (
            <div className="text-xs text-nia-green font-medium mt-2">
              {selectedReqIds.size} requirement{selectedReqIds.size !== 1 ? "s" : ""} linked — Integration: Yes
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-nia-dark text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/metric/${metricId}`}
              className="bg-gray-200 text-nia-dark rounded-lg py-2 px-4 hover:bg-gray-300 inline-flex items-center"
            >
              Cancel
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 text-sm hover:text-red-800 transition-colors"
          >
            Delete Metric
          </button>
        </div>
      </form>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h3 className="font-bold text-red-800 mb-2">Delete this metric?</h3>
          <p className="text-sm text-red-700 mb-4">
            This will permanently delete <strong>{name}</strong> and{" "}
            <strong>{entryCount} data {entryCount === 1 ? "entry" : "entries"}</strong>.
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white rounded-lg py-2 px-4 hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {deleting ? "Deleting..." : "Yes, Delete Permanently"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="bg-gray-200 text-nia-dark rounded-lg py-2 px-4 hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
