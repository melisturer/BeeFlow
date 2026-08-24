import type { ContentPlanItem } from "@/lib/content-plan-types";

export function ContentPlanSummary({
  title,
  subtitle,
  items,
}: {
  title?: string;
  subtitle?: string;
  items: ContentPlanItem[];
}) {
  const hasTargets = items.some((i) => i.target > 0);

  return (
    <div className="rounded-[10px] border border-[var(--da-line)] bg-white/80 p-4">
      {title ? <p className="bf-panel-title text-base">{title}</p> : null}
      {subtitle ? (
        <p className="mt-1 text-sm text-[var(--da-muted)]">{subtitle}</p>
      ) : null}
      <div className={`grid gap-2 sm:grid-cols-4 ${title ? "mt-3" : ""}`}>
        {items.map((item) => {
          const over = item.target > 0 && item.done >= item.target;
          const pct =
            item.target > 0
              ? Math.min(100, Math.round((item.done / item.target) * 100))
              : 0;
          return (
            <div
              key={item.type}
              className="rounded-[5px] border border-[var(--da-line)] bg-[var(--da-bg,#fafafa)] px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--da-muted)]">
                  {item.label}
                </span>
                <span
                  className={`font-display text-lg font-extrabold ${
                    over ? "text-[var(--da-purple)]" : "text-[var(--da-ink)]"
                  }`}
                >
                  {item.done}
                  {item.target > 0 ? (
                    <span className="text-sm font-semibold text-[var(--da-muted)]">
                      /{item.target}
                    </span>
                  ) : null}
                </span>
              </div>
              {item.target > 0 ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/8">
                  <div
                    className="h-full rounded-full bg-[var(--da-yellow)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--da-muted)]">
                  Hedef yok
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!hasTargets ? (
        <p className="mt-3 text-xs text-[var(--da-muted)]">
          Hedef ve dönem görev eklerken girilir.
        </p>
      ) : null}
    </div>
  );
}
