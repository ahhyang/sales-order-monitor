"use client";

import { useState } from "react";
import type { Facet } from "@/lib/types";
import { datePresets } from "@/lib/view";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  site: string;
  onSite: (value: string) => void;
  from: string;
  to: string;
  onDates: (range: { from: string; to: string }) => void;
  overdue: boolean;
  onOverdue: (on: boolean) => void;
  today: string;
  statuses: Facet[];
  sites: Facet[];
  facetsError?: string;
  hasFilters: boolean;
  onClear: () => void;
}

const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:bg-slate-50";
const labelText = "mb-1 block text-xs font-medium text-slate-600";

export function Filters(props: Props) {
  const { search, onSearch, status, onStatus, site, onSite, statuses, sites, facetsError, hasFilters, onClear } = props;
  const { from, to, onDates, overdue, onOverdue, today } = props;

  const presets = datePresets(today);
  const matched = presets.find((p) => p.from === from && p.to === to)?.id;
  // "Custom" with no dates yet has to be remembered locally; otherwise the choice is derived from the URL.
  const [wantsCustom, setWantsCustom] = useState(false);
  const dateMode = matched ?? (from || to || wantsCustom ? "custom" : "all");

  const onDateMode = (mode: string) => {
    setWantsCustom(mode === "custom");
    if (mode === "all") onDates({ from: "", to: "" });
    const preset = presets.find((p) => p.id === mode);
    if (preset) onDates({ from: preset.from, to: preset.to });
  };

  return (
    <div className="space-y-3 border-b border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
        <label className="block">
          <span className={labelText}>Search</span>
          <div className="relative">
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-slate-400">
              <path d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65a.75.75 0 1 1-1.06 1.06l-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Order no., customer, PO ref…"
              title="Searches order no., customer name, account, PO ref and sales taker"
              maxLength={100}
              className={`${control} pl-9`}
            />
          </div>
        </label>

        <label className="block">
          <span className={labelText}>Status</span>
          <select value={status} onChange={(e) => onStatus(e.target.value)} className={control} disabled={!statuses.length && !status}>
            <option value="">All statuses</option>
            {statuses.map((f) => (
              <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
            ))}
            {/* Keep a URL-provided value selectable even before facets load */}
            {status && !statuses.some((f) => f.value === status) && <option value={status}>{status}</option>}
          </select>
        </label>

        <label className="block">
          <span className={labelText}>Branch / site</span>
          <select value={site} onChange={(e) => onSite(e.target.value)} className={control} disabled={!sites.length && !site}>
            <option value="">All branches</option>
            {sites.map((f) => (
              <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
            ))}
            {site && !sites.some((f) => f.value === site) && <option value={site}>{site}</option>}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full sm:w-44">
          <span className={labelText}>Order date</span>
          <select value={dateMode} onChange={(e) => onDateMode(e.target.value)} className={control}>
            <option value="all">All dates</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </label>

        {dateMode === "custom" && (
          <>
            <label className="block w-[calc(50%-6px)] sm:w-40">
              <span className={labelText}>From</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => onDates({ from: e.target.value, to })} className={control} />
            </label>
            <label className="block w-[calc(50%-6px)] sm:w-40">
              <span className={labelText}>To</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => onDates({ from, to: e.target.value })} className={control} />
            </label>
          </>
        )}

        <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm has-[:checked]:border-amber-700 has-[:checked]:bg-amber-50 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-slate-900">
          <input type="checkbox" checked={overdue} onChange={(e) => onOverdue(e.target.checked)} className="size-4 accent-amber-700" />
          Overdue only
        </label>

        <button
          type="button"
          onClick={() => {
            setWantsCustom(false);
            onClear();
          }}
          disabled={!hasFilters}
          className="h-[38px] rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:invisible focus-visible:outline-2 focus-visible:outline-slate-900 sm:ml-auto"
        >
          Clear filters
        </button>
      </div>

      {facetsError && <p className="text-xs text-amber-700">Filter options couldn’t load ({facetsError}). Search still works.</p>}
    </div>
  );
}
