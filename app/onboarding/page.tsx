// app/onboarding/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const CHAPTERS = [
  {
    id: "why",
    title: "Why the Excellence Hub Exists",
    subtitle: "Chapter 1 of 4",
    content: [
      {
        heading: "NIA's Baldrige Journey",
        body: "Northwestern Illinois Association is pursuing recognition through the IIASA Continuous Improvement Program — a Baldrige-based framework for organizational excellence. The Excellence Hub is the platform that makes that pursuit systematic and visible.",
      },
      {
        heading: "What the Hub Is",
        body: "The Hub is where NIA documents its processes, tracks its performance metrics, manages improvement actions, and measures its readiness for Baldrige recognition. Every process you own in this system is a contribution to NIA's overall excellence.",
      },
      {
        heading: "Why Your Role Matters",
        body: "Process owners are the backbone of this system. Without active process owners documenting their work, updating their metrics, and driving improvements, the Hub is just a database. With engaged owners, it becomes evidence of a high-performing organization.",
      },
    ],
  },
  {
    id: "how",
    title: "How the Hub Works",
    subtitle: "Chapter 2 of 4",
    content: [
      {
        heading: "Process Health Score (0–100)",
        body: "Every process you own has a health score across five dimensions: Documentation (25 pts), Maturity (20 pts), Measurement (20 pts), Operations (20 pts), and Freshness (15 pts). Your job is to keep those scores moving up.",
      },
      {
        heading: "ADLI Maturity (1–5)",
        body: "ADLI stands for Approach, Deployment, Learning, and Integration — the four Baldrige dimensions of process maturity. Each is scored 1 to 5. The AI coach on your process page can help you score these and identify what to improve next.",
      },
      {
        heading: "Metrics and Data",
        body: "Processes are linked to performance metrics with defined review cadences (monthly, quarterly, semi-annual, annual). Your job is to make sure data gets entered on time. The Data Health page shows you which metrics are current, due soon, or overdue.",
      },
      {
        heading: "Tasks and Improvements",
        body: "The AI coach generates improvement tasks for each process. These sync to Asana so nothing falls through the cracks. Completing tasks is one of the signals the Hub uses to measure your engagement.",
      },
    ],
  },
  {
    id: "expectations",
    title: "Your Responsibilities",
    subtitle: "Chapter 3 of 4",
    content: [
      {
        heading: "The Standard",
        body: "NIA's expectation is simple: progress is acceptable, failure to use the Hub is not. You don't need to have a perfect score — you need to be actively working your processes.",
      },
      {
        heading: "What 'Active' Means",
        body: "You are considered compliant when you: (1) have completed this onboarding program, (2) keep all linked metrics entered within their cadence window, (3) update your process documentation at least once every 90 days, (4) complete at least one improvement task per quarter, and (5) have at least one process at Ready for Review or Approved status.",
      },
      {
        heading: "Your Scorecard",
        body: "You have a personal scorecard page that shows your compliance status and growth metrics. You can view it anytime from the sidebar. Jon and NIA leadership can also view it. The scorecard is not punitive — it's a tool to help you self-monitor and prioritize.",
      },
      {
        heading: "The Cadence",
        body: "Think of your Hub work in three rhythms: monthly (log data for monthly metrics), quarterly (update ADLI, complete a task, review your health score), and annually (full readiness review aligned to the IIASA application cycle).",
      },
    ],
  },
  {
    id: "start",
    title: "Your First Actions",
    subtitle: "Chapter 4 of 4",
    content: [
      {
        heading: "Step 1: Find Your Processes",
        body: "Go to the Processes page and filter by your name in the owner column. These are your processes. Click into each one to see the current state of the documentation.",
      },
      {
        heading: "Step 2: Review Your Health Score",
        body: "On each process page, you'll see a health score card. Click 'View Breakdown' to see which dimensions are lowest. That's where to focus first.",
      },
      {
        heading: "Step 3: Open the AI Coach",
        body: "Click 'AI Coach' on your process page. Ask it to score your ADLI maturity, or ask what the top three improvements would be. It knows your process data and will give you specific recommendations.",
      },
      {
        heading: "Step 4: Check Your Scorecard",
        body: "Visit your personal scorecard (My Scorecard in the sidebar) to see which compliance checks are passing and which need attention. Use this as your regular home base in the Hub.",
      },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [chapter, setChapter] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    document.title = "Onboarding | NIA Excellence Hub";
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  async function handleComplete() {
    if (!userId) return;
    setCompleting(true);
    try {
      await fetch(`/api/owner/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      });
    } catch {
      // Non-fatal
    }
    router.push(`/owner/${userId}`);
  }

  const current = CHAPTERS[chapter];
  const isLast = chapter === CHAPTERS.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-surface-subtle">
        <div
          className="h-full bg-nia-dark-solid transition-all duration-500"
          style={{ width: `${((chapter + 1) / CHAPTERS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {current.subtitle}
          </p>
          <h1 className="text-3xl font-bold text-foreground">{current.title}</h1>
        </div>

        <div className="flex-1 space-y-6">
          {current.content.map((section) => (
            <div key={section.heading} className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2">{section.heading}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-1.5">
            {CHAPTERS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === chapter
                    ? "bg-nia-dark-solid"
                    : i < chapter
                    ? "bg-nia-green"
                    : "bg-surface-subtle"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {chapter > 0 && (
              <button
                onClick={() => setChapter((c) => c - 1)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="px-6 py-2 text-sm font-semibold text-white bg-nia-dark-solid hover:opacity-90 rounded-lg transition-opacity disabled:opacity-60"
              >
                {completing ? "Finishing…" : "Complete Onboarding →"}
              </button>
            ) : (
              <button
                onClick={() => setChapter((c) => c + 1)}
                className="px-6 py-2 text-sm font-semibold text-white bg-nia-dark-solid hover:opacity-90 rounded-lg transition-opacity"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
