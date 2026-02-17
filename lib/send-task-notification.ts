/**
 * Shared helper for sending task-related email notifications.
 * Uses Resend with NIA-branded HTML template.
 * Fire-and-forget — never throws, always returns silently on error.
 */
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nia-results-tracker.vercel.app";

// NIA brand colors (inline — email clients strip <style> tags)
const NIA_DARK = "#324a4d";
const NIA_ORANGE = "#f5a623";
const TEXT_SECONDARY = "#6b7280";

interface TaskNotificationParams {
  to: string;
  subject: string;
  recipientName: string;
  taskTitle: string;
  processName: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
}

function buildTaskEmailHtml(params: TaskNotificationParams): string {
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
            <p style="margin:0 0 8px;color:${NIA_DARK};font-size:14px;">Hi ${params.recipientName},</p>
            <p style="margin:0 0 16px;color:${TEXT_SECONDARY};font-size:14px;line-height:1.6;">
              ${params.bodyText}
            </p>

            <!-- Task card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
                  <p style="margin:0 0 4px;color:${NIA_DARK};font-size:15px;font-weight:600;">${params.taskTitle}</p>
                  <p style="margin:0;color:${TEXT_SECONDARY};font-size:13px;">${params.processName}</p>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:0 0 24px;">
                <a href="${params.ctaUrl}"
                   style="display:inline-block;background-color:${NIA_ORANGE};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;">
                  ${params.ctaLabel}
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              NIA Excellence Hub &middot;
              <a href="${APP_URL}/settings" style="color:#9ca3af;text-decoration:underline;">Notification settings</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send a task notification email. Fire-and-forget — never throws.
 */
export async function sendTaskNotification(params: TaskNotificationParams): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[Task Notification] RESEND_API_KEY not set — skipping email");
    return;
  }

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: "NIA Excellence Hub <hub@thenia.org>",
      to: params.to,
      subject: params.subject,
      html: buildTaskEmailHtml(params),
    });

    if (error) {
      console.error("[Task Notification] Resend error:", error.message);
    }
  } catch (err) {
    console.error("[Task Notification] Failed:", (err as Error).message);
  }
}
