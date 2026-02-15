"use client";

import { useState, useEffect, useRef } from "react";

interface WorkspaceMember {
  gid: string;
  name: string;
  email: string;
}

interface AssigneePickerProps {
  currentAssigneeName: string | null;
  currentAssigneeGid: string | null;
  onSelect: (member: WorkspaceMember | null) => void;
  isSaving?: boolean;
}

export default function AssigneePicker({
  currentAssigneeName,
  currentAssigneeGid,
  onSelect,
  isSaving,
}: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hasFetched = useRef(false);

  // Fetch members on first open
  useEffect(() => {
    if (!isOpen || hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    setError(null);

    fetch("/api/asana/workspace-members")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load members");
        return res.json();
      })
      .then((data) => setMembers(data.members || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation(); // Don't close the detail panel
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const searchLower = search.toLowerCase();
  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(searchLower) ||
    m.email.toLowerCase().includes(searchLower)
  );

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSaving}
        className="text-sm text-foreground hover:text-nia-grey-blue transition-colors flex items-center gap-1"
      >
        {isSaving ? (
          <span className="text-text-muted animate-pulse">Saving...</span>
        ) : (
          <>
            {currentAssigneeName || "Unassigned"}
            <svg className="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-slide-up">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full text-sm bg-surface-hover border border-border-light rounded-lg px-2.5 py-1.5 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
            />
          </div>

          {/* Member list */}
          <div className="max-h-48 overflow-y-auto">
            {loading && (
              <div className="px-3 py-4 text-center">
                <span className="text-xs text-text-muted animate-pulse">Loading members...</span>
              </div>
            )}

            {error && (
              <div className="px-3 py-4 text-center">
                <span className="text-xs text-nia-red">{error}</span>
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Unassign option */}
                <button
                  type="button"
                  onClick={() => {
                    onSelect(null);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                    !currentAssigneeGid ? "text-nia-grey-blue font-medium" : "text-text-muted"
                  }`}
                >
                  Unassigned
                </button>

                {filtered.map((member) => (
                  <button
                    key={member.gid}
                    type="button"
                    onClick={() => {
                      onSelect(member);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors ${
                      member.gid === currentAssigneeGid ? "bg-surface-hover" : ""
                    }`}
                  >
                    <span className={`text-sm ${
                      member.gid === currentAssigneeGid ? "text-nia-grey-blue font-medium" : "text-foreground"
                    }`}>
                      {member.name}
                    </span>
                    <span className="text-[10px] text-text-muted ml-2">{member.email}</span>
                  </button>
                ))}

                {filtered.length === 0 && !loading && (
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
  );
}
