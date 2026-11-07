"use client";

import { useEffect, useRef } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { SalesOrder } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { StatusBadge } from "./StatusBadge";

// Side panel showing one order, loaded from GET /api/orders/:id. Uses <dialog> for focus trapping and Esc.
export function OrderDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data, error, loading, retry } = useApi<{ data: SalesOrder }>(id ? `/api/orders/${encodeURIComponent(id)}` : null);
  const order = data?.data;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (id && !dialog.open) dialog.showModal();
    if (!id && dialog.open) dialog.close();
  }, [id]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="order-title"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sales order</p>
            <h2 id="order-title" className="font-mono text-lg font-semibold text-slate-900">{id}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order details"
            className="grid size-9 place-items-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="space-y-3" aria-busy="true" aria-label="Loading order">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />)}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p className="font-medium">Couldn’t load this order.</p>
              <p className="mt-1">{error}</p>
              <button type="button" onClick={retry} className="mt-3 font-medium underline">Try again</button>
            </div>
          )}

          {order && (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-slate-900">{order.SalesName}</p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={order.SalesStatus} />
                  {order.DocumentStatus && <span className="text-xs text-slate-500">Document: {order.DocumentStatus}</span>}
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center">
                <Amount label="Order total" value={order.HAR_TotalSOAmount} />
                <Amount label="Invoiced" value={order.HAR_InvoicedAmount} />
                <Amount label="Balance" value={order.HAR_BalanceAmount} />
              </dl>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Row label="Customer acct" value={order.CustAccount} />
                <Row label="Customer ref" value={order.CustomerRef} />
                <Row label="Branch / site" value={order.InventSiteId} />
                <Row label="Order date" value={formatDateTime(order.CreatedDateTime1)} />
                <Row label="Ship requested" value={formatDate(order.ShippingDateRequested)} />
                <Row label="Sales type" value={order.SalesType} />
                <Row label="Sales group" value={order.SalesGroup} />
                <Row label="Item group" value={order.DOT_ItemGroupId} />
                <Row label="Sales taker" value={order.SalesTaker} />
                <Row label="Sales district" value={order.SalesDistrictDescription} />
                <Row label="Delivery district" value={order.HAR_DeliveryDistrictDescription} />
                {order.DOT_SONotes && <Row label="Notes" value={order.DOT_SONotes} />}
              </dl>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value || "—"}</dd>
    </>
  );
}

function Amount({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(value)}</dd>
    </div>
  );
}
