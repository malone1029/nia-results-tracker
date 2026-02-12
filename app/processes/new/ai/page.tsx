"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownContent from "@/components/markdown-content";
import { Button } from "@/components/ui";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProcessDraft {
  name: string;
  description: string;
  category_suggestion: string;
  owner: string;
  process_type: string;
  charter: { content: string };
  adli_approach: { content: string };
  adli_deployment: { content: string };
  adli_learning: { content: string };
  adli_integration: { content: string };
}

// The sections that appear in the draft preview, in order
const DRAFT_SECTIONS: { key: string; label: string; field: string }[] = [
  { key: "charter", label: "Charter", field: "charter" },
  { key: "approach", label: "Approach", field: "adli_approach" },
  { key: "deployment", label: "Deployment", field: "adli_deployment" },
  { key: "learning", label: "Learning", field: "adli_learning" },
  { key: "integration", label: "Integration", field: "adli_integration" },
];

const SECTION_COLORS: Record<string, string> = {
  charter: "#55787c",
  approach: "#55787c",
  deployment: "#f79935",
  learning: "#b1bd37",
  integration: "#324a4d",
};

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
  const [isSaving, setIsSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<"name" | "description" | null>(null);
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

  // Send the opening prompt automatically on first load
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

  // Update a draft section's content inline
  function updateDraftSection(field: string, newContent: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      [field]: { content: newContent },
    });
    setEditingSection(null);
  }

  // Update draft meta fields (name, description)
  function updateDraftMeta(field: "name" | "description", value: string) {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
    setEditingMeta(null);
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

  // Count how many ADLI sections have content
  const filledSections = draft
    ? DRAFT_SECTIONS.filter((s) => {
        const val = draft[s.field as keyof ProcessDraft];
        return val && typeof val === "object" && "content" in val && (val as { content: string }).content;
      }).length
    : 0;

  // Determine current step for the progress indicator
  const currentStep = isSaving ? 3 : editingSection || editingMeta ? 2 : draft ? 1 : 0;

  return (
    <div className="space-y-4">
      {/* Header + Progress Steps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-nia-dark">Create with AI</h1>
          <ProgressSteps currentStep={currentStep} />
        </div>
        <Button variant="secondary" size="sm" href="/processes/new">Use manual form</Button>
      </div>

      {/* Side-by-side layout: chat left, preview right */}
      <div className={`grid gap-5 ${draft ? "lg:grid-cols-[1fr_400px]" : "max-w-3xl"}`}>
        {/* ═══ LEFT: Chat ═══ */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ minHeight: draft ? "calc(100vh - 160px)" : "600px" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                          ? "max-w-[85%] bg-nia-dark-solid text-white"
                          : "w-full bg-surface-hover text-nia-dark"
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

            {/* Draft notification — only shown on mobile (desktop sees the preview panel) */}
            {draft && (
              <div className="lg:hidden bg-nia-green/10 border border-nia-green/30 rounded-lg p-3">
                <p className="text-sm font-medium text-nia-dark">
                  Draft ready — scroll down to review and edit.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-nia-red/10 border border-nia-red/30 rounded-lg px-3 py-2 text-sm text-nia-red">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3 flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your process..."
                className="flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm text-nia-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue focus:border-transparent"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="bg-nia-dark-solid text-white rounded-lg px-3 py-2 hover:bg-nia-grey-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* ═══ RIGHT: Live Draft Preview (appears when draft exists) ═══ */}
        {draft && (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 160px)" }}>
            {/* Preview header */}
            <div className="bg-nia-dark-solid text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="font-semibold text-sm">Draft Preview</span>
                <span className="text-xs text-white/60">{filledSections}/5 sections</span>
              </div>
              <Button variant="success" size="xs" onClick={handleSave} disabled={isSaving} loading={isSaving}>
                {isSaving ? "Saving..." : "Save Process"}
              </Button>
            </div>

            {/* Scrollable preview content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Process name — click to edit */}
              <div>
                {editingMeta === "name" ? (
                  <input
                    autoFocus
                    defaultValue={draft.name}
                    onBlur={(e) => updateDraftMeta("name", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateDraftMeta("name", e.currentTarget.value);
                      if (e.key === "Escape") setEditingMeta(null);
                    }}
                    className="w-full text-lg font-bold text-nia-dark border border-nia-grey-blue/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30"
                  />
                ) : (
                  <h3
                    className="text-lg font-bold text-nia-dark cursor-pointer hover:bg-surface-hover rounded px-2 py-1 -mx-2 transition-colors group"
                    onClick={() => setEditingMeta("name")}
                    title="Click to edit"
                  >
                    {draft.name}
                    <PencilHint />
                  </h3>
                )}

                <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-text-tertiary">
                  <span className="bg-surface-subtle rounded px-2 py-0.5">{draft.category_suggestion}</span>
                  {draft.owner && <span className="bg-surface-subtle rounded px-2 py-0.5">{draft.owner}</span>}
                  {draft.process_type === "key" && <span className="text-xs px-2 py-0.5 rounded-full bg-nia-orange/20 text-nia-orange font-medium">Key Process</span>}
                  {draft.process_type === "support" && <span className="text-xs px-2 py-0.5 rounded-full bg-nia-grey-blue/15 text-nia-grey-blue font-medium">Support</span>}
                </div>
              </div>

              {/* Description — click to edit */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Description</label>
                {editingMeta === "description" ? (
                  <textarea
                    autoFocus
                    defaultValue={draft.description}
                    onBlur={(e) => updateDraftMeta("description", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingMeta(null);
                    }}
                    rows={2}
                    className="w-full mt-1 text-sm text-nia-dark border border-nia-grey-blue/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 resize-none"
                  />
                ) : (
                  <p
                    className="text-sm text-text-secondary mt-1 cursor-pointer hover:bg-surface-hover rounded px-2 py-1 -mx-2 transition-colors group"
                    onClick={() => setEditingMeta("description")}
                    title="Click to edit"
                  >
                    {draft.description || "No description yet"}
                    <PencilHint />
                  </p>
                )}
              </div>

              {/* ADLI Sections — each editable */}
              {DRAFT_SECTIONS.map((section) => {
                const fieldVal = draft[section.field as keyof ProcessDraft];
                const content = fieldVal && typeof fieldVal === "object" && "content" in fieldVal
                  ? (fieldVal as { content: string }).content
                  : "";
                const borderColor = SECTION_COLORS[section.key] || "#55787c";
                const isEditing = editingSection === section.key;

                return (
                  <div
                    key={section.key}
                    className="border-l-4 pl-3 rounded-r"
                    style={{ borderColor }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: borderColor }}>
                        {section.label}
                      </h4>
                      {content && !isEditing && (
                        <button
                          onClick={() => setEditingSection(section.key)}
                          className="text-xs text-text-muted hover:text-nia-dark transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          defaultValue={content}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingSection(null);
                          }}
                          rows={8}
                          className="w-full text-sm text-nia-dark border border-nia-grey-blue/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 resize-y font-mono"
                          id={`edit-${section.key}`}
                        />
                        <div className="flex gap-2">
                          <Button size="xs" onClick={() => { const el = document.getElementById(`edit-${section.key}`) as HTMLTextAreaElement; if (el) updateDraftSection(section.field, el.value); }}>
                            Done
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => setEditingSection(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : content ? (
                      <div
                        className="text-sm text-text-secondary cursor-pointer hover:bg-surface-hover rounded px-2 py-1 -mx-2 transition-colors group"
                        onClick={() => setEditingSection(section.key)}
                        title="Click to edit"
                      >
                        <MarkdownContent content={content} />
                        <PencilHint />
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted italic py-1">
                        Not yet generated — keep chatting
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Save footer */}
              <div className="pt-3 border-t border-border flex gap-2">
                <Button variant="success" onClick={handleSave} disabled={isSaving} loading={isSaving} className="flex-1">
                  {isSaving ? "Saving..." : "Save as New Process"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Discard</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small pencil icon that appears on hover to hint editability */
function PencilHint() {
  return (
    <svg
      className="inline-block ml-1.5 w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const STEPS = [
  { label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { label: "Draft", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" },
  { label: "Edit", icon: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" },
  { label: "Save", icon: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" },
];

function ProgressSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="hidden sm:flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        const color = isActive ? "#324a4d" : isCompleted ? "#b1bd37" : "var(--grid-line-strong)";

        return (
          <div key={step.label} className="flex items-center">
            <div className="flex items-center gap-1.5" title={step.label}>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: isActive ? color : isCompleted ? color : "transparent",
                  border: `2px solid ${color}`,
                }}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke={isActive ? "white" : color}
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={step.icon} />
                  </svg>
                )}
              </div>
              <span
                className="text-xs font-medium transition-colors"
                style={{ color: isActive ? "#324a4d" : isCompleted ? "#b1bd37" : "var(--text-muted)" }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-6 h-0.5 mx-1 rounded transition-colors"
                style={{ backgroundColor: isCompleted ? "#b1bd37" : "var(--grid-line)" }}
              />
            )}
          </div>
        );
      })}
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
