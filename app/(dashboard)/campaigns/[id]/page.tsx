"use client";

/**
 * Campaign Detail
 *
 * Clicking a campaign opens this read-only view: a summary of the automation
 * on the left, and Insights / Preview tabs on the right. Edit and Stop/Resume
 * live in the top bar.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import DmBreakdownBar from "@/components/dm-breakdown-bar";

interface Campaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  followUpButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  instagramAccount: { username: string };
  trackedLinks?: {
    destinationUrl: string;
    label?: string | null;
    trackedUrl?: string;
  }[];
  followUpLinks?: {
    destinationUrl: string;
    label?: string | null;
    trackedUrl?: string;
  }[];
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
  };
}

type Tab = "insights" | "preview";

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [postStats, setPostStats] = useState<{
    likes: number | null;
    comments: number | null;
    views: number | null;
    shares: number | null;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("insights");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const found = (payload.data as Campaign[]).find((c) => c.id === id);
        if (!found) return setNotFound(true);
        setCampaign(found);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!campaign) return;
    const acct = campaign.instagramAccountId;
    fetch(`/api/instagram/profile?instagramAccountId=${acct}`)
      .then((r) => r.json())
      .then((d) =>
        setAvatarUrl(d.success ? d.data.profilePictureUrl ?? null : null)
      )
      .catch(() => setAvatarUrl(null));

    if (campaign.postId) {
      fetch(`/api/instagram/posts?instagramAccountId=${acct}&limit=50`)
        .then((r) => r.json())
        .then((payload) => {
          if (!payload.success) return;
          const hit = (
            payload.data as {
              id: string;
              thumbnail_url?: string;
              media_url?: string;
              like_count?: number;
              comments_count?: number;
            }[]
          ).find((p) => p.id === campaign.postId);
          setPostThumb(hit?.thumbnail_url ?? hit?.media_url ?? null);
          setPostStats((prev) => ({
            likes: hit?.like_count ?? null,
            comments: hit?.comments_count ?? null,
            views: prev?.views ?? null,
            shares: prev?.shares ?? null,
          }));
        })
        .catch(() => setPostThumb(null));

      fetch(
        `/api/instagram/post-insights?instagramAccountId=${acct}&postId=${campaign.postId}`
      )
        .then((r) => r.json())
        .then((payload) => {
          if (!payload.success) return;
          const d = payload.data as { views?: number; shares?: number };
          setPostStats((prev) => ({
            likes: prev?.likes ?? null,
            comments: prev?.comments ?? null,
            views: d.views ?? null,
            shares: d.shares ?? null,
          }));
        })
        .catch(() => {});
    }
  }, [campaign]);

  async function toggleActive() {
    if (!campaign) return;
    setBusy(true);
    try {
      await fetch(`/api/automations?id=${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !campaign.isActive }),
      });
      setCampaign({ ...campaign, isActive: !campaign.isActive });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel h-64 rounded-xl" />;
  }
  if (notFound || !campaign) {
    return (
      <div className="panel rounded-xl p-8 text-center">
        <p className="text-sm text-muted">Automation not found.</p>
        <button
          onClick={() => router.push("/campaigns")}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Back to automations
        </button>
      </div>
    );
  }

  const publicReplies =
    campaign.publicReplyMessages && campaign.publicReplyMessages.length > 0
      ? campaign.publicReplyMessages
      : campaign.publicReplyMessage
        ? [campaign.publicReplyMessage]
        : [];
  const hasLink = Boolean(campaign.trackedLinks?.[0]?.destinationUrl);
  const hasSecondLink = Boolean(campaign.trackedLinks?.[1]?.destinationUrl);

  const trigger = campaign.matchAnyPost
    ? "Any post or reel"
    : campaign.pendingNextReel
      ? "Your next reel"
      : "A specific post or reel";
  const matchText = campaign.matchAnyWord
    ? "Any comment"
    : campaign.keywords.join(", ") || "No keywords";

  const metrics = [
    { label: "Sends", value: campaign.analytics.sent },
    { label: "Clicks", value: campaign.analytics.clicks },
    { label: "CTR", value: `${campaign.analytics.ctr}%` },
    { label: "Failed", value: campaign.analytics.failed },
  ];

  return (
    <div className="space-y-6">
      {/* Top bar: name, status, and the two actions that matter most — kept
          above everything else so they're visible without scrolling past the
          whole config summary. */}
      <div className="space-y-2">
        <Link
          href="/campaigns"
          className="text-sm text-muted hover:text-foreground"
        >
          &larr; Automations
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{campaign.name}</h1>
            <span
              className={`shrink-0 rounded-xl px-2 py-0.5 text-xs font-semibold ${
                campaign.isActive
                  ? "bg-success/10 text-success"
                  : "bg-border text-muted"
              }`}
            >
              {campaign.isActive ? "LIVE" : "Paused"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/campaigns/${campaign.id}/edit`}
              className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Edit
            </Link>
            <button
              onClick={toggleActive}
              disabled={busy}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                campaign.isActive
                  ? "bg-error hover:bg-error/85"
                  : "bg-success hover:bg-success/85"
              }`}
            >
              {campaign.isActive ? "Stop" : "Resume"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* Left: config summary */}
      <div className="space-y-6">
        <Summary title="When someone comments on">
          <div className="flex items-center gap-3">
            {postThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postThumb}
                alt="Post"
                className="h-14 w-14 rounded-xl object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-surface-hover text-[10px] text-muted">
                {campaign.matchAnyPost || campaign.pendingNextReel ? "Any" : "Post"}
              </div>
            )}
            <span className="text-sm text-foreground">{trigger}</span>
          </div>
        </Summary>

        <Summary title="And this comment has">
          <FieldBox>{matchText}</FieldBox>
          {campaign.dmTriggerEnabled && (
            <p className="text-xs text-muted">
              Also replies when someone DMs{" "}
              {campaign.matchAnyWord ? "anything" : "these words"}.
            </p>
          )}
          {publicReplies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Public reply under the post</p>
              {publicReplies.map((m, i) => (
                <FieldBox key={i}>{m}</FieldBox>
              ))}
            </div>
          )}
        </Summary>

        {campaign.openingDmEnabled && (
          <Summary title="They will get an opening DM">
            <FieldBox>{campaign.openingDmMessage || "Opening message"}</FieldBox>
            <FieldBox>{campaign.openingDmButtonLabel || "Button"}</FieldBox>
          </Summary>
        )}

        {campaign.requireFollow && (
          <Summary title="They must follow first">
            <FieldBox>
              {campaign.followPromptMessage ||
                "quick favor before i send your link. i don't make any money from this, it's free. if you want to support me, just don't unfollow after, and star the repo on github if it helps you. tap the button once you're following and i'll send it over"}
            </FieldBox>
            <FieldBox>
              {campaign.followPromptButtonLabel || "i'm following"}
            </FieldBox>
          </Summary>
        )}

        <Summary title="And then, they will get a DM">
          <FieldBox>{campaign.dmMessage}</FieldBox>
          {hasLink && (
            <FieldBox>{campaign.linkButtonLabel || "Open link"}</FieldBox>
          )}
          {hasSecondLink && (
            <FieldBox>
              {campaign.trackedLinks?.[1]?.label || "Open link"}
            </FieldBox>
          )}
        </Summary>

        {hasLink && (
          <Summary title="The exact link sent">
            {campaign.trackedLinks
              ?.filter((link) => link.destinationUrl)
              .map((link, i) => (
                <div key={i} className="space-y-1">
                  <div className="rounded-xl border border-border bg-surface px-3 py-2">
                    <p className="select-all break-all font-mono text-xs text-foreground">
                      {link.trackedUrl ?? link.destinationUrl}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {link.label ? `${link.label} · ` : ""}redirects to{" "}
                    <span className="break-all">{link.destinationUrl}</span>
                  </p>
                </div>
              ))}
          </Summary>
        )}

        {campaign.followUpEnabled && campaign.followUpMessage && (
          <Summary title="Then a follow-up message">
            <FieldBox>{campaign.followUpMessage}</FieldBox>
            <p className="text-xs text-muted">
              {campaign.followUpDelayMinutes && campaign.followUpDelayMinutes > 0
                ? `Sent ${campaign.followUpDelayMinutes} min after the link.`
                : "Sent right after the link."}
            </p>
            {Boolean(campaign.followUpLinks?.[0]?.destinationUrl) && (
              <FieldBox>
                {campaign.followUpButtonLabel || "Open link"}
              </FieldBox>
            )}
            {Boolean(campaign.followUpLinks?.[1]?.destinationUrl) && (
              <FieldBox>
                {campaign.followUpLinks?.[1]?.label || "Open link"}
              </FieldBox>
            )}
            {campaign.followUpLinks?.some((l) => l.destinationUrl) && (
              <div className="mt-1 space-y-1">
                {campaign.followUpLinks
                  .filter((link) => link.destinationUrl)
                  .map((link, i) => (
                    <div key={i} className="space-y-1">
                      <div className="rounded-xl border border-border bg-surface px-3 py-2">
                        <p className="select-all break-all font-mono text-xs text-foreground">
                          {link.trackedUrl ?? link.destinationUrl}
                        </p>
                      </div>
                      <p className="text-xs text-muted">
                        {link.label ? `${link.label} · ` : ""}redirects to{" "}
                        <span className="break-all">{link.destinationUrl}</span>
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </Summary>
        )}
      </div>

      {/* Right: tabs */}
      <div className="space-y-4">
        <div className="flex gap-4 border-b border-border pb-3">
          <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
            Insights
          </TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </TabButton>
        </div>

        {tab === "insights" && (
          <div className="space-y-4">
            {campaign.postId && (
              <div className="panel rounded-xl p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">
                  Post engagement
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <PostStat icon={EyeIcon} label="Views" value={postStats?.views} color="var(--color-bubblegum-pink)" />
                  <PostStat icon={HeartIcon} label="Likes" value={postStats?.likes} color="var(--color-tangerine)" />
                  <PostStat icon={CommentIcon} label="Comments" value={postStats?.comments} color="var(--color-sunshine-yellow)" />
                  <PostStat icon={ShareIcon} label="Shares" value={postStats?.shares} color="var(--color-aqua-teal)" />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Instagram doesn&apos;t report reposts as a separate metric
                  from its API. Shares above includes reposts to Stories and
                  sends to DMs.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {metrics.map((m) => (
                <div key={m.label} className="panel rounded-xl p-4">
                  <p className="text-sm text-muted">{m.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="panel rounded-xl p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">
                How matched comments resolved
              </p>
              <DmBreakdownBar
                sent={campaign.analytics.sent}
                skipped={campaign.analytics.skipped}
                failed={campaign.analytics.failed}
              />
            </div>
          </div>
        )}

        {tab === "preview" && (
          <div className="flex justify-center sm:justify-start">
          <CampaignPreview
            tab={previewTab}
            onTabChange={setPreviewTab}
            username={campaign.instagramAccount.username}
            avatarUrl={avatarUrl}
            postThumb={postThumb}
            caption=""
            sampleComment={campaign.matchAnyWord ? "nice!" : campaign.keywords[0] ?? "LINK"}
            dmTriggerEnabled={campaign.dmTriggerEnabled}
            publicReplyEnabled={campaign.publicReplyEnabled}
            publicReplyMessage={publicReplies[0] ?? ""}
            openingDmEnabled={campaign.openingDmEnabled}
            openingDmMessage={campaign.openingDmMessage ?? ""}
            openingDmButtonLabel={campaign.openingDmButtonLabel ?? ""}
            revealMessage={campaign.dmMessage}
            hasLink={hasLink}
            linkButtonLabel={campaign.linkButtonLabel ?? "Open link"}
            linkUrl={
              campaign.trackedLinks?.[0]?.trackedUrl ??
              campaign.trackedLinks?.[0]?.destinationUrl
            }
            hasSecondLink={hasSecondLink}
            secondLinkButtonLabel={
              campaign.trackedLinks?.[1]?.label ?? "Open link"
            }
            requireFollow={campaign.requireFollow}
            followPromptMessage={campaign.followPromptMessage ?? ""}
            followPromptButtonLabel={
              campaign.followPromptButtonLabel ?? "i'm following"
            }
            followUpEnabled={campaign.followUpEnabled ?? false}
            followUpMessage={campaign.followUpMessage ?? ""}
            followUpDelayMinutes={campaign.followUpDelayMinutes ?? 0}
          />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground">
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 pb-2 text-sm font-medium ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function formatCount(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type IconProps = { className?: string };

function PostStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: (props: IconProps) => React.JSX.Element;
  label: string;
  value: number | null | undefined;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-foreground">
          {formatCount(value)}
        </p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function EyeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 20s-7.5-4.7-9.8-9.4C.9 7.3 2.6 4 6 4c2 0 3.5 1.1 6 3.5C14.5 5.1 16 4 18 4c3.4 0 5.1 3.3 3.8 6.6C19.5 15.3 12 20 12 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CommentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4.5h16v11H9l-5 4v-4H4v-11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M16 7l-4-4-4 4M12 3v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
