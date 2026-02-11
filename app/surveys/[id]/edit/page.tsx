"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FormSkeleton } from "@/components/skeleton";
import SurveyBuilderPage from "@/components/survey-builder-page";
import type { QuestionInput, QuestionRow } from "@/lib/survey-types";

interface MetricOption {
  id: number;
  name: string;
  unit: string;
  cadence: string;
}

interface SurveyApiResponse {
  id: number;
  process_id: number;
  title: string;
  description: string | null;
  is_anonymous: boolean;
  welcome_message: string | null;
  thank_you_message: string | null;
  questions: QuestionRow[];
  response_target?: number | null;
  recurrence_enabled?: boolean;
  recurrence_cadence?: string | null;
  recurrence_duration_days?: number;
  error?: string;
}

export default function EditSurveyPage() {
  const params = useParams();
  const surveyId = Number(params.id);

  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [survey, setSurvey] = useState<SurveyApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!surveyId) {
      setError("Invalid survey ID");
      setLoading(false);
      return;
    }

    async function fetchData() {
      // Fetch survey (with questions) and metrics in parallel
      const [surveyRes, metricsRes] = await Promise.all([
        fetch(`/api/surveys/${surveyId}`).then((r) => r.json()) as Promise<SurveyApiResponse>,
        supabase
          .from("metrics")
          .select("id, name, unit, cadence")
          .order("name"),
      ]);

      if (surveyRes.error) {
        setError(surveyRes.error);
        setLoading(false);
        return;
      }

      setSurvey(surveyRes);
      setMetrics(metricsRes.data || []);
      setLoading(false);
    }

    fetchData();
  }, [surveyId]);

  if (loading) return <FormSkeleton fields={6} />;

  if (error || !survey) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
          {error || "Survey not found"}
        </div>
      </div>
    );
  }

  // Convert QuestionRow[] from API response to QuestionInput[]
  const questions: QuestionInput[] = (survey.questions || []).map((q) => ({
    question_text: q.question_text,
    question_type: q.question_type,
    sort_order: q.sort_order,
    rating_scale_max: q.rating_scale_max,
    metric_id: q.metric_id,
    options: q.options || {},
    is_required: q.is_required ?? true,
    help_text: q.help_text || "",
    section_label: q.section_label || "",
  }));

  return (
    <SurveyBuilderPage
      processId={survey.process_id}
      metrics={metrics}
      existingSurvey={{
        id: survey.id,
        process_id: survey.process_id,
        title: survey.title,
        description: survey.description,
        is_anonymous: survey.is_anonymous,
        welcome_message: survey.welcome_message,
        thank_you_message: survey.thank_you_message,
        questions,
        response_target: survey.response_target,
        recurrence_enabled: survey.recurrence_enabled,
        recurrence_cadence: survey.recurrence_cadence,
        recurrence_duration_days: survey.recurrence_duration_days,
      }}
    />
  );
}
