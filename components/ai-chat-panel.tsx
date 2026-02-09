"use client";

import { useState, useRef, useEffect } from "react";
import MarkdownContent from "./markdown-content";
import AdliRadar from "./adli-radar";
import { getMaturityLevel } from "@/lib/colors";

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

interface UploadedFile {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface CoachSuggestion {
  id: string;
  field: string;
  priority: "quick-win" | "important" | "long-term";
  effort: "minimal" | "moderate" | "substantial";
  title: string;
  whyMatters: string;
  preview: string;
  content: string;
}

interface AiChatPanelProps {
  processId: number;
  processName: string;
  onProcessUpdated?: () => void;
  autoAnalyze?: boolean;
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

// Parse coach-suggestions code block from AI response
function parseCoachSuggestions(text: string): { suggestions: CoachSuggestion[]; cleanedText: string } {
  const match = text.match(/```coach-suggestions\s*\n([\s\S]*?)\n```/);
  if (!match) {
    // Backward compat: also try old adli-suggestion format
    const oldMatch = text.match(/```adli-suggestion\s*\n([\s\S]*?)\n```/);
    if (oldMatch) {
      try {
        const old = JSON.parse(oldMatch[1]) as { field: string; content: string };
        const cleanedText = text.replace(/```adli-suggestion\s*\n[\s\S]*?\n```\s*\n?/g, "").trim();
        return {
          suggestions: [{
            id: "legacy",
            field: old.field,
            priority: "important",
            effort: "moderate",
            title: `Update ${FIELD_LABELS[old.field] || old.field}`,
            whyMatters: "AI-suggested improvement for this section.",
            preview: "Apply the suggested content to this section.",
            content: old.content,
          }],
          cleanedText,
        };
      } catch { /* fall through */ }
    }
    return { suggestions: [], cleanedText: text };
  }

  try {
    const suggestions = JSON.parse(match[1]) as CoachSuggestion[];
    const cleanedText = text.replace(/```coach-suggestions\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { suggestions, cleanedText };
  } catch {
    return { suggestions: [], cleanedText: text };
  }
}

const FIELD_LABELS: Record<string, string> = {
  charter: "Charter",
  adli_approach: "ADLI: Approach",
  adli_deployment: "ADLI: Deployment",
  adli_learning: "ADLI: Learning",
  adli_integration: "ADLI: Integration",
};


export default function AiChatPanel({ processId, processName, onProcessUpdated, autoAnalyze }: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const autoAnalyzeRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adliScores, setAdliScores] = useState<AdliScores | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<CoachSuggestion[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Auto-open and trigger analysis if autoAnalyze prop is set
  useEffect(() => {
    if (autoAnalyze && !autoAnalyzeRef.current) {
      autoAnalyzeRef.current = true;
      setIsOpen(true);
      // Small delay to let the panel render before sending
      setTimeout(() => {
        sendMessage("Analyze this process using the ADLI framework. Score each dimension, identify the biggest gaps, and suggest the 2-3 most impactful improvements with effort estimates.");
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalyze]);

  // Load uploaded files when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function fetchFiles() {
    const res = await fetch(`/api/ai/files?processId=${processId}`);
    if (res.ok) {
      const data = await res.json();
      setUploadedFiles(data);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("processId", String(processId));

      const res = await fetch("/api/ai/files", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFileDelete(fileId: number) {
    const res = await fetch(`/api/ai/files?fileId=${fileId}`, { method: "DELETE" });
    if (res.ok) {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  }

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
        // Persist scores to database
        fetch("/api/ai/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processId,
            approach: scores.approach,
            deployment: scores.deployment,
            learning: scores.learning,
            integration: scores.integration,
          }),
        }).catch(() => { /* silent — non-critical */ });
      }
      const { suggestions } = parseCoachSuggestions(assistantContent);
      if (suggestions.length > 0) {
        setPendingSuggestions(suggestions);
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
    sendMessage(`Coach me on improving the ${dimLabel} section. What are the 2-3 most impactful changes I could make? Include effort estimates so I can prioritize.`);
  }

  function handleTellMeMore(suggestion: CoachSuggestion) {
    const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;
    sendMessage(`Tell me more about "${suggestion.title}" for the ${fieldLabel} section. What specifically would change and why does it matter?`);
  }

  async function applySuggestion(suggestion: CoachSuggestion) {
    if (isApplying) return;

    setIsApplying(true);
    try {
      const response = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          field: suggestion.field,
          content: suggestion.content,
          suggestionTitle: suggestion.title,
          whyMatters: suggestion.whyMatters,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to apply suggestion");
      }

      const data = await response.json();
      const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;

      // Remove this suggestion from pending list
      setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      // Build success message based on Asana status
      let successMsg = `**Applied!** "${suggestion.title}" has been applied to the ${fieldLabel} section.`;
      if (data.asanaStatus === "created") {
        successMsg += ` An Asana task was created to track this improvement.`;
      } else if (data.asanaStatus === "not_linked") {
        successMsg += ` Export this process to Asana to track improvements as tasks.`;
      } else if (data.asanaStatus === "no_token" || data.asanaStatus === "failed") {
        successMsg += ` (Couldn't create Asana task — check your Asana connection in Settings.)`;
      }

      // Add a success message to the chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: successMsg,
        },
      ]);

      onProcessUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  }

  async function applyAllSuggestions() {
    for (const suggestion of pendingSuggestions) {
      await applySuggestion(suggestion);
    }
  }

  return (
    <>
      {/* Floating "Ask AI" button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-nia-dark text-white rounded-full px-5 py-3 shadow-lg hover:bg-nia-grey-blue transition-colors flex items-center gap-2 z-50"
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
            <div className="bg-nia-dark text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.1 6.4 5 7.7V22l3-3 3 3v-4.3c2.9-1.3 5-4.2 5-7.7a8 8 0 0 0-8-8z" />
                  <circle cx="9" cy="10" r="1" fill="currentColor" />
                  <circle cx="15" cy="10" r="1" fill="currentColor" />
                </svg>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">AI Process Coach</div>
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
                  <div className="bg-nia-dark/5 rounded-lg p-4 text-sm text-nia-dark">
                    <p className="font-medium mb-2">
                      I can help you analyze and improve this process. Try:
                    </p>
                    <ul className="space-y-1 text-nia-grey-blue">
                      <li>- Running an ADLI gap analysis</li>
                      <li>- Getting specific improvement suggestions</li>
                      <li>- Asking questions about Baldrige criteria</li>
                    </ul>
                  </div>

                  {/* Quick action buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Quick Actions</p>
                    <button
                      onClick={() => handleQuickAction("Analyze this process using the ADLI framework. Score each dimension (Approach, Deployment, Learning, Integration), identify the biggest gaps, and suggest the 2-3 most impactful improvements with effort estimates.")}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-nia-orange/30 bg-nia-orange/5 text-sm text-nia-dark hover:bg-nia-orange/10 transition-colors"
                    >
                      <span className="font-medium text-nia-orange">Analyze This Process</span>
                      <span className="text-gray-500 ml-1">— ADLI scores + top gaps</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("Coach me on this process. What are the 2-3 quickest wins I could tackle right now to improve maturity? Focus on what will make the biggest difference with the least effort.")}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-nia-green/30 bg-nia-green/5 text-sm text-nia-dark hover:bg-nia-green/10 transition-colors"
                    >
                      <span className="font-medium text-nia-green">Coach Me</span>
                      <span className="text-gray-500 ml-1">— quick wins with effort estimates</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.")}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-nia-grey-blue/30 bg-nia-grey-blue/5 text-sm text-nia-dark hover:bg-nia-grey-blue/10 transition-colors"
                    >
                      <span className="font-medium text-nia-grey-blue">Interview Me</span>
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
                  displayContent = parseCoachSuggestions(displayContent).cleanedText;
                }

                return (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      msg.role === "user"
                        ? "max-w-[85%] bg-nia-dark text-white"
                        : "w-full bg-gray-100 text-nia-dark"
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

              {/* Coach suggestion cards */}
              {pendingSuggestions.length > 0 && !isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-nia-dark">
                      Suggested Improvements
                    </p>
                    <button
                      onClick={() => setPendingSuggestions([])}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Dismiss
                    </button>
                  </div>

                  {pendingSuggestions.map((suggestion) => (
                    <CoachSuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onApply={() => applySuggestion(suggestion)}
                      onTellMore={() => handleTellMeMore(suggestion)}
                      isApplying={isApplying}
                    />
                  ))}

                  {pendingSuggestions.length > 1 && (
                    <button
                      onClick={applyAllSuggestions}
                      disabled={isApplying}
                      className="w-full bg-nia-dark text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
                    >
                      {isApplying ? "Applying..." : "Apply All Suggestions"}
                    </button>
                  )}
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
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-nia-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue focus:border-transparent"
                  rows={2}
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="bg-nia-dark text-white rounded-lg px-3 py-2 hover:bg-nia-grey-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-400">
                  Enter to send, Shift+Enter for new line
                </p>
                <div className="flex items-center gap-2">
                  {uploadedFiles.length > 0 && (
                    <span className="text-xs text-nia-grey-blue">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".txt,.md,.csv,.json,.png,.jpg,.jpeg,.pdf,.xlsx,.xls,.docx"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs text-nia-grey-blue hover:text-nia-dark flex items-center gap-1 disabled:opacity-40"
                    title="Upload a file for AI context"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                    {isUploading ? "Uploading..." : "Attach"}
                  </button>
                </div>
              </div>

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1"
                    >
                      <span className="text-nia-dark truncate mr-2">
                        {f.file_name}
                        <span className="text-gray-400 ml-1">
                          ({Math.round(f.file_size / 1024)}KB)
                        </span>
                      </span>
                      <button
                        onClick={() => handleFileDelete(f.id)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                        title="Remove file"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
      <div className="w-2 h-2 bg-nia-grey-blue rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 bg-nia-grey-blue rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 bg-nia-grey-blue rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  "quick-win": { bg: "bg-nia-green/15", text: "text-nia-green", label: "Quick Win" },
  "important": { bg: "bg-nia-orange/15", text: "text-nia-orange", label: "Important" },
  "long-term": { bg: "bg-nia-grey-blue/15", text: "text-nia-grey-blue", label: "Long-term" },
};

const EFFORT_LABELS: Record<string, string> = {
  minimal: "< 30 min",
  moderate: "1-2 hours",
  substantial: "Half day+",
};

function CoachSuggestionCard({
  suggestion,
  onApply,
  onTellMore,
  isApplying,
}: {
  suggestion: CoachSuggestion;
  onApply: () => void;
  onTellMore: () => void;
  isApplying: boolean;
}) {
  const priority = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES["important"];
  const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;
  const effortLabel = EFFORT_LABELS[suggestion.effort] || suggestion.effort;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header with badges */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
            {priority.label}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {effortLabel}
          </span>
          <span className="text-xs text-gray-400 ml-auto">{fieldLabel}</span>
        </div>
        <p className="text-sm font-semibold text-nia-dark">{suggestion.title}</p>
      </div>

      {/* Why it matters + preview */}
      <div className="px-3 py-2 space-y-1.5">
        <p className="text-xs text-gray-600 italic">{suggestion.whyMatters}</p>
        <p className="text-xs text-gray-500">{suggestion.preview}</p>
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onApply}
          disabled={isApplying}
          className="text-xs bg-nia-dark text-white rounded px-3 py-1.5 font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
        >
          {isApplying ? "Applying..." : "Apply This"}
        </button>
        <button
          onClick={onTellMore}
          className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium px-2 py-1.5 transition-colors"
        >
          Tell Me More
        </button>
      </div>
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
        <h3 className="text-sm font-semibold text-nia-dark">ADLI Assessment</h3>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: overallLevel.bgColor }}
        >
          {overall}% — {overallLevel.label}
        </span>
      </div>

      {/* Radar visualization */}
      <div className="flex justify-center py-1">
        <AdliRadar
          approach={scores.approach}
          deployment={scores.deployment}
          learning={scores.learning}
          integration={scores.integration}
          size={160}
          color={overallLevel.bgColor}
        />
      </div>

      {/* Dimension bars with improve buttons */}
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
                  className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium disabled:opacity-40 whitespace-nowrap"
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
