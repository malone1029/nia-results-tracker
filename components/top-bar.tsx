"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GlobalSearch from "@/components/global-search";
import { useTheme } from "@/lib/use-theme";
import type { User } from "@supabase/supabase-js";

export default function TopBar({
  onMenuClick,
  user,
}: {
  onMenuClick: () => void;
  user: User | null;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  const name = user?.user_metadata?.full_name || user?.email || "";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="sticky top-0 z-30 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-text-tertiary hover:text-foreground -ml-1"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile app name */}
      <span className="lg:hidden text-sm font-bold text-foreground font-display">
        NIA Excellence Hub
      </span>

      {/* Desktop: spacer + centered search + spacer */}
      <div className="hidden lg:flex flex-1" />
      <div className="hidden lg:block w-full max-w-lg">
        <GlobalSearch variant="light" />
      </div>
      <div className="hidden lg:flex flex-1" />

      {/* Mobile spacer */}
      <div className="flex-1 lg:hidden" />

      {/* Mobile search icon */}
      <button
        onClick={() => setMobileSearchOpen(true)}
        className="lg:hidden text-text-tertiary hover:text-foreground p-1"
        aria-label="Search"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-subtle transition-colors"
        aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      >
        {resolvedTheme === "dark" ? (
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        ) : (
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        )}
      </button>

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
                className="rounded-full ring-2 ring-border-light"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-nia-orange flex items-center justify-center text-xs font-bold text-white ring-2 ring-border-light">
                {initials}
              </div>
            )}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-50 dropdown-enter">
              <div className="px-3 py-2 border-b border-border-light">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.user_metadata?.full_name || "NIA User"}
                </p>
                <p className="text-xs text-text-tertiary truncate">{user.email}</p>
              </div>
              <a
                href="/settings"
                className="block px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover"
              >
                Settings
              </a>
              <button
                onClick={signOut}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-card flex flex-col lg:hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="text-text-tertiary hover:text-foreground p-1 -ml-1"
              aria-label="Close search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <GlobalSearch variant="light" mobile onNavigate={() => setMobileSearchOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
