"use client";

import { useState, useRef, useEffect } from "react";
import { Card, Button } from "@/components/ui";

type Status = "idle" | "loading" | "ready" | "error";

const LEGEND_ITEMS = [
  { label: "Integrated (70+%)", color: "#324a4d", textColor: "#ffffff" },
  { label: "Aligned (50–69%)", color: "#b1bd37", textColor: "#000000" },
  { label: "Early Systematic (30–49%)", color: "#f79935", textColor: "#000000" },
  { label: "Reacting (0–29%)", color: "#dc2626", textColor: "#ffffff" },
  { label: "Unscored", color: "#9ca3af", textColor: "#ffffff" },
];

export default function WorkflowDiagramCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [showCode, setShowCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    generatedAt: string;
    processCount: number;
    keyCount: number;
  } | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);

  async function generate() {
    setStatus("loading");
    setErrorMsg(null);
    setMermaidCode("");
    setMeta(null);

    try {
      const res = await fetch("/api/admin/generate-workflow", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Generation failed");
        setStatus("error");
        return;
      }

      setMermaidCode(data.mermaid || "");
      setMeta({
        generatedAt: data.generatedAt,
        processCount: data.processCount,
        keyCount: data.keyCount,
      });
      setStatus("ready");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  // Render Mermaid diagram whenever code changes
  useEffect(() => {
    if (!mermaidCode || !diagramRef.current || renderingRef.current) return;

    renderingRef.current = true;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "neutral" });

        const id = `workflow-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, mermaidCode);

        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `<p class="text-sm text-nia-red p-4">Diagram render failed. View the raw Mermaid code below to debug.</p>`;
        }
        setShowCode(true);
      } finally {
        renderingRef.current = false;
      }
    }

    // Small delay for DOM to settle
    const timer = setTimeout(render, 50);
    return () => clearTimeout(timer);
  }, [mermaidCode]);

  return (
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
            Baldrige Systems Model showing how processes connect and fulfill NIA&apos;s mission.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={generate}
          disabled={status === "loading"}
          loading={status === "loading"}
          size="sm"
        >
          {status === "loading"
            ? "Generating..."
            : status === "ready"
            ? "Regenerate"
            : "Generate Diagram"}
        </Button>

        {status === "ready" && (
          <button
            onClick={() => setShowCode((v) => !v)}
            className="text-sm text-text-secondary hover:text-nia-dark transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            {showCode ? "Hide" : "View"} Mermaid Code
          </button>
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
          <div className="w-full max-w-lg h-48 skeleton-shimmer rounded-lg" />
          <p className="text-sm text-text-muted">AI is mapping your processes to the Baldrige Systems Model...</p>
        </div>
      )}

      {/* Meta info */}
      {meta && status === "ready" && (
        <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
          <span>Generated {new Date(meta.generatedAt).toLocaleString()}</span>
          <span>·</span>
          <span>{meta.processCount} processes ({meta.keyCount} key)</span>
        </div>
      )}

      {/* Diagram */}
      {status === "ready" && (
        <div className="mt-4 rounded-lg border border-border bg-white p-4 overflow-x-auto">
          <div ref={diagramRef} className="flex justify-center min-h-32" />
        </div>
      )}

      {/* Mermaid code toggle */}
      {showCode && mermaidCode && (
        <div className="mt-3">
          <pre className="bg-surface-hover rounded-lg p-3 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono">
            {mermaidCode}
          </pre>
        </div>
      )}

      {/* Legend */}
      {status === "ready" && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            ADLI Maturity Legend
          </p>
          <div className="flex flex-wrap gap-3">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-text-secondary">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
