"use client";

import { useState, useRef, useEffect } from "react";
import MarkdownContent from "./markdown-content";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AdliScores {
  approach: number;
  deployment: number;
  learning: number;
  integration: number;
}

interface AdliSuggestion {
  field: string;
  content: string;
}

interface AiChatPanelProps {
  processId: number;
  processName: string;
  onProcessUpdated?: () => void;
}

// Parse adli-scores code block from AI response, return scores and cleaned text
function parseAdliScores(text: string): { scores: AdliScores | null; cleanedText: string } {
  const match = text.match(/```adli-scores\s*\n([\s\S]*?)\n```/);
  if (!match) return { scores: null, cleanedText: text };

  try {
    const scores = JSON.parse(match[1]) as AdliScores;
    const cleanedText = text.replace(/```adli-scores\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { scores, cleanedText };
  } catch {
    return { scores: null, cleanedText: text };
  }
}

// Parse adli-suggestion code block from AI response
function parseAdliSuggestion(text: string): { suggestion: AdliSuggestion | null; cleanedText: string } {
  const match = text.match(/```adli-suggestion\s*\n([\s\S]*?)\n```/);
  if (!match) return { suggestion: null, cleanedText: text };

  try {
    const suggestion = JSON.parse(match[1]) as AdliSuggestion;
    const cleanedText = text.replace(/```adli-suggestion\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { suggestion, cleanedText };
  } catch {
    return { suggestion: null, cleanedText: text };
  }
}

const FIELD_LABELS: Record<string, string> = {
  charter: "Charter",
  adli_approach: "ADLI: Approach",
  adli_deployment: "ADLI: Deployment",
  adli_learning: "ADLI: Learning",
  adli_integration: "ADLI: Integration",
};

function getMaturityLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 70) return { label: "Integrated", color: "#324a4d", bgColor: "#324a4d" };
  if (score >= 50) return { label: "Aligned", color: "#b1bd37", bgColor: "#b1bd37" };
  if (score >= 30) return { label: "Early Systematic", color: "#f79935", bgColor: "#f79935" };
  return { label: "Reacting", color: "#dc2626", bgColor: "#dc2626" };
}

