"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/categories", label: "Categories" },
  { href: "/schedule", label: "Review Schedule" },
  { href: "/letci", label: "LeTCI Summary" },
  { href: "/log", label: "Log Data" },
  { href: "/metric/new", label: "+ Add Metric" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 text-sm">
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`transition-colors ${
              isActive
                ? "text-[#f79935] font-medium"
                : "text-white hover:text-[#f79935]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
