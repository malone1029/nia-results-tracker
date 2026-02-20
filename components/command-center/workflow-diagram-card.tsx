"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, Button } from "@/components/ui";
import type { GapItem } from "@/app/api/admin/generate-workflow/route";

type Status = "idle" | "loading" | "ready" | "error";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const LEGEND_ITEMS = [
  { label: "Integrated (70+%)", color: "#324a4d" },
  { label: "Aligned (50–69%)", color: "#b1bd37" },
  { label: "Early Systematic (30–49%)", color: "#f79935" },
  { label: "Reacting (0–29%)", color: "#dc2626" },
  { label: "Unscored", color: "#9ca3af" },
  { label: "Gap (missing process)", color: "#fff7ed", border: "#f59e0b" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-nia-red/10 border-nia-red/30 text-nia-red",
  medium: "bg-nia-orange/10 border-nia-orange/30 text-nia-orange",
  low: "bg-border border-border-light text-text-secondary",
};

const CHAT_STARTERS = [
  "Why are some categories empty?",
  "What should I build first?",
  "Explain the most critical gap",
  "How does Category 6 connect to Operations?",
];

export default function WorkflowDiagramCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ generatedAt: string; keyCount: number } | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [processList, setProcessList] = useState<string>("");

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const diagramRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);

  // ── Auto-load latest snapshot on mount ─────────────────────────────────
  useEffect(() => {
    async function loadLatest() {
      try {
        const res = await fetch("/api/admin/workflow-snapshots");
        if (!res.ok) return;
        const data = await res.json();
        if (data.snapshot) {
          setMermaidCode(data.snapshot.mermaid_code);
          setGaps(data.snapshot.gaps || []);
          setMeta({
            generatedAt: data.snapshot.generated_at,
            keyCount: data.snapshot.key_count,
          });
          setStatus("ready");
        }
      } catch {
        // Silently fail — user can still manually generate
      }
    }
    loadLatest();
  }, []);

  // ── Generate (Regenerate) ───────────────────────────────────────────────
  async function generate() {
    setStatus("loading");
    setErrorMsg(null);
    setMermaidCode("");
    setGaps([]);
    setMeta(null);
    setSavedIndicator(false);
    setShowFullscreen(false);
    setChatMessages([]);

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
      setProcessList(data.processList || "");
      setMeta({ generatedAt: data.generatedAt, keyCount: data.keyCount });
      setStatus("ready");

      // Auto-save to Supabase
      try {
        await fetch("/api/admin/workflow-snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mermaid: data.mermaid,
            gaps: data.gaps,
            keyCount: data.keyCount,
          }),
        });
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 3000);
      } catch {
        // Non-fatal — diagram is visible even if save fails
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  // ── Mermaid render ──────────────────────────────────────────────────────
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

      // Remove Mermaid's injected max-width + force full-width SVG for vertical layout
      const cleanSvg = svg.replace(/style="[^"]*max-width[^"]*"/g, "");
      target.innerHTML = cleanSvg;

      // Make SVG fill container width so it flows vertically
      const svgEl = target.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = "100%";
        svgEl.style.height = "auto";
        svgEl.removeAttribute("width");
      }
    } catch (err) {
      console.error("Mermaid render error:", err);
      target.innerHTML = `<p class="text-sm text-nia-red p-4">Diagram render failed — check the Mermaid code below.</p>`;
      setShowCode(true);
    }
  }, []);

  // Render inline when code changes
  useEffect(() => {
    if (!mermaidCode || !diagramRef.current || renderingRef.current) return;
    renderingRef.current = true;
    const timer = setTimeout(async () => {
      if (diagramRef.current) await renderMermaid(diagramRef.current, mermaidCode);
      renderingRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [mermaidCode, renderMermaid]);

  // Render into fullscreen div when it opens
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

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showChat]);

  // ── Chat send ───────────────────────────────────────────────────────────
  async function sendChat(text?: string) {
    const input = (text ?? chatInput).trim();
    if (!input || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    // Add empty assistant message to stream into
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/admin/workflow-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          mermaid: mermaidCode,
          gaps,
          processList,
        }),
      });

      if (!res.ok || !res.body) {
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I couldn't generate a response. Please try again.",
          };
          return updated;
        });
        setChatLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      }
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Network error — please try again.",
        };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  }

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
              All 6 Baldrige categories — key processes color-coded by ADLI maturity, gap nodes shown in amber. Auto-saved between visits.
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

          {savedIndicator && (
            <span className="flex items-center gap-1 text-xs text-nia-green font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
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
              AI is mapping all 6 Baldrige categories, placing gap nodes, and analyzing the workflow...
            </p>
          </div>
        )}

        {/* Meta */}
        {meta && status === "ready" && (
          <div className="mt-3 flex items-center gap-3 text-xs text-text-muted flex-wrap">
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

        {/* Inline diagram — vertical scroll only */}
        {status === "ready" && (
          <div
            className="mt-4 rounded-lg border border-border bg-white overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: "600px" }}
          >
            <div
              ref={diagramRef}
              className="p-4 w-full"
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
                  className="w-3 h-3 rounded-sm flex-shrink-0 border"
                  style={{
                    backgroundColor: item.color,
                    borderColor: item.border ?? item.color,
                  }}
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
              {highGaps.length > 0 && (
                <div className="space-y-2">
                  {highGaps.map((gap, i) => (
                    <GapRow key={i} gap={gap} />
                  ))}
                </div>
              )}
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

        {/* ── Chat Panel ──────────────────────────────────────────────────── */}
        {status === "ready" && (
          <div className="mt-6 border-t border-border pt-5">
            <button
              onClick={() => setShowChat((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-nia-dark hover:text-nia-green transition-colors"
            >
              <svg className="w-4 h-4 text-nia-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Chat about this diagram
              <svg
                className={`w-3.5 h-3.5 text-text-muted transition-transform ${showChat ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showChat && (
              <div className="mt-3 rounded-lg border border-border bg-surface-hover overflow-hidden">
                {/* Message list */}
                <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                  {chatMessages.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">Ask anything about the diagram — the AI has full context.</p>
                      <div className="flex flex-wrap gap-2">
                        {CHAT_STARTERS.map((starter) => (
                          <button
                            key={starter}
                            onClick={() => sendChat(starter)}
                            disabled={chatLoading}
                            className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-card text-text-secondary hover:text-nia-dark hover:border-nia-green/50 transition-colors"
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-nia-dark text-white"
                              : "bg-card border border-border text-nia-dark"
                          }`}
                        >
                          {msg.content || (
                            <span className="flex gap-1 items-center text-text-muted">
                              <span className="animate-pulse">●</span>
                              <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                              <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input row */}
                <div className="flex items-center gap-2 p-2 border-t border-border bg-card">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    placeholder="Ask a question about the diagram..."
                    disabled={chatLoading}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background text-nia-dark placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-nia-green/50 disabled:opacity-50"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={!chatInput.trim() || chatLoading}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-nia-green text-white hover:bg-nia-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
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
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white p-6">
            <div ref={fullscreenRef} className="w-full" />
          </div>

          {/* Legend bar */}
          <div className="flex items-center gap-4 px-4 py-2 bg-sidebar flex-shrink-0 flex-wrap">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0 border"
                  style={{ backgroundColor: item.color, borderColor: item.border ?? item.color }}
                />
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
          {gap.baldrigeCategory && (
            <span className="text-xs text-text-muted">Cat {gap.baldrigeCategory}</span>
          )}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[gap.priority] || PRIORITY_STYLES.low}`}>
            {gap.priority}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{gap.rationale}</p>
      </div>
    </div>
  );
}
