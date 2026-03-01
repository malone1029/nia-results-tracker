// app/api/admin/owner-setup/route.ts
// GET  — returns all distinct process owner names + their current owner_email (if set)
// POST — applies a name→email mapping: updates processes.owner_email, seeds user_roles

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isSuperAdminRole } from '@/lib/auth-helpers';

export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: myRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!isSuperAdminRole(myRole?.role ?? 'member')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all distinct owner values + their current owner_email
  const { data: processes } = await supabase
    .from('processes')
    .select('owner, owner_email')
    .order('owner');

  // Deduplicate: group by display name, pick first owner_email if set
  const ownerMap = new Map<string, string | null>();
  for (const p of processes ?? []) {
    if (!p.owner) continue;
    if (!ownerMap.has(p.owner)) {
      ownerMap.set(p.owner, p.owner_email ?? null);
    } else if (!ownerMap.get(p.owner) && p.owner_email) {
      ownerMap.set(p.owner, p.owner_email);
    }
  }

  const owners = Array.from(ownerMap.entries()).map(([name, email]) => ({
    name,
    email,
    processCount: (processes ?? []).filter((p) => p.owner === name).length,
  }));

  return NextResponse.json({ owners });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: myRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!isSuperAdminRole(myRole?.role ?? 'member')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Body: { mappings: { name: string; email: string; fullName: string }[] }
  const body = await req.json();
  const mappings: { name: string; email: string; fullName: string }[] = body.mappings ?? [];

  if (!mappings.length) {
    return NextResponse.json({ error: 'No mappings provided' }, { status: 400 });
  }

  const results: { name: string; email: string; processesUpdated: number; userSeeded: boolean }[] =
    [];

  for (const mapping of mappings) {
    if (!mapping.email) continue;

    // Update all processes where owner matches this name
    const { data: updated } = await supabase
      .from('processes')
      .update({ owner_email: mapping.email.toLowerCase() })
      .eq('owner', mapping.name)
      .select('id');

    const processesUpdated = updated?.length ?? 0;

    // Seed user_roles if the user doesn't already exist
    // We use upsert on email — Supabase auth_id will be null until they log in
    const { data: existing } = await supabase
      .from('user_roles')
      .select('auth_id')
      .eq('email', mapping.email.toLowerCase())
      .single();

    let userSeeded = false;
    if (!existing) {
      const { error: insertErr } = await supabase.from('user_roles').insert({
        email: mapping.email.toLowerCase(),
        full_name: mapping.fullName,
        role: 'member',
      });
      userSeeded = !insertErr;
    }

    results.push({ name: mapping.name, email: mapping.email, processesUpdated, userSeeded });
  }

  return NextResponse.json({ ok: true, results });
}
