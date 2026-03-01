'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/use-role';
import Sidebar from '@/components/sidebar';
import TopBar from '@/components/top-bar';
import FeedbackModal from '@/components/feedback-modal';
import AiHelpPanel from '@/components/ai-help-panel';
import ProxyBanner from '@/components/proxy-banner';
import type { SidebarHealthData } from '@/components/sidebar-health-widget';
import type { User } from '@supabase/supabase-js';

// Paths that members (non-admin users) are allowed to access
const MEMBER_ALLOWED_PATHS = [
  '/processes',
  '/classifications',
  '/categories',
  '/settings',
  '/help',
  '/login',
];

function isMemberAllowed(pathname: string): boolean {
  return MEMBER_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { role, isAdmin, loading: roleLoading } = useRole();

  // Sidebar health widget data
  const [healthData, setHealthData] = useState<SidebarHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Fetch sidebar health data once on mount
  useEffect(() => {
    fetch('/api/sidebar-health')
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
      if (target.id === 'ask-ai-help' || target.closest?.('#ask-ai-help')) {
        setHelpOpen(true);
      }
      if (target.id === 'send-feedback-help' || target.closest?.('#send-feedback-help')) {
        setFeedbackOpen(true);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Redirect members away from pages they can't access
  useEffect(() => {
    if (!roleLoading && !isAdmin && !isMemberAllowed(pathname)) {
      router.replace('/processes');
    }
  }, [roleLoading, isAdmin, pathname, router]);

  // Login page and public survey pages render without sidebar/topbar
  if (pathname === '/login' || pathname.startsWith('/survey/respond')) {
    return <>{children}</>;
  }

  // Block rendering on restricted pages while role is loading (prevents content flash)
  if (roleLoading && !isMemberAllowed(pathname)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse space-y-4 w-48">
          <div className="h-8 bg-surface-muted rounded" />
          <div className="h-4 bg-surface-muted rounded w-full" />
          <div className="h-4 bg-surface-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        onFeedbackClick={() => setFeedbackOpen(true)}
        healthData={healthData}
        healthLoading={healthLoading}
      />

      <div className="flex-1 flex flex-col lg:ml-60 min-w-0">
        <ProxyBanner />
        <TopBar onMenuClick={() => setSidebarOpen(true)} user={user} />

        <main className="flex-1 overflow-auto px-4 sm:px-6 py-6">
          <div className="max-w-6xl mx-auto">{children}</div>
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
