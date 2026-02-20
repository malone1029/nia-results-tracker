"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, Button } from "@/components/ui";
import type { GapItem } from "@/app/api/admin/generate-workflow/route";
import type { MissionFlowData } from "@/lib/flow-types";

// Dynamically import the React Flow canvas so it only loads client-side
// (avoids SSR issues with React Flow's browser-only APIs)
const MissionFlowCanvas = dynamic(
  () => import("@/components/flow/mission-flow-canvas"),
  { ssr: false, loading: () => <CanvasLoader /> }
);

function CanvasLoader() {
  return (
    <div className="w-full h-[700px] rounded-lg bg-surface-hover border border-border flex flex-col items-center justify-center gap-3">
      <div className="w-full max-w-sm h-40 skeleton-shimmer rounded-lg" />
      <p className="text-sm text-text-muted">Loading diagram canvas...</p>
    </div>
  );
}

type Status = "idle" | "loading" | "ready" | "legacy" | "error";

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
  "Add a node for Workforce Recruitment",
  "Connect the top gaps with arrows",
];

export default function WorkflowDiagramCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [flowData, setFlowData] = useState<MissionFlowData | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ generatedAt: string; keyCount: number } | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [processList, setProcessList] = useState<string>("");

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [diagramEditedIndicator, setDiagramEditedIndicator] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Auto-load latest snapshot on mount ─────────────────────────────────
  useEffect(() => {
    async function loadLatest() {
      try {
        const res = await fetch("/api/admin/workflow-snapshots");
        if (!res.ok) return;
        const data = await res.json();
        if (data.snapshot) {
          if (data.snapshot.flow_data) {
            // New format — use React Flow
            setFlowData(data.snapshot.flow_data as MissionFlowData);
            setGaps(data.snapshot.gaps || []);
            setMeta({
              generatedAt: data.snapshot.generated_at,
              keyCount: data.snapshot.key_count,
            });
            setStatus("ready");
          } else if (data.snapshot.mermaid_code) {
            // Legacy snapshot — show amber banner prompting regeneration
            setStatus("legacy");
          }
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
    setFlowData(null);
    setGaps([]);
    setMeta(null);
    setSavedIndicator(false);
    setChatMessages([]);

    try {
      const res = await fetch("/api/admin/generate-workflow", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Generation failed");
        setStatus("error");
        return;
      }

      setFlowData(data.flowData || null);
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
            flowData: data.flowData,
            gaps: data.gaps,
            keyCount: data.keyCount,
          }),
        });
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 3000);
      } catch {
        // Non-fatal — diagram visible even if save fails
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showChat]);

  // ── Chat send ───────────────────────────────────────────────────────────
  const sendChat = useCallback(async (text?: string) => {
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
          flowData,
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
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setChatMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: fullContent };
          }
          return updated;
        });
      }

      // ── After stream: check for diagram update delimiter ──────────────
      const DELIM = "---DIAGRAM---";
      const delimIdx = fullContent.indexOf(DELIM);
      if (delimIdx !== -1) {
        const textPart = fullContent.slice(0, delimIdx).trim();
        const jsonPart = fullContent.slice(delimIdx + DELIM.length).trim();

        // Update chat bubble to show only the text portion
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: textPart + "\n\n_✓ Diagram updated_",
          };
          return updated;
        });

        if (jsonPart) {
          try {
            const newFlowData = JSON.parse(jsonPart) as MissionFlowData;
            setFlowData(newFlowData);
            setDiagramEditedIndicator(true);
            setTimeout(() => setDiagramEditedIndicator(false), 4000);
            // Auto-save the edited diagram
            try {
              await fetch("/api/admin/workflow-snapshots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  flowData: newFlowData,
                  gaps,
                  keyCount: meta?.keyCount ?? 0,
                }),
              });
            } catch {
              // Non-fatal
            }
          } catch {
            console.warn("Failed to parse updated diagram JSON from chat");
          }
        }
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
  }, [chatInput, chatLoading, chatMessages, flowData, gaps, processList, meta]);

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
              All 6 Baldrige categories — interactive pan/zoom, key processes color-coded by ADLI maturity, gap nodes in amber.
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

          {savedIndicator && (
            <span className="flex items-center gap-1 text-xs text-nia-green font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}

          {diagramEditedIndicator && (
            <span className="flex items-center gap-1 text-xs text-nia-green font-medium animate-pulse">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Diagram updated
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg p-3 text-sm bg-nia-red/10 border border-nia-red/30 text-nia-red">
            {errorMsg}
          </div>
        )}

        {/* Legacy snapshot banner */}
        {status === "legacy" && (
          <div className="mt-4 rounded-lg p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3">
            <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              <strong>Old format detected.</strong> Click <strong>Regenerate</strong> to upgrade to the interactive diagram.
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="mt-4 rounded-lg bg-surface-hover border border-border p-8 flex flex-col items-center gap-3">
            <div className="w-full h-56 skeleton-shimmer rounded-lg" />
            <p className="text-sm text-text-muted">
              AI is mapping all 6 Baldrige categories and analyzing your workflow...
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

        {/* React Flow canvas */}
        {status === "ready" && flowData && (
          <div className="mt-4">
            <MissionFlowCanvas flowData={flowData} height={700} />
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
                    placeholder="Ask a question or say 'Add a node for X'..."
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
