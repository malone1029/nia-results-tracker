import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nia-results-tracker.vercel.app";

// NIA brand colors (inline — email clients strip <style> tags)
const NIA_DARK = "#324a4d";
const NIA_ORANGE = "#f5a623";
const TEXT_SECONDARY = "#6b7280";
const BORDER = "#e5e7eb";

function buildInviteHtml(surveyTitle: string, shareToken: string): string {
  const surveyUrl = `${APP_URL}/survey/respond/${shareToken}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background-color:${NIA_DARK};padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">NIA Excellence Hub</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 8px;color:${NIA_DARK};font-size:18px;font-weight:600;">You're invited to share your feedback</h2>
            <p style="margin:0 0 24px;color:${TEXT_SECONDARY};font-size:14px;line-height:1.6;">
              You've been invited to complete the survey <strong style="color:${NIA_DARK};">"${surveyTitle}"</strong>.
              Your responses help us improve our processes and are greatly appreciated.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${surveyUrl}"
                   style="display:inline-block;background-color:${NIA_ORANGE};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;">
                  Take Survey
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:13px;">
              Estimated time: 2–5 minutes
            </p>
            <p style="margin:0;color:${TEXT_SECONDARY};font-size:13px;">
              Your responses are anonymous by default.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid ${BORDER};text-align:center;">
            <p style="margin:0;color:${TEXT_SECONDARY};font-size:11px;">
              This survey was sent via <a href="${APP_URL}" style="color:${NIA_DARK};text-decoration:none;">NIA Excellence Hub</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Verify authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Fail-open: return warning, don't block deploy
    return NextResponse.json({
      warning: "Email not configured (RESEND_API_KEY missing)",
      sent: 0,
      failed: [],
    });
  }

  const body = await request.json();
  const { shareToken, surveyTitle, emails } = body as {
    shareToken: string;
    surveyTitle: string;
    emails: string[];
  };

  if (!shareToken || !surveyTitle || !emails || emails.length === 0) {
    return NextResponse.json(
      { error: "shareToken, surveyTitle, and emails are required" },
      { status: 400 }
    );
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails = emails.filter((e) => emailRegex.test(e.trim()));

  if (validEmails.length === 0) {
    return NextResponse.json(
      { error: "No valid email addresses provided" },
      { status: 400 }
    );
  }

  const resend = new Resend(resendKey);
  const html = buildInviteHtml(surveyTitle, shareToken);
  let sent = 0;
  const failed: string[] = [];

  for (const email of validEmails) {
    const { error: sendError } = await resend.emails.send({
      from: "NIA Excellence Hub <hub@thenia.org>",
      to: email.trim(),
      subject: `You're invited: ${surveyTitle}`,
      html,
    });

    if (sendError) {
      console.error(`Survey invite error for ${email}:`, sendError);
      failed.push(email);
    } else {
      sent++;
    }
  }

  return NextResponse.json({ sent, failed });
}
