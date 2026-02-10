"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Card, Button, Input } from "@/components/ui";

export default function ImportProcessPage() {
  const [existingProcesses, setExistingProcesses] = useState<Map<string, number>>(new Map());

  // Asana import state
  const [asanaProjects, setAsanaProjects] = useState<{ gid: string; name: string; description: string; modified_at: string; team: string | null }[]>([]);
  const [asanaLoading, setAsanaLoading] = useState(true);
  const [asanaError, setAsanaError] = useState("");
  const [asanaConnected, setAsanaConnected] = useState<boolean | null>(null);
  const [asanaImporting, setAsanaImporting] = useState<string | null>(null);
  const [asanaSearch, setAsanaSearch] = useState("");
  const [showAnalyzePrompt, setShowAnalyzePrompt] = useState<{ id: number; name: string } | null>(null);
  const router = useRouter();

  const [savedProcesses, setSavedProcesses] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    document.title = "Import Processes | NIA Excellence Hub";

    async function fetchData() {
      const procRes = await supabase.from("processes").select("id, name");
      if (procRes.data) {
        const map = new Map<string, number>();
        procRes.data.forEach((p) => map.set(p.name.toLowerCase(), p.id));
        setExistingProcesses(map);
      }
    }
    fetchData();
    loadAsanaProjects();
  }, []);

  async function loadAsanaProjects() {
    setAsanaLoading(true);
    setAsanaError("");
    try {
      const res = await fetch("/api/asana/projects");
      const data = await res.json();
      if (res.status === 401) {
        setAsanaConnected(false);
        return;
      }
      if (data.error) {
        setAsanaError(data.error);
        return;
      }
      setAsanaConnected(true);
      setAsanaProjects(data.projects);
    } catch (e) {
      setAsanaError("Failed to load projects: " + (e as Error).message);
    } finally {
      setAsanaLoading(false);
    }
  }

  async function handleAsanaImport(projectGid: string) {
    setAsanaImporting(projectGid);
    setAsanaError("");
    try {
      const res = await fetch("/api/asana/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectGid }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setAsanaError(`"${data.existingName}" was already imported. View it in Processes.`);
        setAsanaImporting(null);
        return;
      }

      if (!res.ok) {
        setAsanaError(data.error || "Import failed");
        setAsanaImporting(null);
        return;
      }

      setSavedProcesses((prev) => [...prev, { id: data.id, name: data.name }]);
      setShowAnalyzePrompt({ id: data.id, name: data.name });
    } catch (e) {
      setAsanaError("Import failed: " + (e as Error).message);
    }
    setAsanaImporting(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/processes"
          className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
        >
          &larr; Back to Processes
        </Link>
        <h1 className="text-3xl font-bold text-nia-dark mt-2">
          Import from Asana
        </h1>
        <p className="text-gray-500 mt-1">
          Select an Asana project to import as a process in the Excellence Hub.
        </p>
      </div>

      {/* Success messages */}
      {savedProcesses.length > 0 && (
        <div className="success-celebrate bg-nia-green/20 border border-nia-green rounded-lg p-4">
          <p className="text-sm text-nia-dark font-medium">
            Successfully imported {savedProcesses.length} process
            {savedProcesses.length !== 1 ? "es" : ""}:
          </p>
          <ul className="mt-1 text-sm space-y-1">
            {savedProcesses.map((proc) => (
              <li key={proc.id}>
                <Link
                  href={`/processes/${proc.id}`}
                  className="text-nia-grey-blue hover:text-nia-dark font-medium transition-colors underline"
                >
                  {proc.name} &rarr;
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI analyze prompt after import */}
      {showAnalyzePrompt && (
        <div className="bg-nia-grey-blue/10 border border-nia-grey-blue rounded-lg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-nia-dark">
            <strong>{showAnalyzePrompt.name}</strong> imported! Want AI to analyze it for ADLI gaps?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="success" size="sm" onClick={() => router.push(`/processes/${showAnalyzePrompt.id}?analyze=true`)}>
              Analyze Now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAnalyzePrompt(null); router.push(`/processes/${showAnalyzePrompt.id}`); }}>
              Skip
            </Button>
          </div>
        </div>
      )}

      {/* Asana projects */}
      <Card accent="orange" padding="sm">
        {asanaConnected === false && (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F06A6A] to-[#e05555] flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="white">
                <circle cx="10" cy="13" r="3.5" />
                <circle cx="4" cy="6.5" r="3.5" />
                <circle cx="16" cy="6.5" r="3.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-nia-dark mb-1">
              Connect Asana to import projects
            </p>
            <p className="text-xs text-gray-400 mb-4">
              You&apos;ll be able to select any project from your workspace.
            </p>
            <Button size="sm" href="/settings">
              Go to Settings
            </Button>
          </div>
        )}

        {asanaLoading && asanaConnected !== false && (
          <div className="py-6 text-center">
            <p className="text-nia-grey-blue text-sm">Loading Asana projects...</p>
          </div>
        )}

        {asanaError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            {asanaError}
          </div>
        )}

        {asanaConnected && !asanaLoading && asanaProjects.length === 0 && !asanaError && (
          <p className="text-gray-400 text-sm py-4">No projects found in your Asana workspace.</p>
        )}

        {asanaConnected && asanaProjects.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-nia-dark">
                Your Asana Projects
              </h2>
              <span className="text-xs text-gray-400">{asanaProjects.length} projects</span>
            </div>
            <Input
              value={asanaSearch}
              onChange={(e) => setAsanaSearch(e.target.value)}
              placeholder="Search projects..."
              className="mb-4"
            />

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {asanaProjects
                .filter((p) =>
                  p.name.toLowerCase().includes(asanaSearch.toLowerCase())
                )
                .map((project) => {
                  const isImporting = asanaImporting === project.gid;
                  const alreadySaved = savedProcesses.some(
                    (sp) => sp.name === project.name
                  );
                  const alreadyExists = existingProcesses.has(project.name.toLowerCase());

                  return (
                    <div
                      key={project.gid}
                      className="flex items-center justify-between gap-4 px-3 py-3 rounded-lg border border-gray-100 hover:border-nia-grey-blue/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-nia-dark truncate">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {project.description}
                          </p>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          {project.team && <span>{project.team}</span>}
                          {project.modified_at && (
                            <span>
                              Updated{" "}
                              {new Date(project.modified_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {alreadySaved ? (
                          <span className="text-xs text-nia-green font-medium">
                            Imported
                          </span>
                        ) : alreadyExists ? (
                          <span className="text-xs text-gray-400">
                            Already in Hub
                          </span>
                        ) : (
                          <Button
                            size="xs"
                            onClick={() => handleAsanaImport(project.gid)}
                            disabled={isImporting || asanaImporting !== null}
                            loading={isImporting}
                          >
                            {isImporting ? "Importing..." : "Import"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
