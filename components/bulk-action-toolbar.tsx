"use client";

import { useState, useEffect, useRef } from "react";
import type { TaskPriority } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────

interface WorkspaceMember {
  gid: string;
  name: string;
  email: string;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  onBulkComplete: () => void;
  onBulkPriority: (priority: TaskPriority) => void;
  onBulkAssign: (member: WorkspaceMember | null) => void;
  onBulkDueDate: (date: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

// ── Component ────────────────────────────────────────────────

export default function BulkActionToolbar({
  selectedCount,
  onBulkComplete,
  onBulkPriority,
  onBulkAssign,
  onBulkDueDate,
  onBulkDelete,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [activePicker, setActivePicker] = useState<"priority" | "assign" | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hasFetchedMembers = useRef(false);

  // Close picker on click-outside
  useEffect(() => {
    if (!activePicker) return;
    function handleClick(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePicker]);

  // Escape clears selection (only when no picker is open)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (activePicker) {
          setActivePicker(null);
        } else {
          onClearSelection();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [activePicker, onClearSelection]);

  // Fetch workspace members when assign picker opens
  useEffect(() => {
    if (activePicker !== "assign" || hasFetchedMembers.current) return;
    hasFetchedMembers.current = true;
    setLoadingMembers(true);
    fetch("/api/asana/workspace-members")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMembers(data.members || []))
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [activePicker]);

  const searchLower = memberSearch.toLowerCase();
  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchLower) ||
      m.email.toLowerCase().includes(searchLower)
  );

  return (
    <div
      ref={toolbarRef}
      className="fixed bottom-6 left-1/2 z-[100] animate-toolbar-enter"
      style={{ transform: "translateX(-50%)" }}
    >
      <div className="bg-nia-dark-solid text-white rounded-xl shadow-2xl px-4 py-2.5 flex items-center gap-3">
        {/* Selection count */}
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} task{selectedCount !== 1 ? "s" : ""} selected
        </span>

        {/* Divider */}
        <div className="w-px h-5 bg-white/20" />

        {/* Complete */}
        <button
          type="button"
          onClick={onBulkComplete}
          className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          title="Mark complete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>

        {/* Priority */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActivePicker(activePicker === "priority" ? null : "priority")}
            className={`p-1.5 rounded-lg transition-colors ${
              activePicker === "priority" ? "bg-white/25" : "hover:bg-white/15"
            }`}
            title="Set priority"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>

          {activePicker === "priority" && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[120px] animate-context-menu">
              {(["high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onBulkPriority(p);
                    setActivePicker(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover text-left cursor-pointer"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p === "high" ? "bg-red-500" : p === "medium" ? "bg-nia-orange" : "bg-surface-muted"
                    }`}
                  />
                  <span className="capitalize">{p}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assign */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActivePicker(activePicker === "assign" ? null : "assign")}
            className={`p-1.5 rounded-lg transition-colors ${
              activePicker === "assign" ? "bg-white/25" : "hover:bg-white/15"
            }`}
            title="Assign"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>

          {activePicker === "assign" && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[240px] max-w-[280px] animate-context-menu">
              {/* Search */}
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full text-sm bg-surface-hover border border-border-light rounded-lg px-2.5 py-1.5 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
                  autoFocus
                />
              </div>

              <div className="max-h-48 overflow-y-auto">
                {loadingMembers && (
                  <div className="px-3 py-4 text-center">
                    <span className="text-xs text-text-muted animate-pulse">Loading...</span>
                  </div>
                )}

                {!loadingMembers && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onBulkAssign(null);
                        setActivePicker(null);
                        setMemberSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-text-muted hover:bg-surface-hover transition-colors"
                    >
                      Unassigned
                    </button>

                    {filteredMembers.map((member) => (
                      <button
                        key={member.gid}
                        type="button"
                        onClick={() => {
                          onBulkAssign(member);
                          setActivePicker(null);
                          setMemberSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
                      >
                        <span className="text-sm text-foreground">{member.name}</span>
                        <span className="text-[10px] text-text-muted ml-2">{member.email}</span>
                      </button>
                    ))}

                    {filteredMembers.length === 0 && !loadingMembers && (
                      <div className="px-3 py-3 text-center">
                        <span className="text-xs text-text-muted">No members found</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Due Date */}
        <div className="relative">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker()}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title="Set due date"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            onChange={(e) => {
              if (e.target.value) {
                onBulkDueDate(e.target.value);
                e.target.value = "";
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Set due date for selected tasks"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/20" />

        {/* Delete */}
        <button
          type="button"
          onClick={onBulkDelete}
          className="p-1.5 rounded-lg hover:bg-red-500/30 text-red-300 transition-colors"
          title="Delete selected tasks"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Close (X) */}
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 rounded-lg hover:bg-white/15 transition-colors ml-1"
          title="Clear selection"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
