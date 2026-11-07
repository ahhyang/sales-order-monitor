import { formatCompactCurrency, formatCurrency, formatInt } from "@/lib/format";
import type { Insights as InsightsData } from "@/lib/orders";
import { monthRange } from "@/lib/view";

interface Props {
  data?: InsightsData;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  site: string;
  from: string;
  to: string;
  overdueOnly: boolean;
  onSite: (site: string) => void;
  onMonth: (range: { from: string; to: string } | null) => void;
  onOverdue: (on: boolean) => void;
  onOpenOrder: (id: string) => void;
}

// Sequential single-hue ramp (light -> dark) for aging severity.
const AGING_FILLS = ["bg-amber-300", "bg-amber-500", "bg-amber-700", "bg-amber-900"];
const monthLabel = new Intl.DateTimeFormat("en-MY", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });

export function Insights(props: Props) {
  const { data, loading, error, onRetry } = props;

  if (!data) {
    return (
      <div className="grid gap-3 lg:grid-cols-3" aria-busy={!error} aria-label="Loading insights">
        {error ? (
          <div role="alert" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 lg:col-span-3">
            Insights couldn’t load ({error}).{" "}
            <button type="button" onClick={onRetry} className="font-medium text-slate-900 underline">Try again</button>
          </div>
        ) : (
          Array.from({ length: 3 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />)
        )}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 lg:grid-cols-3 ${loading ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
      <OverduePanel {...props} data={data} />
      <BranchPanel {...props} data={data} />
      <TrendPanel {...props} data={data} />
    </div>
  );
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function OverduePanel({ data, overdueOnly, onOverdue, onOpenOrder }: Props & { data: InsightsData }) {
  const { overdue } = data;
  const max = Math.max(1, ...overdue.buckets.map((b) => b.count));

  return (
    <Panel
      title="Overdue open orders"
      subtitle={`Past requested ship date · as of ${data.asOf}`}
      action={
        <button
          type="button"
          onClick={() => onOverdue(!overdueOnly)}
          aria-pressed={overdueOnly}
          disabled={!overdue.count && !overdueOnly}
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-40 ${
            overdueOnly ? "border-amber-700 bg-amber-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {overdueOnly ? "Showing overdue" : "Show in table"}
        </button>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-slate-900">{formatInt(overdue.count)}</span>
        <span className="text-sm text-slate-500">orders · {formatCurrency(overdue.value)}</span>
      </div>

      {overdue.count === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nothing overdue for the current filters.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5" aria-label="Overdue orders by age">
            {overdue.buckets.map((b, i) => (
              <li key={b.label} className="grid grid-cols-[76px_1fr_auto] items-center gap-2 text-xs">
                <span className="text-slate-600">{b.label}</span>
                <span className="h-2.5 rounded-r bg-slate-100">
                  <span
                    className={`block h-full rounded-r ${AGING_FILLS[i]}`}
                    style={{ width: `${(b.count / max) * 100}%`, minWidth: b.count ? 3 : 0 }}
                    title={`${b.label}: ${b.count} orders, ${formatCurrency(b.value)}`}
                  />
                </span>
                <span className="w-8 text-right tabular-nums text-slate-900">{formatInt(b.count)}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-medium text-slate-500">Longest waiting</p>
          <ul className="mt-1 divide-y divide-slate-100 text-xs">
            {overdue.oldest.map((o) => (
              <li key={o.SalesId}>
                <button
                  type="button"
                  onClick={() => onOpenOrder(o.SalesId)}
                  className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-slate-500">{o.SalesId}</span>{" "}
                    <span className="text-slate-900">{o.SalesName}</span>
                  </span>
                  <span className="shrink-0 font-medium text-amber-800">{o.days}d</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function BranchPanel({ data, site, onSite }: Props & { data: InsightsData }) {
  const max = Math.max(1, ...data.byBranch.map((b) => b.value));
  return (
    <Panel title="Order value by branch" subtitle="Click a branch to filter">
      {data.byBranch.length === 0 ? (
        <p className="text-sm text-slate-500">No orders for the current filters.</p>
      ) : (
        <ul className="space-y-1">
          {data.byBranch.map((b) => {
            const active = site.toLowerCase() === b.site.toLowerCase();
            const dim = site && !active;
            return (
              <li key={b.site}>
                <button
                  type="button"
                  onClick={() => onSite(active ? "" : b.site)}
                  aria-pressed={active}
                  aria-label={`${b.site}: ${formatCurrency(b.value)} across ${b.count} orders. ${active ? "Clear branch filter" : "Filter to this branch"}`}
                  className="group relative grid w-full grid-cols-[48px_1fr_64px] items-center gap-2 rounded py-1 text-left text-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900"
                >
                  <span className="font-mono text-slate-700">{b.site}</span>
                  <span className="h-3 rounded-r bg-slate-100">
                    <span
                      className={`block h-full rounded-r ${dim ? "bg-slate-300" : "bg-slate-700 group-hover:bg-slate-900"}`}
                      style={{ width: `${(b.value / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-slate-900">{formatCompactCurrency(b.value)}</span>
                  <Tooltip>{`${b.site} · ${formatCurrency(b.value)} · ${formatInt(b.count)} orders`}</Tooltip>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TrendPanel({ data, from, to, onMonth }: Props & { data: InsightsData }) {
  const max = Math.max(1, ...data.byMonth.map((m) => m.value));
  const selected = data.byMonth.find((m) => {
    const r = monthRange(m.month);
    return r.from === from && r.to === to;
  })?.month;

  return (
    <Panel title="Monthly order value" subtitle="By order date · click a month to filter">
      {data.byMonth.length === 0 ? (
        <p className="text-sm text-slate-500">No orders for the current filters.</p>
      ) : (
        <div className="flex h-44 items-end gap-1.5 border-b border-slate-200 pt-6">
          {data.byMonth.map((m) => {
            const d = new Date(`${m.month}-01T00:00:00Z`);
            const active = selected === m.month;
            const dim = selected && !active;
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => onMonth(active ? null : monthRange(m.month))}
                aria-pressed={active}
                aria-label={`${monthLong.format(d)}: ${formatCurrency(m.value)} across ${m.count} orders`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end focus-visible:outline-2 focus-visible:outline-slate-900"
              >
                <span
                  className={`w-full max-w-10 rounded-t ${dim ? "bg-slate-300" : "bg-slate-700 group-hover:bg-slate-900"}`}
                  style={{ height: `${(m.value / max) * 100}%`, minHeight: 3 }}
                />
                <span className="absolute -bottom-5 text-[11px] text-slate-500">{monthLabel.format(d)}</span>
                <Tooltip>{`${monthLong.format(d)} · ${formatCurrency(m.value)} · ${formatInt(m.count)} orders`}</Tooltip>
              </button>
            );
          })}
        </div>
      )}
      <div className="h-5" />
    </Panel>
  );
}

function Tooltip({ children }: { children: string }) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block group-focus-visible:block"
    >
      {children}
    </span>
  );
}
