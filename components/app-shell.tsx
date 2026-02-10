"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import type { User } from "@supabase/supabase-js";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useRole();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Login page renders without sidebar/topbar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} />

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
    </div>
  );
}
