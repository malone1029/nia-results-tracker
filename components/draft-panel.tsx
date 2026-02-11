"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MarkdownContent from "@/components/markdown-content";

interface DraftRecord {
  id: number;
  item_id: number;
  tier: string;
  narrative_text: string;
  word_count: number;
  status: string;
  figures: unknown[];
  last_ai_generated_at: string | null;
  last_edited_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DraftPanelProps {
  item: {
    id: number;
    item_code: string;
    item_name: string;
    category_name: string;
    points: number;
    mappedQuestions: number;
    totalQuestions: number;
  };
  tier?: string;
  onClose: () => void;
  onDraftSaved: () => void;
}

export default function DraftPanel({ item, tier = "excellence_builder", onClose, onDraftSaved }: DraftPanelProps) {
  const [draft, setDraft] = useState<DraftRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch existing draft for this item + tier
  const fetchDraft = useCallback(async () => {
    try {
      const res = await fetch(`/api/criteria/drafts?item_id=${item.id}&tier=${tier}`);
      if (res.ok) {
        const data = await res.json();
        setDraft(data); // null if no draft exists
      }
    } finally {
      setLoading(false);
    }
  }, [item.id, tier]);

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Auto-scroll during streaming
  useEffect(() => {
    if (streaming && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [streamContent, streaming]);

  async function generateDraft() {
    setStreaming(true);
    setStreamContent("");
    setEditing(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/criteria/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id, tier }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setStreamContent(`*Error: ${err.error || "Failed to generate draft"}*`);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStreamContent("*Error: No response stream*");
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamContent(accumulated);
      }

      setStreamContent(accumulated);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStreamContent("*Error: AI request failed. Please try again.*");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function saveDraft(narrativeText: string, isAiGenerated: boolean) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        item_id: item.id,
        narrative_text: narrativeText,
        tier,
      };
      if (isAiGenerated) {
        payload.last_ai_generated_at = new Date().toISOString();
      }

      const res = await fetch("/api/criteria/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setDraft(saved);
        setStreamContent("");
        setEditing(false);
        setEditContent("");
        onDraftSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  // Auto-save on edit (3-second debounce)
  function handleEditChange(value: string) {
    setEditContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (value.trim()) {
        saveDraft(value, false);
      }
    }, 3000);
  }

  function startEditing() {
    const content = draft?.narrative_text || streamContent;
    setEditContent(content);
    setEditing(true);
  }

  function cancelEditing() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setEditing(false);
    setEditContent("");
  }

  // The content to display
  const displayContent = editing
    ? editContent
    : streamContent || draft?.narrative_text || "";
  const wordCount = displayContent.trim().split(/\s+/).filter(Boolean).length;

  const statusLabel = draft?.status
    ? draft.status.charAt(0).toUpperCase() + draft.status.slice(1)
    : "No Draft";

  const statusColor = !draft
    ? "bg-surface-subtle text-text-tertiary"
    : draft.status === "final"
    ? "bg-nia-green/20 text-nia-dark"
    : draft.status === "review"
    ? "bg-blue-500/10 text-blue-400"
    : "bg-nia-orange/20 text-nia-orange";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[60%] bg-card z-50 shadow-2xl flex flex-col sidebar-enter">
        {/* Header */}
        <div className="flex-shrink-0 border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-text-muted">{item.item_code}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-nia-dark/10 text-nia-dark">
                  {item.points} pts
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
              <h2 className="text-lg font-bold text-nia-dark mt-0.5 truncate">
                {item.item_name}
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                {item.category_name} &middot; {item.mappedQuestions}/{item.totalQuestions} questions mapped
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-surface-subtle transition-colors"
            >
              <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Word count + last updated */}
          <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
            <span>{wordCount.toLocaleString()} words</span>
            {draft?.last_edited_at && (
              <span>
                Last edited {new Date(draft.last_edited_at).toLocaleDateString()}
              </span>
            )}
            {draft?.last_ai_generated_at && (
              <span>
                AI generated {new Date(draft.last_ai_generated_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-surface-muted rounded w-3/4" />
              <div className="h-4 bg-surface-muted rounded w-full" />
              <div className="h-4 bg-surface-muted rounded w-5/6" />
            </div>
          ) : !displayContent && !streaming ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-nia-green/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-nia-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-nia-dark mb-1">No Draft Yet</h3>
              <p className="text-sm text-text-tertiary max-w-sm mb-4">
                Generate an AI draft using your mapped process evidence, or write one from scratch.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={generateDraft}
                  disabled={item.mappedQuestions === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-nia-dark-solid text-white rounded-lg text-sm font-medium hover:bg-nia-dark-solid/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Generate AI Draft
                </button>
                <button
                  onClick={() => { setEditContent(""); setEditing(true); }}
                  className="px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors"
                >
                  Write Manually
                </button>
              </div>
              {item.mappedQuestions === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Map at least one process to enable AI drafting.
                </p>
              )}
            </div>
          ) : editing ? (
            /* Edit mode — markdown textarea */
            <textarea
              value={editContent}
              onChange={(e) => handleEditChange(e.target.value)}
              className="w-full h-full min-h-[400px] text-sm font-mono border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-nia-green/50"
              placeholder="Write your narrative draft in markdown..."
            />
          ) : (
            /* Rendered markdown */
            <div>
              {streaming && (
                <div className="flex items-center gap-2 mb-3 text-sm text-nia-dark">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating narrative...
                </div>
              )}
              <MarkdownContent content={displayContent} />
              <div ref={streamEndRef} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && (displayContent || streaming) && (
          <div className="flex-shrink-0 border-t px-5 py-3 flex items-center gap-2 bg-surface-hover/50">
            {streaming ? (
              <button
                onClick={() => abortRef.current?.abort()}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Stop Generating
              </button>
            ) : editing ? (
              <>
                <button
                  onClick={() => saveDraft(editContent, false)}
                  disabled={saving || !editContent.trim()}
                  className="px-4 py-1.5 bg-nia-green text-nia-dark rounded-lg text-sm font-medium hover:bg-nia-green/80 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm text-text-tertiary hover:text-text-secondary"
                >
                  Cancel
                </button>
                <span className="text-xs text-text-muted ml-auto">Auto-saves after 3s</span>
              </>
            ) : (
              <>
                {streamContent && (
                  <button
                    onClick={() => saveDraft(streamContent, true)}
                    disabled={saving}
                    className="px-4 py-1.5 bg-nia-green text-nia-dark rounded-lg text-sm font-medium hover:bg-nia-green/80 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                )}
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded-lg hover:bg-surface-hover transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={generateDraft}
                  disabled={item.mappedQuestions === 0}
                  className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {draft?.narrative_text ? "Regenerate" : "Generate AI Draft"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
