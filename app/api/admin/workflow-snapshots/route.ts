import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isSuperAdminRole } from '@/lib/auth-helpers';
import type { GapItem } from '@/app/api/admin/generate-workflow/route';
import type { MissionFlowData } from '@/lib/flow-types';

// ── GET /api/admin/workflow-snapshots ──────────────────────────────────────
// Returns the most recently saved workflow snapshot, or null if none exist.
export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (!isSuperAdminRole(roleData?.role || '')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('workflow_snapshots')
    .select('id, mermaid_code, flow_data, gaps, key_count, generated_at')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('workflow-snapshots GET error:', error);
    return NextResponse.json({ error: 'Failed to load snapshot' }, { status: 500 });
  }

  return NextResponse.json({ snapshot: data ?? null });
}

// ── POST /api/admin/workflow-snapshots ─────────────────────────────────────
// Saves a new workflow snapshot after generation.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (!isSuperAdminRole(roleData?.role || '')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const body = (await request.json()) as {
    flowData: MissionFlowData;
    gaps: GapItem[];
    keyCount: number;
    // Legacy field — still accepted for backwards compat but no longer required
    mermaid?: string;
  };

  const { data, error } = await supabase
    .from('workflow_snapshots')
    .insert({
      flow_data: body.flowData ?? null,
      mermaid_code: body.mermaid ?? null,
      gaps: body.gaps,
      key_count: body.keyCount,
      created_by: user.id,
    })
    .select('id, generated_at')
    .single();

  if (error) {
    console.error('workflow-snapshots POST error:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: data.id, generatedAt: data.generated_at });
}
