import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get('processId');

  if (!processId) {
    return NextResponse.json({ error: 'processId is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('improvement_journal')
    .select('*')
    .eq('process_id', Number(processId))
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { process_id, title, description, status = 'in_progress' } = body;

  if (!process_id || !title) {
    return NextResponse.json({ error: 'process_id and title are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('improvement_journal')
    .insert({ process_id, title, description, status })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { id, title, description, status, resolve_message } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) {
    updates.status = status;
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
  }

  const { data, error } = await supabase
    .from('improvement_journal')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify Resolve of status change via webhook (fire-and-forget)
  if (status && data.source_ticket_id) {
    const webhookUrl = (process.env.RESOLVE_WEBHOOK_URL || '').trim();
    const webhookSecret = (process.env.RESOLVE_WEBHOOK_SECRET || '').trim();
    if (webhookUrl && webhookSecret) {
      // RESOLVE_WEBHOOK_URL may be a full URL or just the base — handle both
      const fullUrl = webhookUrl.includes('/api/webhooks/')
        ? webhookUrl
        : `${webhookUrl}/api/webhooks/hub-status`;
      fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${webhookSecret}`,
        },
        body: JSON.stringify({
          ticket_id: data.source_ticket_id,
          new_status: status,
          message: resolve_message || undefined,
          changed_by: 'Process Owner',
        }),
      }).catch((err) => console.error('[journal] webhook error:', err));
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase.from('improvement_journal').delete().eq('id', Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
