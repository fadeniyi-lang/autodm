"use client";

/**
 * Per-post engagement, as six small-multiple bar charts (Views, Reach, Likes,
 * Comments, Saved, Shares) instead of numbers alone. Each metric is its own
 * chart with its own scale — views can run 100x higher than saves, so one
 * shared axis would flatten everything else to a flat line. Colors: the three
 * headline metrics (views/reach/likes) get a validated three-hue categorical
 * set (node scripts/validate_palette.js, all-pairs, light mode — passes: see
 * dataviz skill); the three secondary metrics share one warm accent, since
 * each panel is independently titled and never needs to be told apart from
 * the others by hue alone.
 */

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export interface EngagementPost {
  id: string;
  timestamp: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
}

const METRICS: {
  key: keyof Pick<
    EngagementPost,
    "views" | "reach" | "likes" | "comments" | "saved" | "shares"
  >;
  label: string;
  color: string;
}[] = [
  { key: "views", label: "Views", color: "#bd0d3b" },
  { key: "reach", label: "Reach", color: "#2a78d6" },
  { key: "likes", label: "Likes", color: "#1baf7a" },
  { key: "comments", label: "Comments", color: "#e8a33d" },
  { key: "saved", label: "Saved", color: "#e8a33d" },
  { key: "shares", label: "Shares", color: "#e8a33d" },
];

const AXIS_TEXT = "#6e5b61";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MetricTooltip({
  active,
  payload,
  color,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  color: string;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      <p className="text-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

export default function EngagementCharts({ posts }: { posts: EngagementPost[] }) {
  // Most recent first from the API — chart reads left-to-right as time
  // passing, and a phone can't usefully show more than a dozen bars anyway.
  const chartPosts = [...posts].slice(0, 12).reverse();

  if (chartPosts.length === 0) {
    return (
      <div className="panel rounded-xl p-6 text-center text-sm text-muted">
        No posts to chart yet.
      </div>
    );
  }

  const data = chartPosts.map((p) => ({
    date: new Date(p.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    views: p.views ?? 0,
    reach: p.reach ?? 0,
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    saved: p.saved ?? 0,
    shares: p.shares ?? 0,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {METRICS.map((metric) => {
        const total = data.reduce((sum, d) => sum + d[metric.key], 0);
        return (
          <div key={metric.key} className="panel rounded-xl p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: metric.color }}
                  />
                  {metric.label}
                </span>
                <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                  {formatCompact(total)}
                </p>
              </div>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: AXIS_TEXT, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    content={<MetricTooltip color={metric.color} />}
                    cursor={{ fill: metric.color, opacity: 0.08 }}
                  />
                  <Bar
                    dataKey={metric.key}
                    fill={metric.color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
