const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const compactCurrency = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  notation: "compact",
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("en-MY");

// Orders are timestamped in UTC; show them in Sabah local time.
const TIME_ZONE = "Asia/Kuching";
const date = new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateTime = new Intl.DateTimeFormat("en-MY", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export const formatCurrency = (value: number | undefined) =>
  typeof value === "number" ? currency.format(value) : "—";
export const formatCompactCurrency = (value: number) => compactCurrency.format(value);
export const formatInt = (value: number) => integer.format(value);

function safe(fmt: Intl.DateTimeFormat, iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fmt.format(d);
}
export const formatDate = (iso: string | undefined) => safe(date, iso);
export const formatDateTime = (iso: string | undefined) => safe(dateTime, iso);
