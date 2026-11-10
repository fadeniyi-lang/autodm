"use client";

/**
 * Top Bar
 *
 * Page title, mobile hamburger, and connection status.
 */

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/overview": "Insights",
  "/inbox": "Inbox",
  "/campaigns": "Automations",
  "/campaigns/new": "New Automation",
  "/automations": "Automations",
  "/automations/new": "New Automation",
  "/logs": "DM Logs",
  "/settings": "Settings",
  "/diagnostics": "Diagnostics",
};

interface TopBarProps {
  onMenuClick: () => void;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title =
    pageTitles[pathname] ??
    (pathname.startsWith("/get-started")
      ? "Setup guide"
      : "Dashboard");

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-white/40 backdrop-blur-xl backdrop-saturate-150"
      // Installed to the home screen the app starts at the very top of the
      // display, so without this the title sits under the clock and battery.
      // The inset is 0 in a browser tab and on desktop.
      style={{
        height: "calc(4rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
        background: "color-mix(in srgb, var(--color-background) 55%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden shrink-0 p-2 rounded-xl bg-accent/10 text-accent hover:bg-accent/20"
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
      </div>

      {instagramAccountCount > 0 ? (
        <p className="shrink-0 truncate text-sm text-muted">
          {instagramAccountCount > 1
            ? `${instagramAccountCount} accounts`
            : `@${instagramUsername}`}
        </p>
      ) : (
        <a
          href="/api/instagram/connect"
          className="shrink-0 whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded-xl bg-accent text-white hover:bg-accent-hover"
        >
          {/* Full label needs more room than a 360px header has to spare. */}
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">Connect Instagram</span>
        </a>
      )}
    </header>
  );
}
