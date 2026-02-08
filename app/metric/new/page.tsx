"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewMetricPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);

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

      // Fetch all key requirements
      const { data: reqData } = await supabase
        .from("key_requirements")
        .select("id, stakeholder_segment, stakeholder_group, requirement")
        .order("sort_order");
      if (reqData) setAllRequirements(reqData);

      setLoading(false);
    }
    fetch();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (processId === 0) {
      alert("Please select a process");
      return;
    }
    setSaving(true);

    const { data, error } = await supabase
      .from("metrics")
      .insert({
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
      .select("id")
      .single();

    if (error) {
      alert("Failed to create metric: " + error.message);
      setSaving(false);
      return;
    }

    // Save requirement links
    if (data && selectedReqIds.size > 0) {
      await supabase.from("metric_requirements").insert(
        Array.from(selectedReqIds).map((reqId) => ({
          metric_id: data.id,
          requirement_id: reqId,
        }))
      );
    }

    if (data) {
      router.push(`/metric/${data.id}`);
    }
    setSaving(false);
  }

  if (loading) return <FormSkeleton fields={6} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/" className="hover:text-nia-grey-blue">Dashboard</Link>
        {" / "}
        <span className="text-nia-dark">Add Metric</span>
      </div>

      <h1 className="text-3xl font-bold text-nia-dark">Add New Metric</h1>

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
            placeholder="e.g., Employee Engagement Score"
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
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-nia-dark text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium"
          >
            {saving ? "Creating..." : "Create Metric"}
          </button>
          <Link
            href="/"
            className="bg-gray-200 text-nia-dark rounded-lg py-2 px-4 hover:bg-gray-300 inline-flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
