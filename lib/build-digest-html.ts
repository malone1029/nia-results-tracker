// Weekly Digest Email HTML Builder
// Generates NIA-branded HTML email with inline styles (email clients strip <style> tags)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nia-results-tracker.vercel.app';

// NIA brand colors
const NIA_ORANGE = '#f5a623';
const NIA_DARK = '#324a4d';
const NIA_GREEN = '#b1bd37';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#6b7280';
const BORDER = '#e5e7eb';
const BG_LIGHT = '#f9fafb';

export interface DigestOverdueMetric {
  id: number;
  name: string;
  daysOverdue: number;
  processName: string | null;
}

export interface DigestStaleProcess {
  id: number;
  name: string;
  owner: string | null;
  daysSinceActivity: number;
  healthScore: number;
}

export interface DigestNextAction {
  label: string;
  href: string;
  points: number;
  processCount: number; // how many processes share this action
}

export interface DigestData {
  recipientName: string | null; // null = org-wide digest (no personalization)
  orgScore: number;
  orgScoreDelta: number | null; // week-over-week change, null if no previous snapshot
  baldrigeReadyCount: number;
  needsAttentionCount: number;
  totalProcesses: number;
  myProcessCount: number; // how many processes this person owns
  overdueMetrics: DigestOverdueMetric[];
  staleProcesses: DigestStaleProcess[];
  nextActions: DigestNextAction[];
  weeklyUpdates: { owner: string; processCount: number }[];
}

function deltaArrow(delta: number | null): string {
  if (delta === null) return '';
  if (delta > 0) return ` <span style="color: ${NIA_GREEN};">&#9650; +${delta}</span>`;
  if (delta < 0) return ` <span style="color: #dc2626;">&#9660; ${delta}</span>`;
  return ` <span style="color: ${TEXT_SECONDARY};">&#8594; no change</span>`;
}

function healthColor(score: number): string {
  if (score >= 80) return NIA_GREEN;
  if (score >= 60) return '#55787c';
  if (score >= 40) return NIA_ORANGE;
  return '#dc2626';
}

