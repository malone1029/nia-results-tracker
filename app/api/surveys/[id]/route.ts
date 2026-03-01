import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// GET /api/surveys/:id — returns a single survey with its questions
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);

  if (!surveyId) {
    return NextResponse.json({ error: 'Invalid survey ID' }, { status: 400 });
  }

  // Fetch survey and questions in parallel
  const [surveyRes, questionsRes] = await Promise.all([
    supabase.from('surveys').select('*').eq('id', surveyId).single(),
    supabase.from('survey_questions').select('*').eq('survey_id', surveyId).order('sort_order'),
  ]);

  if (surveyRes.error) {
    return NextResponse.json(
      { error: surveyRes.error.message },
      { status: surveyRes.error.code === 'PGRST116' ? 404 : 500 }
    );
  }

  return NextResponse.json({
    ...surveyRes.data,
    questions: questionsRes.data || [],
  });
}
