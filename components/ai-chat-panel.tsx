'use client';

import { useState, useRef, useEffect } from 'react';
import MarkdownContent from './markdown-content';
import CoachSuggestionCard from './coach-suggestion-card';
import MetricSuggestionCard from './metric-suggestion-card';
import SurveyQuestionCard from './survey-question-card';
import AdliScorecard from './adli-scorecard';
import { PDCA_SECTIONS } from '@/lib/pdca';
import type { PdcaSection } from '@/lib/types';
import { DEFAULT_ACTIONS, getStepDef, type StepActionDef } from '@/lib/step-actions';
import {
  FIELD_LABELS,
  parseAdliScores,
  parseCoachSuggestions,
  parseProposedTasks,
  parseMetricSuggestions,
  parseSurveyQuestions,
  stripPartialBlocks,
  hasPartialBlock,
  type AdliScores,
  type CoachSuggestion,
  type SuggestionTask,
  type MetricSuggestion,
  type SurveyQuestionSuggestion,
} from '@/lib/ai-parsers';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UploadedFile {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
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
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
}

export default function AiChatPanel({
  processId,
  processName,
  onProcessUpdated,
  autoAnalyze,
  guidedStep,
  pendingPrompt,
  onPromptConsumed,
}: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const autoAnalyzeRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adliScores, setAdliScores] = useState<AdliScores | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<CoachSuggestion[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<SuggestionTask[]>([]);
  const [isQueuing, setIsQueuing] = useState(false);
  const [pendingMetricSuggestions, setPendingMetricSuggestions] = useState<MetricSuggestion[]>([]);
  const [isLinkingMetric, setIsLinkingMetric] = useState(false);
  const [pendingSurveyQuestions, setPendingSurveyQuestions] = useState<SurveyQuestionSuggestion[]>(
    []
  );
  const [isAddingSurveyQ, setIsAddingSurveyQ] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Conversation persistence state
  const conversationIdRef = useRef<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyLoadedRef = useRef(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // Handle incoming pendingPrompt from stepper (opens panel + sends prompt)
  useEffect(() => {
    if (pendingPrompt) {
      setIsOpen(true);
      // Small delay so panel renders before sending
      const t = setTimeout(() => {
        sendMessage(pendingPrompt);
        onPromptConsumed?.();
      }, 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

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
    } catch {
      /* silent */
    }
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
    } catch {
      /* silent — show empty state */
    }
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
    } catch {
      /* silent */
    }
  }

  async function saveConversation(msgs: Message[], scores: AdliScores | null) {
    const title = msgs.find((m) => m.role === 'user')?.content.slice(0, 60) || 'New Conversation';

    try {
      if (conversationIdRef.current) {
        // Update existing conversation
        await fetch('/api/ai/conversations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: conversationIdRef.current,
            messages: msgs,
            adli_scores: scores,
          }),
        });
      } else {
        // Create new conversation
        const res = await fetch('/api/ai/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    } catch {
      /* silent — fire-and-forget */
    }
  }

  function startNewChat() {
    conversationIdRef.current = null;
    setMessages([]);
    setAdliScores(null);
    setPendingSuggestions([]);
    setProposedTasks([]);
    setPendingMetricSuggestions([]);
    setPendingSurveyQuestions([]);
    setShowHistory(false);
    setError(null);
  }

  async function deleteConversation(id: number) {
    try {
      await fetch(`/api/ai/conversations?id=${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // If we deleted the active conversation, clear it
      if (conversationIdRef.current === id) {
        startNewChat();
      }
    } catch {
      /* silent */
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('processId', String(processId));

      const res = await fetch('/api/ai/files', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleFileDelete(fileId: number) {
    const res = await fetch(`/api/ai/files?fileId=${fileId}`, { method: 'DELETE' });
    if (res.ok) {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      // Cancel any previous in-flight request
      abortControllerRef.current?.abort();
      // 3-minute timeout — AI responses with suggestions can be large
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          messages: updatedMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get AI response');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add an empty assistant message that we'll update as chunks arrive
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // Update the last message with accumulated content
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
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
        // Persist scores to database, then refresh parent page
        fetch('/api/ai/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processId,
            approach: scores.approach,
            deployment: scores.deployment,
            learning: scores.learning,
            integration: scores.integration,
          }),
        })
          .then((r) => {
            if (r.ok) onProcessUpdated?.();
          })
          .catch(() => {
            /* silent — non-critical */
          });
      }
      const { suggestions } = parseCoachSuggestions(assistantContent);
      if (suggestions.length > 0) {
        setPendingSuggestions(suggestions);
      }
      const { tasks: newProposedTasks } = parseProposedTasks(assistantContent);
      if (newProposedTasks.length > 0) {
        setProposedTasks(newProposedTasks);
      }
      const { metrics: newMetricSuggestions } = parseMetricSuggestions(assistantContent);
      if (newMetricSuggestions.length > 0) {
        setPendingMetricSuggestions(newMetricSuggestions);
      }
      const { questions: newSurveyQuestions } = parseSurveyQuestions(assistantContent);
      if (newSurveyQuestions.length > 0) {
        setPendingSurveyQuestions(newSurveyQuestions);
      }

      // Save conversation after each complete AI response
      const finalMessages = [
        ...updatedMessages,
        { role: 'assistant' as const, content: assistantContent },
      ];
      saveConversation(finalMessages, latestScores);
    } catch (err) {
      let message = 'Something went wrong. Please try again.';
      if (err instanceof DOMException && err.name === 'AbortError') {
        message =
          'Request timed out after 3 minutes. Try a simpler question or break your request into smaller parts.';
      } else if (
        err instanceof TypeError &&
        (err.message.includes('fetch') || err.message.includes('network'))
      ) {
        message =
          'Network connection was lost — the AI response may have taken too long. Try again, or ask a more focused question to get a shorter response.';
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      // Remove the empty assistant message if there was an error
      // But keep partial content if the stream started successfully
      setMessages((prev) => {
        if (
          prev.length > 0 &&
          prev[prev.length - 1].role === 'assistant' &&
          !prev[prev.length - 1].content
        ) {
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleQuickAction(prompt: string) {
    sendMessage(prompt);
  }

  function handleImprove(dimension: string) {
    const dimLabel = FIELD_LABELS[`adli_${dimension}`] || dimension;
    sendMessage(
      `Coach me on improving the ${dimLabel} section. What are the 2-3 most impactful changes I could make? Include effort estimates so I can prioritize.`
    );
  }

  function handleTellMeMore(suggestion: CoachSuggestion) {
    const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;
    sendMessage(
      `Tell me more about "${suggestion.title}" for the ${fieldLabel} section. What specifically would change and why does it matter?`
    );
  }

  async function applySuggestion(suggestion: CoachSuggestion) {
    if (isApplying) return;

    setIsApplying(true);
    try {
      const response = await fetch('/api/ai/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(errData.error || 'Failed to apply suggestion');
      }

      const data = await response.json();
      const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;

      // Remove this suggestion from pending list
      setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      // Build success message
      let successMsg: string;
      if (suggestion.field === 'charter_cleanup' && data.fieldsUpdated) {
        successMsg = `**Applied!** "${suggestion.title}" — ${data.fieldsUpdated} sections updated. Process documentation has been separated from operational content.`;
      } else {
        successMsg = `**Applied!** "${suggestion.title}" has been applied to the ${fieldLabel} section.`;
        if (data.tasksQueued > 0) {
          successMsg += ` ${data.tasksQueued} task${data.tasksQueued !== 1 ? 's' : ''} queued for review — check the Tasks tab.`;
        }
      }

      // Add a success message to the chat and save
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant' as const, content: successMsg }];
        // Fire-and-forget save
        saveConversation(updated, adliScores);
        return updated;
      });

      onProcessUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
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
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process_id: processId,
          title: task.title,
          description: task.description || null,
          pdca_section: task.pdcaSection,
          adli_dimension: task.adliDimension || null,
          priority: task.priority || 'medium',
          source: 'ai_interview',
        }),
      });
      if (res.ok) {
        setProposedTasks((prev) => prev.filter((t) => t.title !== task.title));
      }
    } catch {
      setError('Failed to queue task');
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
        priority: t.priority || 'medium',
        source: 'ai_interview',
      }));
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      if (res.ok) {
        const data = await res.json();
        setProposedTasks([]);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: `**Queued ${data.count} tasks!** Check the Tasks tab to review them.`,
          },
        ]);
        onProcessUpdated?.();
      }
    } catch {
      setError('Failed to queue tasks');
    } finally {
      setIsQueuing(false);
    }
  }

  async function handleMetricAction(
    suggestion: MetricSuggestion,
    editedValues?: Partial<MetricSuggestion>
  ) {
    setIsLinkingMetric(true);
    try {
      const merged = { ...suggestion, ...editedValues };
      const body =
        merged.action === 'link'
          ? { processId, action: 'link', metricId: merged.metricId }
          : {
              processId,
              action: 'create',
              metric: {
                name: merged.name,
                unit: merged.unit,
                cadence: merged.cadence,
                targetValue: merged.targetValue ?? null,
                isHigherBetter: merged.isHigherBetter ?? true,
              },
            };

      const res = await fetch('/api/ai/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to process metric action');
      }

      const data = await res.json();
      setPendingMetricSuggestions((prev) => prev.filter((m) => m.name !== suggestion.name));

      const verb = data.action === 'created' ? 'Created and linked' : 'Linked';
      setMessages((prev) => {
        const updated = [
          ...prev,
          {
            role: 'assistant' as const,
            content: `**${verb}!** "${data.metricName}" is now linked to this process. You'll see it in the Metrics & Results section.`,
          },
        ];
        saveConversation(updated, adliScores);
        return updated;
      });

      onProcessUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link metric');
    } finally {
      setIsLinkingMetric(false);
    }
  }

  async function handleAddSurveyQuestion(question: SurveyQuestionSuggestion) {
    setIsAddingSurveyQ(true);
    try {
      // Check if process already has a survey we can add to
      const listRes = await fetch(`/api/surveys?processId=${processId}`);
      const surveys = listRes.ok ? await listRes.json() : [];
      const existingSurvey = surveys.length > 0 ? surveys[0] : null;

      if (existingSurvey) {
        // Fetch full survey with questions
        const detailRes = await fetch(`/api/surveys/${existingSurvey.id}`);
        const surveyDetail = detailRes.ok ? await detailRes.json() : null;
        const existingQuestions = surveyDetail?.questions || [];

        const newQuestions = [
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ...existingQuestions.map(
            ({ id: _id, survey_id: _sid, created_at: _ca, ...rest }: Record<string, unknown>) =>
              rest
          ),
          {
            question_text: question.questionText,
            question_type: question.questionType,
            sort_order: existingQuestions.length,
            is_required: true,
            ...(question.questionType === 'rating' && { rating_scale_max: 5 }),
          },
        ];

        const patchRes = await fetch('/api/surveys', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existingSurvey.id, questions: newQuestions }),
        });
        if (!patchRes.ok) throw new Error('Failed to add question to survey');

        setPendingSurveyQuestions((prev) =>
          prev.filter((q) => q.questionText !== question.questionText)
        );
        setMessages((prev) => {
          const updated = [
            ...prev,
            {
              role: 'assistant' as const,
              content: `**Added!** "${question.questionText}" has been added to survey "${surveyDetail?.title || existingSurvey.title}".`,
            },
          ];
          saveConversation(updated, adliScores);
          return updated;
        });
      } else {
        // Create a new survey with this question
        const postRes = await fetch('/api/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            process_id: processId,
            title: `${processName} Feedback`,
            questions: [
              {
                question_text: question.questionText,
                question_type: question.questionType,
                sort_order: 0,
                is_required: true,
                ...(question.questionType === 'rating' && { rating_scale_max: 5 }),
              },
            ],
          }),
        });
        if (!postRes.ok) throw new Error('Failed to create survey');

        setPendingSurveyQuestions((prev) =>
          prev.filter((q) => q.questionText !== question.questionText)
        );
        setMessages((prev) => {
          const updated = [
            ...prev,
            {
              role: 'assistant' as const,
              content: `**Created!** New survey "${processName} Feedback" with question "${question.questionText}". You can add more questions and deploy it from the Overview tab.`,
            },
          ];
          saveConversation(updated, adliScores);
          return updated;
        });
      }

      onProcessUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add survey question');
    } finally {
      setIsAddingSurveyQ(false);
    }
  }

  async function handleAddAllSurveyQuestions() {
    setIsAddingSurveyQ(true);
    try {
      const listRes = await fetch(`/api/surveys?processId=${processId}`);
      const surveys = listRes.ok ? await listRes.json() : [];
      const existingSurvey = surveys.length > 0 ? surveys[0] : null;

      const newQs = pendingSurveyQuestions.map((q, i) => ({
        question_text: q.questionText,
        question_type: q.questionType,
        sort_order: i,
        is_required: true,
        ...(q.questionType === 'rating' && { rating_scale_max: 5 }),
      }));

      if (existingSurvey) {
        const detailRes = await fetch(`/api/surveys/${existingSurvey.id}`);
        const surveyDetail = detailRes.ok ? await detailRes.json() : null;
        const existingQuestions = surveyDetail?.questions || [];

        const allQuestions = [
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ...existingQuestions.map(
            ({ id: _id, survey_id: _sid, created_at: _ca, ...rest }: Record<string, unknown>) =>
              rest
          ),
          ...newQs.map((q, i) => ({ ...q, sort_order: existingQuestions.length + i })),
        ];

        const patchRes = await fetch('/api/surveys', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existingSurvey.id, questions: allQuestions }),
        });
        if (!patchRes.ok) throw new Error('Failed to add questions to survey');

        setMessages((prev) => {
          const updated = [
            ...prev,
            {
              role: 'assistant' as const,
              content: `**Added ${newQs.length} questions** to survey "${existingSurvey.title}".`,
            },
          ];
          saveConversation(updated, adliScores);
          return updated;
        });
      } else {
        const postRes = await fetch('/api/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            process_id: processId,
            title: `${processName} Feedback`,
            questions: newQs,
          }),
        });
        if (!postRes.ok) throw new Error('Failed to create survey');

        setMessages((prev) => {
          const updated = [
            ...prev,
            {
              role: 'assistant' as const,
              content: `**Created!** New survey "${processName} Feedback" with ${newQs.length} questions. You can deploy it from the Overview tab.`,
            },
          ];
          saveConversation(updated, adliScores);
          return updated;
        });
      }

      setPendingSurveyQuestions([]);
      onProcessUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add survey questions');
    } finally {
      setIsAddingSurveyQ(false);
    }
  }

  return (
    <>
      {/* Floating "Ask AI" button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-nia-dark-solid text-white rounded-full px-5 py-3 shadow-lg hover:bg-nia-grey-blue transition-colors flex items-center gap-2 z-50"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
          <div
            className={`fixed right-0 top-0 h-full w-full max-w-[calc(100vw-2rem)] bg-card shadow-2xl z-50 flex flex-col transition-all duration-200 ${isExpanded ? 'sm:w-[720px]' : 'sm:w-[420px]'}`}
          >
            {/* Header */}
            <div className="bg-nia-dark-solid text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                    onClick={() => {
                      setShowHistory(!showHistory);
                      if (!showHistory) fetchConversations();
                    }}
                    className={`text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors ${showHistory ? 'bg-white/20 text-white' : ''}`}
                    title="Conversation history"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </button>
                  {/* History dropdown */}
                  {showHistory && (
                    <div className="absolute right-0 top-full mt-1 w-72 bg-card rounded-lg shadow-xl border border-border z-50 max-h-80 overflow-y-auto">
                      <div className="p-2 border-b border-border-light">
                        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Past Conversations
                        </p>
                      </div>
                      {conversations.length === 0 ? (
                        <div className="p-3 text-xs text-text-muted text-center">
                          No conversations yet
                        </div>
                      ) : (
                        conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={`flex items-center gap-2 px-3 py-2 hover:bg-surface-hover cursor-pointer border-b border-border-light ${conversationIdRef.current === conv.id ? 'bg-nia-dark/5' : ''}`}
                          >
                            <button
                              onClick={() => loadConversation(conv.id)}
                              className="flex-1 text-left min-w-0"
                            >
                              <p className="text-sm text-nia-dark truncate font-medium">
                                {conv.title}
                              </p>
                              <p className="text-xs text-text-muted">
                                {new Date(conv.updated_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                {' · '}
                                {new Date(conv.updated_at).toLocaleTimeString(undefined, {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="text-text-muted hover:text-red-400 flex-shrink-0 p-1"
                              title="Delete conversation"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
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
                  title={isExpanded ? 'Collapse panel' : 'Expand panel'}
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Step context banner — connects stepper to sidebar */}
            {guidedStep && getStepDef(guidedStep) && (
              <div className="bg-nia-dark/5 border-b border-nia-dark/10 px-4 py-2 flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-nia-dark-solid text-white uppercase tracking-wider">
                  {guidedStep.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-text-tertiary">
                  Use the Improvement Cycle steps above to change focus
                </span>
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Welcome message when empty */}
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="bg-nia-dark/5 rounded-lg p-4 text-sm text-nia-dark">
                    <p className="font-medium mb-2">
                      {getStepDef(guidedStep || '')?.welcome ||
                        'I can help you analyze and improve this process. Pick a starting point below, or type your own question.'}
                    </p>
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
                const displayContent =
                  msg.role === 'assistant' ? stripPartialBlocks(msg.content) : msg.content;

                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        msg.role === 'user'
                          ? 'max-w-[85%] bg-nia-dark-solid text-white'
                          : 'w-full bg-surface-subtle text-nia-dark'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
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
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1].role === 'assistant' &&
                hasPartialBlock(messages[messages.length - 1].content) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nia-orange/5 border border-nia-orange/20">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-nia-orange rounded-full animate-pulse" />
                      <div
                        className="w-1.5 h-1.5 bg-nia-orange rounded-full animate-pulse"
                        style={{ animationDelay: '300ms' }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-nia-orange rounded-full animate-pulse"
                        style={{ animationDelay: '600ms' }}
                      />
                    </div>
                    <span className="text-xs font-medium text-nia-orange">
                      {(() => {
                        const blockType = hasPartialBlock(messages[messages.length - 1].content);
                        if (blockType === 'scores') return 'Calculating ADLI scores...';
                        if (blockType === 'tasks') return 'Building task list...';
                        if (blockType === 'metrics') return 'Finding relevant metrics...';
                        return 'Preparing improvement suggestions...';
                      })()}
                    </span>
                  </div>
                )}

              {/* Coach suggestion cards */}
              {pendingSuggestions.length > 0 && !isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-nia-dark">Suggested Improvements</p>
                    <button
                      onClick={() => setPendingSuggestions([])}
                      className="text-xs text-text-muted hover:text-text-secondary"
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
                        className="text-xs text-text-muted hover:text-text-secondary"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={queueAllTasks}
                        disabled={isQueuing}
                        className="text-xs bg-nia-dark-solid text-white rounded px-3 py-1.5 font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
                      >
                        {isQueuing ? 'Queuing...' : 'Queue All'}
                      </button>
                    </div>
                  </div>

                  {proposedTasks.map((task, idx) => {
                    const section = PDCA_SECTIONS[task.pdcaSection as PdcaSection];
                    return (
                      <div key={idx} className="bg-card rounded-lg border border-border p-3">
                        <div className="flex items-start gap-2">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: section?.color || '#6b7280' }}
                          >
                            {section?.label || task.pdcaSection}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-nia-dark">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-text-tertiary mt-0.5">
                                {task.description}
                              </p>
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

              {/* Metric suggestion cards */}
              {pendingMetricSuggestions.length > 0 && !isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-nia-dark">Recommended Metrics</p>
                    <button
                      onClick={() => setPendingMetricSuggestions([])}
                      className="text-xs text-text-muted hover:text-text-secondary"
                    >
                      Dismiss
                    </button>
                  </div>

                  {pendingMetricSuggestions.map((ms, idx) => (
                    <MetricSuggestionCard
                      key={`${ms.name}-${idx}`}
                      suggestion={ms}
                      onAction={(edited) => handleMetricAction(ms, edited)}
                      isLoading={isLinkingMetric}
                    />
                  ))}
                </div>
              )}

              {/* Survey question suggestion cards */}
              {pendingSurveyQuestions.length > 0 && !isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-nia-dark">
                      Suggested Survey Questions
                    </p>
                    <div className="flex items-center gap-2">
                      {pendingSurveyQuestions.length > 1 && (
                        <button
                          onClick={handleAddAllSurveyQuestions}
                          disabled={isAddingSurveyQ}
                          className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium disabled:opacity-50"
                        >
                          Add All ({pendingSurveyQuestions.length})
                        </button>
                      )}
                      <button
                        onClick={() => setPendingSurveyQuestions([])}
                        className="text-xs text-text-muted hover:text-text-secondary"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  {pendingSurveyQuestions.map((sq, idx) => (
                    <SurveyQuestionCard
                      key={`${sq.questionText}-${idx}`}
                      suggestion={sq}
                      onAdd={() => handleAddSurveyQuestion(sq)}
                      onDismiss={() =>
                        setPendingSurveyQuestions((prev) =>
                          prev.filter((q) => q.questionText !== sq.questionText)
                        )
                      }
                      isLoading={isAddingSurveyQ}
                    />
                  ))}
                </div>
              )}

              {/* Step-aware buttons — always visible when not loading (even mid-conversation) */}
              {messages.length > 0 && !isLoading && (
                <div className="pt-2 border-t border-border-light">
                  <StepActions guidedStep={guidedStep} onAction={handleQuickAction} compact />
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="bg-nia-red/10 border border-nia-red/20 rounded-lg px-3 py-2 text-sm text-nia-red">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Apply All bar — sits between messages and input */}
            {pendingSuggestions.length > 1 && !isLoading && (
              <div className="border-t border-border bg-surface-hover px-4 py-2 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-text-tertiary">
                  {pendingSuggestions.length} suggestions ready
                </span>
                <button
                  onClick={applyAllSuggestions}
                  disabled={isApplying}
                  className="bg-nia-dark-solid text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
                >
                  {isApplying ? 'Applying...' : 'Apply All'}
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-border px-4 py-3 flex-shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-expand: reset height to recalculate, then set to scrollHeight
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this process..."
                  className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-nia-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue focus:border-transparent"
                  rows={3}
                  style={{ minHeight: '72px', maxHeight: '160px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="bg-nia-dark-solid text-white rounded-lg px-3 py-2 hover:bg-nia-grey-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-text-muted">Enter to send, Shift+Enter for new line</p>
                <div className="flex items-center gap-2">
                  {uploadedFiles.length > 0 && (
                    <span className="text-xs text-nia-grey-blue">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
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
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                    {isUploading ? 'Uploading...' : 'Attach'}
                  </button>
                </div>
              </div>

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between text-xs bg-surface-hover rounded px-2 py-1"
                    >
                      <span className="text-nia-dark truncate mr-2">
                        {f.file_name}
                        <span className="text-text-muted ml-1">
                          ({Math.round(f.file_size / 1024)}KB)
                        </span>
                      </span>
                      <button
                        onClick={() => handleFileDelete(f.id)}
                        className="text-text-muted hover:text-red-500 flex-shrink-0"
                        title="Remove file"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
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
      <div
        className="w-2 h-2 bg-nia-grey-blue rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <div
        className="w-2 h-2 bg-nia-grey-blue rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <div
        className="w-2 h-2 bg-nia-grey-blue rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

// Step-aware quick action buttons — reads from shared lib/step-actions.ts

function StepActions({
  guidedStep,
  onAction,
  compact,
}: {
  guidedStep?: string | null;
  onAction: (prompt: string) => void;
  compact?: boolean;
}) {
  const stepDef = guidedStep ? getStepDef(guidedStep) : null;
  const actionList: StepActionDef[] = stepDef ? stepDef.actions : DEFAULT_ACTIONS;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {actionList.map((action) => (
          <button
            key={action.key}
            onClick={() => onAction(action.prompt)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium ${action.borderClass} ${action.bgClass} ${action.textClass} transition-colors`}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stepDef && (
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Next Step: {guidedStep?.replace(/_/g, ' ')}
        </p>
      )}
      {!stepDef && (
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Quick Actions
        </p>
      )}

      {actionList.map((action, idx) => (
        <button
          key={action.key}
          onClick={() => onAction(action.prompt)}
          className={`w-full text-left px-3 ${idx === 0 ? 'py-3' : 'py-2.5'} rounded-lg border ${action.borderClass} ${action.bgClass} text-sm text-nia-dark transition-colors`}
        >
          <span className={`${idx === 0 ? 'font-semibold' : 'font-medium'} ${action.textClass}`}>
            {action.label}
          </span>
          <span className="text-text-tertiary ml-1">— {action.description}</span>
        </button>
      ))}
    </div>
  );
}
