"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSidebarGroups } from "@/lib/use-sidebar-groups";
import SidebarHealthWidget, {
  type SidebarHealthData,
} from "@/components/sidebar-health-widget";
import type { AppRole } from "@/lib/auth-helpers";

// ── Navigation structure ──────────────────────────────────
// "Actions" group merged into "Overview". Admin group renamed.

const navGroups = [
  {
    label: "Overview",
    links: [
      { href: "/", label: "Dashboard", icon: "grid" },
      { href: "/my-tasks", label: "My Tasks", icon: "check-circle" },
      { href: "/my-scorecard", label: "My Scorecard", icon: "award" },
      { href: "/data-health", label: "Data Health", icon: "heart" },
      { href: "/requirements", label: "Requirements", icon: "clipboard" },
      { href: "/log", label: "Log Data", icon: "edit" },
      { href: "/metric/new", label: "New Metric", icon: "plus" },
    ],
  },
  {
    label: "Processes",
    links: [
      { href: "/processes", label: "Processes", icon: "folder" },
      { href: "/classifications", label: "Classifications", icon: "tag" },
      { href: "/categories", label: "Categories", icon: "layers" },
    ],
  },
  {
    label: "Analytics",
    links: [
      { href: "/readiness", label: "Readiness", icon: "shield-check" },
      { href: "/adli-insights", label: "ADLI Insights", icon: "radar" },
      { href: "/letci", label: "LeTCI", icon: "bar-chart" },
      { href: "/schedule", label: "Schedule", icon: "calendar" },
    ],
  },
];

const adminNavGroups = [
  {
    label: "Admin",
    links: [
      { href: "/application", label: "Application Drafts", icon: "file-text" },
      { href: "/criteria", label: "Criteria Map", icon: "book-open" },
      { href: "/criteria/gaps", label: "Gap Analysis", icon: "alert-triangle" },
      { href: "/surveys", label: "Surveys", icon: "clipboard-list" },
      { href: "/feedback", label: "Feedback Inbox", icon: "inbox" },
      { href: "/admin/scorecards", label: "Scorecards", icon: "users" },
    ],
  },
];

// Visible only to super_admin — hidden from admin and member
const superAdminNavGroups = [
  {
    label: "Intelligence",
    links: [
      { href: "/command-center", label: "Command Center", icon: "shield-check" },
    ],
  },
];

// Members only see the Processes group + their scorecard
const memberNavGroups = [
  {
    label: "Overview",
    links: [
      { href: "/my-tasks", label: "My Tasks", icon: "check-circle" },
      { href: "/my-scorecard", label: "My Scorecard", icon: "award" },
    ],
  },
  {
    label: "Processes",
    links: [
      { href: "/processes", label: "Processes", icon: "folder" },
      { href: "/classifications", label: "Classifications", icon: "tag" },
      { href: "/categories", label: "Categories", icon: "layers" },
    ],
  },
];

