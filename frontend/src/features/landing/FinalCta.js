import { ButtonLink } from "@/components/ui/Button";

export default function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pb-20 sm:pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-card bg-navy-950 px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 id="cta-title" className="text-2xl font-semibold tracking-tight text-white">
              Start tracking your application security work
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy-300">
              Create an account to record URL and source code scan requests in your own private workspace.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/register" variant="inverse" className="h-10 px-5">
              Create account
            </ButtonLink>
            <ButtonLink href="/login" variant="inverse-outline" className="h-10 px-5">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
