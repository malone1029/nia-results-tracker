import { createSupabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createResolveClient() {
  return createClient(
    process.env.RESOLVE_SUPABASE_URL!,
    process.env.RESOLVE_SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ComputedMetrics = {
  techAvgResolution: number | null;
  techSatisfaction: number | null;
  hrAvgResolution: number | null;
  hrSatisfaction: number | null;
  techTicketCount: number;
  hrTicketCount: number;
  techSentimentCount: number;
  hrSentimentCount: number;
};

async function computeMetrics(month: string): Promise<ComputedMetrics> {
  const resolve = createResolveClient();
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, mon - 1, 1).toISOString();
  const end = new Date(year, mon, 1).toISOString();

  // Tickets created this month, with department name
  const { data: tickets } = await resolve
    .from('tickets')
    .select('id, created_at, resolved_at, departments(name)')
    .gte('created_at', start)
    .lt('created_at', end);

  const allTickets = tickets || [];
  const techTickets = allTickets.filter(
    (t) => (t.departments as unknown as { name: string } | null)?.name === 'Technology'
  );
  const hrTickets = allTickets.filter(
    (t) => (t.departments as unknown as { name: string } | null)?.name === 'Human Resources'
  );

  // Average resolution time (hours) for resolved tickets in this cohort
  function avgResolutionHours(ts: typeof allTickets): number | null {
    const resolved = ts.filter((t) => t.resolved_at);
    if (!resolved.length) return null;
    const total = resolved.reduce(
      (sum, t) =>
        sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000,
      0
    );
    return Math.round((total / resolved.length) * 10) / 10;
  }

  // Satisfaction: sentiment_responses linked to tickets from this cohort
  const allTicketIds = allTickets.map((t) => t.id);
  const techTicketIds = new Set(techTickets.map((t) => t.id));
  const hrTicketIds = new Set(hrTickets.map((t) => t.id));

  let techSatisfaction: number | null = null;
  let hrSatisfaction: number | null = null;
  let techSentimentCount = 0;
  let hrSentimentCount = 0;

  if (allTicketIds.length > 0) {
    const { data: sentiment } = await resolve
      .from('sentiment_responses')
      .select('rating, ticket_id')
      .in('ticket_id', allTicketIds);

    const allSentiment = sentiment || [];
    const techSentiment = allSentiment.filter((s) => techTicketIds.has(s.ticket_id));
    const hrSentiment = allSentiment.filter((s) => hrTicketIds.has(s.ticket_id));

    techSentimentCount = techSentiment.length;
    hrSentimentCount = hrSentiment.length;

    if (techSentiment.length > 0) {
      techSatisfaction =
        Math.round(
          (techSentiment.reduce((sum, s) => sum + s.rating, 0) / techSentiment.length) * 10
        ) / 10;
    }
    if (hrSentiment.length > 0) {
      hrSatisfaction =
        Math.round((hrSentiment.reduce((sum, s) => sum + s.rating, 0) / hrSentiment.length) * 10) /
        10;
    }
  }

  return {
    techAvgResolution: avgResolutionHours(techTickets),
    techSatisfaction,
    hrAvgResolution: avgResolutionHours(hrTickets),
    hrSatisfaction,
    techTicketCount: techTickets.length,
    hrTicketCount: hrTickets.length,
    techSentimentCount,
    hrSentimentCount,
  };
}

// GET /api/resolve/sync?month=2026-01 → preview computed metrics
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = request.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month — use YYYY-MM' }, { status: 400 });
  }

  const metrics = await computeMetrics(month);
  return NextResponse.json({ month, metrics });
}

// POST /api/resolve/sync  body: { month: "2026-01" } → write entries to Hub
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { month } = body as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month — use YYYY-MM' }, { status: 400 });
  }

  const computed = await computeMetrics(month);
  const entryDate = `${month}-01`;

  // Look up Hub metric IDs by name
  const { data: metricRows } = await supabase
    .from('metrics')
    .select('id, name')
    .in('name', [
      'Technology Support: Avg Resolution Time',
      'Technology Support: Customer Satisfaction',
      'HR Support: Avg Resolution Time',
      'HR Support: Customer Satisfaction',
    ]);

  if (!metricRows?.length) {
    return NextResponse.json(
      { error: 'Metrics not found in Hub — run the migration first.' },
      { status: 500 }
    );
  }

  const byName = Object.fromEntries(metricRows.map((m) => [m.name, m.id]));

  // Build entries, skip any where we have no data
  const candidates = [
    {
      metric_id: byName['Technology Support: Avg Resolution Time'],
      value: computed.techAvgResolution,
      note_analysis: `Avg resolution time across ${computed.techTicketCount} Technology tickets opened in ${month}`,
    },
    {
      metric_id: byName['Technology Support: Customer Satisfaction'],
      value: computed.techSatisfaction,
      note_analysis: `Avg satisfaction from ${computed.techSentimentCount} survey response${computed.techSentimentCount !== 1 ? 's' : ''} on Technology tickets in ${month}`,
    },
    {
      metric_id: byName['HR Support: Avg Resolution Time'],
      value: computed.hrAvgResolution,
      note_analysis: `Avg resolution time across ${computed.hrTicketCount} HR tickets opened in ${month}`,
    },
    {
      metric_id: byName['HR Support: Customer Satisfaction'],
      value: computed.hrSatisfaction,
      note_analysis: `Avg satisfaction from ${computed.hrSentimentCount} survey response${computed.hrSentimentCount !== 1 ? 's' : ''} on HR tickets in ${month}`,
    },
  ].filter((e) => e.metric_id != null && e.value != null) as {
    metric_id: number;
    value: number;
    note_analysis: string;
  }[];

  if (!candidates.length) {
    return NextResponse.json({ message: 'No data to sync for this month', synced: 0 });
  }

  // Delete any existing entries for these metrics on this date, then insert fresh
  const metricIds = candidates.map((e) => e.metric_id);
  await supabase.from('entries').delete().in('metric_id', metricIds).eq('date', entryDate);

  const { error } = await supabase.from('entries').insert(
    candidates.map((e) => ({
      metric_id: e.metric_id,
      value: e.value,
      date: entryDate,
      note_analysis: e.note_analysis,
    }))
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Synced', synced: candidates.length, month });
}
