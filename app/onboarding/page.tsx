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
        heading: "How NIA Thinks About Excellence",
        body: "Northwestern Illinois Association uses the Baldrige Excellence Framework as a lens for how we run our organization — how we design our processes, measure our performance, and improve over time. The Excellence Hub is the platform that makes that work systematic and visible.",
      },
      {
        heading: "What the Hub Is",
        body: "The Hub is where NIA documents its processes, tracks its performance metrics, and manages improvement actions. Every process you own in this system is a contribution to NIA's overall quality — and to the people and districts we serve.",
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
        heading: "Key vs. Support Processes",
        body: "Every process in the Hub is classified as either Key or Support. Key processes directly deliver services to member school districts — they're what NIA exists to do. Support processes keep NIA running internally but don't directly serve districts. The simplest test: if your process stopped tomorrow, would a district notice? If yes, it's Key. Key processes carry twice the weight in NIA's readiness score because Baldrige examiners scrutinize them most closely.",
      },
      {
        heading: "Tasks and Improvements",
        body: "The AI coach generates improvement tasks for each process. These sync to Asana so nothing falls through the cracks. Completing tasks is one of the signals the Hub uses to measure your engagement.",
      },
    ],
  },
  {
    id: "expectations",
    title: "How We Know You're Growing",
    subtitle: "Chapter 3 of 4",
    content: [
      {
        heading: "Growth, Not Compliance",
        body: "NIA doesn't measure success by whether you followed a checklist. We measure it by whether your processes are getting better over time. The Hub tracks three signals that tell that story honestly.",
      },
      {
        heading: "Signal 1: Your Metrics Are Current",
        body: "Data that's never entered can't tell you anything. Keeping your linked metrics logged within their cadence window is the foundation — it means your processes are actually being watched, not just documented.",
      },
      {
        heading: "Signal 2: Your Health Score Is On Track",
        body: "The Hub calculates a health score for each of your processes based on the quality and depth of your documentation and ADLI maturity. A score of 60 or above means you're on track. You don't need a perfect score — you need to be in the game.",
      },
      {
        heading: "Signal 3: Your ADLI Maturity Is Improving",
        body: "ADLI scores measure how systematically your approach, deployment, learning, and integration are working. Use the AI coach to score your ADLI and identify what to improve next. Rising scores over time — or reaching maturity on all four dimensions — is the signal we're looking for.",
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
        body: "Visit your personal scorecard (My Scorecard in the sidebar) to see which growth signals are green and which need attention. Use this as your regular home base in the Hub.",
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
