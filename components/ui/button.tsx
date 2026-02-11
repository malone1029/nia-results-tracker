import Link from "next/link";

/* ─── Variant + Size definitions ────────────────────────────── */

const variants = {
  primary:
    "bg-nia-dark-solid text-white hover:bg-nia-grey-blue focus-ring",
  secondary:
    "bg-card text-foreground border border-border hover:bg-surface-hover hover:border-border focus-ring",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-subtle focus-ring",
  danger:
    "bg-nia-red text-white hover:bg-red-700 focus-ring",
  success:
    "bg-nia-green text-white hover:opacity-90 focus-ring",
  accent:
    "bg-nia-orange text-white hover:bg-nia-orange-dark focus-ring",
} as const;

const sizes = {
  xs: "text-xs px-2.5 py-1 rounded-md gap-1",
  sm: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2 rounded-lg gap-2",
  lg: "text-base px-6 py-2.5 rounded-lg gap-2",
} as const;

/* ─── Types ─────────────────────────────────────────────────── */

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

interface ButtonBaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

interface ButtonAsButton extends ButtonBaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {
  href?: never;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  target?: string;
  rel?: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

/* ─── Spinner ───────────────────────────────────────────────── */

function Spinner({ size }: { size: Size }) {
  const dim = size === "xs" || size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <svg
      className={`${dim} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Button component ──────────────────────────────────────── */

export default function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    children,
    className = "",
    ...rest
  } = props;

  const base = "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  // Link variant
  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        className={cls}
        target={props.target}
        rel={props.rel}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </Link>
    );
  }

  // Button variant
  const { href: _href, ...buttonProps } = rest as ButtonAsButton;
  return (
    <button
      className={cls}
      disabled={loading || (rest as ButtonAsButton).disabled}
      {...buttonProps}
    >
      {loading ? (
        <Spinner size={size} />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
}
