"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui";

/* ─── Types ─────────────────────────────────────────────────── */

interface WelcomeOnboardingProps {
  userName: string;
  userId: string;
  asanaConnected: boolean;
  onComplete: () => void;
}

/* ─── Storage key ───────────────────────────────────────────── */

function getStorageKey(userId: string) {
  return `nia-onboarding-complete-${userId}`;
}

export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(getStorageKey(userId)) === "true";
}

/* ─── Feature highlight data ────────────────────────────────── */

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 12l2 2 4-4" stroke="#b1bd37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Process Documentation",
    detail: "Charter, ADLI, and process maps aligned to Baldrige",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" fill="#f79935" opacity="0.3" />
        <circle cx="12" cy="12" r="3" stroke="#f79935" strokeWidth="1.5" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    label: "AI Coaching",
    detail: "Guided improvement cycles with intelligent suggestions",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 14l4-4 3 3 6-6" stroke="#b1bd37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="7" r="2" fill="#b1bd37" opacity="0.4" />
      </svg>
    ),
    label: "Health Scoring",
    detail: "Track readiness across five dimensions toward Baldrige",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <circle cx="12" cy="6" r="3.5" stroke="#f06a6a" strokeWidth="1.5" />
        <circle cx="5.5" cy="17" r="3.5" stroke="#f06a6a" strokeWidth="1.5" />
        <circle cx="18.5" cy="17" r="3.5" stroke="#f06a6a" strokeWidth="1.5" />
        <path d="M8 8.5L6.5 13.5M16 8.5l1.5 5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
      </svg>
    ),
    label: "Asana Integration",
    detail: "Bidirectional sync keeps documentation and tasks aligned",
  },
];

/* ─── Component ─────────────────────────────────────────────── */

