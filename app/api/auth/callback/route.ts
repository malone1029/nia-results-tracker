import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check email domain — only @thenia.org allowed
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email?.endsWith('@thenia.org')) {
        // Auto-register: upsert into user_roles on every login
        // First login → creates row with role='member' (DB default)
        // Subsequent logins → updates full_name and last_login_at only
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown';
        await supabase
          .from('user_roles')
          .upsert(
            {
              auth_id: user.id,
              email: user.email!,
              full_name: fullName,
              last_login_at: new Date().toISOString(),
            },
            { onConflict: 'auth_id', ignoreDuplicates: false }
          )
          // Only update name and login time — never reset role
          .select();

        return NextResponse.redirect(`${origin}${next}`);
      } else {
        // Sign out non-NIA users and show error
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=domain`);
      }
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
