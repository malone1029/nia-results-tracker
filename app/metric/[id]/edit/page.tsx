"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FormSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { Card, Button, Input, Textarea, Select } from "@/components/ui";

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
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<number>>(new Set());
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
  const [dataStewardEmail, setDataStewardEmail] = useState<string>("");
  const [members, setMembers] = useState<{ gid: string; name: string; email: string }[]>([]);

  useEffect(() => {
    async function loadData() {
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
        setCadence(metric.cadence);
        setTargetValue(metric.target_value !== null ? String(metric.target_value) : "");
        setComparisonValue(metric.comparison_value !== null ? String(metric.comparison_value) : "");
        setComparisonSource(metric.comparison_source || "");
        setDataSource(metric.data_source || "");
        setCollectionMethod(metric.collection_method || "");
        setUnit(metric.unit || "%");
        setIsHigherBetter(metric.is_higher_better);
        setDataStewardEmail(metric.data_steward_email || "");
      }

      // Fetch current process links from junction table
      const { data: processLinks } = await supabase
        .from("metric_processes")
        .select("process_id")
        .eq("metric_id", metricId);
      if (processLinks) {
        setSelectedProcessIds(new Set(processLinks.map((l) => l.process_id)));
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

      // Fetch Asana workspace members for data steward dropdown
      const membersRes = await fetch("/api/asana/workspace-members");
      const membersData = await membersRes.json();
      setMembers(membersData.members || []);

      setLoading(false);
    }
    loadData();
  }, [metricId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("metrics")
      .update({
        name,
        description: description || null,
        cadence,
        target_value: targetValue ? parseFloat(targetValue) : null,
        comparison_value: comparisonValue ? parseFloat(comparisonValue) : null,
        comparison_source: comparisonSource || null,
        data_source: dataSource || null,
        collection_method: collectionMethod || null,
        unit,
        is_higher_better: isHigherBetter,
        data_steward_email: dataStewardEmail || null,
      })
      .eq("id", metricId);

    if (error) {
      alert("Failed to save: " + error.message);
      setSaving(false);
      return;
    }

    // Save process links: delete existing, insert new
    await supabase.from("metric_processes").delete().eq("metric_id", metricId);
    if (selectedProcessIds.size > 0) {
      await supabase.from("metric_processes").insert(
        Array.from(selectedProcessIds).map((pid) => ({
          metric_id: metricId,
          process_id: pid,
        }))
      );
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
      <div className="text-sm text-text-tertiary">
        <Link href="/" className="hover:text-nia-grey-blue">Dashboard</Link>
        {" / "}
        <Link href={`/metric/${metricId}`} className="hover:text-nia-grey-blue">{name}</Link>
        {" / "}
        <span className="text-nia-dark">Edit</span>
      </div>

      <h1 className="text-3xl font-bold text-nia-dark">Edit Metric</h1>

      <form onSubmit={handleSave}>
      <Card padding="lg" className="space-y-5">
        <Input label="Name *" required value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description" hint="optional" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this metric measure and why does it matter?" />

        {/* Processes (multi-select checkboxes) */}
        <div className="bg-nia-grey-blue/5 border border-nia-grey-blue/20 rounded-lg p-4 space-y-3">
          <div>
            <span className="font-medium text-nia-dark">Linked Processes *</span>
            <p className="text-xs text-text-tertiary mt-1">
              Select the processes this metric provides evidence for. A metric can be linked to multiple processes.
            </p>
          </div>
          {(() => {
            const groups = new Map<string, ProcessOption[]>();
            for (const p of processes) {
              if (!groups.has(p.category_display_name)) groups.set(p.category_display_name, []);
              groups.get(p.category_display_name)!.push(p);
            }
            return Array.from(groups.entries()).map(([cat, procs]) => (
              <div key={cat}>
                <div className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">
                  {cat}
                </div>
                <div className="space-y-1 ml-1">
                  {procs.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProcessIds.has(p.id)}
                        onChange={() => {
                          setSelectedProcessIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 accent-nia-green"
                      />
                      <span className="text-sm text-nia-dark">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ));
          })()}
          {selectedProcessIds.size > 0 && (
            <div className="text-xs text-nia-green font-medium mt-2">
              {selectedProcessIds.size} process{selectedProcessIds.size !== 1 ? "es" : ""} selected
            </div>
          )}
        </div>

        <Select label="Cadence *" required value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="semi-annual">Semi-Annual</option>
          <option value="annual">Annual</option>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="%">% (Percentage)</option>
            <option value="score">Score</option>
            <option value="count">Count</option>
            <option value="currency">Currency ($)</option>
            <option value="days">Days</option>
            <option value="rate">Rate</option>
          </Select>
          <Select label="Trend Direction" value={isHigherBetter ? "higher" : "lower"} onChange={(e) => setIsHigherBetter(e.target.value === "higher")}>
            <option value="higher">Higher is better (e.g., satisfaction score)</option>
            <option value="lower">Lower is better (e.g., phishing click rate)</option>
          </Select>
        </div>

        <Input label="Target Value" hint="for LeTCI Levels" type="number" step="any" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Leave blank if TBD" />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Comparison Value" hint="for LeTCI Comparisons" type="number" step="any" value={comparisonValue} onChange={(e) => setComparisonValue(e.target.value)} placeholder="Benchmark or peer value" />
          <Input label="Comparison Source" value={comparisonSource} onChange={(e) => setComparisonSource(e.target.value)} placeholder="e.g., National average, Studer benchmark" />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Data Steward</label>
          <p className="text-xs text-text-muted mb-2">Person responsible for collecting and entering this metric&apos;s data.</p>
          <select
            value={dataStewardEmail}
            onChange={(e) => setDataStewardEmail(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-nia-dark-solid/30"
          >
            <option value="">— No steward assigned —</option>
            {members.map((m) => (
              <option key={m.gid} value={m.email}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Data Source" value={dataSource} onChange={(e) => setDataSource(e.target.value)} placeholder="e.g., Studer EE Survey" />
          <Input label="Collection Method" value={collectionMethod} onChange={(e) => setCollectionMethod(e.target.value)} placeholder="e.g., Semi-annual survey" />
        </div>

        {/* Key Requirements (LeTCI Integration) */}
        <div className="bg-nia-grey-blue/5 border border-nia-grey-blue/20 rounded-lg p-4 space-y-3">
          <div>
            <span className="font-medium text-nia-dark">Key Requirements (LeTCI Integration)</span>
            <p className="text-xs text-text-tertiary mt-1">
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
                <div className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">
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
            <Button type="submit" loading={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            <Button variant="ghost" href={`/metric/${metricId}`}>Cancel</Button>
          </div>
          <Button variant="danger" size="xs" onClick={() => setShowDeleteConfirm(true)}>Delete Metric</Button>
        </div>
      </Card>
      </form>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <Card accent="red" padding="lg">
          <h3 className="font-bold text-nia-red mb-2">Delete this metric?</h3>
          <p className="text-sm text-nia-red mb-4">
            This will permanently delete <strong>{name}</strong> and{" "}
            <strong>{entryCount} data {entryCount === 1 ? "entry" : "entries"}</strong>.
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              {deleting ? "Deleting..." : "Yes, Delete Permanently"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
