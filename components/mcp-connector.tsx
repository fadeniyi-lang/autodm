"use client";

/**
 * Settings card: the link a creator adds to an MCP client (for example Claude,
 * as a custom connector) so it can manage AutoDM automations. The link is shown once
 * (only its hash is stored); making a new one stops the old one working.
 */

import { useEffect, useState } from "react";

export default function McpConnector({ canManage }: { canManage: boolean }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/connector", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setConnected(d.data.connected))
      .catch(() => setConnected(false));
  }, []);

  async function make() {
    if (connected && !window.confirm("Make a new link? The old one stops working, so you'll need to update it in Claude.")) return;
    setBusy(true);
    setError(null);
    try {
      const d = await (await fetch("/api/workspace/connector", { method: "POST" })).json();
      if (!d.success) throw new Error(d.error);
      setUrl(d.data.url);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't make the link, try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect the MCP connector? It won't be able to see or change your automations until you add a new link.")) return;
    setBusy(true);
    await fetch("/api/workspace/connector", { method: "DELETE" });
    setUrl(null);
    setConnected(false);
    setBusy(false);
  }

  return (
    <section className="panel rounded-xl p-4 sm:p-6">
      <h2 className="text-base font-semibold">Connect an AI assistant (MCP)</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Manage your automations from any MCP client, such as Claude. Make a link here, then in Claude go to Settings, Connectors,
        Add custom connector, name it <strong className="text-foreground">AutoDM</strong>{" "}and paste the link. Treat the link
        like a password: anyone with it can see and change your automations.
      </p>
      {!canManage ? (
        <p className="mt-4 text-sm text-muted">Only the workspace owner or an admin can set this up.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {url && (
            <div className="space-y-2 rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">Your connector link (shown once, copy it now)</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-hover px-2 py-1.5 text-xs">{url}</code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url).catch(() => undefined);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="shrink-0 rounded-xl border border-border-hover bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy || connected === null} onClick={make} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {connected ? "Make a new link" : "Make my connector link"}
            </button>
            {connected && (
              <button type="button" disabled={busy} onClick={disconnect} className="text-sm text-muted hover:text-error">
                Disconnect
              </button>
            )}
            {connected && !url && <span className="text-xs text-success">Connected</span>}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
