"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  parseObsidianProcess,
  type ParsedProcess,
} from "@/lib/parse-obsidian-process";
import Link from "next/link";
import { Card, Button, Input, Select } from "@/components/ui";

interface CategoryOption {
  id: number;
  display_name: string;
}

interface VaultFile {
  name: string;
  relativePath: string;
  category: string;
}

interface ImportResult {
  id: number;
  name: string;
  status: "success" | "updated" | "error";
  message?: string;
}

// Map vault folder names to Baldrige category display names
const FOLDER_TO_CATEGORY: Record<string, string> = {
  "1-Leadership": "Leadership",
  "2-Strategy": "Strategy",
  "3-Customers": "Customers",
  "4-Measurement": "Measurement, Analysis & Knowledge Management",
  "5-Workforce": "Workforce",
  "6-Operations": "Operations",
};

export default function ImportProcessPage() {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [existingProcesses, setExistingProcesses] = useState<Map<string, number>>(new Map()); // name -> id
  const [tab, setTab] = useState<"vault" | "paste" | "asana">("vault");

  // Vault import state
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [vaultError, setVaultError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importProgress, setImportProgress] = useState("");

  // Manual paste state
  const [markdown, setMarkdown] = useState("");
  const [parsed, setParsed] = useState<ParsedProcess | null>(null);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Asana import state
  const [asanaProjects, setAsanaProjects] = useState<{ gid: string; name: string; description: string; modified_at: string; team: string | null }[]>([]);
  const [asanaLoading, setAsanaLoading] = useState(false);
  const [asanaError, setAsanaError] = useState("");
  const [asanaConnected, setAsanaConnected] = useState<boolean | null>(null);
  const [asanaImporting, setAsanaImporting] = useState<string | null>(null); // gid of project being imported
  const [asanaSearch, setAsanaSearch] = useState("");
  const [showAnalyzePrompt, setShowAnalyzePrompt] = useState<{ id: number; name: string } | null>(null);
  const router = useRouter();

  // Combined success tracking
  const [savedProcesses, setSavedProcesses] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    document.title = "Import Processes | NIA Excellence Hub";

    async function fetchData() {
      const [catRes, procRes] = await Promise.all([
        supabase.from("categories").select("id, display_name").order("sort_order"),
        supabase.from("processes").select("id, name"),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (procRes.data) {
        const map = new Map<string, number>();
        procRes.data.forEach((p) => map.set(p.name.toLowerCase(), p.id));
        setExistingProcesses(map);
      }
    }
    fetchData();
  }, []);

  // Load vault files
  useEffect(() => {
    async function loadVault() {
      try {
        const res = await fetch("/api/vault-files");
        const data = await res.json();
        if (data.error) {
          setVaultError(data.error);
        } else {
          setVaultFiles(data.files);
        }
      } catch (e) {
        setVaultError("Failed to connect to vault: " + (e as Error).message);
      }
      setVaultLoading(false);
    }
    loadVault();
  }, []);

  // Load Asana projects when tab switches to asana
  useEffect(() => {
    if (tab !== "asana" || asanaProjects.length > 0 || asanaConnected === false) return;
    loadAsanaProjects();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function toggleFile(path: string) {
    const next = new Set(selectedFiles);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedFiles(next);
  }

  function selectAll() {
    setSelectedFiles(new Set(vaultFiles.map((f) => f.relativePath)));
  }

  function selectNone() {
    setSelectedFiles(new Set());
  }

  function findCategoryId(vaultFile: VaultFile, parsed: ParsedProcess): number | null {
    // First try: use parsed baldrige_category from frontmatter
    if (parsed.baldrige_category) {
      const match = categories.find(
        (c) =>
          c.display_name.toLowerCase().includes(parsed.baldrige_category!.toLowerCase()) ||
          parsed.baldrige_category!.toLowerCase().includes(c.display_name.toLowerCase())
      );
      if (match) return match.id;
    }

    // Second try: use vault folder name
    const folderCat = FOLDER_TO_CATEGORY[vaultFile.category];
    if (folderCat) {
      const match = categories.find((c) => c.display_name === folderCat);
      if (match) return match.id;
    }

    return null;
  }

  async function handleBulkImport() {
    if (selectedFiles.size === 0) return;
    setImporting(true);
    setImportResults([]);
    setError("");

    const results: ImportResult[] = [];
    const filePaths = Array.from(selectedFiles);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const file = vaultFiles.find((f) => f.relativePath === filePath);
      if (!file) continue;

      setImportProgress(`Importing ${i + 1} of ${filePaths.length}: ${file.name}...`);

      try {
        // Fetch file content from vault
        // Encode each path segment individually so slashes stay as path separators
        const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
        const res = await fetch(`/api/vault-files/${encodedPath}`);
        const data = await res.json();
        if (data.error) {
          results.push({ id: 0, name: file.name, status: "error", message: data.error });
          continue;
        }

        // Parse the markdown
        const parsed = parseObsidianProcess(data.content);

        // Find category
        const catId = findCategoryId(file, parsed);
        if (!catId) {
          results.push({ id: 0, name: parsed.name, status: "error", message: "Could not determine Baldrige category" });
          continue;
        }

        const processData = {
          name: parsed.name,
          category_id: catId,
          baldrige_item: parsed.baldrige_item,
          status: parsed.status,
          template_type: "full",
          owner: parsed.owner,
          reviewer: parsed.reviewer,
          description: parsed.description,
          basic_steps: parsed.basic_steps.length > 0 ? parsed.basic_steps : null,
          participants: parsed.participants.length > 0 ? parsed.participants : null,
          metrics_summary: parsed.metrics_summary,
          connections: parsed.connections,
          charter: parsed.charter,
          adli_approach: parsed.adli_approach,
          adli_deployment: parsed.adli_deployment,
          adli_learning: parsed.adli_learning,
          adli_integration: parsed.adli_integration,
          workflow: parsed.workflow,
          baldrige_connections: parsed.baldrige_connections,
          is_key: false,
        };

        // Check if this process already exists
        const existingId = existingProcesses.get(parsed.name.toLowerCase());

        if (existingId) {
          // Update existing process
          const { error: updateError } = await supabase
            .from("processes")
            .update(processData)
            .eq("id", existingId);

          if (updateError) {
            results.push({ id: 0, name: parsed.name, status: "error", message: updateError.message });
          } else {
            results.push({ id: existingId, name: parsed.name, status: "updated" });
            setSavedProcesses((prev) => [...prev, { id: existingId, name: parsed.name }]);
          }
        } else {
          // Insert new process
          const { data: insertData, error: insertError } = await supabase
            .from("processes")
            .insert(processData)
            .select("id")
            .single();

          if (insertError) {
            results.push({ id: 0, name: parsed.name, status: "error", message: insertError.message });
          } else {
            results.push({ id: insertData.id, name: parsed.name, status: "success" });
            setExistingProcesses((prev) => new Map([...prev, [parsed.name.toLowerCase(), insertData.id]]));
            setSavedProcesses((prev) => [...prev, { id: insertData.id, name: parsed.name }]);
          }
        }
      } catch (e) {
        results.push({ id: 0, name: file.name, status: "error", message: (e as Error).message });
      }
    }

    setImportResults(results);
    setSelectedFiles(new Set());
    setImportProgress("");
    setImporting(false);
  }

  // --- Manual paste handlers ---

  function handleParse() {
    setError("");
    setParsed(null);
    if (!markdown.trim()) {
      setError("Paste some markdown content first.");
      return;
    }
    try {
      const result = parseObsidianProcess(markdown);
      setParsed(result);
      if (result.baldrige_category) {
        const match = categories.find(
          (c) =>
            c.display_name.toLowerCase().includes(result.baldrige_category!.toLowerCase()) ||
            result.baldrige_category!.toLowerCase().includes(c.display_name.toLowerCase())
        );
        if (match) setCategoryId(match.id);
      }
    } catch (e) {
      setError("Failed to parse markdown: " + (e as Error).message);
    }
  }

  async function handleManualImport() {
    if (!parsed || categoryId === "") return;
    setSaving(true);
    setError("");

    const processData = {
      name: parsed.name,
      category_id: categoryId,
      baldrige_item: parsed.baldrige_item,
      status: parsed.status,
      template_type: parsed.template_type,
      owner: parsed.owner,
      reviewer: parsed.reviewer,
      description: parsed.description,
      basic_steps: parsed.basic_steps.length > 0 ? parsed.basic_steps : null,
      participants: parsed.participants.length > 0 ? parsed.participants : null,
      metrics_summary: parsed.metrics_summary,
      connections: parsed.connections,
      charter: parsed.charter,
      adli_approach: parsed.adli_approach,
      adli_deployment: parsed.adli_deployment,
      adli_learning: parsed.adli_learning,
      adli_integration: parsed.adli_integration,
      workflow: parsed.workflow,
      baldrige_connections: parsed.baldrige_connections,
    };

    const existingId = existingProcesses.get(parsed.name.toLowerCase());
    let resultId: number;

    if (existingId) {
      const { error: updateError } = await supabase
        .from("processes")
        .update(processData)
        .eq("id", existingId);
      if (updateError) {
        setError("Failed to update: " + updateError.message);
        setSaving(false);
        return;
      }
      resultId = existingId;
    } else {
      const { data: insertData, error: insertError } = await supabase
        .from("processes")
        .insert(processData)
        .select("id")
        .single();
      if (insertError) {
        setError("Failed to save: " + insertError.message);
        setSaving(false);
        return;
      }
      resultId = insertData.id;
      setExistingProcesses((prev) => new Map([...prev, [parsed.name.toLowerCase(), resultId]]));
    }

    setSavedProcesses([...savedProcesses, { id: resultId, name: parsed.name }]);
    setMarkdown("");
    setParsed(null);
    setCategoryId("");
    setSaving(false);
  }

  const isDuplicate = parsed ? existingProcesses.has(parsed.name.toLowerCase()) : false;

  // Group vault files by category for display
  const filesByCategory: Record<string, VaultFile[]> = {};
  for (const f of vaultFiles) {
    const cat = FOLDER_TO_CATEGORY[f.category] || f.category;
    if (!filesByCategory[cat]) filesByCategory[cat] = [];
    filesByCategory[cat].push(f);
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
          Import Processes
        </h1>
        <p className="text-gray-500 mt-1">
          Import processes from Asana, your Obsidian vault, or paste markdown directly.
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

      {/* Bulk import results */}
      {importResults.length > 0 && (
        <Card padding="sm">
          <h3 className="font-semibold text-nia-dark mb-2">Import Results</h3>
          <div className="space-y-1 text-sm">
            {importResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                {r.status === "success" && (
                  <>
                    <span className="text-nia-green">&#10003;</span>
                    <Link href={`/processes/${r.id}`} className="text-nia-grey-blue hover:text-nia-dark underline">
                      {r.name}
                    </Link>
                  </>
                )}
                {r.status === "updated" && (
                  <>
                    <span className="text-nia-grey-blue">&#8635;</span>
                    <Link href={`/processes/${r.id}`} className="text-nia-grey-blue hover:text-nia-dark underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-nia-grey-blue">updated</span>
                  </>
                )}
                {r.status === "error" && (
                  <>
                    <span className="text-nia-red">&#10007;</span>
                    <span className="text-gray-500">{r.name}</span>
                    <span className="text-xs text-nia-red">{r.message}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* AI analyze prompt after Asana import */}
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

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab("asana")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "asana"
              ? "bg-white text-nia-dark shadow-sm"
              : "text-gray-500 hover:text-nia-dark"
          }`}
        >
          From Asana
        </button>
        <button
          onClick={() => setTab("vault")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "vault"
              ? "bg-white text-nia-dark shadow-sm"
              : "text-gray-500 hover:text-nia-dark"
          }`}
        >
          From Obsidian Vault
        </button>
        <button
          onClick={() => setTab("paste")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "paste"
              ? "bg-white text-nia-dark shadow-sm"
              : "text-gray-500 hover:text-nia-dark"
          }`}
        >
          Paste Markdown
        </button>
      </div>

      {/* ═══ ASANA TAB ═══ */}
      {tab === "asana" && (
        <Card accent="orange" padding="sm">
          <h2 className="font-semibold text-nia-dark mb-1">
            Import from Asana
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Select an Asana project to import as an NIA process.
          </p>

          {asanaConnected === false && (
            <div className="py-4">
              <p className="text-nia-grey-blue text-sm font-medium mb-2">
                Connect your Asana account first
              </p>
              <Button size="sm" href="/settings">Go to Settings</Button>
            </div>
          )}

          {asanaLoading && (
            <p className="text-nia-grey-blue text-sm py-4">Loading Asana projects...</p>
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
              {/* Count + Search filter */}
              <p className="text-xs text-gray-400 mb-2">{asanaProjects.length} projects found</p>
              <Input value={asanaSearch} onChange={(e) => setAsanaSearch(e.target.value)} placeholder="Search projects..." className="mb-4" />

              {/* Project list */}
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
                          ) : (
                            <Button size="xs" onClick={() => handleAsanaImport(project.gid)} disabled={isImporting || asanaImporting !== null} loading={isImporting}>
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
      )}

      {/* ═══ VAULT TAB ═══ */}
      {tab === "vault" && (
        <Card accent="orange" padding="sm">
          <h2 className="font-semibold text-nia-dark mb-1">
            Select Processes to Import
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Reading from your Obsidian vault. Select files and click Import.
          </p>

          {vaultLoading && (
            <p className="text-nia-grey-blue text-sm py-4">Scanning vault...</p>
          )}

          {vaultError && (
            <div className="py-4">
              <p className="text-nia-grey-blue text-sm font-medium mb-1">
                Vault import is only available when running locally
              </p>
              <p className="text-gray-400 text-xs">
                The app needs access to your Obsidian vault on disk. Use the &quot;Paste Markdown&quot; tab to import manually, or run the app locally with <code className="bg-gray-100 px-1 rounded">npm run dev</code>.
              </p>
            </div>
          )}

          {!vaultLoading && !vaultError && (
            <>
              {/* Select all / none */}
              <div className="flex gap-3 mb-3 text-sm items-center">
                <Button variant="ghost" size="xs" onClick={selectAll}>Select all new</Button>
                <Button variant="ghost" size="xs" onClick={selectNone}>Clear selection</Button>
                <span className="text-gray-400 ml-auto">
                  {selectedFiles.size} selected
                </span>
              </div>

              {/* File list grouped by category */}
              <div className="space-y-4">
                {Object.entries(filesByCategory).map(([cat, files]) => (
                  <div key={cat}>
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      {cat}
                    </h3>
                    <div className="space-y-1">
                      {files.map((file) => {
                        const isSelected = selectedFiles.has(file.relativePath);
                        const isExisting = existingProcesses.has(
                          file.name.toLowerCase()
                        ) || existingProcesses.has(
                          file.name.replace(/-/g, " ").toLowerCase()
                        );

                        return (
                          <label
                            key={file.relativePath}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-nia-grey-blue/10"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFile(file.relativePath)}
                              className="rounded border-gray-300 text-nia-grey-blue focus:ring-nia-grey-blue"
                            />
                            <span className="text-sm text-nia-dark flex-1">
                              {file.name}
                            </span>
                            {isExisting && (
                              <span className="text-xs text-nia-grey-blue">will update</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Import button */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                {importProgress && (
                  <p className="text-sm text-nia-grey-blue mb-2">{importProgress}</p>
                )}
                <Button onClick={handleBulkImport} disabled={importing || selectedFiles.size === 0} loading={importing}>
                  {importing
                    ? "Importing..."
                    : `Import ${selectedFiles.size} Process${selectedFiles.size !== 1 ? "es" : ""}`}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ═══ PASTE TAB ═══ */}
      {tab === "paste" && (
        <>
          <Card accent="orange" padding="sm">
            <h2 className="font-semibold text-nia-dark mb-2">
              Paste Markdown
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Open a process file in Obsidian, switch to Source Mode (Ctrl/Cmd +
              E), select all (Ctrl/Cmd + A), and paste here.
            </p>
            <textarea
              value={markdown}
              onChange={(e) => {
                setMarkdown(e.target.value);
                setParsed(null);
              }}
              rows={12}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue font-mono text-sm"
              placeholder="Paste your Obsidian markdown here..."
            />
            <Button size="sm" onClick={handleParse} disabled={!markdown.trim()} className="mt-3">
              Parse Content
            </Button>
          </Card>

          {parsed && (
            <Card accent="orange" padding="sm">
              <h2 className="font-semibold text-nia-dark mb-3">
                Review Parsed Data
              </h2>

              {isDuplicate && (
                <div className="bg-nia-orange/10 border border-nia-orange rounded-lg p-3 mb-4">
                  <p className="text-sm text-nia-orange-dark font-medium">
                    Warning: A process named &quot;{parsed.name}&quot; already exists.
                  </p>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <PreviewField label="Name" value={parsed.name} />
                <PreviewField label="Status" value={parsed.status.replace(/_/g, " ")} />
                <PreviewField label="Owner" value={parsed.owner} />
                <PreviewField label="Detected Category" value={parsed.baldrige_category} />
                <PreviewField label="Baldrige Item" value={parsed.baldrige_item} />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <Select label="Assign to Baldrige Category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </Select>
              </div>

              <Button onClick={handleManualImport} disabled={saving || categoryId === "" || isDuplicate} loading={saving} className="mt-4">
                {saving ? "Importing..." : "Import Process"}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function PreviewField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 w-36 flex-shrink-0 text-right">{label}:</span>
      <span className="text-nia-dark">
        {value || <span className="text-gray-300 italic">empty</span>}
      </span>
    </div>
  );
}
