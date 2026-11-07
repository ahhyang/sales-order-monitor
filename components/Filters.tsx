import type { Facet } from "@/lib/types";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  site: string;
  onSite: (value: string) => void;
  statuses: Facet[];
  sites: Facet[];
  facetsError?: string;
  hasFilters: boolean;
  onClear: () => void;
}

const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:bg-slate-50";

export function Filters(props: Props) {
  const { search, onSearch, status, onStatus, site, onSite, statuses, sites, facetsError, hasFilters, onClear } = props;

  return (
    <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_180px_160px_auto] sm:items-end">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Search</span>
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
        <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
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
        <span className="mb-1 block text-xs font-medium text-slate-600">Branch / site</span>
        <select value={site} onChange={(e) => onSite(e.target.value)} className={control} disabled={!sites.length && !site}>
          <option value="">All branches</option>
          {sites.map((f) => (
            <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
          ))}
          {site && !sites.some((f) => f.value === site) && <option value={site}>{site}</option>}
        </select>
      </label>

      <button
        type="button"
        onClick={onClear}
        disabled={!hasFilters}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:invisible focus-visible:outline-2 focus-visible:outline-slate-900"
      >
        Clear filters
      </button>

      {facetsError && (
        <p className="text-xs text-amber-700 sm:col-span-4">Filter options couldn’t load ({facetsError}). Search still works.</p>
      )}
    </div>
  );
}
