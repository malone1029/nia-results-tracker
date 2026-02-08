import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (errorParam || !code) {
    return NextResponse.redirect(`${appUrl}/settings?asana_error=denied`);
  }

  // Exchange code for tokens
  const redirectUri = `${appUrl}/api/asana/callback`;
  const tokenRes = await fetch("https://app.asana.com/-/oauth_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ASANA_CLIENT_ID!,
      client_secret: process.env.ASANA_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/settings?asana_error=token`);
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, data: asanaUser } = tokenData;

  // Get the current Supabase user
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Get the user's workspace info from Asana
  const workspacesRes = await fetch("https://app.asana.com/api/1.0/workspaces", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const workspacesData = await workspacesRes.json();
  const workspace = workspacesData.data?.[0]; // Use first workspace

  // Upsert the token (one row per user)
  const { error } = await supabase.from("user_asana_tokens").upsert(
    {
      user_id: user.id,
      access_token,
      refresh_token,
      asana_user_name: asanaUser?.name || "Unknown",
      workspace_id: workspace?.gid || null,
      workspace_name: workspace?.name || null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?asana_error=save`);
  }

  return NextResponse.redirect(`${appUrl}/settings?asana_connected=true`);
}
