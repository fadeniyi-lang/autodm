/**
 * Setup guide: everything a creator needs to get AutoDM sending DMs, and
 * optionally connected to an AI assistant over MCP. The checklist at the top reads their real
 * setup state, so each step ticks itself off as it's done.
 *
 * Facts checked 7 Nov 2026 against zernio.com/pricing and docs.zernio.com.
 */

import Link from "next/link";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { zernioLink } from "@/lib/zernio-links";

export const dynamic = "force-dynamic";

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-label={done ? "Done" : "Not done yet"}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-success text-white" : "border-2 border-border text-transparent"}`}
    >
      ✓
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-xl p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ul]:list-disc [&_ul]:space-y-1.5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

const ext = { target: "_blank", rel: "noopener noreferrer", className: "font-semibold text-accent underline underline-offset-2" } as const;

export default async function GetStartedPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const [zernio, accounts, ws, automations, sent] = workspaceId
    ? await Promise.all([
        prisma.zernioConnection.findUnique({ where: { workspaceId }, select: { profileId: true } }),
        prisma.instagramAccount.count({ where: { workspaceId } }),
        prisma.workspace.findUnique({ where: { id: workspaceId }, select: { connectorTokenHash: true } }),
        prisma.automation.count({ where: { workspaceId } }),
        prisma.dmLog.count({ where: { workspaceId, status: "SENT" } }),
      ])
    : [null, 0, null, 0, 0];

  const checklist = [
    { label: "Zernio API key saved", done: Boolean(zernio) },
    { label: "Zernio profile chosen", done: Boolean(zernio?.profileId) },
    { label: "Instagram account imported", done: accounts > 0 },
    { label: "MCP connector made (optional)", done: Boolean(ws?.connectorTokenHash) },
    { label: "First automation made", done: automations > 0 },
    { label: "First DM sent", done: sent > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Set up AutoDM</h1>
        <p className="mt-1 text-sm text-muted">
          AutoDM sends a DM to everyone who comments your keyword. This page gets it connected.
          About 15 minutes, once.
        </p>
      </div>

      <section className="panel rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Your setup</h2>
          <span className="text-xs font-semibold tabular-nums text-muted">
            {doneCount} of {checklist.length} done
          </span>
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-3 text-sm text-foreground">
              <Tick done={c.done} />
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground sm:p-5">
        <p className="font-semibold">What you&apos;re using</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>AutoDM</strong>{" "}is built on{" "}
            <a href="https://github.com/diwenne/openreply" {...ext}>OpenReply</a>, free open-source software (MIT licence, by Anish Raj and
            Diwen Huang). This copy runs on your own server, so your data and your Instagram tokens stay with you.
          </li>
          <li>
            <strong>Zernio</strong>{" "}is how AutoDM reaches your Instagram. You make your own Zernio account. It&apos;s free for your first 2
            connected accounts with no card, and includes 10,000 sent DMs a month; after that it&apos;s $1 per 10,000 DMs.{" "}
            <a href={zernioLink({ path: "/pricing", placement: "get-started-pricing" })} {...ext}>Zernio pricing</a>
          </li>
          <li>
            Prefer Meta&apos;s own API? You can connect Instagram directly with your own Meta app instead of Zernio. See the README.
          </li>
        </ul>
      </section>

      <Step n={1} title="Check your Instagram account type">
        <p>
          AutoDM works with Instagram <strong>Business</strong>{" "}or <strong>Creator</strong>{" "}accounts. In Instagram, go to Settings, then
          Account type and tools. If it says Personal, switch to Professional (it&apos;s free and you can switch back).
        </p>
      </Step>

      <Step n={2} title="Make your free Zernio account and connect Instagram">
        <ol>
          <li>
            <a href={zernioLink({ path: "/signup", placement: "get-started-signup" })} {...ext}>Sign up at Zernio</a> (no card needed).
          </li>
          <li>
            In the Zernio dashboard, open <strong>Connections</strong>{" "}and click <strong>New Connection</strong>.
          </li>
          <li>
            Under <strong>Add to profile</strong>, pick your profile (create one named after your brand if there isn&apos;t one).
          </li>
          <li>
            Click <strong>Instagram</strong>, sign in and approve. If your Instagram is linked to a Facebook Page, you can sign in with
            Facebook instead.
          </li>
          <li>
            Check your Instagram shows as <strong>connected</strong>{" "}in Connections.
          </li>
        </ol>
      </Step>

      <Step n={3} title="Create your Zernio API key">
        <ol>
          <li>
            In Zernio, open <strong>API keys</strong>{" "}and click <strong>Create API key</strong>.
          </li>
          <li>
            Give it <strong>full read and write access</strong>, including the <strong>Inbox</strong>, and don&apos;t limit it to one
            profile. A read-only or profile-restricted key won&apos;t work.
          </li>
          <li>Copy the key straight away. It starts with <code>sk_</code> and Zernio only shows it once.</li>
        </ol>
      </Step>

      <Step n={4} title="Connect Zernio to AutoDM">
        <ol>
          <li>
            Open <Link href="/settings" className="font-semibold text-accent underline underline-offset-2">Settings</Link> here in
            AutoDM.
          </li>
          <li>
            In the Zernio section, paste your key and click <strong>Save API key</strong>.
          </li>
          <li>Choose your Zernio profile, then import your Instagram account.</li>
        </ol>
        <p className="rounded-lg bg-surface-hover p-3 text-xs">
          Make your automations in AutoDM only. Don&apos;t also set one up inside Zernio for the same post, or people get
          two DMs.
        </p>
      </Step>

      <Step n={5} title="Optional: manage AutoDM from an AI assistant (MCP)">
        <ol>
          <li>
            In <Link href="/settings" className="font-semibold text-accent underline underline-offset-2">Settings</Link>, find{" "}
            <strong>Connect an AI assistant (MCP)</strong>{" "}and click <strong>Make my connector link</strong>. Copy it.
          </li>
          <li>
            In Claude, go to <strong>Settings</strong>, then <strong>Connectors</strong>, then <strong>Add custom connector</strong>.
          </li>
          <li>
            Name it <strong>AutoDM</strong>, paste the link and click Add. Claude can then list your posts and automations, create
            new ones (always switched off) and switch them on.
          </li>
        </ol>
        <p className="text-xs text-muted">Keep the link private, like a password. If it ever leaks, make a new one in Settings and the old one stops working.</p>
      </Step>

      <Step n={6} title="Make your first automation and test it">
        <ol>
          <li>
            Open <Link href="/campaigns" className="font-semibold text-accent underline underline-offset-2">Automations</Link>, pick the
            reel, add your keyword, the DM and your link.
          </li>
          <li>Check it, then switch it on.</li>
          <li>
            From a <strong>different</strong>{" "}Instagram account, comment the keyword. The DM should arrive within a minute or two, and show
            in <Link href="/logs" className="font-semibold text-accent underline underline-offset-2">DM Logs</Link>.
          </li>
        </ol>
        <p className="text-xs text-muted">
          Instagram&apos;s own rules still apply: DMs only go to people who commented, and Instagram limits how many messages an account
          can send in a short time.
        </p>
      </Step>
    </div>
  );
}
