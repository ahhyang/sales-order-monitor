import { Suspense } from "react";
import { OrdersDashboard } from "@/components/OrdersDashboard";

export default function Home() {
  // useSearchParams() in the dashboard needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <OrdersDashboard />
    </Suspense>
  );
}
