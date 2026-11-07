const STYLES: Record<string, string> = {
  "Open order": "bg-amber-50 text-amber-800 ring-amber-600/20",
  Invoiced: "bg-sky-50 text-sky-800 ring-sky-600/20",
  Delivered: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  Cancelled: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

const DOTS: Record<string, string> = {
  "Open order": "bg-amber-500",
  Invoiced: "bg-sky-500",
  Delivered: "bg-emerald-500",
  Cancelled: "bg-rose-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STYLES[status] ?? "bg-slate-50 text-slate-700 ring-slate-500/20"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${DOTS[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}
