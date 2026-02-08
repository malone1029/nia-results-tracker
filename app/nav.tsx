"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/global-search";

const links = [
  { href: "/requirements", label: "Key Requirements" },
  { href: "/processes", label: "Processes" },
  { href: "/categories", label: "Categories" },
  { href: "/", label: "Results Dashboard" },
  { href: "/letci", label: "LeTCI Summary" },
  { href: "/schedule", label: "Review Schedule" },
  { href: "/log", label: "Log Data" },
  { href: "/metric/new", label: "+ Add Metric" },
];

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function linkClass(href: string) {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `transition-colors ${
      isActive
        ? "text-[#f79935] font-medium"
        : "text-white hover:text-[#f79935]"
    }`;
  }

  return (
    <>
      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-4">
        <GlobalSearch />
        <nav className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden text-white text-2xl leading-none px-2"
        aria-label="Toggle menu"
      >
        {menuOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#324a4d] shadow-lg z-50">
          <div className="px-4 pt-3">
            <GlobalSearch mobile onNavigate={() => setMenuOpen(false)} />
          </div>
          <nav className="flex flex-col px-4 py-3 gap-3 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
