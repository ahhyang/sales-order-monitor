import { Suspense } from "react";
import { OrdersDashboard, type DashboardSeed } from "@/components/OrdersDashboard";
import { getFacets, listOrders } from "@/lib/service";
import { listUrl, readView } from "@/lib/view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Server-render the first page of results so data is in the initial HTML (no loading flash, faster first paint).
// The client then takes over and fetches through /api/* as filters change.
export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params.set(k, v);

  const url = listUrl(readView((k) => params.get(k)));
  const [list, facets] = await Promise.allSettled([
    listOrders(new URL(url, "http://local").searchParams),
    getFacets(),
  ]);

  // If the upstream is down, render the shell anyway; the client will show the error state with a retry.
  const seed: DashboardSeed = {
    listUrl: url,
    list: list.status === "fulfilled" ? list.value : undefined,
    meta: facets.status === "fulfilled" ? { facets: facets.value } : undefined,
  };

  return (
    <Suspense>
      <OrdersDashboard seed={seed} />
    </Suspense>
  );
}
