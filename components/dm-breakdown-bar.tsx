"use client";

/**
 * A single horizontal proportion bar showing how a campaign's matched
 * comments resolved: sent, skipped, failed. Same three colors as the
 * dashboard's DmActivityChart so the two read as one visual language.
 */

const SENT_COLOR = "#bd0d3b";
const SKIPPED_COLOR = "#1b6b6b";
const FAILED_COLOR = "#a0550f";

export default function DmBreakdownBar({
  sent,
  skipped,
  failed,
}: {
  sent: number;
  skipped: number;
  failed: number;
}) {
  const total = sent + skipped + failed;
  if (total === 0) {
    return (
      <p className="text-sm text-muted">No matched comments yet.</p>
    );
  }

  const segments = [
    { label: "Sent", value: sent, color: SENT_COLOR },
    { label: "Skipped", value: skipped, color: SKIPPED_COLOR },
    { label: "Failed", value: failed, color: FAILED_COLOR },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label} · {s.value} ({Math.round((s.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
