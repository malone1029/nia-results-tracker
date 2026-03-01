import { Button } from '@/components/ui';
import { NIA_COLORS } from '@/lib/colors';

type Illustration = 'check' | 'document' | 'chart' | 'radar' | 'search';

interface EmptyStateProps {
  illustration: Illustration;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  compact?: boolean;
}

export default function EmptyState({
  illustration,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? 'py-6 px-4' : 'py-10 px-6'}`}
    >
      <div className={compact ? 'w-16 h-16 mb-3' : 'w-20 h-20 mb-4'}>
        {illustrations[illustration]}
      </div>
      <h3
        className={`font-semibold text-foreground ${compact ? 'text-base mb-0.5' : 'text-lg mb-1'}`}
      >
        {title}
      </h3>
      <p className="text-sm text-text-muted max-w-sm">{description}</p>
      {action && (
        <Button variant="primary" size="sm" href={action.href} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}

const illustrations: Record<Illustration, React.ReactNode> = {
  /* Checkmark with celebration rays — "all caught up" */
  check: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="24" fill={NIA_COLORS.green} opacity="0.12" />
      <circle cx="40" cy="40" r="24" stroke={NIA_COLORS.green} strokeWidth="2" fill="none" />
      <path
        d="M28 40l8 8 16-16"
        stroke={NIA_COLORS.green}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Celebration rays */}
      <line
        x1="40"
        y1="7"
        x2="40"
        y2="12"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="61"
        y1="13"
        x2="58"
        y2="17"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="19"
        y1="13"
        x2="22"
        y2="17"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="68"
        y1="34"
        x2="63"
        y2="36"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="34"
        x2="17"
        y2="36"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="22" r="1.5" fill={NIA_COLORS.green} opacity="0.5" />
      <circle cx="66" cy="22" r="1.5" fill={NIA_COLORS.green} opacity="0.5" />
      <circle cx="40" cy="2" r="1" fill={NIA_COLORS.orange} opacity="0.6" />
    </svg>
  ),

  /* Empty document with dashed lines — "no processes" */
  document: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="18"
        y="8"
        width="44"
        height="60"
        rx="4"
        style={{ fill: 'var(--card)', stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1.5"
      />
      {/* Fold corner */}
      <path
        d="M50 8v10a2 2 0 002 2h10"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1.5"
      />
      <path
        d="M50 8l12 12"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Dashed content lines */}
      <line
        x1="28"
        y1="30"
        x2="52"
        y2="30"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      <line
        x1="28"
        y1="38"
        x2="46"
        y2="38"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      <line
        x1="28"
        y1="46"
        x2="50"
        y2="46"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      <line
        x1="28"
        y1="54"
        x2="42"
        y2="54"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      {/* Plus icon accent */}
      <circle cx="60" cy="60" r="10" fill={NIA_COLORS.orange} opacity="0.12" />
      <circle cx="60" cy="60" r="10" stroke={NIA_COLORS.orange} strokeWidth="1.5" />
      <line
        x1="56"
        y1="60"
        x2="64"
        y2="60"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="60"
        y1="56"
        x2="60"
        y2="64"
        stroke={NIA_COLORS.orange}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),

  /* Empty bar chart — "no metrics / no data" */
  chart: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Axis */}
      <line
        x1="14"
        y1="64"
        x2="66"
        y2="64"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="14"
        x2="14"
        y2="64"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Grid lines */}
      <line
        x1="14"
        y1="39"
        x2="66"
        y2="39"
        style={{ stroke: 'var(--surface-subtle)' }}
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <line
        x1="14"
        y1="22"
        x2="66"
        y2="22"
        style={{ stroke: 'var(--surface-subtle)' }}
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {/* Ghost bars */}
      <rect
        x="22"
        y="34"
        width="8"
        height="30"
        rx="2"
        style={{ fill: 'var(--grid-line)' }}
        opacity="0.5"
      />
      <rect x="36" y="24" width="8" height="40" rx="2" fill={NIA_COLORS.green} opacity="0.18" />
      <rect
        x="50"
        y="44"
        width="8"
        height="20"
        rx="2"
        style={{ fill: 'var(--grid-line)' }}
        opacity="0.5"
      />
      {/* Dashed outlines on top */}
      <rect
        x="22"
        y="34"
        width="8"
        height="30"
        rx="2"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1"
        strokeDasharray="3 2"
        fill="none"
      />
      <rect
        x="36"
        y="24"
        width="8"
        height="40"
        rx="2"
        stroke={NIA_COLORS.green}
        strokeWidth="1"
        strokeDasharray="3 2"
        fill="none"
      />
      <rect
        x="50"
        y="44"
        width="8"
        height="20"
        rx="2"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1"
        strokeDasharray="3 2"
        fill="none"
      />
    </svg>
  ),

  /* Empty radar/spider chart — "no assessments" */
  radar: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <polygon
        points="40,12 64,26 64,54 40,68 16,54 16,26"
        style={{ fill: 'var(--nia-dark)', stroke: 'var(--grid-line-strong)' }}
        opacity="0.04"
        strokeWidth="1"
      />
      {/* Inner ring */}
      <polygon
        points="40,22 54,30 54,50 40,58 26,50 26,30"
        fill="none"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      {/* Axes */}
      <line
        x1="40"
        y1="12"
        x2="40"
        y2="68"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="0.75"
      />
      <line
        x1="16"
        y1="26"
        x2="64"
        y2="54"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="0.75"
      />
      <line
        x1="16"
        y1="54"
        x2="64"
        y2="26"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="0.75"
      />
      {/* Axis labels */}
      <circle cx="40" cy="10" r="2" fill={NIA_COLORS.greyBlue} opacity="0.4" />
      <circle cx="66" cy="25" r="2" fill={NIA_COLORS.greyBlue} opacity="0.4" />
      <circle cx="66" cy="55" r="2" fill={NIA_COLORS.greyBlue} opacity="0.4" />
      <circle cx="40" cy="70" r="2" fill={NIA_COLORS.greyBlue} opacity="0.4" />
      <circle cx="14" cy="55" r="2" fill={NIA_COLORS.greyBlue} opacity="0.4" />
      <circle cx="14" cy="25" r="2" fill={NIA_COLORS.greyBlue} opacity="0.4" />
      {/* Center dot */}
      <circle cx="40" cy="40" r="3" fill={NIA_COLORS.orange} opacity="0.4" />
    </svg>
  ),

  /* Magnifying glass — "no search results" */
  search: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="34"
        cy="34"
        r="18"
        fill={NIA_COLORS.greyBlue}
        opacity="0.06"
        style={{ stroke: 'var(--grid-line-strong)' }}
        strokeWidth="1.5"
      />
      <line
        x1="47"
        y1="47"
        x2="64"
        y2="64"
        stroke={NIA_COLORS.greyBlue}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Dashed content inside lens */}
      <line
        x1="25"
        y1="30"
        x2="43"
        y2="30"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
      <line
        x1="25"
        y1="38"
        x2="38"
        y2="38"
        style={{ stroke: 'var(--grid-line)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
    </svg>
  ),
};
