import { formatInt } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/query";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

export function Pagination({ page, pageSize, total, totalPages, onPage, onPageSize }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite">
        Showing <strong className="font-medium text-slate-900">{formatInt(from)}–{formatInt(to)}</strong> of{" "}
        <strong className="font-medium text-slate-900">{formatInt(total)}</strong> orders
      </p>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-slate-900"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <PageButton label="First page" disabled={page <= 1} onClick={() => onPage(1)}>«</PageButton>
          <PageButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</PageButton>
          <span className="px-2 tabular-nums">
            {formatInt(page)} / {formatInt(Math.max(totalPages, 1))}
          </span>
          <PageButton label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</PageButton>
          <PageButton label="Last page" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>»</PageButton>
        </nav>
      </div>
    </div>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md border border-slate-300 bg-white text-base leading-none text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-slate-900"
    >
      {children}
    </button>
  );
}
