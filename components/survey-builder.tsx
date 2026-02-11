"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

interface QuestionInput {
  question_text: string;
  question_type: "rating" | "yes_no";
  sort_order: number;
  rating_scale_max: number;
  metric_id: number | null;
}

interface MetricOption {
  id: number;
  name: string;
  unit: string;
  cadence: string;
}

interface SurveyBuilderProps {
  processId: number;
  metrics: MetricOption[];
  onClose: () => void;
  onSaved: () => void;
  // For editing an existing survey
  editSurvey?: {
    id: number;
    title: string;
    description: string | null;
    is_public: boolean;
    is_anonymous: boolean;
    questions: QuestionInput[];
  };
}

export default function SurveyBuilder({
  processId,
  metrics,
  onClose,
  onSaved,
  editSurvey,
}: SurveyBuilderProps) {
  const [title, setTitle] = useState(editSurvey?.title || "");
  const [description, setDescription] = useState(editSurvey?.description || "");
  const [isAnonymous, setIsAnonymous] = useState(editSurvey?.is_anonymous ?? true);
  const [questions, setQuestions] = useState<QuestionInput[]>(
    editSurvey?.questions || [
      { question_text: "", question_type: "rating", sort_order: 0, rating_scale_max: 5, metric_id: null },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        question_text: "",
        question_type: "rating",
        sort_order: questions.length,
        rating_scale_max: 5,
        metric_id: null,
      },
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: string, value: string | number | null) {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === questions.length - 1)
    ) return;
    const updated = [...questions];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setQuestions(updated);
  }

  async function handleSave() {
    setError("");

    if (!title.trim()) {
      setError("Survey title is required");
      return;
    }

    const validQuestions = questions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      setError("At least one question with text is required");
      return;
    }

    setSaving(true);

    const payload = {
      ...(editSurvey ? { id: editSurvey.id } : { process_id: processId }),
      title: title.trim(),
      description: description.trim() || null,
      is_public: true,
      is_anonymous: isAnonymous,
      questions: validQuestions.map((q, i) => ({
        ...q,
        sort_order: i,
        question_text: q.question_text.trim(),
      })),
    };

    const res = await fetch("/api/surveys", {
      method: editSurvey ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save survey");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light flex-shrink-0">
          <h3 className="text-lg font-semibold text-nia-dark">
            {editSurvey ? "Edit Survey" : "Create Survey"}
          </h3>
          <p className="text-sm text-text-tertiary mt-1">
            Build a micro-survey to collect feedback on this process.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Survey Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q1 Process Satisfaction"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Description <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context for respondents"
            />
          </div>

          {/* Settings */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-border text-nia-green focus:ring-nia-green"
              />
              Anonymous responses
            </label>
          </div>

          {/* Questions */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Questions
            </label>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-text-muted mt-2.5 w-5 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1">
                      <Input
                        value={q.question_text}
                        onChange={(e) =>
                          updateQuestion(i, "question_text", e.target.value)
                        }
                        placeholder="Enter your question..."
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveQuestion(i, "up")}
                        disabled={i === 0}
                        className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"
                        title="Move up"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveQuestion(i, "down")}
                        disabled={i === questions.length - 1}
                        className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"
                        title="Move down"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(i)}
                          className="p-1 text-text-muted hover:text-nia-red"
                          title="Remove question"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-7">
                    <select
                      value={q.question_type}
                      onChange={(e) =>
                        updateQuestion(i, "question_type", e.target.value)
                      }
                      className="text-xs border border-border rounded-md px-2 py-1 text-text-secondary bg-card"
                    >
                      <option value="rating">Rating (1-5)</option>
                      <option value="yes_no">Yes / No</option>
                    </select>

                    <select
                      value={q.metric_id || ""}
                      onChange={(e) =>
                        updateQuestion(
                          i,
                          "metric_id",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="text-xs border border-border rounded-md px-2 py-1 text-text-secondary bg-card flex-1 min-w-0"
                    >
                      <option value="">No metric link</option>
                      {metrics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addQuestion}
              className="mt-2 text-sm text-nia-grey-blue hover:text-nia-dark font-medium"
            >
              + Add Question
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-light flex justify-end gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            {editSurvey ? "Save Changes" : "Create Survey"}
          </Button>
        </div>
      </div>
    </div>
  );
}
