import { Skeleton } from "@/components/ui/Feedback";

/** Heading and container for the sign-in and registration forms. */
export default function AuthCard({ title, description, children }) {
  return (
    <section className="rounded-card border border-slate-200 bg-white p-6 shadow-card sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Placeholder while a form that reads search params renders on the client. */
export function AuthFormSkeleton({ fields = 2 }) {
  return (
    <div aria-hidden="true" className="space-y-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
