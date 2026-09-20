"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

type Props = {
  activityMap: Record<string, number>;
  /** Number of calendar weeks to show (default 52). */
  weeks?: number;
  /** Fixed end date for deterministic previews and tests. */
  endDate?: Date;
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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activityLabel(date: Date, count: number): string {
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${count} activit${count === 1 ? "y" : "ies"} on ${formatted}`;
}

type HeatmapCell = { date: Date; key: string; count: number; future: boolean };

let clientEndDate: Date | null = null;
const noopSubscribe = () => () => {};
const getClientEndDate = () => {
  clientEndDate ??= new Date();
  return clientEndDate;
};
const getServerEndDate = () => null;

export function ActivityHeatmap(props: Props) {
  const generatedEndDate = useSyncExternalStore(noopSubscribe, getClientEndDate, getServerEndDate);
  const resolvedEndDate = props.endDate ?? generatedEndDate;

  if (!resolvedEndDate) {
    return <div className="min-h-48 animate-pulse rounded-2xl bg-surface-hover" role="status" aria-label="Preparing activity calendar" />;
  }

  return <ActivityHeatmapGrid {...props} endDate={resolvedEndDate} />;
}

function ActivityHeatmapGrid({ activityMap, weeks = 52, endDate }: Props & { endDate: Date }) {
  const tooltipId = useId();
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ key: string; text: string; x: number; y: number } | null>(null);

  const { grid, monthMarkers, visibleCells, activeDays, totalActivities, todayKey } = useMemo(() => {
    const today = new Date(endDate);
    today.setHours(0, 0, 0, 0);
    const safeWeeks = Math.max(1, Math.min(53, weeks));
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - startDate.getDay() - ((safeWeeks - 1) * 7));

    const columns: HeatmapCell[][] = [];
    const markers: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;

    for (let column = 0; column < safeWeeks; column += 1) {
      const week: HeatmapCell[] = [];
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + (column * 7) + day);
        const key = formatDate(date);
        week.push({ date, key, count: activityMap[key] ?? 0, future: date > today });
      }
      const firstVisible = week.find((cell) => !cell.future);
      if (firstVisible && firstVisible.date.getMonth() !== lastMonth) {
        lastMonth = firstVisible.date.getMonth();
        markers.push({ label: MONTH_LABELS[lastMonth], col: column });
      }
      columns.push(week);
    }

    const visible = columns.flat().filter((cell) => !cell.future);
    const active = visible.filter((cell) => cell.count > 0).sort((a, b) => b.date.getTime() - a.date.getTime());
    return {
      grid: columns,
      monthMarkers: markers,
      visibleCells: visible,
      activeDays: active,
      totalActivities: visible.reduce((sum, cell) => sum + cell.count, 0),
      todayKey: formatDate(today),
    };
  }, [activityMap, endDate, weeks]);

  const activeFocusKey = focusKey ?? todayKey;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth;
  }, [todayKey, weeks]);

  const showTooltip = (target: HTMLButtonElement, cell: HeatmapCell) => {
    const rect = target.getBoundingClientRect();
    setTooltip({
      key: cell.key,
      text: activityLabel(cell.date, cell.count),
      x: Math.max(140, Math.min(window.innerWidth - 140, rect.left + 6)),
      y: Math.min(window.innerHeight - 64, rect.bottom + 8),
    });
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, cell: HeatmapCell) => {
    const deltas: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    let nextIndex: number | null = null;
    const currentIndex = visibleCells.findIndex((candidate) => candidate.key === cell.key);
    if (event.key in deltas) nextIndex = currentIndex + deltas[event.key];
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visibleCells.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = visibleCells[Math.max(0, Math.min(visibleCells.length - 1, nextIndex))];
    setFocusKey(next.key);
    cellRefs.current.get(next.key)?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">{totalActivities}</span>{" "}
          activit{totalActivities === 1 ? "y" : "ies"} across the past {Math.min(53, Math.max(1, weeks))} weeks
        </p>
        <div className="flex items-center gap-1 text-[10px] text-text-secondary" aria-hidden>
          <span>Less</span>
          {[0, 1, 3, 6, 7].map((count) => (
            <span key={count} className={`inline-block h-2.5 w-2.5 rounded-[2px] ${intensityClass(count)}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <p className="sr-only" id={`${tooltipId}-instructions`}>
        Activity calendar. Use the arrow keys to inspect adjacent dates.
      </p>
      <div ref={scrollRef} className="relative overflow-x-auto pb-1" data-heatmap-scroll>
        <div className="min-w-[1280px]">
          <div className="relative flex h-4 pl-7" aria-hidden>
            {monthMarkers.map((marker) => (
              <span
                key={`${marker.label}-${marker.col}`}
                className="absolute text-[10px] text-text-secondary"
                style={{ left: `${28 + marker.col * 24}px` }}
              >
                {marker.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1" role="group" aria-describedby={`${tooltipId}-instructions`}>
            <div className="sticky left-0 z-20 flex flex-col gap-1 bg-surface-raised pr-1" aria-hidden data-heatmap-weekdays>
              {DAY_LABELS.map((label, index) => (
                <span key={index} className="flex h-5 w-5 items-center text-[9px] text-text-secondary">
                  {label}
                </span>
              ))}
            </div>

            {grid.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((cell) => cell.future ? (
                  <span key={cell.key} className="h-5 w-5 rounded bg-transparent" aria-hidden />
                ) : (
                  <button
                    key={cell.key}
                    ref={(node) => {
                      if (node) cellRefs.current.set(cell.key, node);
                      else cellRefs.current.delete(cell.key);
                    }}
                    type="button"
                    tabIndex={cell.key === activeFocusKey ? 0 : -1}
                    className={`h-5 w-5 rounded transition-[box-shadow,transform] hover:scale-110 focus:z-10 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background ${intensityClass(cell.count)}`}
                    aria-label={activityLabel(cell.date, cell.count)}
                    aria-describedby={tooltip?.key === cell.key ? tooltipId : undefined}
                    onFocus={(event) => {
                      setFocusKey(cell.key);
                      showTooltip(event.currentTarget, cell);
                    }}
                    onBlur={() => setTooltip(null)}
                    onPointerEnter={(event) => showTooltip(event.currentTarget, cell)}
                    onPointerDown={(event) => showTooltip(event.currentTarget, cell)}
                    onPointerLeave={() => setTooltip(null)}
                    onKeyDown={(event) => moveFocus(event, cell)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {tooltip ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-md border border-border bg-surface-raised px-2 py-1 text-center text-[10px] text-text-primary shadow-lg sm:whitespace-nowrap"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        ) : null}
      </div>

      {activeDays.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-text-secondary">
          No interview or submission activity is recorded in this period.
        </p>
      ) : (
        <details className="rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-text-primary">Review {activeDays.length} active day{activeDays.length === 1 ? "" : "s"}</summary>
          <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-text-secondary">
            {activeDays.map((cell) => (
              <li key={cell.key} className="flex justify-between gap-4">
                <time dateTime={cell.key}>{cell.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>
                <span>{cell.count} activit{cell.count === 1 ? "y" : "ies"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
