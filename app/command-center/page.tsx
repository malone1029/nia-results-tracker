"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";
import MassAdliCard from "@/components/command-center/mass-adli-card";
import ClassifyProcessesCard from "@/components/command-center/classify-processes-card";
import WorkflowDiagramCard from "@/components/command-center/workflow-diagram-card";

function CommandCenterContent() {
  const { isSuperAdmin, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    document.title = "Command Center | NIA Excellence Hub";
  }, []);

  // Redirect non-super-admins once role is known
  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.replace("/");
    }
  }, [loading, isSuperAdmin, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-nia-dark border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-nia-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-widest text-nia-orange/80">
            Super Admin
          </span>
        </div>
        <h1 className="text-3xl font-bold text-nia-dark">Command Center</h1>
        <p className="text-text-tertiary mt-1">
          Executive intelligence tools — assess NIA&apos;s Baldrige posture at a glance.
        </p>
      </div>

      {/* Three stacked feature cards */}
      <MassAdliCard />
      <ClassifyProcessesCard />
      <WorkflowDiagramCard />
    </div>
  );
}

export default function CommandCenterPage() {
  return (
    <Suspense>
      <CommandCenterContent />
    </Suspense>
  );
}
