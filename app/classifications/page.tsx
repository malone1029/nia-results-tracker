"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { fetchHealthData, type ProcessWithCategory } from "@/lib/fetch-health-data";
import { useRole } from "@/lib/use-role";
import { ListPageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { Card, Button, Badge } from "@/components/ui";

type ProcessType = "key" | "support" | "unclassified";

export default function ClassificationsPage() {
  const [processes, setProcesses] = useState<ProcessWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | ProcessType>("all");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const { isAdmin } = useRole();

  // AI classification state
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Classifications | NIA Excellence Hub";
    async function load() {
      const { processes: procs } = await fetchHealthData();
      setProcesses(procs);
      setLoading(false);
    }
    load();
  }, []);

  async function toggleType(id: number, currentType: string) {
    const next: ProcessType =
      currentType === "key" ? "support" : currentType === "support" ? "unclassified" : "key";
    setSavingId(id);
    await supabase.from("processes").update({ process_type: next }).eq("id", id);
    setProcesses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, process_type: next } : p))
    );
    setSavingId(null);
  }

  async function setType(id: number, newType: ProcessType) {
    setSavingId(id);
    await supabase.from("processes").update({ process_type: newType }).eq("id", id);
    setProcesses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, process_type: newType } : p))
    );
    setSavingId(null);
  }

  async function runClassification() {
    setClassifyLoading(true);
    setClassifyMsg(null);
    try {
      const res = await fetch("/api/processes/classify", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setClassifyMsg(data.error || "Classification failed");
        setClassifyLoading(false);
        return;
      }
      const data = await res.json();
      // Apply suggestions and save rationale
      for (const s of data.suggestions) {
        await supabase
          .from("processes")
          .update({
            process_type: s.suggestion,
            classification_rationale: s.rationale,
          })
          .eq("id", s.process_id);
      }
      // Update local state
      setProcesses((prev) =>
        prev.map((p) => {
          const match = data.suggestions.find(
            (s: { process_id: number }) => s.process_id === p.id
          );
          return match
            ? {
                ...p,
                process_type: match.suggestion,
                classification_rationale: match.rationale,
              }
            : p;
        })
      );
      const keyCount = data.suggestions.filter(
        (s: { suggestion: string }) => s.suggestion === "key"
      ).length;
      const supportCount = data.suggestions.filter(
        (s: { suggestion: string }) => s.suggestion === "support"
      ).length;
      setClassifyMsg(
        `AI classified ${keyCount} Key and ${supportCount} Support processes`
      );
      setTimeout(() => setClassifyMsg(null), 6000);
    } catch {
      setClassifyMsg("Network error — please try again");
    }
    setClassifyLoading(false);
  }

  // Group by category
  const filtered = useMemo(() => {
    return processes
      .filter((p) => {
        if (filterType !== "all" && p.process_type !== filterType) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [processes, filterType, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProcessWithCategory[]>();
    for (const p of filtered) {
      const cat = p.category_display_name;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [filtered]);

  if (loading) return <ListPageSkeleton showStats statCount={3} />;

  // Stats
  const keyCount = processes.filter((p) => p.process_type === "key").length;
  const supportCount = processes.filter((p) => p.process_type === "support").length;
  const unclassifiedCount = processes.filter(
    (p) => p.process_type === "unclassified" || !p.process_type
  ).length;
  const withRationale = processes.filter((p) => p.classification_rationale).length;

  return (
    <div className="space-y-6 content-appear">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">Classifications</h1>
          <p className="text-text-tertiary mt-1">
            Manage Key vs Support process classifications for Baldrige alignment
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={runClassification}
            disabled={classifyLoading}
          >
            {classifyLoading ? "Analyzing..." : "Run AI Classification"}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => setFilterType(filterType === "key" ? "all" : "key")}>
          <Card
            variant="interactive"
            accent={filterType === "key" ? "orange" : "dark"}
            padding="sm"
            className="text-center"
          >
            <div className="text-2xl font-bold font-display number-pop text-nia-orange">
              {keyCount}
            </div>
            <div className="text-xs text-text-muted">Key Processes</div>
          </Card>
        </button>
        <button onClick={() => setFilterType(filterType === "support" ? "all" : "support")}>
          <Card
            variant="interactive"
            accent={filterType === "support" ? "orange" : "dark"}
            padding="sm"
            className="text-center"
          >
            <div className="text-2xl font-bold font-display number-pop text-nia-grey-blue">
              {supportCount}
            </div>
            <div className="text-xs text-text-muted">Support Processes</div>
          </Card>
        </button>
        <button
          onClick={() =>
            setFilterType(filterType === "unclassified" ? "all" : "unclassified")
          }
        >
          <Card
            variant="interactive"
            accent={unclassifiedCount > 0 ? "red" : "dark"}
            padding="sm"
            className="text-center"
          >
            <div
              className={`text-2xl font-bold font-display number-pop ${
                unclassifiedCount > 0 ? "text-nia-red" : "text-nia-dark"
              }`}
            >
              {unclassifiedCount}
            </div>
            <div className="text-xs text-text-muted">Unclassified</div>
          </Card>
        </button>
        <Card variant="interactive" accent="dark" padding="sm" className="text-center">
          <div className="text-2xl font-bold font-display number-pop text-nia-dark">
            {withRationale}
          </div>
          <div className="text-xs text-text-muted">Have AI Rationale</div>
        </Card>
      </div>

      {/* Messages */}
      {classifyMsg && (
        <div className="bg-nia-green/10 border border-nia-green/30 text-nia-green rounded-lg px-4 py-3 text-sm font-medium">
          {classifyMsg}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search processes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
        />
        {(filterType !== "all" || search) && (
          <button
            onClick={() => {
              setFilterType("all");
              setSearch("");
            }}
            className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-text-muted ml-auto">
          {filtered.length} process{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Process cards grouped by category */}
      {[...grouped.entries()].map(([category, procs]) => (
        <div key={category}>
          <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-3">
            {category}{" "}
            <span className="text-text-muted font-normal">({procs.length})</span>
          </h2>
          <Card>
            <div className="divide-y divide-border-light">
              {procs.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-surface-hover/50 transition-colors"
                >
                  {/* Process name + link */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/processes/${p.id}`}
                      className="font-medium text-nia-dark hover:text-nia-orange transition-colors"
                    >
                      {p.name}
                    </Link>
                    {p.owner && (
                      <span className="text-xs text-text-muted ml-2">{p.owner}</span>
                    )}
                  </div>

                  {/* Classification toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setType(p.id, "key")}
                      disabled={savingId === p.id}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                        p.process_type === "key"
                          ? "bg-nia-orange text-white shadow-sm"
                          : "bg-surface-subtle text-text-muted hover:bg-nia-orange/10 hover:text-nia-orange"
                      }`}
                    >
                      {"\u2605"} Key
                    </button>
                    <button
                      onClick={() => setType(p.id, "support")}
                      disabled={savingId === p.id}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                        p.process_type === "support"
                          ? "bg-nia-grey-blue text-white shadow-sm"
                          : "bg-surface-subtle text-text-muted hover:bg-nia-grey-blue/10 hover:text-nia-grey-blue"
                      }`}
                    >
                      Support
                    </button>
                  </div>

                  {/* Rationale */}
                  <div className="text-xs text-text-tertiary sm:max-w-[40%] leading-relaxed">
                    {p.classification_rationale || (
                      <span className="italic text-text-muted">
                        No rationale yet — run AI Classification
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}

      {filtered.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-text-muted">No processes match your filters</p>
        </Card>
      )}

      {/* Help text */}
      <div className="text-xs text-text-muted text-center py-4">
        <strong>Key processes</strong> directly produce value for customers and
        stakeholders. <strong>Support processes</strong> enable key processes to
        function.{" "}
        <Link
          href="/processes"
          className="text-nia-grey-blue hover:text-nia-dark transition-colors"
        >
          Back to Processes
        </Link>
      </div>
    </div>
  );
}
