import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isSuperAdminRole } from '@/lib/auth-helpers';

interface ProxySession {
  adminId: string;
  targetAuthId: string;
  targetName: string;
  targetRole: string;
  startedAt: string;
}

async function getProxySession(): Promise<ProxySession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('hub_proxy_session')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProxySession;
  } catch {
    return null;
  }
}

/** GET — check if a proxy session is active for the current user */
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ active: false });

  const session = await getProxySession();
  if (!session || session.adminId !== user.id) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    targetAuthId: session.targetAuthId,
    targetName: session.targetName,
    targetRole: session.targetRole,
  });
}

/** POST — start a proxy session. Super admin only. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Caller must be super_admin
  const { data: callerRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!isSuperAdminRole(callerRow?.role || '')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { targetAuthId } = body;

  if (!targetAuthId) {
    return NextResponse.json({ error: 'targetAuthId required' }, { status: 400 });
  }
  if (targetAuthId === user.id) {
    return NextResponse.json({ error: 'Cannot proxy as yourself' }, { status: 400 });
  }

  // Get target user info
  const { data: targetRow } = await supabase
    .from('user_roles')
    .select('role, full_name, email')
    .eq('auth_id', targetAuthId)
    .single();

  if (!targetRow) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (isSuperAdminRole(targetRow.role)) {
    return NextResponse.json({ error: 'Cannot proxy as another super admin' }, { status: 400 });
  }

  const session: ProxySession = {
    adminId: user.id,
    targetAuthId,
    targetName: targetRow.full_name || targetRow.email,
    targetRole: targetRow.role,
    startedAt: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set('hub_proxy_session', JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4, // 4 hours
  });

  return NextResponse.json({ success: true, targetName: session.targetName });
}

/** DELETE — end the proxy session */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('hub_proxy_session');
  return NextResponse.json({ success: true });
}
