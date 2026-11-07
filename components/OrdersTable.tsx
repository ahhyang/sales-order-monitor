import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { daysOverdue } from "@/lib/orders";
import type { SortField } from "@/lib/query";
import type { SalesOrder } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  orders: SalesOrder[];
  sort: SortField | "";
  order: "asc" | "desc";
  onSort: (field: SortField) => void;
  onOpen: (id: string) => void;
  today: string;
}

const COLUMNS: { label: string; field?: SortField; align?: "right" }[] = [
  { label: "Order no.", field: "SalesId" },
  { label: "Customer" },
  { label: "Branch", field: "InventSiteId" },
  { label: "Order date", field: "CreatedDateTime1" },
  { label: "Status", field: "SalesStatus" },
  { label: "Amount", field: "HAR_TotalSOAmount", align: "right" },
];

export function OrdersTable({ orders, sort, order, onSort, onOpen, today }: Props) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              {COLUMNS.map((col) => {
                const active = col.field && sort === col.field;
                return (
                  <th
                    key={col.label}
                    scope="col"
                    aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined}
                    className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                  >
                    {col.field ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.field!)}
                        className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900 ${active ? "text-slate-900" : ""}`}
                      >
                        {col.label}
                        <SortIcon state={active ? order : undefined} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.SalesId} className="group cursor-pointer hover:bg-slate-50" onClick={() => onOpen(o.SalesId)}>
                <td className="px-4 py-3 font-mono text-[13px] font-medium text-slate-900">
                  {/* Real button so keyboard users can open the detail panel too */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(o.SalesId);
                    }}
                    className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-slate-900"
                  >
                    {o.SalesId}
                  </button>
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <div className="truncate font-medium text-slate-900" title={o.SalesName}>{o.SalesName}</div>
                  <div className="text-xs text-slate-500">{o.CustAccount}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{o.InventSiteId}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700" title={formatDateTime(o.CreatedDateTime1)}>
                  {formatDate(o.CreatedDateTime1)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={o.SalesStatus} />
                    <OverdueTag days={daysOverdue(o, today)} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                  {formatCurrency(o.HAR_TotalSOAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {orders.map((o) => (
          <li key={o.SalesId}>
            <button
              type="button"
              onClick={() => onOpen(o.SalesId)}
              className="block w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-medium text-slate-500">{o.SalesId}</div>
                  <div className="truncate font-medium text-slate-900">{o.SalesName}</div>
                </div>
                <div className="shrink-0 text-right font-semibold tabular-nums text-slate-900">
                  {formatCurrency(o.HAR_TotalSOAmount)}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <StatusBadge status={o.SalesStatus} />
                <OverdueTag days={daysOverdue(o, today)} />
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{o.InventSiteId}</span>
                <span>{formatDate(o.CreatedDateTime1)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function OverdueTag({ days }: { days: number }) {
  if (!days) return null;
  return (
    <span title={`Requested ship date passed ${days} days ago`} className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
      {days}d overdue
    </span>
  );
}

function SortIcon({ state }: { state?: "asc" | "desc" }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3">
      <path d="M6 2 9 5H3z" className={state === "asc" ? "fill-slate-900" : "fill-slate-300"} />
      <path d="M6 10 3 7h6z" className={state === "desc" ? "fill-slate-900" : "fill-slate-300"} />
    </svg>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading orders" className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
          <div className="hidden h-4 w-16 animate-pulse rounded bg-slate-100 sm:block" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
