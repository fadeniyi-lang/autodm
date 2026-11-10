"use client";

/**
 * DMs Over Time
 *
 * Stacked bar chart of the last 7 days: sent, skipped, and failed, so a spike
 * in skips or failures is visible at a glance instead of hiding inside one
 * total. Replaces the earlier hand-rolled div bars, which only ever showed the
 * "sent" count and had no tooltip or breakdown.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DmActivityPoint {
  date: string;
  count: number;
  skipped: number;
  failed: number;
}

// Same family as the login page's ambient colors: crimson (sent, the outcome
// that matters most), teal (skipped, neutral — by design, not a problem), and
// gold-shifted-warm (failed, without reaching for a jarring red-on-red next to
// the brand crimson).
const SENT_COLOR = "#bd0d3b";
const SKIPPED_COLOR = "#1b6b6b";
const FAILED_COLOR = "#a0550f";
const GRID_COLOR = "#e3d9d2";
const AXIS_TEXT = "#6e5b61";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const names: Record<string, string> = {
    count: "Sent",
    skipped: "Skipped",
    failed: "Failed",
  };

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-1 flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-muted">{names[entry.dataKey] ?? entry.dataKey}</span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DmActivityChart({ data }: { data: DmActivityPoint[] }) {
  const total = data.reduce(
    (sum, d) => sum + d.count + d.skipped + d.failed,
    0
  );

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-surface/60 text-sm text-muted">
        No DM activity in the last 7 days
      </div>
    );
  }

  return (
    <div className="h-48 sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            stroke={GRID_COLOR}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            stroke={GRID_COLOR}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: GRID_COLOR, opacity: 0.4 }} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) =>
              ({ count: "Sent", skipped: "Skipped", failed: "Failed" })[
                value as string
              ] ?? value
            }
            wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }}
          />
          <Bar dataKey="count" stackId="dm" fill={SENT_COLOR} radius={[0, 0, 0, 0]} />
          <Bar dataKey="skipped" stackId="dm" fill={SKIPPED_COLOR} />
          <Bar dataKey="failed" stackId="dm" fill={FAILED_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
