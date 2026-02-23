// app/admin/owner-setup/page.tsx
// One-time admin tool: maps process owner display names → emails,
// seeds user_roles for each person, and populates processes.owner_email.
"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/use-role";
import { Card } from "@/components/ui";
import { useRouter } from "next/navigation";

interface AsanaMember {
  gid: string;
  name: string;
  email: string;
}

interface ProcessOwner {
  name: string;
  email: string | null;
  processCount: number;
}

interface OwnerMapping {
  name: string;
  email: string;
  fullName: string;
}

export default function OwnerSetupPage() {
  const { isSuperAdmin, loading: roleLoading } = useRole();
  const router = useRouter();

  const [owners, setOwners] = useState<ProcessOwner[]>([]);
  const [members, setMembers] = useState<AsanaMember[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({}); // name → email
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<{ name: string; email: string; processesUpdated: number; userSeeded: boolean }[] | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    if (!isSuperAdmin) { router.push("/"); return; }

    Promise.all([
      fetch("/api/admin/owner-setup").then((r) => r.json()),
      fetch("/api/asana/workspace-members").then((r) => r.json()),
    ]).then(([ownerData, memberData]) => {
      const ownerList: ProcessOwner[] = ownerData.owners ?? [];
      setOwners(ownerList);
      setMembers(memberData.members ?? []);

      // Pre-fill mappings for owners that already have an email set
      const pre: Record<string, string> = {};
      for (const o of ownerList) {
        if (o.email) pre[o.name] = o.email;
      }
      setMappings(pre);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isSuperAdmin, roleLoading, router]);

  function setMapping(ownerName: string, email: string) {
    setMappings((prev) => ({ ...prev, [ownerName]: email }));
  }

  async function handleApply() {
    setApplying(true);
    setResults(null);

    const payload: OwnerMapping[] = Object.entries(mappings)
      .filter(([, email]) => !!email)
      .map(([name, email]) => {
        const member = members.find((m) => m.email === email);
        return { name, email, fullName: member?.name ?? name };
      });

    const res = await fetch("/api/admin/owner-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings: payload }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setApplying(false);

    // Refresh owner list to reflect updated emails
    fetch("/api/admin/owner-setup").then((r) => r.json()).then((d) => {
      setOwners(d.owners ?? []);
    });
  }

  const unmappedCount = owners.filter((o) => !mappings[o.name]).length;

  if (loading || roleLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-surface-subtle rounded animate-pulse" />
        <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Owner Email Setup</h1>
        <p className="text-text-muted mt-1">
          Map each process owner to their NIA email. This seeds their Hub account and enables scorecard matching.
        </p>
      </div>

      {unmappedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          {unmappedCount} owner{unmappedCount !== 1 ? "s" : ""} not yet mapped — select an email for each row below.
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Owner (display name)</th>
              <th className="text-center px-4 py-3 font-medium text-text-secondary">Processes</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Email (Asana member)</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => {
              const mapped = mappings[o.name];
              const isAlreadySaved = !!o.email;
              return (
                <tr key={o.name} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{o.name}</p>
                    {isAlreadySaved && (
                      <p className="text-xs text-nia-green mt-0.5">✓ Email saved</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-text-secondary">{o.processCount}</td>
                  <td className="px-4 py-3">
                    <select
                      value={mapped ?? ""}
                      onChange={(e) => setMapping(o.name, e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-nia-dark-solid/30"
                    >
                      <option value="">— select —</option>
                      {members.map((m) => (
                        <option key={m.gid} value={m.email}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {Object.values(mappings).filter(Boolean).length} of {owners.length} owners mapped
        </p>
        <button
          onClick={handleApply}
          disabled={applying || Object.values(mappings).filter(Boolean).length === 0}
          className="px-6 py-2 text-sm font-semibold text-white bg-nia-dark-solid hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
        >
          {applying ? "Applying…" : "Apply All Mappings →"}
        </button>
      </div>

      {results && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground mb-3">Results</h2>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.name} → <span className="text-text-muted">{r.email}</span></span>
                <span className="text-text-muted text-xs">
                  {r.processesUpdated} process{r.processesUpdated !== 1 ? "es" : ""} updated
                  {r.userSeeded ? " · account created" : " · account exists"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-4">
            Scorecards will now show for all mapped owners. They will see their own scorecard when they log in with Google.
          </p>
        </Card>
      )}
    </div>
  );
}