// ── Icons ──────────────────────────────────────────────────

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const cn = className || "w-4 h-4";
  switch (icon) {
    case "grid":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case "check-circle":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "heart":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case "clipboard":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    case "folder":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case "tag":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    case "layers":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case "radar":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "shield-check":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "edit":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case "plus":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      );
    case "book-open":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "clipboard-list":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    case "file-text":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "inbox":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      );
    case "settings":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "help":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      );
    case "message":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0M2.25 12c0 4.556 4.03 8.25 9 8.25a9.764 9.764 0 002.555-.337A5.972 5.972 0 0015.75 21a5.969 5.969 0 004.282-1.8A8.224 8.224 0 0021.75 12c0-4.556-4.03-8.25-9-8.25S2.25 7.444 2.25 12z" />
        </svg>
      );
    case "award":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    case "users":
      return (
        <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Chevron icon for collapse/expand ────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Find which group a path belongs to ──────────────────────

function findGroupForPath(
  path: string,
  groups: typeof navGroups,
  adminGroups: typeof adminNavGroups,
  superAdminGroups: typeof superAdminNavGroups = []
): string | null {
  for (const group of [...groups, ...adminGroups, ...superAdminGroups]) {
    for (const link of group.links) {
      if (link.href === "/" ? path === "/" : path.startsWith(link.href)) {
        return group.label;
      }
    }
  }
  return null;
}

// ── Sidebar component ───────────────────────────────────────

export default function Sidebar({
  open,
  onClose,
  role = "member",
  onFeedbackClick,
  healthData,
  healthLoading,
}: {
  open: boolean;
  onClose: () => void;
  role?: AppRole;
  onFeedbackClick?: () => void;
  healthData?: SidebarHealthData | null;
  healthLoading?: boolean;
}) {
  const isAdmin = role === "admin" || role === "super_admin";
  const pathname = usePathname();
  const { expandedGroups, toggleGroup, expandGroup } = useSidebarGroups();

  // Auto-expand group containing the active page
  useEffect(() => {
    const group = findGroupForPath(pathname, navGroups, adminNavGroups, superAdminNavGroups);
    if (group) {
      expandGroup(group);
    }
  }, [pathname, expandGroup]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function renderGroup(
    group: { label: string; links: { href: string; label: string; icon: string }[] },
    isAdminGroup: boolean
  ) {
    const expanded = expandedGroups.has(group.label);
    const groupId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div key={group.label}>
        <button
          onClick={() => toggleGroup(group.label)}
          aria-expanded={expanded}
          aria-controls={groupId}
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-medium transition-colors hover:bg-white/5 ${
            isAdminGroup ? "text-nia-orange/60" : "text-white/40"
          }`}
        >
          <span>{group.label}</span>
          <ChevronIcon expanded={expanded} />
        </button>
        <div
          id={groupId}
          className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-200 ${
            expanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
          }`}
        >
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all ${
                isActive(link.href)
                  ? isAdminGroup
                    ? "bg-nia-orange/20 text-nia-orange font-medium"
                    : "bg-white/15 text-white font-medium nav-link-active"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <NavIcon icon={link.icon} className="w-4 h-4 flex-shrink-0" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo + app name */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Image
          src="/logo.png"
          alt="NIA Logo"
          width={36}
          height={36}
          className="rounded"
        />
        <div>
          <div className="text-white font-bold text-sm leading-tight font-display">
            NIA Excellence Hub
          </div>
          <div className="text-white/50 text-[11px]">
            Baldrige Framework
          </div>
        </div>
      </div>

      {/* Health widget — always visible above nav */}
      <SidebarHealthWidget
        data={healthData ?? null}
        loading={healthLoading}
        onNavigate={onClose}
      />

      {/* Nav groups */}
      <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {isAdmin
          ? navGroups.map((group) => renderGroup(group, false))
          : memberNavGroups.map((group) => renderGroup(group, false))}
        {isAdmin &&
          adminNavGroups.map((group) => renderGroup(group, true))}
        {role === "super_admin" &&
          superAdminNavGroups.map((group) => renderGroup(group, true))}
      </nav>

      {/* Bottom — Help, Feedback, Settings */}
      <div className="px-3 py-3 border-t border-white/10 space-y-0.5">
        <Link
          href="/help"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all ${
            isActive("/help")
              ? "bg-white/15 text-white font-medium nav-link-active"
              : "text-white/60 hover:text-white hover:bg-white/8"
          }`}
        >
          <NavIcon icon="help" className="w-4 h-4 flex-shrink-0" />
          Help
        </Link>
        <button
          onClick={() => {
            onClose?.();
            onFeedbackClick?.();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all text-white/60 hover:text-white hover:bg-white/8"
        >
          <NavIcon icon="message" className="w-4 h-4 flex-shrink-0" />
          Feedback
        </button>
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all ${
            isActive("/settings")
              ? "bg-white/15 text-white font-medium nav-link-active"
              : "text-white/60 hover:text-white hover:bg-white/8"
          }`}
        >
          <NavIcon icon="settings" className="w-4 h-4 flex-shrink-0" />
          Settings
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:z-40">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — slide-in overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          {/* Drawer */}
          <aside className="lg:hidden fixed inset-y-0 left-0 w-60 z-50 sidebar-enter">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
