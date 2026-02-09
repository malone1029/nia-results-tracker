"use client";

import { useState, useRef, useEffect } from "react";
import MarkdownContent from "./markdown-content";
import AdliRadar from "./adli-radar";
import { getMaturityLevel } from "@/lib/colors";
import { PDCA_SECTIONS } from "@/lib/pdca";
import type { PdcaSection } from "@/lib/types";

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

interface SuggestionTask {
  title: string;
  description: string;
  pdcaSection: "plan" | "execute" | "evaluate" | "improve";
  adliDimension: "approach" | "deployment" | "learning" | "integration";
}

interface CoachSuggestion {
  id: string;
  field: string;
  priority: "quick-win" | "important" | "long-term";
  effort: "minimal" | "moderate" | "substantial";
  title: string;
  whyMatters: string;
  preview: string;
  content: string | Record<string, string>; // string for normal, object for charter_cleanup
  tasks?: SuggestionTask[];
}

interface ConversationSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AiChatPanelProps {
  processId: number;
  processName: string;
  onProcessUpdated?: () => void;
  autoAnalyze?: boolean;
  guidedStep?: string | null;
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

// Parse proposed-tasks code block from AI response
function parseProposedTasks(text: string): { tasks: SuggestionTask[]; cleanedText: string } {
  const match = text.match(/```proposed-tasks\s*\n([\s\S]*?)\n```/);
  if (!match) return { tasks: [], cleanedText: text };

  try {
    const tasks = JSON.parse(match[1]) as SuggestionTask[];
    const cleanedText = text.replace(/```proposed-tasks\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { tasks, cleanedText };
  } catch {
    return { tasks: [], cleanedText: text };
  }
}

// Strip partial (still-streaming) structured blocks so raw JSON isn't visible
function stripPartialBlocks(text: string): string {
  // Remove complete structured blocks (scores + suggestions + proposed-tasks)
  let cleaned = text;
  cleaned = cleaned.replace(/```adli-scores\s*\n[\s\S]*?\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```coach-suggestions\s*\n[\s\S]*?\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```adli-suggestion\s*\n[\s\S]*?\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```proposed-tasks\s*\n[\s\S]*?\n```\s*\n?/g, "");

  // Remove PARTIAL blocks that started but haven't closed yet (still streaming)
  cleaned = cleaned.replace(/```adli-scores[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```coach-suggestions[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```adli-suggestion[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```proposed-tasks[\s\S]*$/g, "");

  return cleaned.trim();
}

// Check if a response has an in-progress structured block (started but not closed)
function hasPartialBlock(text: string): "scores" | "suggestions" | "tasks" | null {
  // Check for partial adli-scores (opened but not closed)
  if (/```adli-scores(?![\s\S]*?```)[\s\S]*$/.test(text)) return "scores";
  // Check for partial coach-suggestions (opened but not closed)
  if (/```coach-suggestions(?![\s\S]*?```)[\s\S]*$/.test(text)) return "suggestions";
  // Check for partial proposed-tasks (opened but not closed)
  if (/```proposed-tasks(?![\s\S]*?```)[\s\S]*$/.test(text)) return "tasks";
  return null;
}

const FIELD_LABELS: Record<string, string> = {
  charter: "Charter",
  adli_approach: "ADLI: Approach",
  adli_deployment: "ADLI: Deployment",
  adli_learning: "ADLI: Learning",
  adli_integration: "ADLI: Integration",
};


