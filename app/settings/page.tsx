"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import { Card, Button } from "@/components/ui";

interface AsanaConnection {
  asana_user_name: string;
  workspace_name: string | null;
  connected_at: string;
}

interface UserRow {
  id: number;
  auth_id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

interface BulkSyncResult {
  processId: number;
  processName: string;
  imported: number;
  updated: number;
  removed: number;
  total: number;
  error?: string;
}

function BulkSyncCard() {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<BulkSyncResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; synced: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBulkSync() {
    setSyncing(true);
    setResults(null);
    setSummary(null);
    setError(null);

    try {
      const res = await fetch("/api/asana/sync-all", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || "Sync failed");
        return;
      }

      setResults(data.results);
      setSummary(data.summary);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card padding="md">
      <h2 className="text-xl font-semibold text-nia-dark mb-2">
        Sync All Asana Tasks
      </h2>
      <p className="text-sm text-text-tertiary mb-4">
        Import and update tasks from all Asana-linked processes. This may take a few minutes.
      </p>

      <Button onClick={handleBulkSync} disabled={syncing} size="sm">
        {syncing ? "Syncing..." : "Sync All Processes"}
      </Button>

      {error && (
        <div className="mt-3 rounded-lg p-3 text-sm bg-nia-red/10 border border-nia-red/30 text-nia-red">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-3 rounded-lg p-3 text-sm bg-nia-green/20 border border-nia-green text-nia-dark">
          Synced {summary.synced}/{summary.total} processes
          {summary.failed > 0 && ` (${summary.failed} failed)`}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          {results.map((r) => (
            <div
              key={r.processId}
              className={`flex items-center justify-between py-1 px-2 rounded ${
                r.error ? "bg-nia-red/5" : "bg-card"
              }`}
            >
              <span className="text-nia-dark truncate mr-2">{r.processName}</span>
              {r.error ? (
                <span className="text-nia-red text-xs whitespace-nowrap">Error</span>
              ) : (
                <span className="text-text-tertiary text-xs whitespace-nowrap">
                  {r.imported} new, {r.updated} updated, {r.removed} removed
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface NotifPref {
  notify_on_assignment: boolean;
  notify_on_due_approaching: boolean;
  notify_on_completion: boolean;
  notify_on_mention: boolean;
  notify_weekly_digest: boolean;
}

const DEFAULT_PREFS: NotifPref = {
  notify_on_assignment: true,
  notify_on_due_approaching: true,
  notify_on_completion: true,
  notify_on_mention: true,
  notify_weekly_digest: true,
};

const PREF_LABELS: { key: keyof NotifPref; label: string; description: string }[] = [
  { key: "notify_on_assignment", label: "Assignment", description: "When someone assigns a task to you" },
  { key: "notify_on_due_approaching", label: "Due date reminders", description: "When a task is due tomorrow" },
  { key: "notify_on_completion", label: "Task completion", description: "When a task assigned to you is completed" },
  { key: "notify_on_mention", label: "Mentions", description: "When someone @mentions you in a comment" },
  { key: "notify_weekly_digest", label: "Weekly digest", description: "Monday summary of your tasks across all processes" },
];

function NotificationPrefsCard() {
  const [prefs, setPrefs] = useState<NotifPref>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.ok ? r.json() : DEFAULT_PREFS)
      .then((data) => {
        setPrefs({ ...DEFAULT_PREFS, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(key: keyof NotifPref) {
    const newValue = !prefs[key];
    // Optimistic update
    setPrefs((prev) => ({ ...prev, [key]: newValue }));

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      if (!res.ok) {
        // Revert on error
        setPrefs((prev) => ({ ...prev, [key]: !newValue }));
      }
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
    }
  }

  return (
    <Card padding="md">
      <h2 className="text-xl font-semibold text-nia-dark mb-2">
        Email Notifications
      </h2>
      <p className="text-sm text-text-tertiary mb-4">
        Choose which email notifications you&apos;d like to receive.
      </p>

      {loading ? (
        <div className="text-sm text-text-muted py-4">Loading preferences...</div>
      ) : (
        <div className="space-y-3">
          {PREF_LABELS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-nia-dark">{label}</p>
                <p className="text-xs text-text-tertiary">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => toggle(key)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  prefs[key] ? "bg-nia-green" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    prefs[key] ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Human-friendly role labels */
function roleLabel(role: string): string {
  switch (role) {
    case "super_admin": return "Super Admin";
    case "admin": return "Admin";
    default: return "User";
  }
}

/** Role badge color styles */
function roleBadgeClass(role: string): string {
  switch (role) {
    case "super_admin": return "bg-nia-orange/20 text-nia-orange";
    case "admin": return "bg-nia-dark-solid text-white";
    default: return "bg-border text-text-secondary";
  }
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useRole();
  const [connection, setConnection] = useState<AsanaConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // User management state (admin+ only)
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    authId: string;
    newRole: string;
    name: string;
  } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const asanaConnected = searchParams.get("asana_connected");
  const asanaError = searchParams.get("asana_error");

  useEffect(() => {
    document.title = "Settings | NIA Excellence Hub";
    fetchConnection();
  }, []);

  // Fetch users when admin status is confirmed
  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchUsers();
    }
  }, [roleLoading, isAdmin]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  async function fetchConnection() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_asana_tokens")
      .select("asana_user_name, workspace_name, connected_at")
      .eq("user_id", user.id)
      .single();

    if (data) setConnection(data);
    setLoading(false);
  }

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setCurrentUserId(data.currentUserId || "");
      }
    } catch {
      // Silently fail — admin section just won't show data
    }
    setUsersLoading(false);
  }

  async function disconnect() {
    setDisconnecting(true);
    const res = await fetch("/api/asana/disconnect", { method: "POST" });
    if (res.ok) {
      setConnection(null);
    }
    setDisconnecting(false);
  }

  function handleRoleChange(authId: string, newRole: string, name: string) {
    setConfirmAction({ authId, newRole, name });
  }

  async function confirmRoleChange() {
    if (!confirmAction) return;

    setChangingRoleFor(confirmAction.authId);
    setConfirmAction(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authId: confirmAction.authId,
          role: confirmAction.newRole,
        }),
      });

      if (res.ok) {
        // Optimistic update
        setUsers((prev) =>
          prev.map((u) =>
            u.auth_id === confirmAction.authId
              ? { ...u, role: confirmAction.newRole }
              : u
          )
        );
        setSuccessMsg(`${confirmAction.name} changed to ${roleLabel(confirmAction.newRole)}`);
      } else {
        const err = await res.json();
        setSuccessMsg(`Error: ${err.error}`);
      }
    } catch {
      setSuccessMsg("Failed to update role");
    }

    setChangingRoleFor(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="xs" href="/">
          &larr; Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-nia-dark mt-2">Settings</h1>
      </div>

      {/* Success / Error banners */}
      {asanaConnected && (
        <div className="success-celebrate bg-nia-green/20 border border-nia-green rounded-lg p-3 text-sm text-nia-dark">
          Asana connected successfully!
        </div>
      )}
      {asanaError === "denied" && (
        <div className="bg-nia-red/10 border border-nia-red/30 rounded-lg p-3 text-sm text-nia-red">
          Asana connection was cancelled or denied.
        </div>
      )}
      {asanaError === "token" && (
        <div className="bg-nia-red/10 border border-nia-red/30 rounded-lg p-3 text-sm text-nia-red">
          Failed to get Asana access token. Please try again.
        </div>
      )}
      {asanaError === "save" && (
        <div className="bg-nia-red/10 border border-nia-red/30 rounded-lg p-3 text-sm text-nia-red">
          Connected to Asana but failed to save. Please try again.
        </div>
      )}

      {/* Connected Accounts */}
      <Card padding="md">
        <h2 className="text-xl font-semibold text-nia-dark mb-4">
          Connected Accounts
        </h2>

        {/* Asana */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            {/* Asana logo - simple text icon */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F06A6A] to-[#F06A6A] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                <circle cx="10" cy="13" r="4" />
                <circle cx="4" cy="7" r="4" />
                <circle cx="16" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-nia-dark">Asana</p>
              {loading ? (
                <p className="text-sm text-text-muted">Checking connection...</p>
              ) : connection ? (
                <p className="text-sm text-text-tertiary">
                  Connected as{" "}
                  <span className="font-medium">{connection.asana_user_name}</span>
                  {connection.workspace_name && (
                    <> in {connection.workspace_name}</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-text-muted">Not connected</p>
              )}
            </div>
          </div>

          <div>
            {loading ? null : connection ? (
              <Button
                variant="danger"
                size="sm"
                onClick={disconnect}
                disabled={disconnecting}
                loading={disconnecting}
              >
                Disconnect
              </Button>
            ) : (
              <a
                href="/api/asana/authorize"
                className="inline-flex items-center justify-center font-medium transition-colors bg-nia-dark-solid text-white hover:bg-nia-grey-blue text-sm px-3 py-1.5 rounded-lg gap-1.5 focus-ring"
              >
                Connect Asana
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Notification Preferences — all users */}
      <NotificationPrefsCard />

      {/* Bulk Asana Sync — admin only */}
      {!roleLoading && isAdmin && (
        <BulkSyncCard />
      )}

      {/* User Management — admin only */}
      {!roleLoading && isAdmin && (
        <Card padding="md">
          <h2 className="text-xl font-semibold text-nia-dark mb-4">
            User Management
          </h2>
          <p className="text-sm text-text-tertiary mb-4">
            All NIA team members who have signed in. New users automatically get the &ldquo;member&rdquo; role.
          </p>

          {/* Role change success banner */}
          {successMsg && (
            <div
              className={`mb-4 rounded-lg p-3 text-sm ${
                successMsg.startsWith("Error")
                  ? "bg-nia-red/10 border border-nia-red/30 text-nia-red"
                  : "bg-nia-green/20 border border-nia-green text-nia-dark"
              }`}
            >
              {successMsg}
            </div>
          )}

          {/* Confirmation dialog */}
          {confirmAction && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 font-medium">
                Change {confirmAction.name} to {roleLabel(confirmAction.newRole)}?
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {confirmAction.newRole === "super_admin"
                  ? "Super Admins have full access including role management."
                  : confirmAction.newRole === "admin"
                  ? "Admins can map Baldrige criteria, access analytics, and manage all features."
                  : "Users can only view and edit Processes, Classifications, and Categories."}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="xs"
                  onClick={confirmRoleChange}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {usersLoading ? (
            <div className="text-sm text-text-muted py-4">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-text-muted py-4">
              No users have signed in yet. Users are registered automatically on first login.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-tertiary">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Last Login</th>
                      <th className="pb-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isCurrentUser = u.auth_id === currentUserId;
                      const isChanging = changingRoleFor === u.auth_id;

                      return (
                        <tr
                          key={u.auth_id}
                          className={`border-b border-border-light ${
                            isCurrentUser ? "bg-nia-green/5" : ""
                          }`}
                        >
                          <td className="py-3 font-medium text-nia-dark">
                            {u.full_name || "—"}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-text-muted">(you)</span>
                            )}
                          </td>
                          <td className="py-3 text-text-secondary">{u.email}</td>
                          <td className="py-3">
                            {isCurrentUser || !isSuperAdmin ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass(u.role)}`}>
                                {roleLabel(u.role)}
                              </span>
                            ) : isChanging ? (
                              <span className="text-xs text-text-muted">Updating...</span>
                            ) : u.role === "super_admin" ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass(u.role)}`}>
                                {roleLabel(u.role)}
                              </span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) =>
                                  handleRoleChange(
                                    u.auth_id,
                                    e.target.value,
                                    u.full_name || u.email
                                  )
                                }
                                className="text-xs border border-border rounded-md px-2 py-1 bg-card focus:outline-none focus:ring-2 focus:ring-nia-green/50"
                              >
                                <option value="member">User</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                            )}
                          </td>
                          <td className="py-3 text-text-tertiary" title={u.last_login_at || ""}>
                            {relativeTime(u.last_login_at)}
                          </td>
                          <td className="py-3 text-text-tertiary">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {users.map((u) => {
                  const isCurrentUser = u.auth_id === currentUserId;
                  const isChanging = changingRoleFor === u.auth_id;

                  return (
                    <div
                      key={u.auth_id}
                      className={`border rounded-lg p-3 ${
                        isCurrentUser
                          ? "border-nia-green/30 bg-nia-green/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-nia-dark text-sm">
                          {u.full_name || "—"}
                          {isCurrentUser && (
                            <span className="ml-1 text-xs text-text-muted">(you)</span>
                          )}
                        </span>
                        {isCurrentUser || !isSuperAdmin ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass(u.role)}`}>
                            {roleLabel(u.role)}
                          </span>
                        ) : isChanging ? (
                          <span className="text-xs text-text-muted">Updating...</span>
                        ) : u.role === "super_admin" ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass(u.role)}`}>
                            {roleLabel(u.role)}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(
                                u.auth_id,
                                e.target.value,
                                u.full_name || u.email
                              )
                            }
                            className="text-xs border border-border rounded-md px-2 py-1 bg-card"
                          >
                            <option value="member">User</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary">{u.email}</p>
                      <p className="text-xs text-text-muted mt-1">
                        Last login: {relativeTime(u.last_login_at)} · Joined{" "}
                        {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-text-muted mt-3">
                {users.length} user{users.length !== 1 ? "s" : ""} registered
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
