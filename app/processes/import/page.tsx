'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Card, Button, Input } from '@/components/ui';

type BulkResult = {
  gid: string;
  name: string;
  status: 'success' | 'skipped' | 'failed';
  processId?: number;
  error?: string;
};

type BulkProgress = {
  total: number;
  completed: number;
  currentName: string;
  results: BulkResult[];
};

export default function ImportProcessPage() {
  const [existingProcesses, setExistingProcesses] = useState<Map<string, number>>(new Map());
  const [importedGids, setImportedGids] = useState<Set<string>>(new Set());

  // Asana import state
  const [asanaProjects, setAsanaProjects] = useState<
    { gid: string; name: string; description: string; modified_at: string; team: string | null }[]
  >([]);
  const [asanaLoading, setAsanaLoading] = useState(true);
  const [asanaError, setAsanaError] = useState('');
  const [asanaConnected, setAsanaConnected] = useState<boolean | null>(null);
  const [asanaImporting, setAsanaImporting] = useState<string | null>(null);
  const [asanaSearch, setAsanaSearch] = useState('');
  const [showAnalyzePrompt, setShowAnalyzePrompt] = useState<{ id: number; name: string } | null>(
    null
  );
  const router = useRouter();

  const [savedProcesses, setSavedProcesses] = useState<{ id: number; name: string }[]>([]);

  // Bulk import state
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [bulkSummary, setBulkSummary] = useState<BulkResult[] | null>(null);

  useEffect(() => {
    document.title = 'Import Processes | NIA Excellence Hub';

    async function fetchData() {
      const procRes = await supabase.from('processes').select('id, name, asana_project_gid');
      if (procRes.data) {
        const map = new Map<string, number>();
        const gids = new Set<string>();
        procRes.data.forEach(
          (p: { id: number; name: string; asana_project_gid: string | null }) => {
            map.set(p.name.toLowerCase(), p.id);
            if (p.asana_project_gid) gids.add(p.asana_project_gid);
          }
        );
        setExistingProcesses(map);
        setImportedGids(gids);
      }
    }
    fetchData();
    loadAsanaProjects();
  }, []);

  async function loadAsanaProjects() {
    setAsanaLoading(true);
    setAsanaError('');
    try {
      const res = await fetch('/api/asana/projects');
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
      setAsanaError('Failed to load projects: ' + (e as Error).message);
    } finally {
      setAsanaLoading(false);
    }
  }

  async function handleAsanaImport(projectGid: string) {
    setAsanaImporting(projectGid);
    setAsanaError('');
    try {
      const res = await fetch('/api/asana/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectGid }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setAsanaError(`"${data.existingName}" was already imported. View it in Processes.`);
        setAsanaImporting(null);
        return;
      }

      if (!res.ok) {
        setAsanaError(data.error || 'Import failed');
        setAsanaImporting(null);
        return;
      }

      setSavedProcesses((prev) => [...prev, { id: data.id, name: data.name }]);
      setImportedGids((prev) => new Set(prev).add(projectGid));
      setShowAnalyzePrompt({ id: data.id, name: data.name });
    } catch (e) {
      setAsanaError('Import failed: ' + (e as Error).message);
    }
    setAsanaImporting(null);
  }

  // --- Bulk import helpers ---

  function isProjectImportable(project: { gid: string; name: string }) {
    return (
      !importedGids.has(project.gid) &&
      !existingProcesses.has(project.name.toLowerCase()) &&
      !savedProcesses.some((sp) => sp.name === project.name)
    );
  }

  function toggleSelect(gid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  }

  function selectAllImportable() {
    const search = asanaSearch.toLowerCase();
    const importable = asanaProjects
      .filter((p) => p.name.toLowerCase().includes(search) && isProjectImportable(p))
      .map((p) => p.gid);
    setSelected(new Set(importable));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelected(new Set());
    setBulkSummary(null);
  }

  async function handleBulkImport() {
    const projectsToImport = asanaProjects.filter((p) => selected.has(p.gid));
    if (projectsToImport.length === 0) return;

    setBulkImporting(true);
    setBulkSummary(null);
    setAsanaError('');
    const progress: BulkProgress = {
      total: projectsToImport.length,
      completed: 0,
      currentName: projectsToImport[0].name,
      results: [],
    };
    setBulkProgress({ ...progress });

    for (const project of projectsToImport) {
      progress.currentName = project.name;
      setBulkProgress({ ...progress });

      try {
        const res = await fetch('/api/asana/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectGid: project.gid }),
        });
        const data = await res.json();

        if (res.status === 409) {
          progress.results.push({
            gid: project.gid,
            name: project.name,
            status: 'skipped',
            error: 'Already imported',
          });
        } else if (!res.ok) {
          progress.results.push({
            gid: project.gid,
            name: project.name,
            status: 'failed',
            error: data.error || 'Import failed',
          });
        } else {
          progress.results.push({
            gid: project.gid,
            name: project.name,
            status: 'success',
            processId: data.id,
          });
          setSavedProcesses((prev) => [...prev, { id: data.id, name: data.name }]);
          setImportedGids((prev) => new Set(prev).add(project.gid));
        }
      } catch (e) {
        progress.results.push({
          gid: project.gid,
          name: project.name,
          status: 'failed',
          error: (e as Error).message,
        });
      }

      progress.completed += 1;
      setBulkProgress({ ...progress });
    }

    setBulkImporting(false);
    setBulkSummary(progress.results);
    setBulkProgress(null);
    setSelected(new Set());
  }

  // --- Derived values ---

  const filteredProjects = asanaProjects.filter((p) =>
    p.name.toLowerCase().includes(asanaSearch.toLowerCase())
  );

  const importableCount = filteredProjects.filter((p) => isProjectImportable(p)).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/processes"
          className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
        >
          &larr; Back to Processes
        </Link>
        <h1 className="text-3xl font-bold text-nia-dark mt-2">Import from Asana</h1>
        <p className="text-text-tertiary mt-1">
          {bulkMode
            ? 'Select multiple projects to import them all at once.'
            : 'Select an Asana project to import as a process in the Excellence Hub.'}
        </p>
      </div>

      {/* Success messages (single import mode) */}
      {savedProcesses.length > 0 && !bulkMode && !bulkSummary && (
        <div className="success-celebrate bg-nia-green/20 border border-nia-green rounded-lg p-4">
          <p className="text-sm text-nia-dark font-medium">
            Successfully imported {savedProcesses.length} process
            {savedProcesses.length !== 1 ? 'es' : ''}:
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

      {/* AI analyze prompt after single import */}
      {showAnalyzePrompt && !bulkMode && (
        <div className="bg-nia-grey-blue/10 border border-nia-grey-blue rounded-lg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-nia-dark">
            <strong>{showAnalyzePrompt.name}</strong> imported! Want AI to analyze it for ADLI gaps?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="success"
              size="sm"
              onClick={() => router.push(`/processes/${showAnalyzePrompt.id}?analyze=true`)}
            >
              Analyze Now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAnalyzePrompt(null);
                router.push(`/processes/${showAnalyzePrompt.id}`);
              }}
            >
              Skip
            </Button>
          </div>
        </div>
      )}

      {/* Bulk import progress */}
      {bulkProgress && (
        <Card padding="sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-nia-dark">Importing projects...</p>
              <span className="text-xs text-text-muted">
                {bulkProgress.completed} of {bulkProgress.total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-nia-orange rounded-full transition-all duration-500"
                style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
              />
            </div>

            {/* Current item */}
            {bulkProgress.completed < bulkProgress.total && (
              <p className="text-xs text-text-muted">
                Importing:{' '}
                <span className="font-medium text-nia-dark">{bulkProgress.currentName}</span>
              </p>
            )}

            {/* Live results feed */}
            {bulkProgress.results.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {bulkProgress.results.map((r) => (
                  <div key={r.gid} className="flex items-center gap-2 text-xs">
                    {r.status === 'success' && <span className="text-nia-green">&#10003;</span>}
                    {r.status === 'skipped' && <span className="text-text-muted">&ndash;</span>}
                    {r.status === 'failed' && <span className="text-nia-red">&#10007;</span>}
                    <span className={r.status === 'failed' ? 'text-nia-red' : 'text-foreground'}>
                      {r.name}
                    </span>
                    {r.error && <span className="text-text-muted">({r.error})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Bulk import summary (post-import) */}
      {bulkSummary && (
        <Card padding="sm">
          <div className="space-y-3">
            <p className="text-sm font-medium text-nia-dark">Import Complete</p>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              {bulkSummary.filter((r) => r.status === 'success').length > 0 && (
                <span className="text-nia-green font-medium">
                  {bulkSummary.filter((r) => r.status === 'success').length} imported
                </span>
              )}
              {bulkSummary.filter((r) => r.status === 'skipped').length > 0 && (
                <span className="text-text-muted">
                  {bulkSummary.filter((r) => r.status === 'skipped').length} skipped
                </span>
              )}
              {bulkSummary.filter((r) => r.status === 'failed').length > 0 && (
                <span className="text-nia-red font-medium">
                  {bulkSummary.filter((r) => r.status === 'failed').length} failed
                </span>
              )}
            </div>

            {/* Failed details */}
            {bulkSummary.some((r) => r.status === 'failed') && (
              <div className="bg-nia-red/10 border border-nia-red/30 rounded-lg p-3 text-sm text-nia-red space-y-1">
                {bulkSummary
                  .filter((r) => r.status === 'failed')
                  .map((r) => (
                    <p key={r.gid}>
                      <strong>{r.name}:</strong> {r.error}
                    </p>
                  ))}
              </div>
            )}

            {/* Successful imports list */}
            {bulkSummary.some((r) => r.status === 'success') && (
              <div className="space-y-1">
                {bulkSummary
                  .filter((r) => r.status === 'success')
                  .map((r) => (
                    <Link
                      key={r.gid}
                      href={`/processes/${r.processId}`}
                      className="block text-sm text-nia-grey-blue hover:text-nia-dark transition-colors underline"
                    >
                      {r.name} &rarr;
                    </Link>
                  ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" href="/processes">
                View All Processes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBulkSummary(null);
                  exitBulkMode();
                }}
              >
                Import More
              </Button>
            </div>
          </div>
        </Card>
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
            <p className="text-xs text-text-muted mb-4">
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

        {asanaError && !bulkImporting && (
          <div className="bg-nia-red/10 border border-nia-red/30 rounded-lg p-3 mb-4 text-sm text-nia-red">
            {asanaError}
          </div>
        )}

        {asanaConnected && !asanaLoading && asanaProjects.length === 0 && !asanaError && (
          <p className="text-text-muted text-sm py-4">No projects found in your Asana workspace.</p>
        )}

        {asanaConnected && asanaProjects.length > 0 && (
          <>
            {/* Header row with bulk mode toggle */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-nia-dark">Your Asana Projects</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">{asanaProjects.length} projects</span>
                {!bulkImporting && !bulkSummary && (
                  <button
                    onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
                    className="text-xs font-medium text-nia-grey-blue hover:text-nia-dark transition-colors"
                  >
                    {bulkMode ? 'Cancel' : 'Select Multiple'}
                  </button>
                )}
              </div>
            </div>

            {/* Bulk mode toolbar */}
            {bulkMode && !bulkImporting && !bulkSummary && (
              <div className="flex items-center gap-3 mb-3 text-xs">
                <button
                  onClick={selectAllImportable}
                  className="text-nia-grey-blue hover:text-nia-dark transition-colors font-medium"
                >
                  Select All Importable ({importableCount})
                </button>
                <span className="text-border">&middot;</span>
                <button
                  onClick={deselectAll}
                  className="text-nia-grey-blue hover:text-nia-dark transition-colors font-medium"
                >
                  Deselect All
                </button>
                {selected.size > 0 && (
                  <>
                    <span className="text-border">&middot;</span>
                    <span className="text-nia-orange font-medium">{selected.size} selected</span>
                  </>
                )}
              </div>
            )}

            <Input
              value={asanaSearch}
              onChange={(e) => setAsanaSearch(e.target.value)}
              placeholder="Search projects..."
              className="mb-4"
            />

            <div
              className={`space-y-2 max-h-[500px] overflow-y-auto ${bulkMode && selected.size > 0 ? 'pb-20' : ''}`}
            >
              {filteredProjects.map((project) => {
                const isImporting = asanaImporting === project.gid;
                const alreadySaved = savedProcesses.some((sp) => sp.name === project.name);
                const alreadyByGid = importedGids.has(project.gid);
                const alreadyByName = existingProcesses.has(project.name.toLowerCase());
                const alreadyExists = alreadySaved || alreadyByGid || alreadyByName;
                const isSelected = selected.has(project.gid);

                return (
                  <div
                    key={project.gid}
                    onClick={
                      bulkMode && !alreadyExists && !bulkImporting
                        ? () => toggleSelect(project.gid)
                        : undefined
                    }
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${
                      bulkMode && !alreadyExists && !bulkImporting ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'border-nia-orange bg-nia-orange/5'
                        : 'border-border-light hover:border-nia-grey-blue/30'
                    }`}
                  >
                    {/* Checkbox in bulk mode */}
                    {bulkMode && (
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={alreadyExists || bulkImporting}
                          onChange={() => toggleSelect(project.gid)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-border accent-nia-orange"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-nia-dark truncate">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-text-muted truncate mt-0.5">
                          {project.description}
                        </p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-text-muted">
                        {project.team && <span>{project.team}</span>}
                        {project.modified_at && (
                          <span>Updated {new Date(project.modified_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {alreadySaved || alreadyByGid ? (
                        <span className="text-xs text-nia-green font-medium">
                          {alreadySaved ? 'Imported' : 'Already in Hub'}
                        </span>
                      ) : alreadyByName ? (
                        <span className="text-xs text-text-muted">Already in Hub</span>
                      ) : bulkMode ? null : ( // In bulk mode, no individual import button
                        <Button
                          size="xs"
                          onClick={() => handleAsanaImport(project.gid)}
                          disabled={isImporting || asanaImporting !== null}
                          loading={isImporting}
                        >
                          {isImporting ? 'Importing...' : 'Import'}
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

      {/* Floating action bar for bulk mode */}
      {bulkMode && selected.size > 0 && !bulkImporting && !bulkSummary && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-40">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-nia-dark font-medium">
              {selected.size} project{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={exitBulkMode}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleBulkImport}>
                Import {selected.size} Project{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
