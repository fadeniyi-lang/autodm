"use client";

/**
 * Top Posts
 *
 * Ranks actual posts by a chosen metric — "which post got the most shares",
 * not just a date-ordered table. Includes a plain-language comparison
 * against the account average so a spike is legible without doing the maths
 * yourself ("3.2x your average" rather than two raw numbers to compare).
 */

import { useState } from "react";

interface Post {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaType: string;
  timestamp: string;
  views: number | null;
  reach: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
}

const METRICS = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "saved", label: "Saved" },
  { key: "shares", label: "Shares" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function TopPosts({ posts }: { posts: Post[] }) {
  const [metric, setMetric] = useState<MetricKey>("views");

  const values = posts.map((p) => p[metric] ?? 0);
  const average = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;

  const ranked = [...posts]
    .map((p) => ({ post: p, value: p[metric] ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="panel rounded-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Top posts</h2>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors ${
                metric === m.key
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 || average === 0 ? (
        <p className="mt-6 py-8 text-center text-sm text-muted">
          Not enough data yet for this metric.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {ranked.map(({ post, value }, i) => {
            const multiple = average > 0 ? value / average : 0;
            return (
              <a
                key={post.id}
                href={post.permalink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-hover"
              >
                <span className="w-4 shrink-0 text-center text-sm font-semibold text-muted">
                  {i + 1}
                </span>
                {post.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.thumbnailUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-surface-hover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {post.caption || `${post.mediaType} post`}
                  </p>
                  <p className="text-xs text-muted">{formatDate(post.timestamp)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {formatNumber(value)}
                  </p>
                  {multiple >= 1.3 && (
                    <p className="text-xs font-medium text-success">
                      {multiple.toFixed(1)}x avg
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
