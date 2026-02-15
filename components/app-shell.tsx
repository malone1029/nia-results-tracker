"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import FeedbackModal from "@/components/feedback-modal";
import AiHelpPanel from "@/components/ai-help-panel";
import type { SidebarHealthData } from "@/components/sidebar-health-widget";
import type { User } from "@supabase/supabase-js";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useRole();

  // Sidebar health widget data
  const [healthData, setHealthData] = useState<SidebarHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Fetch sidebar health data once on mount
  useEffect(() => {
    fetch("/api/sidebar-health")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setHealthData(data);
      })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Listen for help/feedback button clicks from the help page
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.id === "ask-ai-help" || target.closest?.("#ask-ai-help")) {
        setHelpOpen(true);
      }
      if (target.id === "send-feedback-help" || target.closest?.("#send-feedback-help")) {
        setFeedbackOpen(true);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Login page and public survey pages render without sidebar/topbar
  if (pathname === "/login" || pathname.startsWith("/survey/respond")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
        onFeedbackClick={() => setFeedbackOpen(true)}
        healthData={healthData}
        healthLoading={healthLoading}
      />

      <div className="flex-1 flex flex-col lg:ml-60 min-w-0">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
        />

        <main className="flex-1 overflow-auto px-4 sm:px-6 py-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(true)}
        data-tour="ai-help"
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-nia-grey-blue text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-lg font-bold hover:scale-105"
        aria-label="Get help"
      >
        ?
      </button>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <AiHelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