export default function AiChatPanel({ processId, processName, onProcessUpdated }: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adliScores, setAdliScores] = useState<AdliScores | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<AdliSuggestion | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          messages: updatedMessages,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get AI response");
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add an empty assistant message that we'll update as chunks arrive
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // Update the last message with accumulated content
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
          return updated;
        });
      }

      // After streaming is done, check for structured data in the response
      const { scores } = parseAdliScores(assistantContent);
      if (scores) {
        setAdliScores(scores);
      }
      const { suggestion } = parseAdliSuggestion(assistantContent);
      if (suggestion) {
        setPendingSuggestion(suggestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // Remove the empty assistant message if there was an error
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Send on Enter (without Shift for newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleQuickAction(prompt: string) {
    sendMessage(prompt);
  }

  function handleImprove(dimension: string) {
    const dimLabel = FIELD_LABELS[`adli_${dimension}`] || dimension;
    sendMessage(`Improve my ${dimLabel} section. Rewrite it to be stronger based on your analysis. Keep what's good, fill in what's missing, and make it more complete.`);
  }

  async function applySuggestion() {
    if (!pendingSuggestion || isApplying) return;

    setIsApplying(true);
    try {
      const response = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          field: pendingSuggestion.field,
          content: pendingSuggestion.content,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to apply suggestion");
      }

      const fieldLabel = FIELD_LABELS[pendingSuggestion.field] || pendingSuggestion.field;

      // Add a success message to the chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Applied!** The ${fieldLabel} section has been updated. The previous version was saved to process history so you can undo if needed.\n\nRefresh the page to see the changes in the process sections below, or continue improving other dimensions.`,
        },
      ]);

      setPendingSuggestion(null);
      onProcessUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <>
      {/* Floating "Ask AI" button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-[#324a4d] text-white rounded-full px-5 py-3 shadow-lg hover:bg-[#55787c] transition-colors flex items-center gap-2 z-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.1 6.4 5 7.7V22l3-3 3 3v-4.3c2.9-1.3 5-4.2 5-7.7a8 8 0 0 0-8-8z" />
            <circle cx="9" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
          </svg>
          Ask AI
        </button>
      )}

      {/* Chat panel drawer */}
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className={`fixed right-0 top-0 h-full w-full bg-white shadow-2xl z-50 flex flex-col transition-all duration-200 ${isExpanded ? "sm:w-[720px]" : "sm:w-[420px]"}`}>
            {/* Header */}
            <div className="bg-[#324a4d] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.1 6.4 5 7.7V22l3-3 3 3v-4.3c2.9-1.3 5-4.2 5-7.7a8 8 0 0 0-8-8z" />
                  <circle cx="9" cy="10" r="1" fill="currentColor" />
                  <circle cx="15" cy="10" r="1" fill="currentColor" />
                </svg>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">AI Process Advisor</div>
                  <div className="text-xs text-white/70 truncate">{processName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Expand/collapse toggle */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-white/80 hover:text-white text-xs border border-white/30 rounded px-2 py-1 hover:bg-white/10 transition-colors"
                  title={isExpanded ? "Collapse panel" : "Expand panel"}
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Welcome message when empty */}
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="bg-[#324a4d]/5 rounded-lg p-4 text-sm text-[#324a4d]">
                    <p className="font-medium mb-2">
                      I can help you analyze and improve this process. Try:
                    </p>
                    <ul className="space-y-1 text-[#55787c]">
                      <li>- Running an ADLI gap analysis</li>
                      <li>- Getting specific improvement suggestions</li>
                      <li>- Asking questions about Baldrige criteria</li>
                    </ul>
                  </div>

                  {/* Quick action buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Quick Actions</p>
                    <button
                      onClick={() => handleQuickAction("Analyze this process using the ADLI framework. Score each dimension (Approach, Deployment, Learning, Integration), identify the biggest gaps, and suggest what to improve first.")}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-[#f79935]/30 bg-[#f79935]/5 text-sm text-[#324a4d] hover:bg-[#f79935]/10 transition-colors"
                    >
                      <span className="font-medium text-[#f79935]">Analyze This Process</span>
                      <span className="text-gray-500 ml-1">— ADLI gap analysis with scores</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("What are the top 3 things I should improve about this process to make it stronger? Be specific and reference what's currently documented.")}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-[#55787c]/30 bg-[#55787c]/5 text-sm text-[#324a4d] hover:bg-[#55787c]/10 transition-colors"
                    >
                      <span className="font-medium text-[#55787c]">Top Improvements</span>
                      <span className="text-gray-500 ml-1">— 3 most impactful changes</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area.")}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-[#55787c]/30 bg-[#55787c]/5 text-sm text-[#324a4d] hover:bg-[#55787c]/10 transition-colors"
                    >
                      <span className="font-medium text-[#55787c]">Interview Me</span>
                      <span className="text-gray-500 ml-1">— guided questions to fill gaps</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ADLI Scorecard with Improve buttons */}
              {adliScores && (
                <AdliScorecard
                  scores={adliScores}
                  onImprove={handleImprove}
                  isLoading={isLoading}
                />
              )}

              {/* Message bubbles */}
              {messages.map((msg, i) => {
                // Strip structured blocks from displayed text
                let displayContent = msg.content;
                if (msg.role === "assistant") {
                  displayContent = parseAdliScores(displayContent).cleanedText;
                  displayContent = parseAdliSuggestion(displayContent).cleanedText;
                }

                return (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      msg.role === "user"
                        ? "max-w-[85%] bg-[#324a4d] text-white"
                        : "w-full bg-gray-100 text-[#324a4d]"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      displayContent ? (
                        <div className="text-sm">
                          <MarkdownContent content={displayContent} />
                        </div>
                      ) : (
                        <TypingIndicator />
                      )
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
                );
              })}

              {/* Apply suggestion button */}
              {pendingSuggestion && !isLoading && (
                <div className="bg-[#b1bd37]/10 border border-[#b1bd37]/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-[#324a4d]">
                    Ready to apply changes to: <strong>{FIELD_LABELS[pendingSuggestion.field] || pendingSuggestion.field}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    The previous version will be saved to process history.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={applySuggestion}
                      disabled={isApplying}
                      className="bg-[#b1bd37] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
                    >
                      {isApplying ? "Applying..." : "Apply to Process"}
                    </button>
                    <button
                      onClick={() => setPendingSuggestion(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this process..."
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#324a4d] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#55787c] focus:border-transparent"
                  rows={2}
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="bg-[#324a4d] text-white rounded-lg px-3 py-2 hover:bg-[#55787c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      <div className="w-2 h-2 bg-[#55787c] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 bg-[#55787c] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 bg-[#55787c] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function AdliScorecard({ scores, onImprove, isLoading }: { scores: AdliScores; onImprove?: (dimension: string) => void; isLoading?: boolean }) {
  const dimensions = [
    { key: "approach" as const, label: "Approach" },
    { key: "deployment" as const, label: "Deployment" },
    { key: "learning" as const, label: "Learning" },
    { key: "integration" as const, label: "Integration" },
  ];

  // Sort by score ascending so user can see weakest first
  const sorted = [...dimensions].sort((a, b) => scores[a.key] - scores[b.key]);

  const overall = Math.round(
    (scores.approach + scores.deployment + scores.learning + scores.integration) / 4
  );
  const overallLevel = getMaturityLevel(overall);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#324a4d]">ADLI Assessment</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Overall:</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: overallLevel.bgColor }}
          >
            {overall}% — {overallLevel.label}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map(({ key, label }) => {
          const score = scores[key];
          const level = getMaturityLevel(score);

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 w-20">{label}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    backgroundColor: level.bgColor,
                  }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right" style={{ color: level.color }}>
                {score}%
              </span>
              {onImprove && (
                <button
                  onClick={() => onImprove(key)}
                  disabled={isLoading}
                  className="text-xs text-[#55787c] hover:text-[#324a4d] font-medium disabled:opacity-40 whitespace-nowrap"
                >
                  Improve
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
