"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  parseObsidianProcess,
  type ParsedProcess,
} from "@/lib/parse-obsidian-process";
import Link from "next/link";

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
  const [tab, setTab] = useState<"vault" | "paste">("vault");

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
          className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors"
        >
          &larr; Back to Processes
        </Link>
        <h1 className="text-2xl font-bold text-[#324a4d] mt-2">
          Import Processes
        </h1>
        <p className="text-gray-500 mt-1">
          Import process documents from your Obsidian vault or paste markdown directly.
        </p>
      </div>

      {/* Success messages */}
      {savedProcesses.length > 0 && (
        <div className="bg-[#b1bd37]/20 border border-[#b1bd37] rounded-lg p-4">
          <p className="text-sm text-[#324a4d] font-medium">
            Successfully imported {savedProcesses.length} process
            {savedProcesses.length !== 1 ? "es" : ""}:
          </p>
          <ul className="mt-1 text-sm space-y-1">
            {savedProcesses.map((proc) => (
              <li key={proc.id}>
                <Link
                  href={`/processes/${proc.id}`}
                  className="text-[#55787c] hover:text-[#324a4d] font-medium transition-colors underline"
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
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-[#324a4d] mb-2">Import Results</h3>
          <div className="space-y-1 text-sm">
            {importResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                {r.status === "success" && (
                  <>
                    <span className="text-[#b1bd37]">&#10003;</span>
                    <Link href={`/processes/${r.id}`} className="text-[#55787c] hover:text-[#324a4d] underline">
                      {r.name}
                    </Link>
                  </>
                )}
                {r.status === "updated" && (
                  <>
                    <span className="text-[#55787c]">&#8635;</span>
                    <Link href={`/processes/${r.id}`} className="text-[#55787c] hover:text-[#324a4d] underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-[#55787c]">updated</span>
                  </>
                )}
                {r.status === "error" && (
                  <>
                    <span className="text-[#dc2626]">&#10007;</span>
                    <span className="text-gray-500">{r.name}</span>
                    <span className="text-xs text-[#dc2626]">{r.message}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab("vault")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "vault"
              ? "bg-white text-[#324a4d] shadow-sm"
              : "text-gray-500 hover:text-[#324a4d]"
          }`}
        >
          From Obsidian Vault
        </button>
        <button
          onClick={() => setTab("paste")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "paste"
              ? "bg-white text-[#324a4d] shadow-sm"
              : "text-gray-500 hover:text-[#324a4d]"
          }`}
        >
          Paste Markdown
        </button>
      </div>

      {/* ═══ VAULT TAB ═══ */}
      {tab === "vault" && (
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#f79935]">
          <h2 className="font-semibold text-[#324a4d] mb-1">
            Select Processes to Import
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Reading from your Obsidian vault. Select files and click Import.
          </p>

          {vaultLoading && (
            <p className="text-[#55787c] text-sm py-4">Scanning vault...</p>
          )}

          {vaultError && (
            <p className="text-red-600 text-sm py-4">{vaultError}</p>
          )}

          {!vaultLoading && !vaultError && (
            <>
              {/* Select all / none */}
              <div className="flex gap-3 mb-3 text-sm">
                <button onClick={selectAll} className="text-[#55787c] hover:text-[#324a4d] font-medium">
                  Select all new
                </button>
                <button onClick={selectNone} className="text-gray-400 hover:text-[#324a4d]">
                  Clear selection
                </button>
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
                                ? "bg-[#55787c]/10"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFile(file.relativePath)}
                              className="rounded border-gray-300 text-[#55787c] focus:ring-[#55787c]"
                            />
                            <span className="text-sm text-[#324a4d] flex-1">
                              {file.name}
                            </span>
                            {isExisting && (
                              <span className="text-xs text-[#55787c]">will update</span>
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
                  <p className="text-sm text-[#55787c] mb-2">{importProgress}</p>
                )}
                <button
                  onClick={handleBulkImport}
                  disabled={importing || selectedFiles.size === 0}
                  className="bg-[#324a4d] text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium"
                >
                  {importing
                    ? "Importing..."
                    : `Import ${selectedFiles.size} Process${selectedFiles.size !== 1 ? "es" : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ PASTE TAB ═══ */}
      {tab === "paste" && (
        <>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#f79935]">
            <h2 className="font-semibold text-[#324a4d] mb-2">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c] font-mono text-sm"
              placeholder="Paste your Obsidian markdown here..."
            />
            <button
              onClick={handleParse}
              disabled={!markdown.trim()}
              className="mt-3 bg-[#324a4d] text-white rounded-lg py-2 px-4 hover:opacity-90 disabled:opacity-50 text-sm font-medium"
            >
              Parse Content
            </button>
          </div>

          {parsed && (
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#f79935]">
              <h2 className="font-semibold text-[#324a4d] mb-3">
                Review Parsed Data
              </h2>

              {isDuplicate && (
                <div className="bg-[#f79935]/10 border border-[#f79935] rounded-lg p-3 mb-4">
                  <p className="text-sm text-[#b06a10] font-medium">
                    Warning: A process named &quot;{parsed.name}&quot; already exists.
                  </p>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <PreviewField label="Name" value={parsed.name} />
                <PreviewField label="Template Type" value={parsed.template_type === "full" ? "Full (ADLI)" : "Quick"} />
                <PreviewField label="Status" value={parsed.status.replace(/_/g, " ")} />
                <PreviewField label="Owner" value={parsed.owner} />
                <PreviewField label="Detected Category" value={parsed.baldrige_category} />
                <PreviewField label="Baldrige Item" value={parsed.baldrige_item} />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-[#324a4d] mb-1">
                  Assign to Baldrige Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleManualImport}
                disabled={saving || categoryId === "" || isDuplicate}
                className="mt-4 bg-[#324a4d] text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {saving ? "Importing..." : "Import Process"}
              </button>
            </div>
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
      <span className="text-[#324a4d]">
        {value || <span className="text-gray-300 italic">empty</span>}
      </span>
    </div>
  );
}
