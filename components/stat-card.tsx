/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend. Pass `href` to make it
 * a drill-down link (e.g. a DM count into the filtered logs view).
 *
 * Full-saturation pastel background, not a neutral panel — the rainbow
 * accent set used the way it's meant to: real colour, not a tint so faint it
 * still reads as grey. All six clear 7:1+ contrast with ink-black text, so
 * legibility isn't a trade-off here.
 */

import Link from "next/link";

export type StatCardColor =
  | "pink"
  | "tangerine"
  | "aqua"
  | "sky"
  | "yellow"
  | "mint";

const COLOR_VARS: Record<StatCardColor, string> = {
  pink: "var(--color-bubblegum-pink)",
  tangerine: "var(--color-tangerine)",
  aqua: "var(--color-aqua-teal)",
  sky: "var(--color-sky-blue)",
  yellow: "var(--color-sunshine-yellow)",
  mint: "var(--color-mint-green)",
};

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  href?: string;
  color?: StatCardColor;
}

export default function StatCard({
  label,
  value,
  trend,
  trendUp,
  href,
  color,
}: StatCardProps) {
  const style = color
    ? { background: COLOR_VARS[color], color: "#1d1d1c" }
    : undefined;

  const content = (
    <>
      <p className={color ? "text-sm font-medium opacity-80" : "text-sm text-muted"}>
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={color ? undefined : { color: "var(--color-foreground)" }}>
        {value}
      </p>
      {trend && (
        <p
          className="text-xs mt-1 font-medium"
          style={{ color: color ? "#1d1d1c" : trendUp ? "var(--color-success)" : "var(--color-error)" }}
        >
          {trendUp ? "Up" : "Down"} {trend}
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`block rounded-xl p-4 transition-transform hover:-translate-y-0.5 ${color ? "shadow-sm" : "panel hover:border-border-hover hover:bg-surface-hover"}`}
        style={style}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`rounded-xl p-4 ${color ? "shadow-sm" : "panel"}`} style={style}>
      {content}
    </div>
  );
}
