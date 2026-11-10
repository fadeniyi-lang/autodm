/**
 * Performance Insight
 *
 * The headline of the Overview page: your top 3 posts by views in the last
 * 30 days, each with a real written explanation grounded in the post's
 * actual caption (from lib/ai/post-insight.ts, computed server-side in the
 * overview API route) rather than a restated stat, plus the post's actual
 * engagement numbers.
 */

interface Post {
  id: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
  views: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
}

interface TopPerformer {
  postId: string;
  reachMultiple: number;
  standoutMetrics: string[];
  insightPoints: string[] | null;
}

const CARD_COLORS = [
  "var(--color-accent)",
  "var(--color-bubblegum-pink)",
  "var(--color-sky-blue)",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatCount(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type IconProps = { className?: string };

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

function BookmarkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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

function Stat({
  icon: Icon,
  value,
}: {
  icon: (props: IconProps) => React.JSX.Element;
  value: number | null | undefined;
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-foreground">
      <Icon className="h-3.5 w-3.5 text-muted" />
      <span className="font-medium tabular-nums">{formatCount(value)}</span>
    </span>
  );
}

export default function PerformanceInsight({
  posts,
  topPerformers,
}: {
  posts: Post[];
  topPerformers: TopPerformer[];
}) {
  if (topPerformers.length === 0) return null;

  const postById = new Map(posts.map((p) => [p.id, p]));

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Your best performers, last 30 days
      </p>
      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
        {topPerformers.map((perf, i) => {
          const post = postById.get(perf.postId);
          if (!post) return null;
          return (
            <div
              key={perf.postId}
              className="flex flex-col rounded-2xl p-5 shadow-sm"
              style={{
                background: `color-mix(in srgb, ${CARD_COLORS[i]} 14%, var(--color-background))`,
                border: `1px solid color-mix(in srgb, ${CARD_COLORS[i]} 35%, transparent)`,
              }}
            >
              <div className="flex items-center gap-3">
                {post.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-surface-hover" />
                )}
                <span className="min-w-0 truncate font-display text-base font-bold leading-tight text-foreground">
                  {formatDate(post.timestamp)}
                </span>
              </div>

              <p className="mt-3 text-sm text-foreground">
                <strong>{perf.reachMultiple.toFixed(1)}x</strong> your average
                views.
              </p>

              {perf.insightPoints && perf.insightPoints.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {perf.insightPoints.map((point, j) => (
                    <li key={j} className="flex gap-2">
                      <span aria-hidden="true" style={{ color: CARD_COLORS[i] }}>
                        &bull;
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  No caption to analyse for this one.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                <Stat icon={EyeIcon} value={post.views} />
                <Stat icon={HeartIcon} value={post.likes} />
                <Stat icon={CommentIcon} value={post.comments} />
                <Stat icon={BookmarkIcon} value={post.saved} />
                <Stat icon={ShareIcon} value={post.shares} />
              </div>

              <a
                href={post.permalink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-border-hover bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-surface-hover"
              >
                View post
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                  <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
