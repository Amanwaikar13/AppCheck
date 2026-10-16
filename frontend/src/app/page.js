import { ButtonLink } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Features from "@/features/landing/Features";
import FinalCta from "@/features/landing/FinalCta";
import HowItWorks from "@/features/landing/HowItWorks";
import LandingFooter from "@/features/landing/LandingFooter";
import LandingHeader from "@/features/landing/LandingHeader";
import ProductPreview from "@/features/landing/ProductPreview";
import SecuritySection from "@/features/landing/SecuritySection";

export const metadata = {
  title: { absolute: "AppCheck · Web application security and code quality" },
  description:
    "AppCheck helps teams find security issues in the web applications and source code they are authorized to test.",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <LandingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <section aria-labelledby="hero-title" className="overflow-hidden border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
                Web application security &amp; code quality analyzer
              </p>
              <h1 id="hero-title" className="mt-6 text-4xl font-semibold tracking-tight text-balance text-navy-950 sm:text-5xl">
                Find security issues before they reach production.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-pretty text-slate-600 sm:text-lg sm:leading-8">
                AppCheck runs passive OWASP ZAP baseline scans against the web applications you are
                authorized to test and turns the results into prioritized findings with remediation
                guidance. Source code analysis is in development.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/register" className="h-10 px-5">
                  Get started
                  <Icon name="arrowRight" className="size-4" />
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" className="h-10 px-5">
                  Sign in
                </ButtonLink>
              </div>
              <p className="mt-4 text-[13px] text-slate-500">
                <a
                  href="#how-it-works"
                  className="rounded font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  See how it works
                </a>
              </p>
            </div>

            <div className="mt-14 sm:mt-16">
              <ProductPreview />
            </div>
          </div>
        </section>

        <Features />
        <HowItWorks />
        <SecuritySection />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  );
}
