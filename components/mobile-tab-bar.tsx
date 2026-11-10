"use client";

/**
 * Mobile Tab Bar
 *
 * Bottom navigation for phone widths — the app-native pattern, distinct from
 * the sidebar drawer which stays available (via the top bar's Menu button)
 * for the pages that don't fit here: Settings, DM Logs, Diagnostics.
 * Five items is the practical ceiling before a tab bar needs a "More" tab;
 * these are the screens actually used day to day.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { label: "Insights", href: "/overview", icon: ChartIcon },
  { label: "Automations", href: "/campaigns", icon: BoltIcon },
  { label: "Inbox", href: "/inbox", icon: InboxTabIcon },
  { label: "Setup", href: "/get-started", icon: FlagTabIcon },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-3 z-40 flex rounded-2xl border border-white/40 shadow-[0_12px_28px_-8px_rgba(29,29,28,0.22)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      style={{
        bottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        background: "color-mix(in srgb, var(--color-background) 55%, transparent)",
      }}
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
          >
            <span className="relative">
              <Icon
                className="h-6 w-6"
                style={{ color: isActive ? "var(--color-accent)" : "var(--color-muted)" }}
              />
            </span>
            <span style={{ color: isActive ? "var(--color-foreground)" : "var(--color-muted)" }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

type IconProps = { className?: string; style?: React.CSSProperties };

function HomeIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M4 11.5 12 4l8 7.5M6 9.5V20h12V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M5 19V10M12 19V5M19 19v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InboxTabIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M4 12h4l2 3h4l2-3h4M4 12l1.5-6.5A1 1 0 0 1 6.47 4h11.06a1 1 0 0 1 .97 1.5L20 12M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlagTabIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
