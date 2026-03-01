// Centralized color constants for the NIA Excellence Hub design system.
// These match the CSS variables in globals.css — use Tailwind classes (e.g. bg-nia-dark)
// for styling, and these constants only when you need raw hex values in JavaScript
// (e.g. inline SVG, dynamic style calculations, chart libraries).

export const NIA_COLORS = {
  dark: '#324a4d',
  greyBlue: '#55787c',
  orange: '#f79935',
  orangeDark: '#e88a28',
  green: '#b1bd37',
  red: '#dc2626',
  purple: '#a855f7',
  yellow: '#eab308',
  muted: '#9ca3af',
  border: '#e5e7eb',
  indigo: '#6366f1',
} as const;

// ADLI maturity levels — used by AI Insights and AI Chat Panel
export interface MaturityLevel {
  label: string;
  color: string;
  bgColor: string;
}

export function getMaturityLevel(score: number): MaturityLevel {
  if (score >= 70) return { label: 'Integrated', color: NIA_COLORS.dark, bgColor: NIA_COLORS.dark };
  if (score >= 50) return { label: 'Aligned', color: NIA_COLORS.green, bgColor: NIA_COLORS.green };
  if (score >= 30)
    return { label: 'Early Systematic', color: NIA_COLORS.orange, bgColor: NIA_COLORS.orange };
  return { label: 'Reacting', color: NIA_COLORS.red, bgColor: NIA_COLORS.red };
}

// Process status colors — used by process list, detail, and stepper
export const STATUS_COLORS: Record<string, string> = {
  draft: NIA_COLORS.muted,
  ready_for_review: NIA_COLORS.orange,
  approved: NIA_COLORS.green,
} as const;

// ADLI dimension colors — used by ADLI radar, process detail page, scoring info
export const ADLI_COLORS = {
  approach: NIA_COLORS.orange,
  deployment: NIA_COLORS.greyBlue,
  learning: NIA_COLORS.green,
  integration: NIA_COLORS.dark,
} as const;

// Sparkline / trend colors — used by data-health and process detail pages
export function getTrendColor(improving: boolean, trend: string | null): string {
  if (improving) return NIA_COLORS.green;
  if (trend === 'flat') return NIA_COLORS.greyBlue;
  if (trend) return NIA_COLORS.red;
  return 'var(--text-muted)';
}

// Health score threshold color — used by data-health and process-list
export function getHealthColor(score: number): string {
  if (score >= 80) return NIA_COLORS.green;
  if (score >= 60) return NIA_COLORS.greyBlue;
  if (score >= 40) return NIA_COLORS.orange;
  return NIA_COLORS.red;
}
