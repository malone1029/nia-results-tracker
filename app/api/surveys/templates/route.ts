import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// GET — list templates (own + shared)
export async function GET() {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('survey_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST — save a survey as a template
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { name, description, category, questions, is_shared } = body;

  if (!name || !questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'name and questions are required' }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Strip sort_order and metric_id from questions — templates are portable
  const cleanedQuestions = questions.map((q: Record<string, unknown>) => ({
    question_text: q.question_text,
    question_type: q.question_type,
    rating_scale_max: q.rating_scale_max ?? 5,
    options: q.options || {},
    is_required: q.is_required ?? true,
    help_text: q.help_text || '',
    section_label: q.section_label || '',
  }));

  const { data, error } = await supabase
    .from('survey_templates')
    .insert({
      name,
      description: description || null,
      category: category || 'Custom',
      questions: cleanedQuestions,
      created_by: user?.id || null,
      is_shared: is_shared ?? false,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}
