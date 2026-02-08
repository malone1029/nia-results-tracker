"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownContent from "@/components/markdown-content";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProcessDraft {
  name: string;
  description: string;
  category_suggestion: string;
  owner: string;
  is_key: boolean;
  charter: { content: string };
  adli_approach: { content: string };
  adli_deployment: { content: string };
  adli_learning: { content: string };
  adli_integration: { content: string };
}

// Parse process-draft block from AI response
function parseProcessDraft(text: string): { draft: ProcessDraft | null; cleanedText: string } {
  const match = text.match(/```process-draft\s*\n([\s\S]*?)\n```/);
  if (!match) return { draft: null, cleanedText: text };

  try {
    const draft = JSON.parse(match[1]) as ProcessDraft;
    const cleanedText = text.replace(/```process-draft\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { draft, cleanedText };
  } catch {
    return { draft: null, cleanedText: text };
  }
}

export default function AiCreateProcessPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProcessDraft | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitial = useRef(false);

  useEffect(() => {
    document.title = "Create Process with AI | NIA Excellence Hub";
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Send the opening prompt automatically on first load (ref prevents Strict Mode double-fire)
  useEffect(() => {
    if (!hasSentInitial.current && messages.length === 0) {
      hasSentInitial.current = true;
      sendMessage("I want to create a new process. Help me get started.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/create-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get AI response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
          return updated;
        });
      }

      // Check for draft in the response
      const { draft: parsedDraft } = parseProcessDraft(assistantContent);
      if (parsedDraft) {
        setDraft(parsedDraft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleSave() {
    if (!draft || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/create-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          processData: draft,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save process");
      }

      const { processId } = await response.json();
      router.push(`/processes/${processId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">Create Process with AI</h1>
          <p className="text-gray-500 mt-1">
            I&apos;ll ask you questions and build a complete process document.
          </p>
        </div>
        <Link
          href="/processes/new"
          className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors"
        >
          Use manual form instead
        </Link>
      </div>

      {/* Chat + Preview layout */}
      <div className="grid grid-cols-1 gap-6">
        {/* Chat area */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => {
              let displayContent = msg.content;
              if (msg.role === "assistant") {
                displayContent = parseProcessDraft(displayContent).cleanedText;
              }

              return (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* Hide the auto-sent first message */}
                  {msg.role === "user" && i === 0 ? null : (
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        msg.role === "user"
                          ? "max-w-[85%] bg-nia-dark text-white"
                          : "w-full bg-gray-50 text-nia-dark"
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
                  )}
                </div>
              );
            })}

            {/* Draft ready notification */}
            {draft && !showPreview && (
              <div className="bg-nia-green/10 border border-nia-green/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b1bd37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <p className="text-sm font-semibold text-nia-dark">
                    Process draft ready: &quot;{draft.name}&quot;
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Review the draft below and save it, or keep chatting to make changes.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreview(true)}
                    className="bg-nia-green text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors"
                  >
                    Review & Save
                  </button>
                  <button
                    onClick={() => setDraft(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your process..."
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
            <p className="text-xs text-gray-400 mt-1">
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && draft && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-nia-dark text-white px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-sm">Process Draft Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-white/80 hover:text-white text-xs border border-white/30 rounded px-2 py-1"
              >
                Back to chat
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Name & Meta */}
              <div>
                <h3 className="text-xl font-bold text-nia-dark">{draft.name}</h3>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                  <span>Category: <strong>{draft.category_suggestion}</strong></span>
                  {draft.owner && <span>Owner: <strong>{draft.owner}</strong></span>}
                  {draft.is_key && (
                    <span className="bg-nia-orange/10 text-nia-orange px-2 py-0.5 rounded text-xs font-medium">
                      Key Process
                    </span>
                  )}
                </div>
              </div>

              {draft.description && (
                <div>
                  <h4 className="text-sm font-semibold text-nia-dark mb-1">Description</h4>
                  <p className="text-sm text-gray-600">{draft.description}</p>
                </div>
              )}

              {/* Charter */}
              {draft.charter?.content && (
                <PreviewSection title="Charter" content={draft.charter.content} />
              )}

              {/* ADLI Sections */}
              {draft.adli_approach?.content && (
                <PreviewSection title="ADLI: Approach" content={draft.adli_approach.content} />
              )}
              {draft.adli_deployment?.content && (
                <PreviewSection title="ADLI: Deployment" content={draft.adli_deployment.content} />
              )}
              {draft.adli_learning?.content && (
                <PreviewSection title="ADLI: Learning" content={draft.adli_learning.content} />
              )}
              {draft.adli_integration?.content && (
                <PreviewSection title="ADLI: Integration" content={draft.adli_integration.content} />
              )}

              {/* Save button */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-nia-green text-white rounded-lg py-2.5 px-6 font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "Saving..." : "Save as New Process"}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="bg-gray-200 text-nia-dark rounded-lg py-2.5 px-6 hover:bg-gray-300 transition-colors"
                >
                  Back to Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="border-l-4 border-nia-orange pl-4">
      <h4 className="text-sm font-semibold text-nia-dark mb-2">{title}</h4>
      <div className="text-sm text-gray-600">
        <MarkdownContent content={content} />
      </div>
    </div>
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
