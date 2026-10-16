import Icon from "@/components/ui/Icon";
import SectionHeading from "./SectionHeading";

// Only controls that are implemented and covered by the automated test suite.
const CONTROLS = [
  { icon: "lock", title: "Protected sessions", body: "HttpOnly, SameSite=Strict session cookies that scripts cannot read. Signing out revokes every session for the account." },
  { icon: "shield", title: "CSRF protection", body: "State-changing requests must come from the AppCheck app, checked by origin and a required request header." },
  { icon: "user", title: "Per-account isolation", body: "Scan records are tied to their owner on the server. Other accounts cannot read them, even by guessing IDs." },
  { icon: "globe", title: "Safe scan targets", body: "Targets that point to localhost, private networks, or cloud metadata addresses, by URL or by DNS, are rejected. During a scan, traffic can reach only the submitted host." },
  { icon: "clock", title: "Rate limiting", body: "Limits on failed sign-ins, registrations, scan creation, and overall API use, with clear retry times." },
  { icon: "check", title: "Strict validation", body: "Every request is validated against a strict schema; unknown fields are rejected and errors never echo submitted values." },
];

export default function SecuritySection() {
  return (
    <section id="security" aria-labelledby="security-title" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="security-title" eyebrow="Security" title="Built with the controls a security tool should have">
          These protections are implemented and verified by automated tests. AppCheck does not claim any compliance
          certification.
        </SectionHeading>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map(({ icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Icon name={icon} className="size-[18px]" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-navy-950">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
