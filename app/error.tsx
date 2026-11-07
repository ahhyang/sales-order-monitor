"use client";

// Last-resort boundary: if a render bug slips through, show a recoverable screen instead of a blank page.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100/70 px-4">
      <div role="alert" className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-1 text-sm text-slate-500">The page hit an unexpected error. Your filters are kept in the URL.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reload view
        </button>
      </div>
    </main>
  );
}
