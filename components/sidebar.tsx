"use client";

/**
 * Sidebar Navigation
 *
 * Icon + label nav with active state and workspace section.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { className?: string; style?: React.CSSProperties };

function HomeIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M4 11.5 12 4l8 7.5M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M5 19V10M12 19V5M19 19v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InboxIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M4 12h4l2 3h4l2-3h4M4 12l1.5-6.5A1 1 0 0 1 6.47 4h11.06a1 1 0 0 1 .97 1.5L20 12M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.1M12 18.4v2.1M20.5 12h-2.1M5.6 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8 6.3 6.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PulseIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M3 12h4l2.2-6 4 12 2.2-6H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlagIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", color: "var(--color-bubblegum-pink)", icon: HomeIcon },
  { label: "Insights", href: "/overview", color: "var(--color-sky-blue)", icon: ChartIcon },
  { label: "Automations", href: "/campaigns", color: "var(--color-tangerine)", icon: BoltIcon },
  { label: "Inbox", href: "/inbox", color: "var(--color-sunshine-yellow)", icon: InboxIcon },
  { label: "DM Logs", href: "/logs", color: "var(--color-aqua-teal)", icon: ListIcon },
  { label: "Settings", href: "/settings", color: "var(--color-muted)", icon: GearIcon },
  { label: "Diagnostics", href: "/diagnostics", color: "var(--color-muted)", icon: PulseIcon },
  { label: "Setup guide", href: "/get-started", color: "var(--color-accent)", icon: FlagIcon },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "var(--color-surface)" }}
      >
        {/* Same reason as the top bar: the drawer is full height, so the
            wordmark would otherwise land under the status bar. */}
        <div
          className="px-6 py-5 border-b border-border"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <Link href="/dashboard" className="text-base font-semibold">
            AutoDM
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                  ${
                    isActive
                      ? "bg-surface-hover text-foreground font-semibold"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                <Icon
                  className="h-[18px] w-[18px] shrink-0"
                  style={{ color: isActive ? item.color : "currentColor", opacity: isActive ? 1 : 0.7 } as React.CSSProperties}
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-sm text-foreground truncate">{workspaceName}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Runs on{" "}
            <a href="https://github.com/diwenne/openreply" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenReply</a>
            {" "}· Instagram via{" "}
            <a href="https://zernio.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Zernio</a>
          </p>
        </div>
      </aside>
    </>
  );
}
