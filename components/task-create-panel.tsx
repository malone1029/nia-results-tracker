"use client";

import { useState, useEffect, useRef } from "react";
import type { PdcaSection, ProcessTask } from "@/lib/types";
import { PDCA_SECTIONS } from "@/lib/pdca";
import AssigneePicker from "@/components/assignee-picker";

const PDCA_KEYS: PdcaSection[] = ["plan", "execute", "evaluate", "improve"];

interface TaskCreatePanelProps {
  processId: number;
  asanaProjectGid?: string | null;
  defaultPdcaSection?: PdcaSection;
  onCreated: (task: ProcessTask) => void;
  onClose: () => void;
}

export default function TaskCreatePanel({
  processId,
  asanaProjectGid,
  defaultPdcaSection = "plan",
  onCreated,
  onClose,
}: TaskCreatePanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdcaSection, setPdcaSection] = useState<PdcaSection>(defaultPdcaSection);
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<{
    name: string;
    email: string;
    gid: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus title on open
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleCreate() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process_id: processId,
          title: trimmedTitle,
          description: description.trim() || null,
          pdca_section: pdcaSection,
          due_date: dueDate || null,
          assignee_name: assignee?.name || null,
          assignee_email: assignee?.email || null,
          assignee_asana_gid: assignee?.gid || null,
          origin: "hub_manual",
          source: "user_created",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create task");
      }

      const task = await res.json();
      onCreated(task as ProcessTask);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  const canCreate = title.trim().length > 0 && !creating;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 sm:left-auto sm:right-0 sm:top-0 h-full w-full sm:w-[420px] bg-card shadow-2xl z-50 animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-nia-dark">New Task</h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Title <span className="text-nia-red">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="What needs to be done?"
              className="w-full text-sm bg-surface-hover border border-border-light rounded-lg px-3 py-2 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
            />
          </div>

          {/* PDCA Section Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Section <span className="text-nia-red">*</span>
            </label>
            <div className="flex gap-2">
              {PDCA_KEYS.map((key) => {
                const section = PDCA_SECTIONS[key];
                const isSelected = pdcaSection === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPdcaSection(key)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                      isSelected
                        ? "ring-2 ring-offset-1"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: section.color + "20",
                      color: section.color,
                      ...(isSelected ? { ringColor: section.color } : {}),
                    }}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full text-sm bg-surface-hover border border-border-light rounded-lg px-3 py-2 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue resize-none"
            />
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm bg-surface-hover border border-border-light rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-nia-grey-blue"
            />
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Assignee
            </label>
            <AssigneePicker
              currentAssigneeName={assignee?.name || null}
              currentAssigneeGid={assignee?.gid || null}
              isSaving={false}
              onSelect={(member) => {
                if (member) {
                  setAssignee({
                    name: member.name,
                    email: member.email,
                    gid: member.gid,
                  });
                } else {
                  setAssignee(null);
                }
              }}
            />
          </div>

          {/* Asana sync note */}
          {asanaProjectGid && (
            <p className="text-[10px] text-text-muted">
              This task will be synced to Asana automatically.
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="bg-nia-red/10 border border-nia-red/20 rounded-lg p-3">
              <p className="text-sm text-nia-red">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm text-text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="bg-nia-grey-blue text-white rounded-lg py-2 px-5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </>
  );
}
