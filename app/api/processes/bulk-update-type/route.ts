import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isSuperAdminRole } from '@/lib/auth-helpers';

/**
 * PATCH /api/processes/bulk-update-type
 * Update process_type for multiple processes at once.
 * Body: { updates: Array<{ processId: number; processType: "key" | "support" }> }
 * Super admin only.
 */
export async function PATCH(request: Request) {
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

  const { updates } = (await request.json()) as {
    updates: Array<{ processId: number; processType: 'key' | 'support' }>;
  };

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
  }

  const results: { processId: number; success: boolean; error?: string }[] = [];

  for (const { processId, processType } of updates) {
    if (!processId || !['key', 'support'].includes(processType)) {
      results.push({ processId, success: false, error: 'Invalid processId or processType' });
      continue;
    }

    const { error } = await supabase
      .from('processes')
      .update({ process_type: processType })
      .eq('id', processId);

    results.push({ processId, success: !error, error: error?.message });
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    results,
    summary: {
      total: updates.length,
      updated: successCount,
      failed: updates.length - successCount,
    },
  });
}
