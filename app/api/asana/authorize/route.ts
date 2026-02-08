import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.ASANA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Asana not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/asana/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });

  return NextResponse.redirect(`https://app.asana.com/-/oauth_authorize?${params}`);
}
