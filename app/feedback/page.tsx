"use client";

import { useState, useEffect } from "react";
import AdminGuard from "@/components/admin-guard";
import { Card } from "@/components/ui";

interface FeedbackRow {
  id: number;
  user_name: string;
  type: "bug" | "idea" | "question";
  description: string;
  page_url: string | null;
  status: "new" | "reviewed" | "done" | "dismissed";
  admin_note: string | null;
  created_at: string;
}

type TypeFilter = "all" | "bug" | "idea" | "question";
type StatusFilter = "all" | "new" | "reviewed" | "done" | "dismissed";

const TYPE_BADGE: Record<string, string> = {
  bug: "bg-red-500/15 text-red-600",
  idea: "bg-nia-orange/15 text-nia-orange",
  question: "bg-nia-grey-blue/15 text-nia-grey-blue",
};

const TYPE_EMOJI: Record<string, string> = {
  bug: "🐛",
  idea: "💡",
  question: "❓",
};

const STATUS_BADGE: Record<string, string> = {
  new: "bg-nia-orange/15 text-nia-orange",
  reviewed: "bg-nia-grey-blue/15 text-nia-grey-blue",
  done: "bg-nia-green/15 text-nia-green",
  dismissed: "bg-surface-muted text-text-muted",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.description.toLowerCase().includes(q) ||
        item.user_name.toLowerCase().includes(q) ||
        (item.page_url || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const newCount = items.filter((i) => i.status === "new").length;
  const reviewedCount = items.filter((i) => i.status === "reviewed").length;
  const doneCount = items.filter((i) => i.status === "done").length;

  function handleExpand(item: FeedbackRow) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    setEditNote(item.admin_note || "");
    setEditStatus(item.status);
  }

  async function handleSave(id: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: editStatus, admin_note: editNote }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: editStatus as FeedbackRow["status"], admin_note: editNote } : i
        )
      );
      setBanner("Feedback updated");
      setTimeout(() => setBanner(""), 3000);
      setExpandedId(null);
    } catch {
      setBanner("Error saving — try again");
      setTimeout(() => setBanner(""), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-nia-dark">Feedback</h1>
          <p className="text-sm text-text-secondary mt-0.5">Bug reports, ideas, and questions from the team</p>
        </div>

        {/* Banner */}
        {banner && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${banner.startsWith("Error") ? "bg-red-500/10 text-red-600" : "bg-nia-green/10 text-nia-green"}`}>
            {banner}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: items.length, color: "text-foreground" },
            { label: "New", value: newCount, color: "text-nia-orange" },
            { label: "Reviewed", value: reviewedCount, color: "text-nia-grey-blue" },
            { label: "Done", value: doneCount, color: "text-nia-green" },
          ].map((stat) => (
            <Card key={stat.label} className="p-3 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Type filters */}
          {(["all", "bug", "idea", "question"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-nia-dark-solid text-white"
                  : "bg-surface-muted text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {t === "all" ? "All Types" : `${TYPE_EMOJI[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}

          <div className="w-px bg-border-light mx-1 self-stretch" />

          {/* Status filters */}
          {(["all", "new", "reviewed", "done", "dismissed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-nia-dark-solid text-white"
                  : "bg-surface-muted text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search feedback..."
          className="w-full mb-4 px-3 py-2 rounded-lg border border-border-light bg-surface-muted text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
        />

        {/* Loading */}
        {loading && (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-muted rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-text-muted">No feedback found</p>
          </Card>
        )}

        {/* Desktop table */}
        {!loading && filtered.length > 0 && (
          <div className="hidden sm:block">
            <Card className="divide-y divide-border-light">
              {filtered.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => handleExpand(item)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-hover transition-colors"
                  >
                    <span className="text-lg flex-shrink-0">{TYPE_EMOJI[item.type]}</span>
                    <span className="text-sm font-medium text-foreground min-w-[100px]">{item.user_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_BADGE[item.type]}`}>
                      {item.type}
                    </span>
                    <span className="text-sm text-text-secondary flex-1 truncate">{item.description}</span>
                    <span className="text-xs text-text-muted whitespace-nowrap">{formatDate(item.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[item.status]}`}>
                      {item.status}
                    </span>
                    <svg className={`w-4 h-4 text-text-muted transition-transform ${expandedId === item.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedId === item.id && (
                    <div className="px-4 py-4 bg-surface-muted/50 border-t border-border-light space-y-3">
                      <div>
                        <div className="text-xs font-medium text-text-muted mb-1">Full Description</div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{item.description}</p>
                      </div>
                      {item.page_url && (
                        <div>
                          <div className="text-xs font-medium text-text-muted mb-1">Page</div>
                          <p className="text-sm text-text-secondary font-mono">{item.page_url}</p>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-medium text-text-muted mb-1 block">Admin Note</label>
                          <textarea
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Add a response..."
                            rows={2}
                            className="w-full rounded-lg border border-border-light bg-card px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-muted mb-1 block">Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="rounded-lg border border-border-light bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
                          >
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="done">Done</option>
                            <option value="dismissed">Dismissed</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSave(item.id)}
                          disabled={saving}
                          className="px-4 py-2 bg-nia-dark-solid text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Mobile cards */}
        {!loading && filtered.length > 0 && (
          <div className="sm:hidden space-y-3">
            {filtered.map((item) => (
              <Card key={item.id} className="p-3">
                <button
                  onClick={() => handleExpand(item)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{TYPE_EMOJI[item.type]}</span>
                    <span className="text-sm font-medium text-foreground">{item.user_name}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_BADGE[item.type]}`}>
                      {item.type}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">{formatDate(item.created_at)}</span>
                  </div>
                </button>

                {expandedId === item.id && (
                  <div className="mt-3 pt-3 border-t border-border-light space-y-3">
                    <div>
                      <div className="text-xs font-medium text-text-muted mb-1">Full Description</div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{item.description}</p>
                    </div>
                    {item.page_url && (
                      <div>
                        <div className="text-xs font-medium text-text-muted mb-1">Page</div>
                        <p className="text-sm text-text-secondary font-mono text-xs">{item.page_url}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">Admin Note</label>
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Add a response..."
                        rows={2}
                        className="w-full rounded-lg border border-border-light bg-card px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="flex-1 rounded-lg border border-border-light bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="done">Done</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                      <button
                        onClick={() => handleSave(item.id)}
                        disabled={saving}
                        className="px-4 py-2 bg-nia-dark-solid text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
