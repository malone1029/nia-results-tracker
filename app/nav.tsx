"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import GlobalSearch from "@/components/global-search";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const navGroups = [
  {
    label: "Overview",
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/requirements", label: "Requirements" },
    ],
  },
  {
    label: "Processes",
    links: [
      { href: "/processes", label: "Processes" },
      { href: "/categories", label: "Categories" },
    ],
  },
  {
    label: "Analytics",
    links: [
      { href: "/ai-insights", label: "AI Insights" },
      { href: "/letci", label: "LeTCI" },
      { href: "/schedule", label: "Schedule" },
    ],
  },
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
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

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

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
      <div className="hidden lg:flex items-center gap-2">
        <GlobalSearch />

        <nav className="flex items-center">
          {navGroups.map((group, gi) => (
            <Fragment key={gi}>
              {gi > 0 && <div className="w-px h-4 bg-white/20 mx-1.5" />}
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    isActive(link.href)
                      ? "bg-white/20 text-white font-medium px-2 py-1 rounded-md text-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md text-sm transition-all"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </Fragment>
          ))}
        </nav>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 ml-1">
          <Link
            href="/log"
            className={`border text-sm px-2 py-1 rounded-md transition-all ${
              isActive("/log")
                ? "border-white text-white bg-white/20"
                : "border-white/30 text-white/70 hover:border-white/60 hover:text-white"
            }`}
          >
            Log Data
          </Link>
          <Link
            href="/metric/new"
            className={`text-sm px-2 py-1 rounded-md transition-all font-medium ${
              isActive("/metric/new")
                ? "bg-nia-orange-dark text-white"
                : "bg-nia-orange text-white hover:bg-nia-orange-dark"
            }`}
          >
            + Metric
          </Link>
        </div>

        {/* User profile */}
        {user && (
          <div className="relative ml-1" ref={profileRef}>
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
                  className="rounded-full ring-2 ring-white/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-nia-orange flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/20">
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
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
                <a
                  href="/settings"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Settings
                </a>
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
        className="lg:hidden text-white text-2xl leading-none px-2"
        aria-label="Toggle menu"
      >
        {menuOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-nia-dark shadow-lg z-50">
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
                <div className="w-7 h-7 rounded-full bg-nia-orange flex items-center justify-center text-xs font-bold text-white">
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

          {/* Grouped navigation */}
          <nav className="px-4 py-3 space-y-4">
            {navGroups.map((group, gi) => (
              <div key={gi}>
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5 font-medium px-3">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={
                        isActive(link.href)
                          ? "bg-white/15 text-white font-medium px-3 py-2 rounded-md text-sm"
                          : "text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm transition-all"
                      }
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* Actions group */}
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5 font-medium px-3">
                Actions
              </div>
              <div className="flex flex-col gap-1">
                <Link
                  href="/log"
                  onClick={() => setMenuOpen(false)}
                  className={
                    isActive("/log")
                      ? "bg-white/15 text-white font-medium px-3 py-2 rounded-md text-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm transition-all"
                  }
                >
                  Log Data
                </Link>
                <Link
                  href="/metric/new"
                  onClick={() => setMenuOpen(false)}
                  className="bg-nia-orange text-white px-3 py-2 rounded-md text-sm font-medium text-center mt-1"
                >
                  + Add Metric
                </Link>
              </div>
            </div>

            {/* Settings + Sign Out */}
            {user && (
              <div className="pt-3 border-t border-white/10 flex flex-col gap-0.5">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className={
                    isActive("/settings")
                      ? "bg-white/15 text-white font-medium px-3 py-2 rounded-md text-sm"
                      : "text-white/60 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm transition-all"
                  }
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="text-left text-white/60 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm transition-all"
                >
                  Sign Out
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
