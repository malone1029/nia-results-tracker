"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { helpSections } from "@/lib/help-content";
import { resetTour } from "@/components/page-tour";
import { Card } from "@/components/ui";

// Reuse sidebar's NavIcon concept — inline small SVGs for section headers
function SectionIcon({ icon }: { icon: string }) {
  const cn = "w-5 h-5";
  switch (icon) {
    case "rocket":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7a18.05 18.05 0 01-.553.832c-.678 1-1.573 1.99-2.635 2.928-.388.342-.815.672-1.274.988a18.05 18.05 0 01-.553-.832c-.678-1-1.573-1.99-2.635-2.928-.388-.342-.815-.672-1.274-.988" />
        </svg>
      );
    case "folder":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      );
    case "heart":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case "clipboard-list":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    case "link":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case "book-open":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "shield-check":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    default:
      return null;
  }
}

interface FeedbackItem {
  id: number;
  type: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: "bg-nia-orange/15 text-nia-orange",
  reviewed: "bg-nia-grey-blue/15 text-nia-grey-blue",
  done: "bg-nia-green/15 text-nia-green",
  dismissed: "bg-surface-muted text-text-muted",
};

export default function HelpPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  function startTour() {
    resetTour();
    router.push("/?tour=true");
  }

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMyFeedback(data))
      .finally(() => setFeedbackLoading(false));
  }, []);

  // Filter sections by search
  const filteredSections = search
    ? helpSections
        .map((section) => ({
          ...section,
          questions: section.questions.filter(
            (q) =>
              q.question.toLowerCase().includes(search.toLowerCase()) ||
              q.answer.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((section) => section.questions.length > 0)
    : helpSections;

  function toggleQuestion(sectionIdx: number, questionIdx: number) {
    const key = `${sectionIdx}-${questionIdx}`;
    setExpandedId(expandedId === key ? null : key);
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-nia-dark">Help Center</h1>
          <p className="text-sm text-text-secondary mt-0.5">How can we help?</p>
        </div>
        <button
          onClick={startTour}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-nia-grey-blue border border-border rounded-lg hover:bg-surface-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Start Tour
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search help topics..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-light bg-card text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 shadow-sm"
        />
      </div>

      {/* No results */}
      {search && filteredSections.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-text-muted mb-2">No results for &ldquo;{search}&rdquo;</p>
          <p className="text-sm text-text-muted">Try different keywords or submit feedback below.</p>
        </Card>
      )}

      {/* FAQ sections */}
      <div className="space-y-6">
        {filteredSections.map((section, sIdx) => (
          <Card key={section.title} className="overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-surface-muted/50 border-b border-border-light">
              <span className="text-nia-grey-blue">
                <SectionIcon icon={section.icon} />
              </span>
              <h2 className="font-semibold text-foreground">{section.title}</h2>
              <span className="text-xs text-text-muted ml-auto">{section.questions.length} topics</span>
            </div>

            {/* Questions */}
            <div className="divide-y divide-border-light">
              {section.questions.map((q, qIdx) => {
                const isOpen = expandedId === `${sIdx}-${qIdx}`;
                return (
                  <div key={qIdx}>
                    <button
                      onClick={() => toggleQuestion(sIdx, qIdx)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-hover transition-colors"
                    >
                      <span className="flex-1 text-sm font-medium text-foreground">{q.question}</span>
                      <svg
                        className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">
                        {q.answer}
                        {q.linkTo && (
                          <Link
                            href={q.linkTo}
                            className="inline-flex items-center gap-1 ml-2 text-nia-grey-blue hover:underline"
                          >
                            Go to page
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* My Feedback section */}
      {!feedbackLoading && myFeedback.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">My Feedback</h2>
          <Card className="divide-y divide-border-light">
            {myFeedback.map((item) => (
              <div key={item.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[item.status] || STATUS_BADGE.new}`}>
                    {item.status}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-sm text-foreground">{item.description}</p>
                {item.admin_note && (
                  <div className="mt-2 pl-3 border-l-2 border-nia-grey-blue/30">
                    <p className="text-xs text-text-muted mb-0.5">Admin response:</p>
                    <p className="text-sm text-text-secondary">{item.admin_note}</p>
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Still need help? */}
      <Card className="mt-8 p-6 text-center">
        <h3 className="font-semibold text-foreground mb-1">Still need help?</h3>
        <p className="text-sm text-text-secondary mb-4">Can&apos;t find what you&apos;re looking for?</p>
        <div className="flex justify-center gap-3">
          <button
            className="px-4 py-2 bg-nia-grey-blue text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            id="ask-ai-help"
          >
            Ask AI
          </button>
          <button
            className="px-4 py-2 bg-surface-muted text-foreground border border-border-light rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors"
            id="send-feedback-help"
          >
            Send Feedback
          </button>
        </div>
      </Card>
    </div>
  );
}
