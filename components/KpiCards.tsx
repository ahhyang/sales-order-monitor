import { formatCompactCurrency, formatCurrency, formatInt } from "@/lib/format";
import type { OrdersSummary } from "@/lib/types";

interface Props {
  summary?: OrdersSummary;
  activeStatus: string;
  onStatus: (status: string) => void;
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");

export function KpiCards({ summary, activeStatus, onStatus }: Props) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading dashboard">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`h-[118px] animate-pulse rounded-xl border border-slate-200 bg-white ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`} />
        ))}
      </div>
    );
  }

  const s = summary;
  const completed = s.invoiced_orders + s.delivered_orders;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Card label="Total orders" value={formatInt(s.total_orders)} hint="All branches" />
      <Card
        label="Open / pending"
        value={formatInt(s.open_orders)}
        hint={`${pct(s.open_orders, s.total_orders)} of orders`}
        accent="bg-amber-500"
        onClick={() => onStatus("Open order")}
        active={activeStatus === "Open order"}
      />
      <Card
        label="Completed"
        value={formatInt(completed)}
        accent="bg-emerald-500"
        hint={
          <span className="flex flex-wrap gap-x-2">
            <Chip label="Invoiced" count={s.invoiced_orders} active={activeStatus === "Invoiced"} onClick={() => onStatus("Invoiced")} />
            <Chip label="Delivered" count={s.delivered_orders} active={activeStatus === "Delivered"} onClick={() => onStatus("Delivered")} />
          </span>
        }
      />
      <Card
        label="Cancelled"
        value={formatInt(s.cancelled_orders)}
        hint={`${pct(s.cancelled_orders, s.total_orders)} of orders`}
        accent="bg-rose-500"
        onClick={() => onStatus("Cancelled")}
        active={activeStatus === "Cancelled"}
      />
      <Card
        className="col-span-2 lg:col-span-1"
        label="Total order value"
        value={<span title={formatCurrency(s.total_order_value)}>{formatCompactCurrency(s.total_order_value)}</span>}
        hint={formatCurrency(s.total_order_value)}
      />
    </div>
  );
}

interface CardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

function Card({ label, value, hint, accent, className = "", onClick, active }: CardProps) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        {accent && <span aria-hidden className={`size-2 rounded-full ${accent}`} />}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </>
  );
  const base = `rounded-xl border bg-white p-4 text-left shadow-sm ${active ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"} ${className}`;

  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? "Clear this status filter" : `Show only ${label.toLowerCase()} orders`}
      className={`${base} flex flex-col justify-start transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900`}
    >
      {body}
    </button>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-slate-900 ${active ? "font-semibold text-slate-900 underline" : ""}`}
    >
      {label} {formatInt(count)}
    </button>
  );
}
