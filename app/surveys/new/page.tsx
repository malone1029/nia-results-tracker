'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FormSkeleton } from '@/components/skeleton';
import SurveyBuilderPage from '@/components/survey-builder-page';
import { Button, Textarea } from '@/components/ui';
import type { QuestionInput, SurveyTemplate } from '@/lib/survey-types';

interface MetricOption {
  id: number;
  name: string;
  unit: string;
  cadence: string;
}

/* ─── Template Picker ────────────────────────────────────────── */

function TemplatePicker({
  processId,
  templates,
  onSelect,
  onStartBlank,
}: {
  processId: number;
  templates: SurveyTemplate[];
  onSelect: (questions: QuestionInput[]) => void;
  onStartBlank: () => void;
}) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Group templates by category
  const grouped = templates.reduce<Record<string, SurveyTemplate[]>>((acc, t) => {
    const cat = t.category || 'Custom';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  function applyTemplate(template: SurveyTemplate) {
    // Convert template questions to QuestionInput (add sort_order + metric_id)
    const questions: QuestionInput[] = (
      template.questions as Omit<QuestionInput, 'sort_order' | 'metric_id'>[]
    ).map((q, i) => ({
      ...q,
      sort_order: i,
      metric_id: null,
      rating_scale_max: q.rating_scale_max ?? 5,
      options: q.options || {},
      is_required: q.is_required ?? true,
      help_text: q.help_text || '',
      section_label: q.section_label || '',
    }));
    onSelect(questions);
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');

    try {
      const res = await fetch('/api/surveys/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt, processId }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setAiError(data.error || 'Generation failed');
        setAiLoading(false);
        return;
      }

      // Convert AI output to QuestionInput
      const questions: QuestionInput[] = (data.questions || []).map(
        (q: Record<string, unknown>, i: number) => ({
          question_text: (q.question_text as string) || '',
          question_type: (q.question_type as string) || 'rating',
          sort_order: i,
          rating_scale_max: (q.rating_scale_max as number) || 5,
          metric_id: null,
          options: (q.options as Record<string, unknown>) || {},
          is_required: q.is_required !== false,
          help_text: (q.help_text as string) || '',
          section_label: (q.section_label as string) || '',
        })
      );

      onSelect(questions);
    } catch {
      setAiError('An unexpected error occurred');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/processes/${processId}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-nia-dark">Create Survey</h1>
          <a
            href="/help"
            className="ml-auto text-xs text-text-muted hover:text-nia-orange transition-colors"
          >
            Need help? View FAQ &rarr;
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* AI Generation */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-nia-orange"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
            <h2 className="text-base font-semibold text-nia-dark">Generate with AI</h2>
          </div>
          <p className="text-sm text-text-secondary">
            Describe what you want to measure and AI will create a complete survey with mixed
            question types.
          </p>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., Measure stakeholder satisfaction with our professional development services, including responsiveness, quality, and overall impact..."
            rows={3}
          />
          {aiError && <p className="text-sm text-nia-red">{aiError}</p>}
          <Button
            size="md"
            loading={aiLoading}
            onClick={handleAiGenerate}
            disabled={!aiPrompt.trim()}
          >
            Generate Survey
          </Button>
        </div>

        {/* Templates */}
        {Object.keys(grouped).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-nia-dark uppercase tracking-wide">
              Start from a Template
            </h2>
            {Object.entries(grouped).map(([category, tmpls]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  {category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tmpls.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="text-left bg-card rounded-xl border border-border hover:border-nia-green hover:shadow-sm transition-all p-4 space-y-1"
                    >
                      <div className="font-medium text-sm text-nia-dark">{t.name}</div>
                      {t.description && (
                        <p className="text-xs text-text-muted line-clamp-2">{t.description}</p>
                      )}
                      <p className="text-xs text-text-tertiary">
                        {(t.questions as unknown[]).length} questions
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Start blank */}
        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-border-light" />
          <span className="text-xs text-text-muted">or</span>
          <div className="flex-1 border-t border-border-light" />
        </div>

        <button
          onClick={onStartBlank}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-border rounded-xl text-sm font-medium text-nia-grey-blue hover:text-nia-dark hover:border-nia-grey-blue transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Start from Scratch
        </button>

        <div className="pb-8" />
      </div>
    </div>
  );
}

/* ─── Main page component ────────────────────────────────────── */

function CreateSurveyInner() {
  const searchParams = useSearchParams();
  const processId = Number(searchParams.get('processId'));

  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // null = show picker, QuestionInput[] = show builder with those questions
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionInput[] | null>(null);
  // true = show builder with blank state
  const [startedBlank, setStartedBlank] = useState(false);

  useEffect(() => {
    if (!processId) {
      setError('Missing processId in URL');
      setLoading(false);
      return;
    }

    async function fetchData() {
      const [metricsRes, templatesRes] = await Promise.all([
        supabase.from('metrics').select('id, name, unit, cadence').order('name'),
        fetch('/api/surveys/templates').then((r) => r.json()),
      ]);

      if (metricsRes.error) {
        setError(metricsRes.error.message);
      } else {
        setMetrics(metricsRes.data || []);
      }

      // Templates might return error or array
      if (Array.isArray(templatesRes)) {
        setTemplates(templatesRes);
      }

      setLoading(false);
    }

    fetchData();
  }, [processId]);

  const handleSelectTemplate = useCallback((questions: QuestionInput[]) => {
    setSelectedQuestions(questions);
  }, []);

  const handleStartBlank = useCallback(() => {
    setStartedBlank(true);
  }, []);

  if (loading) return <FormSkeleton fields={6} />;

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-sm text-nia-red bg-nia-red/10 border border-nia-red/20 px-4 py-3 rounded-xl">
          {error}
        </div>
      </div>
    );
  }

  // Show builder if template selected or starting blank
  if (selectedQuestions || startedBlank) {
    return (
      <SurveyBuilderPage
        processId={processId}
        metrics={metrics}
        initialQuestions={selectedQuestions || undefined}
      />
    );
  }

  // Show template picker
  return (
    <TemplatePicker
      processId={processId}
      templates={templates}
      onSelect={handleSelectTemplate}
      onStartBlank={handleStartBlank}
    />
  );
}

export default function CreateSurveyPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={6} />}>
      <CreateSurveyInner />
    </Suspense>
  );
}
