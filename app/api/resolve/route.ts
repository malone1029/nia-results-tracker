import { createSupabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function createResolveClient() {
  return createClient(
    process.env.RESOLVE_SUPABASE_URL!,
    process.env.RESOLVE_SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  // Require Hub authentication before exposing Resolve data
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolve = createResolveClient();

  const [ticketsRes, sentimentRes] = await Promise.all([
    resolve
      .from('tickets')
      .select('id, status, priority, created_at, resolved_at, departments(name)'),
    resolve.from('sentiment_responses').select('rating, created_at'),
  ]);

  const tickets = ticketsRes.data || [];
  const sentiment = sentimentRes.data || [];

  // Tickets submitted this calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth = tickets.filter((t) => t.created_at >= monthStart).length;

  // Open / active tickets
  const openTickets = tickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting'
  ).length;

  // Avg resolution time (hours) across all resolved tickets
  const resolved = tickets.filter((t) => t.resolved_at);
  const avgResolutionHours =
    resolved.length > 0
      ? Math.round(
          (resolved.reduce((sum, t) => {
            return (
              sum +
              (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000
            );
          }, 0) /
            resolved.length) *
            10
        ) / 10
      : null;

  // Avg satisfaction
  const avgSatisfaction =
    sentiment.length > 0
      ? Math.round((sentiment.reduce((s, r) => s + r.rating, 0) / sentiment.length) * 10) / 10
      : null;

  // Breakdown by department
  const deptMap = new Map<string, { total: number; open: number }>();
  for (const t of tickets) {
    const name = (t.departments as unknown as { name: string } | null)?.name || 'Other';
    if (!deptMap.has(name)) deptMap.set(name, { total: 0, open: 0 });
    const d = deptMap.get(name)!;
    d.total++;
    if (t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting') d.open++;
  }
  const byDepartment = Array.from(deptMap.entries()).map(([name, v]) => ({ name, ...v }));

  return NextResponse.json({
    thisMonth,
    openTickets,
    totalTickets: tickets.length,
    avgResolutionHours,
    avgSatisfaction,
    sentimentCount: sentiment.length,
    byDepartment,
  });
}
