import Badge from "@/components/ui/Badge";
import SectionHeading from "./SectionHeading";

const STEPS = [
  {
    title: "Create an account",
    body: "Register with your email. Every account has its own private workspace.",
  },
  {
    title: "Submit a URL",
    body: "Enter a web application you are authorized to test. AppCheck validates the target, including where its name resolves, before queuing it.",
  },
  {
    title: "OWASP ZAP scans it",
    body: "A background worker runs a passive baseline scan. Status updates live: queued, running, then completed or failed.",
  },
  {
    title: "Review findings",
    body: "See each issue with severity, affected URLs, and remediation, plus a baseline score. Reports are planned.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-20 border-y border-slate-200 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="how-title" eyebrow="How it works" title="From sign-up to real scan findings" />

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map(({ title, body, planned }, index) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${
                    planned ? "border border-dashed border-slate-300 text-slate-500" : "bg-navy-950 text-white"
                  }`}
                >
                  {index + 1}
                </span>
                <span aria-hidden="true" className="hidden h-px flex-1 bg-slate-200 lg:block" />
              </div>
              <h3 className="mt-4 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-navy-950">
                {title}
                {planned && <Badge variant="outline">Planned</Badge>}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
