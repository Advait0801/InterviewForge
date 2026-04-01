"use client";

import { useMemo, useState } from "react";

type Props = {
  activityMap: Record<string, number>;
  /** Number of weeks to show (default 52) */
  weeks?: number;
};

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function intensityClass(count: number): string {
  if (count === 0) return "bg-surface-hover";
  if (count === 1) return "bg-accent/25";
  if (count <= 3) return "bg-accent/50";
  if (count <= 6) return "bg-accent/75";
  return "bg-accent";
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ActivityHeatmap({ activityMap, weeks = 52 }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const { grid, monthMarkers } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = weeks * 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const cols: Array<Array<{ date: Date; key: string; count: number }>> = [];
    const markers: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;

    const cursor = new Date(startDate);
    let col = 0;

    while (cursor <= today || cols.length < weeks) {
      const week: Array<{ date: Date; key: string; count: number }> = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(cursor);
        const key = formatDate(d);
        week.push({ date: d, key, count: activityMap[key] ?? 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (week[0].date.getMonth() !== lastMonth) {
        lastMonth = week[0].date.getMonth();
        markers.push({ label: MONTH_LABELS[lastMonth], col });
      }
      cols.push(week);
      col++;
      if (col > weeks + 2) break;
    }

    return { grid: cols, monthMarkers: markers };
  }, [activityMap, weeks]);

  const totalActivities = Object.values(activityMap).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          {totalActivities} contribution{totalActivities !== 1 ? "s" : ""} in the last year
        </p>
        <div className="flex items-center gap-1 text-[10px] text-text-secondary">
          <span>Less</span>
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-surface-hover" />
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-accent/25" />
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-accent/50" />
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-accent/75" />
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span>More</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        {/* Month labels */}
        <div className="flex pl-7" style={{ gap: 0 }}>
          {monthMarkers.map((m, i) => (
            <span
              key={i}
              className="text-[10px] text-text-secondary"
              style={{
                position: "absolute",
                left: `${28 + m.col * 14}px`,
                top: 0,
              }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="flex gap-[2px] pt-4" style={{ position: "relative" }}>
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[2px] pr-1">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="flex h-[12px] w-5 items-center text-[9px] text-text-secondary">
                {label}
              </span>
            ))}
          </div>

          {/* Grid */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((cell) => (
                <div
                  key={cell.key}
                  className={`h-[12px] w-[12px] rounded-[2px] transition-colors ${intensityClass(cell.count)}`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const parentRect = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                    setTooltip({
                      text: `${cell.count} activit${cell.count !== 1 ? "ies" : "y"} on ${cell.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
                      x: rect.left - (parentRect?.left ?? 0) + 6,
                      y: rect.top - (parentRect?.top ?? 0) - 28,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-surface border border-border px-2 py-1 text-[10px] text-text-primary shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y, transform: "translateX(-50%)" }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
