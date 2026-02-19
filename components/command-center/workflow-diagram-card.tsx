"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, Button } from "@/components/ui";
import type { GapItem } from "@/app/api/admin/generate-workflow/route";

type Status = "idle" | "loading" | "ready" | "error";

const LEGEND_ITEMS = [
  { label: "Integrated (70+%)", color: "#324a4d" },
  { label: "Aligned (50–69%)", color: "#b1bd37" },
  { label: "Early Systematic (30–49%)", color: "#f79935" },
  { label: "Reacting (0–29%)", color: "#dc2626" },
  { label: "Unscored", color: "#9ca3af" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-nia-red/10 border-nia-red/30 text-nia-red",
  medium: "bg-nia-orange/10 border-nia-orange/30 text-nia-orange",
  low: "bg-border border-border-light text-text-secondary",
};

export default function WorkflowDiagramCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ generatedAt: string; keyCount: number } | null>(null);

  const diagramRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);

  async function generate() {
    setStatus("loading");
    setErrorMsg(null);
    setMermaidCode("");
    setGaps([]);
    setMeta(null);
    setShowFullscreen(false);

    try {
      const res = await fetch("/api/admin/generate-workflow", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Generation failed");
        setStatus("error");
        return;
      }

      setMermaidCode(data.mermaid || "");
      setGaps(data.gaps || []);
      setMeta({ generatedAt: data.generatedAt, keyCount: data.keyCount });
      setStatus("ready");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  // Core Mermaid render function — renders into a target div
  const renderMermaid = useCallback(async (target: HTMLDivElement, code: string) => {
    try {
      const mermaid = (await import("mermaid")).default;
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "neutral",
        flowchart: { useMaxWidth: false, htmlLabels: true },
      });

      const id = `workflow-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(id, code);

      // Remove Mermaid's injected max-width so we control sizing via CSS
      const cleanSvg = svg.replace(/style="[^"]*max-width[^"]*"/g, "");
      target.innerHTML = cleanSvg;
    } catch (err) {
      console.error("Mermaid render error:", err);
      target.innerHTML = `<p class="text-sm text-nia-red p-4">Diagram render failed — check the Mermaid code below.</p>`;
      setShowCode(true);
    }
  }, []);

  // Render into the inline diagram div when code changes
  useEffect(() => {
    if (!mermaidCode || !diagramRef.current || renderingRef.current) return;
    renderingRef.current = true;
    const timer = setTimeout(async () => {
      if (diagramRef.current) await renderMermaid(diagramRef.current, mermaidCode);
      renderingRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [mermaidCode, renderMermaid]);

  // Render into the fullscreen div when it opens
  useEffect(() => {
    if (!showFullscreen || !mermaidCode || !fullscreenRef.current) return;
    const timer = setTimeout(async () => {
      if (fullscreenRef.current) await renderMermaid(fullscreenRef.current, mermaidCode);
    }, 50);
    return () => clearTimeout(timer);
  }, [showFullscreen, mermaidCode, renderMermaid]);

  // Close fullscreen on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowFullscreen(false);
    }
    if (showFullscreen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFullscreen]);

  const highGaps = gaps.filter((g) => g.priority === "high");
  const otherGaps = gaps.filter((g) => g.priority !== "high");

  return (
    <>
      <Card padding="md">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-nia-green/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-nia-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-nia-dark">Mission Workflow Diagram</h2>
            <p className="text-sm text-text-tertiary mt-0.5">
              Key processes mapped to the Baldrige Systems Model — color-coded by ADLI maturity. Includes gap analysis based on NIA&apos;s org profile.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={generate}
            disabled={status === "loading"}
            loading={status === "loading"}
            size="sm"
          >
            {status === "loading" ? "Generating..." : status === "ready" ? "Regenerate" : "Generate Diagram"}
          </Button>

          {status === "ready" && (
            <>
              <button
                onClick={() => setShowFullscreen(true)}
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-nia-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Full Screen
              </button>
              <button
                onClick={() => setShowCode((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-nia-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                {showCode ? "Hide" : "View"} Code
              </button>
            </>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg p-3 text-sm bg-nia-red/10 border border-nia-red/30 text-nia-red">
            {errorMsg}
          </div>
        )}

        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="mt-4 rounded-lg bg-surface-hover border border-border p-8 flex flex-col items-center gap-3">
            <div className="w-full h-56 skeleton-shimmer rounded-lg" />
            <p className="text-sm text-text-muted">
              AI is mapping key processes to the Baldrige Systems Model and analyzing gaps...
            </p>
          </div>
        )}

        {/* Meta */}
        {meta && status === "ready" && (
          <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
            <span>Generated {new Date(meta.generatedAt).toLocaleString()}</span>
            <span>·</span>
            <span>{meta.keyCount} key processes</span>
            {gaps.length > 0 && (
              <>
                <span>·</span>
                <span className="text-nia-orange font-medium">{gaps.length} gaps identified</span>
              </>
            )}
          </div>
        )}

        {/* Inline diagram — scrollable */}
        {status === "ready" && (
          <div className="mt-4 rounded-lg border border-border bg-white overflow-auto"
               style={{ maxHeight: "600px" }}>
            <div
              ref={diagramRef}
              className="p-4 min-w-max"
            />
          </div>
        )}

        {/* Mermaid code */}
        {showCode && mermaidCode && (
          <div className="mt-3">
            <pre className="bg-surface-hover rounded-lg p-3 text-xs text-text-secondary overflow-x-auto whitespace-pre font-mono">
              {mermaidCode}
            </pre>
          </div>
        )}

        {/* Legend */}
        {status === "ready" && (
          <div className="mt-4 flex flex-wrap gap-3">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-text-secondary">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Gap Analysis ───────────────────────────────────────────────── */}
        {status === "ready" && gaps.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-nia-orange flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-semibold text-nia-dark">Key Process Gaps</h3>
              <span className="text-xs text-text-muted">
                — processes implied by NIA&apos;s org profile or Baldrige 6.1 not yet documented
              </span>
            </div>

            <div className="space-y-2">
              {/* High priority first */}
              {highGaps.length > 0 && (
                <div className="space-y-2">
                  {highGaps.map((gap, i) => (
                    <GapRow key={i} gap={gap} />
                  ))}
                </div>
              )}
              {/* Medium + low */}
              {otherGaps.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-text-secondary cursor-pointer hover:text-nia-dark transition-colors select-none mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {otherGaps.length} medium/low priority gaps
                  </summary>
                  <div className="mt-2 space-y-2">
                    {otherGaps.map((gap, i) => (
                      <GapRow key={i} gap={gap} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Fullscreen Modal ─────────────────────────────────────────────── */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFullscreen(false); }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-sidebar flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium text-sm">Mission Workflow Diagram</span>
              {meta && (
                <span className="text-white/50 text-xs">{meta.keyCount} key processes</span>
              )}
            </div>
            <button
              onClick={() => setShowFullscreen(false)}
              className="text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close (Esc)
            </button>
          </div>

          {/* Scrollable diagram area */}
          <div className="flex-1 overflow-auto bg-white p-6">
            <div ref={fullscreenRef} className="min-w-max" />
          </div>

          {/* Legend bar */}
          <div className="flex items-center gap-4 px-4 py-2 bg-sidebar flex-shrink-0 flex-wrap">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-white/70">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GapRow({ gap }: { gap: GapItem }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50/50 border-amber-200/60">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-nia-dark">{gap.name}</span>
          <span className="text-xs text-text-muted">Baldrige {gap.baldrigeItem}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[gap.priority] || PRIORITY_STYLES.low}`}>
            {gap.priority}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{gap.rationale}</p>
      </div>
    </div>
  );
}
