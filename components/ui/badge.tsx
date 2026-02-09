/* ─── Color scheme definitions ──────────────────────────────── */

const colorSchemes = {
  gray: "bg-gray-100 text-gray-600",
  dark: "bg-nia-dark/10 text-nia-dark",
  orange: "bg-nia-orange/10 text-nia-orange",
  green: "bg-nia-green/15 text-nia-green",
  red: "bg-nia-red/10 text-nia-red",
  purple: "bg-nia-purple/10 text-nia-purple",
  yellow: "bg-nia-yellow/10 text-nia-yellow",
  blue: "bg-blue-50 text-blue-600",
  // Solid variants — white text on filled background
  "solid-dark": "bg-nia-dark text-white",
  "solid-orange": "bg-nia-orange text-white",
  "solid-green": "bg-nia-green text-white",
  "solid-red": "bg-nia-red text-white",
  "solid-purple": "bg-nia-purple text-white",
} as const;

const sizes = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-xs px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
} as const;

/* ─── Types ─────────────────────────────────────────────────── */

type ColorScheme = keyof typeof colorSchemes;
type Size = keyof typeof sizes;

interface BadgeProps {
  color?: ColorScheme;
  size?: Size;
  dot?: boolean;
  pill?: boolean;
  children: React.ReactNode;
  className?: string;
}

/* ─── Badge component ───────────────────────────────────────── */

export default function Badge({
  color = "gray",
  size = "sm",
  dot = false,
  pill = true,
  children,
  className = "",
}: BadgeProps) {
  const rounded = pill ? "rounded-full" : "rounded";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${colorSchemes[color]} ${sizes[size]} ${rounded} ${className}`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