export default function WelcomeOnboarding({
  userName,
  userId,
  asanaConnected,
  onComplete,
}: WelcomeOnboardingProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Total steps: if Asana already connected, skip step 2 (index 1)
  const totalSteps = asanaConnected ? 2 : 3;

  useEffect(() => {
    // Check if already completed
    if (hasCompletedOnboarding(userId)) {
      onComplete();
      return;
    }
    // Fade in after a beat
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [userId, onComplete]);

  const markComplete = useCallback(() => {
    localStorage.setItem(getStorageKey(userId), "true");
    setVisible(false);
    setTimeout(onComplete, 300);
  }, [userId, onComplete]);

  const nextStep = useCallback(() => {
    setDirection("forward");
    if (step >= totalSteps - 1) {
      markComplete();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, totalSteps, markComplete]);

  const prevStep = useCallback(() => {
    setDirection("back");
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Map logical step to content
  const getContentStep = () => {
    if (asanaConnected) {
      return step === 0 ? "welcome" : "get-started";
    }
    return step === 0 ? "welcome" : step === 1 ? "asana" : "get-started";
  };

  const contentStep = getContentStep();
  const firstName = userName.split(" ")[0] || "there";

  if (hasCompletedOnboarding(userId)) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a3e41] via-[#324a4d] to-[#3d5a5e]">
        {/* Subtle geometric pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }} />
        {/* Warm accent glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #f79935 0%, transparent 70%)" }}
        />
      </div>

      {/* Card */}
      <div
        className={`relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-[0.98]"
        }`}
      >
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#b1bd37] via-[#55787c] to-[#f79935]" />

        {/* Content area with slide transitions */}
        <div className="relative overflow-hidden">
          <div
            key={step}
            className={`px-8 pt-8 pb-6 ${
              direction === "forward" ? "onboard-slide-in" : "onboard-slide-in-back"
            }`}
          >
            {contentStep === "welcome" && (
              <WelcomeStep firstName={firstName} />
            )}
            {contentStep === "asana" && (
              <AsanaStep />
            )}
            {contentStep === "get-started" && (
              <GetStartedStep asanaConnected={asanaConnected} onComplete={markComplete} />
            )}
          </div>
        </div>

        {/* Footer: progress dots + navigation */}
        <div className="px-8 pb-6 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 h-2 bg-gradient-to-r from-[#b1bd37] to-[#55787c]"
                    : i < step
                    ? "w-2 h-2 bg-[#b1bd37]"
                    : "w-2 h-2 bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={prevStep}>
                Back
              </Button>
            )}
            {contentStep === "welcome" && (
              <Button variant="primary" size="md" onClick={nextStep}>
                Get Started
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-0.5">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Button>
            )}
            {contentStep === "asana" && (
              <>
                <Button variant="ghost" size="sm" onClick={nextStep}>
                  Skip for now
                </Button>
                <a
                  href="/api/asana/authorize"
                  className="inline-flex items-center justify-center font-medium transition-all text-sm px-4 py-2 rounded-lg gap-2 text-white shadow-md hover:shadow-lg hover:translate-y-[-1px]"
                  style={{ background: "linear-gradient(135deg, #324a4d, #55787c)" }}
                >
                  <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                    <circle cx="10" cy="12" r="3" />
                    <circle cx="4.5" cy="6.5" r="3" />
                    <circle cx="15.5" cy="6.5" r="3" />
                  </svg>
                  Connect Asana
                </a>
              </>
            )}
            {contentStep === "get-started" && (
              <Button variant="ghost" size="sm" onClick={markComplete}>
                Explore on my own
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Welcome ───────────────────────────────────────── */

function WelcomeStep({ firstName }: { firstName: string }) {
  return (
    <div>
      {/* Logo + greeting */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm flex-shrink-0 ring-1 ring-gray-100">
          <Image src="/logo.png" alt="NIA" width={56} height={56} />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-[#324a4d] leading-tight">
            Welcome, {firstName}
          </h1>
          <p className="text-sm text-[#55787c] mt-0.5">
            NIA Excellence Hub
          </p>
        </div>
      </div>

      {/* Value prop */}
      <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
        Your team&apos;s command center for{" "}
        <span className="font-medium text-[#324a4d]">Baldrige Excellence</span>.
        Document processes, track performance, and drive continuous improvement
        &mdash; all in one place.
      </p>

      {/* Feature grid */}
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50/80 border border-gray-100"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="text-[#55787c] mt-0.5 flex-shrink-0">
              {f.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#324a4d]">{f.label}</div>
              <div className="text-[11px] text-gray-400 leading-snug mt-0.5">{f.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 2: Connect Asana ─────────────────────────────────── */

function AsanaStep() {
  return (
    <div>
      <div className="flex justify-center mb-5">
        {/* Asana + Hub connection illustration */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#F06A6A] to-[#e05555] flex items-center justify-center shadow-md">
            <svg width="28" height="28" viewBox="0 0 20 20" fill="white">
              <circle cx="10" cy="13" r="3.5" />
              <circle cx="4" cy="6.5" r="3.5" />
              <circle cx="16" cy="6.5" r="3.5" />
            </svg>
          </div>
          {/* Connection arrow */}
          <div className="flex items-center gap-1">
            <div className="w-8 h-[2px] bg-gradient-to-r from-[#F06A6A] to-[#55787c] rounded" />
            <svg viewBox="0 0 12 12" className="w-3 h-3 text-[#55787c]">
              <path d="M2 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M6 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4" />
            </svg>
          </div>
          <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md ring-1 ring-gray-100">
            <Image src="/logo.png" alt="NIA" width={56} height={56} />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold font-display text-[#324a4d] text-center mb-2">
        Connect Your Asana Account
      </h2>
      <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
        Link Asana to import your existing projects and keep everything in sync.
      </p>

      {/* Benefits */}
      <div className="space-y-2.5">
        {[
          { icon: "↓", text: "Import existing Asana projects as Excellence Hub processes" },
          { icon: "↔", text: "Bidirectional sync — changes flow both ways automatically" },
          { icon: "✓", text: "AI-generated tasks export directly to your Asana boards" },
        ].map((b, i) => (
          <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50/80">
            <span className="w-6 h-6 rounded-full bg-[#324a4d]/8 flex items-center justify-center text-[11px] font-bold text-[#55787c] flex-shrink-0 mt-px">
              {b.icon}
            </span>
            <span className="text-sm text-gray-600 leading-snug">{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 3: Get Started ───────────────────────────────────── */

function GetStartedStep({
  asanaConnected,
  onComplete,
}: {
  asanaConnected: boolean;
  onComplete: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold font-display text-[#324a4d] text-center mb-2">
        Add Your First Process
      </h2>
      <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
        Choose how you&apos;d like to get started. You can always add more later.
      </p>

      <div className="space-y-3">
        {/* Import from Asana */}
        <a
          href="/processes/import"
          onClick={onComplete}
          className={`block p-4 rounded-xl border-2 transition-all group ${
            asanaConnected
              ? "border-[#324a4d]/20 hover:border-[#324a4d]/50 hover:shadow-md bg-white cursor-pointer"
              : "border-gray-100 bg-gray-50/50 opacity-60 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              asanaConnected
                ? "bg-gradient-to-br from-[#324a4d] to-[#55787c] shadow-sm"
                : "bg-gray-200"
            }`}>
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                <path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)", transformOrigin: "center" }} />
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#324a4d]">
                  Import from Asana
                </span>
                {asanaConnected && (
                  <span className="text-[10px] font-medium text-[#b1bd37] bg-[#b1bd37]/10 px-1.5 py-0.5 rounded">
                    RECOMMENDED
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {asanaConnected
                  ? "Select an existing Asana project to import"
                  : "Connect Asana first to use this option"}
              </span>
            </div>
            {asanaConnected && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-[#324a4d] transition-colors">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </a>

        {/* Create with AI */}
        <a
          href="/processes/new/ai"
          onClick={onComplete}
          className="block p-4 rounded-xl border-2 border-gray-100 hover:border-[#f79935]/40 hover:shadow-md bg-white transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f79935] to-[#e88a28] flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                <path d="M12 2L14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" opacity="0.3" />
                <path d="M12 2L14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-[#324a4d]">
                Create with AI
              </span>
              <br />
              <span className="text-xs text-gray-400">
                Answer a few questions and AI builds your process
              </span>
            </div>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-[#f79935] transition-colors">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </div>
        </a>

        {/* Create manually */}
        <a
          href="/processes/new"
          onClick={onComplete}
          className="block p-4 rounded-xl border-2 border-gray-100 hover:border-gray-300 bg-white transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#55787c]">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-[#324a4d]">
                Create Manually
              </span>
              <br />
              <span className="text-xs text-gray-400">
                Start from a blank template
              </span>
            </div>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </div>
        </a>
      </div>
    </div>
  );
}