export function buildDigestHtml(data: DigestData): string {
  const {
    recipientName,
    orgScore,
    orgScoreDelta,
    baldrigeReadyCount,
    needsAttentionCount,
    totalProcesses,
    myProcessCount,
    overdueMetrics,
    staleProcesses,
    nextActions,
    weeklyUpdates,
  } = data;

  const firstName = recipientName ? recipientName.split(' ')[0] : null;

  // --- Stat cards row ---
  const statCards = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td width="33%" style="padding: 0 4px 0 0;">
          <div style="background: ${BG_LIGHT}; border: 1px solid ${BORDER}; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: ${healthColor(orgScore)};">${orgScore}${deltaArrow(orgScoreDelta)}</div>
            <div style="font-size: 12px; color: ${TEXT_SECONDARY}; margin-top: 4px;">Org Readiness</div>
          </div>
        </td>
        <td width="33%" style="padding: 0 4px;">
          <div style="background: ${BG_LIGHT}; border: 1px solid ${BORDER}; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: ${NIA_GREEN};">${baldrigeReadyCount}</div>
            <div style="font-size: 12px; color: ${TEXT_SECONDARY}; margin-top: 4px;">Baldrige Ready</div>
          </div>
        </td>
        <td width="33%" style="padding: 0 0 0 4px;">
          <div style="background: ${BG_LIGHT}; border: 1px solid ${BORDER}; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: ${needsAttentionCount > 0 ? NIA_ORANGE : NIA_GREEN};">${needsAttentionCount}</div>
            <div style="font-size: 12px; color: ${TEXT_SECONDARY}; margin-top: 4px;">Needs Attention</div>
          </div>
        </td>
      </tr>
    </table>`;

  // --- Overdue metrics ---
  let overdueSection = '';
  if (overdueMetrics.length > 0) {
    const rows = overdueMetrics
      .slice(0, 8) // cap at 8 to keep email short
      .map(
        (m) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER};">
            <a href="${APP_URL}/log?metricId=${m.id}" style="color: ${NIA_DARK}; text-decoration: none; font-weight: 500;">${escapeHtml(m.name)}</a>
            ${m.processName ? `<div style="font-size: 12px; color: ${TEXT_SECONDARY};">${escapeHtml(m.processName)}</div>` : ''}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: #dc2626; font-size: 13px;">
            ${m.daysOverdue} days overdue
          </td>
        </tr>`
      )
      .join('');

    const moreText =
      overdueMetrics.length > 8
        ? `<div style="padding: 8px 12px; font-size: 13px; color: ${TEXT_SECONDARY};">+ ${overdueMetrics.length - 8} more &mdash; <a href="${APP_URL}/data-health" style="color: ${NIA_DARK};">view all</a></div>`
        : '';

    overdueSection = `
      <div style="margin: 24px 0;">
        <h2 style="font-size: 16px; color: ${TEXT_PRIMARY}; margin: 0 0 8px 0;">&#128680; Overdue Metrics (${overdueMetrics.length})</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden;">
          ${rows}
        </table>
        ${moreText}
      </div>`;
  }

  // --- Stale processes ---
  let staleSection = '';
  if (staleProcesses.length > 0) {
    const rows = staleProcesses
      .slice(0, 5)
      .map(
        (p) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER};">
            <a href="${APP_URL}/processes/${p.id}" style="color: ${NIA_DARK}; text-decoration: none; font-weight: 500;">${escapeHtml(p.name)}</a>
            ${p.owner ? `<div style="font-size: 12px; color: ${TEXT_SECONDARY};">${escapeHtml(p.owner)}</div>` : ''}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">
            <span style="color: ${healthColor(p.healthScore)}; font-weight: 600;">${p.healthScore}</span>
            <span style="color: ${TEXT_SECONDARY}; font-size: 12px; margin-left: 4px;">${p.daysSinceActivity}d ago</span>
          </td>
        </tr>`
      )
      .join('');

    staleSection = `
      <div style="margin: 24px 0;">
        <h2 style="font-size: 16px; color: ${TEXT_PRIMARY}; margin: 0 0 8px 0;">&#9200; Stale Processes (${staleProcesses.length})</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden;">
          ${rows}
        </table>
      </div>`;
  }

  // --- Next actions ---
  let actionsSection = '';
  if (nextActions.length > 0) {
    const items = nextActions
      .slice(0, 5)
      .map(
        (a) => `
        <li style="margin: 6px 0;">
          <a href="${APP_URL}${a.href}" style="color: ${NIA_DARK}; text-decoration: none;">${escapeHtml(a.label)}</a>
          <span style="color: ${TEXT_SECONDARY}; font-size: 12px;"> +${a.points} pts${a.processCount > 1 ? ` across ${a.processCount} processes` : ''}</span>
        </li>`
      )
      .join('');

    actionsSection = `
      <div style="margin: 24px 0;">
        <h2 style="font-size: 16px; color: ${TEXT_PRIMARY}; margin: 0 0 8px 0;">&#127919; Top Actions to Improve Readiness</h2>
        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: ${TEXT_PRIMARY}; line-height: 1.6;">
          ${items}
        </ul>
      </div>`;
  }

  // --- Team activity ---
  let activitySection = '';
  if (weeklyUpdates.length > 0) {
    const items = weeklyUpdates
      .map(
        (u) =>
          `<span style="display: inline-block; background: ${BG_LIGHT}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 4px 12px; margin: 2px 4px; font-size: 13px;">${escapeHtml(u.owner)} <strong>${u.processCount}</strong></span>`
      )
      .join('');

    activitySection = `
      <div style="margin: 24px 0;">
        <h2 style="font-size: 16px; color: ${TEXT_PRIMARY}; margin: 0 0 8px 0;">&#128101; Team Activity This Week</h2>
        <div>${items}</div>
      </div>`;
  }

  // --- Full email ---
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NIA Excellence Hub — Weekly Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${NIA_DARK}, ${NIA_DARK}dd); padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff;">NIA Excellence Hub</div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 4px;">Weekly Digest &middot; ${formatDate(new Date())}</div>
                  </td>
                  <td align="right">
                    <img src="${APP_URL}/logo.png" alt="NIA" width="40" height="40" style="display: block; border-radius: 6px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px;">
              <!-- Summary -->
              <p style="font-size: 15px; color: ${TEXT_PRIMARY}; margin: 0 0 8px 0; line-height: 1.5;">
                ${firstName ? `Hi ${escapeHtml(firstName)} &mdash; here&rsquo;s` : `Here&rsquo;s`} your weekly snapshot${myProcessCount > 0 && myProcessCount < totalProcesses ? ` across your <strong>${myProcessCount} processes</strong> (${totalProcesses} org-wide)` : ` across <strong>${totalProcesses} processes</strong>`}.
              </p>

              ${statCards}
              ${overdueSection}
              ${staleSection}
              ${actionsSection}
              ${activitySection}

              <!-- CTA -->
              <div style="text-align: center; margin: 32px 0 8px 0;">
                <a href="${APP_URL}" style="display: inline-block; background: ${NIA_DARK}; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Open Excellence Hub
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background: ${BG_LIGHT}; border-top: 1px solid ${BORDER};">
              <p style="font-size: 12px; color: ${TEXT_SECONDARY}; margin: 0; text-align: center;">
                NIA Excellence Hub &middot; Sent every Monday morning
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
