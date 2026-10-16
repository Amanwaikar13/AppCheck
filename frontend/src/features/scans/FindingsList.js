"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import SeverityBadge from "@/components/ui/SeverityBadge";

const isHttpUrl = (value) => /^https?:\/\//i.test(value);

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h4>
      <div className="mt-1.5 text-[13px] leading-6 text-slate-700">{children}</div>
    </div>
  );
}

/** One finding: a summary row that expands to the scanner's details. */
function FindingRow({ finding }) {
  const [open, setOpen] = useState(false);
  const panelId = `finding-${finding.id}`;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
      >
        <span className="w-24 shrink-0 pt-px">
          <SeverityBadge severity={finding.severity} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-slate-900">{finding.title}</span>
          {finding.affectedUrl && (
            <span className="mt-0.5 block truncate font-mono text-[12px] text-slate-500">{finding.affectedUrl}</span>
          )}
        </span>
        <span className="hidden shrink-0 text-xs text-slate-500 tabular-nums sm:block">
          {finding.occurrences} {finding.occurrences === 1 ? "occurrence" : "occurrences"}
        </span>
        <Icon name={open ? "chevronUp" : "chevronDown"} className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:pl-32">
          {finding.description && (
            <Section title="Description">
              <p className="whitespace-pre-line">{finding.description}</p>
            </Section>
          )}
          {finding.remediation && (
            <Section title="Remediation">
              <p className="whitespace-pre-line">{finding.remediation}</p>
            </Section>
          )}
          {finding.instances.length > 0 && (
            <Section title={`Locations (${finding.instances.length} of ${finding.occurrences})`}>
              <ul className="space-y-1.5">
                {finding.instances.map((instance, i) => (
                  <li key={`${instance.url}-${i}`} className="min-w-0 font-mono text-[12px] break-all text-slate-700">
                    <span className="text-slate-400">{instance.method || "GET"} </span>
                    {instance.url}
                    {instance.param && <span className="text-slate-500"> · param {instance.param}</span>}
                    {instance.evidence && (
                      <span className="mt-0.5 block text-slate-500">evidence: {instance.evidence}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Classification">
            <p>
              Source: OWASP ZAP rule {finding.ruleId}
              {finding.confidence && <> · confidence {finding.confidence}</>}
              {finding.cweId && (
                <>
                  {" · "}
                  <a
                    href={`https://cwe.mitre.org/data/definitions/${finding.cweId}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-700 hover:underline"
                  >
                    CWE-{finding.cweId}
                  </a>
                </>
              )}
            </p>
          </Section>
          {finding.references.filter(isHttpUrl).length > 0 && (
            <Section title="References">
              <ul className="space-y-1">
                {finding.references.filter(isHttpUrl).map((url) => (
                  <li key={url} className="break-all">
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-700 hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </li>
  );
}

export default function FindingsList({ findings }) {
  return (
    <ul className="divide-y divide-slate-100 border-t border-slate-200">
      {findings.map((finding) => (
        <FindingRow key={finding.id} finding={finding} />
      ))}
    </ul>
  );
}
