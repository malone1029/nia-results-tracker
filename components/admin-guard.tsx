"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";

/**
 * Wraps admin-only pages. Redirects non-admin users to the dashboard.
 * Shows nothing while loading (prevents flash of content).
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/");
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
