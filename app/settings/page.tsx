"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, Button } from "@/components/ui";

interface AsanaConnection {
  asana_user_name: string;
  workspace_name: string | null;
  connected_at: string;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<AsanaConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const asanaConnected = searchParams.get("asana_connected");
  const asanaError = searchParams.get("asana_error");

  useEffect(() => {
    document.title = "Settings | NIA Excellence Hub";
    fetchConnection();
  }, []);

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

  async function disconnect() {
    setDisconnecting(true);
    const res = await fetch("/api/asana/disconnect", { method: "POST" });
    if (res.ok) {
      setConnection(null);
    }
    setDisconnecting(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Asana connection was cancelled or denied.
        </div>
      )}
      {asanaError === "token" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Failed to get Asana access token. Please try again.
        </div>
      )}
      {asanaError === "save" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
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
                <p className="text-sm text-gray-400">Checking connection...</p>
              ) : connection ? (
                <p className="text-sm text-gray-500">
                  Connected as{" "}
                  <span className="font-medium">{connection.asana_user_name}</span>
                  {connection.workspace_name && (
                    <> in {connection.workspace_name}</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Not connected</p>
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
                className="inline-flex items-center justify-center font-medium transition-colors bg-nia-dark text-white hover:bg-nia-grey-blue text-sm px-3 py-1.5 rounded-lg gap-1.5 focus-ring"
              >
                Connect Asana
              </a>
            )}
          </div>
        </div>
      </Card>
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
