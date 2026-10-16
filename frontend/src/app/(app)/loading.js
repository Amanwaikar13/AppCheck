import { Skeleton } from "@/components/ui/Feedback";

/** Route transition placeholder shaped like a page: header, then content cards. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <div className="space-y-2 border-b border-slate-200 pb-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-48 rounded-card" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card lg:col-span-2" />
      </div>
    </div>
  );
}
