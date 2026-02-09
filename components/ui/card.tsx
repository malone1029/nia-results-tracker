/* ─── Variant definitions ───────────────────────────────────── */

const variantStyles = {
  default:
    "bg-white rounded-xl border border-gray-200 shadow-sm",
  elevated:
    "bg-white rounded-xl border border-gray-200 shadow-md",
  interactive:
    "bg-white rounded-xl border border-gray-200 shadow-sm card-hover cursor-pointer",
  flat:
    "bg-white rounded-xl border border-gray-100",
  ghost:
    "bg-gray-50/50 rounded-xl border border-gray-100",
} as const;

/* ─── Types ─────────────────────────────────────────────────── */

type Variant = keyof typeof variantStyles;

interface CardProps {
  variant?: Variant;
  accent?: "orange" | "green" | "dark" | "red" | "purple" | "none";
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  borderless?: boolean;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

/* ─── Accent border ─────────────────────────────────────────── */

const accentBorders = {
  orange: "border-l-4 border-l-nia-orange",
  green: "border-l-4 border-l-nia-green",
  dark: "border-l-4 border-l-nia-dark",
  red: "border-l-4 border-l-nia-red",
  purple: "border-l-4 border-l-nia-purple",
  none: "",
} as const;

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

/* ─── Card component ────────────────────────────────────────── */

export default function Card({
  variant = "default",
  accent = "none",
  padding = "none",
  children,
  className = "",
  onClick,
}: CardProps) {
  return (
    <div
      className={`${variantStyles[variant]} ${accentBorders[accent]} ${paddings[padding]} overflow-hidden ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/* ─── Card.Header — optional top section with bottom border ── */

export function CardHeader({
  children,
  className = "",
  borderless = false,
}: CardHeaderProps) {
  return (
    <div
      className={`px-5 py-3 ${
        borderless ? "" : "border-b border-gray-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Card.Body — main content area ─────────────────────────── */

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
