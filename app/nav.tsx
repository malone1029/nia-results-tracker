"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import GlobalSearch from "@/components/global-search";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const links = [
  { href: "/requirements", label: "Key Requirements" },
  { href: "/processes", label: "Processes" },
  { href: "/categories", label: "Categories" },
  { href: "/", label: "Results Dashboard" },
  { href: "/ai-insights", label: "AI Insights" },
  { href: "/letci", label: "LeTCI Summary" },
  { href: "/schedule", label: "Review Schedule" },
  { href: "/log", label: "Log Data" },
  { href: "/metric/new", label: "+ Add Metric" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function linkClass(href: string) {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `transition-colors ${
      isActive
        ? "text-[#f79935] font-medium"
        : "text-white hover:text-[#f79935]"
    }`;
  }

  // Get initials for avatar fallback
  const name = user?.user_metadata?.full_name || user?.email || "";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl = user?.user_metadata?.avatar_url;

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

        {/* User profile */}
        {user && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#f79935] flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
              )}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.user_metadata?.full_name || "NIA User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
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
          {/* Mobile user info */}
          {user && (
            <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-white/10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#f79935] flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
              )}
              <span className="text-sm text-white/80 truncate">
                {user.user_metadata?.full_name || user.email}
              </span>
            </div>
          )}
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
            {user && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="text-left text-white/60 hover:text-[#f79935] transition-colors"
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