export default function AiChatPanel({ processId, processName, onProcessUpdated, autoAnalyze, guidedStep }: AiChatPanelProps) {
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
  const [proposedTasks, setProposedTasks] = useState<SuggestionTask[]>([]);
  const [isQueuing, setIsQueuing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversation persistence state
  const conversationIdRef = useRef<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyLoadedRef = useRef(false);

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

  // Auto-open panel if autoAnalyze prop is set (don't auto-send — let user pick a step button)
  useEffect(() => {
    if (autoAnalyze && !autoAnalyzeRef.current) {
      autoAnalyzeRef.current = true;
      setIsOpen(true);
    }
  }, [autoAnalyze]);

  // Load uploaded files and latest conversation when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      // Load latest conversation on first open (unless autoAnalyze will start fresh)
      if (!historyLoadedRef.current && !autoAnalyze) {
        historyLoadedRef.current = true;
        loadLatestConversation();
      } else if (!historyLoadedRef.current && autoAnalyze) {
        // For autoAnalyze, just load the list (not the latest conversation)
        historyLoadedRef.current = true;
        fetchConversations();
      }
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

  // --- Conversation persistence ---

  async function fetchConversations() {
    try {
      const res = await fetch(`/api/ai/conversations?processId=${processId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch { /* silent */ }
  }

  async function loadLatestConversation() {
    try {
      const res = await fetch(`/api/ai/conversations?processId=${processId}`);
      if (!res.ok) return;
      const list: ConversationSummary[] = await res.json();
      setConversations(list);
      if (list.length === 0) return;

      // Load the most recent conversation
      const latest = list[0];
      const detailRes = await fetch(`/api/ai/conversations?id=${latest.id}`);
      if (!detailRes.ok) return;
      const detail = await detailRes.json();

      conversationIdRef.current = detail.id;
      setMessages(detail.messages || []);
      if (detail.adli_scores) setAdliScores(detail.adli_scores);
    } catch { /* silent — show empty state */ }
  }

  async function loadConversation(id: number) {
    try {
      const res = await fetch(`/api/ai/conversations?id=${id}`);
      if (!res.ok) return;
      const detail = await res.json();

      conversationIdRef.current = detail.id;
      setMessages(detail.messages || []);
      setAdliScores(detail.adli_scores || null);
      setPendingSuggestions([]);
      setShowHistory(false);
    } catch { /* silent */ }
  }

  async function saveConversation(msgs: Message[], scores: AdliScores | null) {
    const title = msgs.find((m) => m.role === "user")?.content.slice(0, 60) || "New Conversation";

    try {
      if (conversationIdRef.current) {
        // Update existing conversation
        await fetch("/api/ai/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: conversationIdRef.current,
            messages: msgs,
            adli_scores: scores,
          }),
        });
      } else {
        // Create new conversation
        const res = await fetch("/api/ai/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            process_id: processId,
            title,
            messages: msgs,
            adli_scores: scores,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          conversationIdRef.current = data.id;
        }
      }
      // Refresh the conversation list in the background
      fetchConversations();
    } catch { /* silent — fire-and-forget */ }
  }

  function startNewChat() {
    conversationIdRef.current = null;
    setMessages([]);
    setAdliScores(null);
    setPendingSuggestions([]);
    setProposedTasks([]);
    setShowHistory(false);
    setError(null);
  }

  async function deleteConversation(id: number) {
    try {
      await fetch(`/api/ai/conversations?id=${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // If we deleted the active conversation, clear it
      if (conversationIdRef.current === id) {
        startNewChat();
      }
    } catch { /* silent */ }
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
      // 3-minute timeout — AI responses with suggestions can be large
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          messages: updatedMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      let latestScores = adliScores;
      if (scores) {
        latestScores = scores;
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
      const { tasks: newProposedTasks } = parseProposedTasks(assistantContent);
      if (newProposedTasks.length > 0) {
        setProposedTasks(newProposedTasks);
      }

      // Save conversation after each complete AI response
      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantContent }];
      saveConversation(finalMessages, latestScores);
    } catch (err) {
      let message = "Something went wrong. Please try again.";
      if (err instanceof DOMException && err.name === "AbortError") {
        message = "Request timed out after 3 minutes. Try a simpler question or break your request into smaller parts.";
      } else if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) {
        message = "Network connection was lost — the AI response may have taken too long. Try again, or ask a more focused question to get a shorter response.";
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      // Remove the empty assistant message if there was an error
      // But keep partial content if the stream started successfully
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
          tasks: suggestion.tasks || [],
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

      // Build success message
      let successMsg: string;
      if (suggestion.field === "charter_cleanup" && data.fieldsUpdated) {
        successMsg = `**Applied!** "${suggestion.title}" — ${data.fieldsUpdated} sections updated. Process documentation has been separated from operational content.`;
      } else {
        successMsg = `**Applied!** "${suggestion.title}" has been applied to the ${fieldLabel} section.`;
        if (data.tasksQueued > 0) {
          successMsg += ` ${data.tasksQueued} task${data.tasksQueued !== 1 ? "s" : ""} queued for review — check the Tasks tab to review and export to Asana.`;
        }
      }

      // Add a success message to the chat and save
      setMessages((prev) => {
        const updated = [
          ...prev,
          { role: "assistant" as const, content: successMsg },
        ];
        // Fire-and-forget save
        saveConversation(updated, adliScores);
        return updated;
      });

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

  async function queueTask(task: SuggestionTask) {
    setIsQueuing(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process_id: processId,
          title: task.title,
          description: task.description || null,
          pdca_section: task.pdcaSection,
          adli_dimension: task.adliDimension || null,
          source: "ai_interview",
        }),
      });
      if (res.ok) {
        setProposedTasks((prev) => prev.filter((t) => t.title !== task.title));
      }
    } catch {
      setError("Failed to queue task");
    } finally {
      setIsQueuing(false);
    }
  }

  async function queueAllTasks() {
    if (proposedTasks.length === 0) return;
    setIsQueuing(true);
    try {
      const rows = proposedTasks.map((t) => ({
        process_id: processId,
        title: t.title,
        description: t.description || null,
        pdca_section: t.pdcaSection,
        adli_dimension: t.adliDimension || null,
        source: "ai_interview",
      }));
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      if (res.ok) {
        const data = await res.json();
        setProposedTasks([]);
        setMessages((prev) => [
          ...prev,
          { role: "assistant" as const, content: `**Queued ${data.count} tasks!** Check the Tasks tab to review and export them to Asana.` },
        ]);
        onProcessUpdated?.();
      }
    } catch {
      setError("Failed to queue tasks");
    } finally {
      setIsQueuing(false);
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
              <div className="flex items-center gap-1.5">
                {/* New Chat button */}
                <button
                  onClick={startNewChat}
                  className="text-white/80 hover:text-white text-xs border border-white/30 rounded px-2 py-1 hover:bg-white/10 transition-colors"
                  title="Start a new conversation"
                >
                  + New
                </button>
                {/* Conversation history toggle */}
                <div className="relative">
                  <button
                    onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchConversations(); }}
                    className={`text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors ${showHistory ? "bg-white/20 text-white" : ""}`}
                    title="Conversation history"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </button>
                  {/* History dropdown */}
                  {showHistory && (
                    <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto">
                      <div className="p-2 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Past Conversations</p>
                      </div>
                      {conversations.length === 0 ? (
                        <div className="p-3 text-xs text-gray-400 text-center">No conversations yet</div>
                      ) : (
                        conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${conversationIdRef.current === conv.id ? "bg-nia-dark/5" : ""}`}
                          >
                            <button
                              onClick={() => loadConversation(conv.id)}
                              className="flex-1 text-left min-w-0"
                            >
                              <p className="text-sm text-nia-dark truncate font-medium">
                                {conv.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(conv.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                {" · "}
                                {new Date(conv.updated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                              className="text-gray-300 hover:text-red-400 flex-shrink-0 p-1"
                              title="Delete conversation"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
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

                  {/* Step-aware action buttons */}
                  <StepActions guidedStep={guidedStep} onAction={handleQuickAction} />
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
                // Strip structured blocks (complete AND partial) from displayed text
                const displayContent = msg.role === "assistant"
                  ? stripPartialBlocks(msg.content)
                  : msg.content;

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

              {/* "Preparing suggestions" indicator — visible while structured block is streaming */}
              {isLoading && messages.length > 0 &&
                messages[messages.length - 1].role === "assistant" &&
                hasPartialBlock(messages[messages.length - 1].content) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nia-orange/5 border border-nia-orange/20">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-nia-orange rounded-full animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-nia-orange rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                    <div className="w-1.5 h-1.5 bg-nia-orange rounded-full animate-pulse" style={{ animationDelay: "600ms" }} />
                  </div>
                  <span className="text-xs font-medium text-nia-orange">
                    {(() => {
                      const blockType = hasPartialBlock(messages[messages.length - 1].content);
                      if (blockType === "scores") return "Calculating ADLI scores...";
                      if (blockType === "tasks") return "Building task list...";
                      return "Preparing improvement suggestions...";
                    })()}
                  </span>
                </div>
              )}

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

                </div>
              )}

              {/* Proposed tasks from interview mode */}
              {proposedTasks.length > 0 && !isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-nia-dark">
                      Proposed Tasks ({proposedTasks.length})
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setProposedTasks([])}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={queueAllTasks}
                        disabled={isQueuing}
                        className="text-xs bg-nia-dark text-white rounded px-3 py-1.5 font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
                      >
                        {isQueuing ? "Queuing..." : "Queue All"}
                      </button>
                    </div>
                  </div>

                  {proposedTasks.map((task, idx) => {
                    const section = PDCA_SECTIONS[task.pdcaSection as PdcaSection];
                    return (
                      <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex items-start gap-2">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: section?.color || "#6b7280" }}
                          >
                            {section?.label || task.pdcaSection}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-nia-dark">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                            )}
                            {task.adliDimension && (
                              <span className="text-[10px] text-nia-grey-blue capitalize mt-1 inline-block">
                                {task.adliDimension}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => queueTask(task)}
                            disabled={isQueuing}
                            className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium flex-shrink-0 disabled:opacity-50"
                          >
                            Queue
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

            {/* Sticky Apply All bar — sits between messages and input */}
            {pendingSuggestions.length > 1 && !isLoading && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-gray-500">
                  {pendingSuggestions.length} suggestions ready
                </span>
                <button
                  onClick={applyAllSuggestions}
                  disabled={isApplying}
                  className="bg-nia-dark text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
                >
                  {isApplying ? "Applying..." : "Apply All"}
                </button>
              </div>
            )}

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

// Step-aware quick action buttons
// Shows a primary action based on the current guided step, plus secondary options

interface StepAction {
  label: string;
  description: string;
  prompt: string;
  color: string; // border + text color class prefix (e.g., "nia-orange")
  borderClass: string;
  bgClass: string;
  textClass: string;
}

const STEP_ACTIONS: Record<string, { primary: StepAction; secondary: StepAction[] }> = {
  start: {
    primary: {
      label: "Get Started",
      description: "welcome + overview of the improvement cycle",
      prompt: "Welcome me to this process and give me an overview of where things stand. What should I focus on first?",
      color: "nia-orange",
      borderClass: "border-nia-orange/30",
      bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
      textClass: "text-nia-orange",
    },
    secondary: [
      { label: "Analyze", description: "ADLI scores + gaps", prompt: "Analyze this process using the ADLI framework. Score each dimension, identify the biggest gaps, and suggest the 2-3 most impactful improvements with effort estimates.", color: "nia-grey-blue", borderClass: "border-nia-grey-blue/30", bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10", textClass: "text-nia-grey-blue" },
    ],
  },
  charter: {
    primary: {
      label: "Review My Charter",
      description: "check for mixed content, suggest cleanup",
      prompt: "Review this charter briefly. List what content types are mixed in (e.g., ADLI assessments, PDSA cycles, Baldrige links, task lists). For each, say which field it should move to. Keep your response short — just the analysis, no rewritten content yet. I'll ask you to generate the cleanup if I want to proceed.",
      color: "nia-orange",
      borderClass: "border-nia-orange/30",
      bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
      textClass: "text-nia-orange",
    },
    secondary: [
      { label: "Coach Me", description: "quick wins", prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now to improve maturity?", color: "nia-green", borderClass: "border-nia-green/30", bgClass: "bg-nia-green/5 hover:bg-nia-green/10", textClass: "text-nia-green" },
      { label: "Interview Me", description: "guided questions", prompt: "Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.", color: "nia-grey-blue", borderClass: "border-nia-grey-blue/30", bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10", textClass: "text-nia-grey-blue" },
    ],
  },
  assessment: {
    primary: {
      label: "Run ADLI Assessment",
      description: "score each dimension, find gaps",
      prompt: "Run a full ADLI assessment. Score each dimension (Approach, Deployment, Learning, Integration) from 0-100. Identify the weakest dimensions and suggest the 2-3 most impactful improvements with effort estimates.",
      color: "nia-orange",
      borderClass: "border-nia-orange/30",
      bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
      textClass: "text-nia-orange",
    },
    secondary: [
      { label: "Review Charter", description: "check for mixed content", prompt: "Review this charter briefly. List what content types are mixed in (e.g., ADLI assessments, PDSA cycles, Baldrige links). For each, say which field it should move to. Keep your response short — just the analysis.", color: "nia-grey-blue", borderClass: "border-nia-grey-blue/30", bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10", textClass: "text-nia-grey-blue" },
      { label: "Coach Me", description: "quick wins", prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now to improve maturity?", color: "nia-green", borderClass: "border-nia-green/30", bgClass: "bg-nia-green/5 hover:bg-nia-green/10", textClass: "text-nia-green" },
    ],
  },
  deep_dive: {
    primary: {
      label: "Improve Weakest Area",
      description: "focused suggestions for lowest-scoring dimension",
      prompt: "Focus on the weakest ADLI dimension for this process. Give me specific, actionable improvements with content I can apply. Include effort estimates and tasks.",
      color: "nia-orange",
      borderClass: "border-nia-orange/30",
      bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
      textClass: "text-nia-orange",
    },
    secondary: [
      { label: "Interview Me", description: "guided questions to fill gaps", prompt: "Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.", color: "nia-grey-blue", borderClass: "border-nia-grey-blue/30", bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10", textClass: "text-nia-grey-blue" },
      { label: "Analyze Again", description: "re-score after improvements", prompt: "Run a fresh ADLI assessment. Score each dimension and compare to where we started. What's improved and what still needs work?", color: "nia-green", borderClass: "border-nia-green/30", bgClass: "bg-nia-green/5 hover:bg-nia-green/10", textClass: "text-nia-green" },
    ],
  },
  tasks: {
    primary: {
      label: "Build Task List",
      description: "AI interviews you, generates PDCA tasks",
      prompt: "Help me build a task list for this process. Interview me about what needs to happen — the key steps, who does what, how we measure success, and what training is needed. Work through Plan, Execute, Evaluate, and Improve sections systematically. Ask 2-3 questions at a time, and generate tasks when you have enough context.",
      color: "nia-dark",
      borderClass: "border-nia-dark/20",
      bgClass: "bg-nia-dark/5 hover:bg-nia-dark/10",
      textClass: "text-nia-dark",
    },
    secondary: [
      { label: "Coach Me", description: "quick wins", prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now?", color: "nia-green", borderClass: "border-nia-green/30", bgClass: "bg-nia-green/5 hover:bg-nia-green/10", textClass: "text-nia-green" },
    ],
  },
  export: {
    primary: {
      label: "Review Before Export",
      description: "check what's ready and what needs work",
      prompt: "Review this process before I export to Asana. Summarize what's strong, what's still weak, and whether the charter and ADLI sections are ready. Flag anything I should fix first.",
      color: "nia-green",
      borderClass: "border-nia-green/30",
      bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
      textClass: "text-nia-green",
    },
    secondary: [
      { label: "Build More Tasks", description: "add tasks before export", prompt: "Help me build more tasks for this process before I export. What's missing from the task list?", color: "nia-dark", borderClass: "border-nia-dark/20", bgClass: "bg-nia-dark/5 hover:bg-nia-dark/10", textClass: "text-nia-dark" },
    ],
  },
};

// Fallback for processes without a guided step (not linked to Asana)
const DEFAULT_ACTIONS: { primary: StepAction; secondary: StepAction[] } = {
  primary: {
    label: "Analyze This Process",
    description: "ADLI scores + top gaps",
    prompt: "Analyze this process using the ADLI framework. Score each dimension (Approach, Deployment, Learning, Integration), identify the biggest gaps, and suggest the 2-3 most impactful improvements with effort estimates.",
    color: "nia-orange",
    borderClass: "border-nia-orange/30",
    bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
    textClass: "text-nia-orange",
  },
  secondary: [
    { label: "Coach Me", description: "quick wins with effort estimates", prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now to improve maturity? Focus on what will make the biggest difference with the least effort.", color: "nia-green", borderClass: "border-nia-green/30", bgClass: "bg-nia-green/5 hover:bg-nia-green/10", textClass: "text-nia-green" },
    { label: "Interview Me", description: "guided questions to fill gaps", prompt: "Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.", color: "nia-grey-blue", borderClass: "border-nia-grey-blue/30", bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10", textClass: "text-nia-grey-blue" },
    { label: "Build Task List", description: "AI interviews you, generates PDCA tasks", prompt: "Help me build a task list for this process. Interview me about what needs to happen — the key steps, who does what, how we measure success, and what training is needed. Work through Plan, Execute, Evaluate, and Improve sections systematically. Ask 2-3 questions at a time, and generate tasks when you have enough context.", color: "nia-dark", borderClass: "border-nia-dark/20", bgClass: "bg-nia-dark/5 hover:bg-nia-dark/10", textClass: "text-nia-dark" },
  ],
};

function StepActions({ guidedStep, onAction }: { guidedStep?: string | null; onAction: (prompt: string) => void }) {
  const actions = (guidedStep && STEP_ACTIONS[guidedStep]) || DEFAULT_ACTIONS;

  return (
    <div className="space-y-2">
      {guidedStep && STEP_ACTIONS[guidedStep] && (
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Next Step: {guidedStep.replace(/_/g, " ")}
        </p>
      )}
      {!guidedStep && (
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Quick Actions</p>
      )}

      {/* Primary action — larger, more prominent */}
      <button
        onClick={() => onAction(actions.primary.prompt)}
        className={`w-full text-left px-3 py-3 rounded-lg border ${actions.primary.borderClass} ${actions.primary.bgClass} text-sm text-nia-dark transition-colors`}
      >
        <span className={`font-semibold ${actions.primary.textClass}`}>{actions.primary.label}</span>
        <span className="text-gray-500 ml-1">— {actions.primary.description}</span>
      </button>

      {/* Secondary actions — smaller */}
      {actions.secondary.map((action) => (
        <button
          key={action.label}
          onClick={() => onAction(action.prompt)}
          className={`w-full text-left px-3 py-2.5 rounded-lg border ${action.borderClass} ${action.bgClass} text-sm text-nia-dark transition-colors`}
        >
          <span className={`font-medium ${action.textClass}`}>{action.label}</span>
          <span className="text-gray-500 ml-1">— {action.description}</span>
        </button>
      ))}
    </div>
  );
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string; border: string; cardBg: string }> = {
  "quick-win": { bg: "bg-nia-green/15", text: "text-nia-green", label: "Quick Win", border: "#b1bd37", cardBg: "rgba(177,189,55,0.04)" },
  "important": { bg: "bg-nia-orange/15", text: "text-nia-orange", label: "Important", border: "#f79935", cardBg: "rgba(247,153,53,0.04)" },
  "long-term": { bg: "bg-nia-grey-blue/15", text: "text-nia-grey-blue", label: "Long-term", border: "#55787c", cardBg: "rgba(85,120,124,0.04)" },
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
  const [showPreview, setShowPreview] = useState(false);
  const priority = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES["important"];
  const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;
  const effortLabel = EFFORT_LABELS[suggestion.effort] || suggestion.effort;

  // Build preview entries from content
  const previewEntries: { label: string; text: string }[] = [];
  if (typeof suggestion.content === "object") {
    for (const [key, value] of Object.entries(suggestion.content)) {
      previewEntries.push({ label: FIELD_LABELS[key] || key, text: value });
    }
  } else if (typeof suggestion.content === "string") {
    previewEntries.push({ label: fieldLabel, text: suggestion.content });
  }

  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden border-l-4"
      style={{ borderLeftColor: priority.border, backgroundColor: priority.cardBg, borderTop: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}
    >
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
        {/* Show affected fields for cleanup suggestions */}
        {suggestion.field === "charter_cleanup" && typeof suggestion.content === "object" && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.keys(suggestion.content).map((key) => (
              <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-nia-grey-blue/10 text-nia-grey-blue font-medium">
                {FIELD_LABELS[key] || key}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content preview — expandable */}
      {previewEntries.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-nia-grey-blue hover:text-nia-dark transition-colors"
          >
            <span>{showPreview ? "Hide Preview" : "Preview Changes"}</span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showPreview ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showPreview && (
            <div className="px-3 pb-3 space-y-3">
              {previewEntries.map(({ label, text }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                  <div className="text-xs text-gray-700 bg-white rounded border border-gray-200 p-2 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {text.length > 800 ? text.slice(0, 800) + "\n\n..." : text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task preview — shows proposed PDCA tasks if present */}
      {suggestion.tasks && suggestion.tasks.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Tasks ({suggestion.tasks.length})
          </p>
          <div className="space-y-1">
            {suggestion.tasks.map((task, idx) => {
              const section = PDCA_SECTIONS[task.pdcaSection as PdcaSection];
              return (
                <div key={idx} className="flex items-start gap-1.5">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 text-white"
                    style={{ backgroundColor: section?.color || "#6b7280" }}
                  >
                    {section?.label || task.pdcaSection}
                  </span>
                  <span className="text-xs text-gray-600">{task.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onApply}
          disabled={isApplying}
          className="text-xs bg-nia-dark text-white rounded px-3 py-1.5 font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
        >
          {isApplying ? "Applying..." : suggestion.field === "charter_cleanup"
            ? `Clean Up${typeof suggestion.content === "object" ? ` ${Object.keys(suggestion.content).length} Sections` : ""}`
            : `Apply${suggestion.tasks?.length ? ` + Queue ${suggestion.tasks.length} Task${suggestion.tasks.length !== 1 ? "s" : ""}` : ""}`}
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
