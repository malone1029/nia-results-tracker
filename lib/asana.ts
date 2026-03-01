import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * Get a valid Asana access token for the current user.
 * Automatically refreshes if the token is expired.
 */
export async function getAsanaToken(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServer();

  const { data: tokenRow } = await supabase
    .from('user_asana_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenRow) return null;

  // Check if we need to refresh (Asana tokens expire after 1 hour)
  const connectedAt = new Date(tokenRow.connected_at).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (now - connectedAt > oneHour && tokenRow.refresh_token) {
    // Refresh the token
    const res = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.ASANA_CLIENT_ID!,
        client_secret: process.env.ASANA_CLIENT_SECRET!,
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      // Update stored token
      await supabase
        .from('user_asana_tokens')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token || tokenRow.refresh_token,
          connected_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return data.access_token;
    } else {
      // Only delete the token on auth errors (revoked/invalid).
      // Preserve it on server errors or network issues so the user
      // doesn't lose their connection over a transient failure.
      if (res.status === 401 || res.status === 403) {
        await supabase.from('user_asana_tokens').delete().eq('user_id', userId);
      }
      return null;
    }
  }

  return tokenRow.access_token;
}

/**
 * Make an authenticated Asana API request.
 */
export async function asanaFetch(token: string, endpoint: string, options?: RequestInit) {
  const res = await fetch(`https://app.asana.com/api/1.0${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [{ message: res.statusText }] }));
    throw new Error(error.errors?.[0]?.message || `Asana API error: ${res.status}`);
  }

  return res.json();
}
