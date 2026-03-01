import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// ============ GET ============
// Members: own feedback. Admins: all feedback.
// RLS handles the filtering automatically.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// ============ POST ============
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const VALID_TYPES = ['bug', 'idea', 'question'];
  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `Type must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get display name from user_roles
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('full_name')
    .eq('auth_id', user.id)
    .single();

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      user_name: roleRow?.full_name || user.email || 'Unknown',
      type: body.type,
      description: body.description.trim(),
      page_url: body.page_url || null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, success: true });
}

// ============ PATCH ============
// Admin only: update status and admin_note
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const VALID_STATUSES = ['new', 'reviewed', 'done', 'dismissed'];
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.status = body.status;
  }
  if (body.admin_note !== undefined) {
    updates.admin_note = body.admin_note;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // RLS ensures only admins can UPDATE
  const { error } = await supabase.from('feedback').update(updates).eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
