"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import MobileTabBar from "@/components/mobile-tab-bar";

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceName: string;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function DashboardShell({
  children,
  workspaceName,
  instagramUsername,
  instagramAccountCount,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // h-dvh, not h-screen: on mobile browsers the URL bar eats into 100vh, which
    // would push the composer and pagination controls below the fold.
    <div className="relative flex h-dvh overflow-hidden bg-background">
      {/* Ambient wash the frosted-glass panels/tab bar actually blur against —
          without something colourful behind them, backdrop-blur just looks
          like a flat grey box. Fixed so it doesn't scroll with content. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[color:var(--color-bubblegum-pink)] opacity-25 blur-[110px]" />
        <div className="absolute right-[-6rem] top-1/3 h-[24rem] w-[24rem] rounded-full bg-[color:var(--color-sky-blue)] opacity-20 blur-[100px]" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-[color:var(--color-electric-violet)] opacity-20 blur-[110px]" />
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        workspaceName={workspaceName}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          instagramUsername={instagramUsername}
          instagramAccountCount={instagramAccountCount}
        />

        {/* overflow-x-hidden: enabling vertical scrolling makes the browser
            allow horizontal scrolling too, which lets a wide child drag the
            whole page sideways on a phone. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Bottom padding clears the fixed mobile tab bar (its own height
              plus the safe-area inset) so the last row of content is never
              hidden behind it. Zero on desktop, where the tab bar is hidden. */}
          <div
            className="px-4 lg:px-8 py-5 sm:py-6 max-w-7xl mx-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6"
          >
            {children}
          </div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
