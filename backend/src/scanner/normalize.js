/*
 * Converts an OWASP ZAP JSON report (zap-baseline.py -J) into AppCheck
 * findings. Only data present in the report is used; nothing is invented.
 */

// ZAP riskcode -> AppCheck severity. ZAP has no "critical" level, so baseline
// findings are never Critical.
const RISK_TO_SEVERITY = { 3: 'high', 2: 'medium', 1: 'low', 0: 'info' };
const CONFIDENCE = { 0: 'false-positive', 1: 'low', 2: 'medium', 3: 'high', 4: 'confirmed' };

export const MAX_FINDINGS_PER_SCAN = 200;
export const MAX_INSTANCES_PER_FINDING = 10;
const LIMITS = { title: 200, description: 4000, remediation: 4000, url: 2048, evidence: 300, param: 200 };

/** Removes HTML tags/entities ZAP puts in descriptions; collapses whitespace. */
export function toPlainText(value, max) {
  const text = String(value ?? '')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Evidence is the matched text from the target. Keep it short, and mask
 * anything that looks like a secret (cookie values, tokens, long opaque
 * strings) so findings never store credentials from the target.
 */
export function safeEvidence(value) {
  let text = toPlainText(value, LIMITS.evidence * 2);
  text = text
    .replace(/((?:set-)?cookie:\s*[^=;\s]+=)[^;\s]+/gi, '$1[redacted]')
    .replace(/((?:authorization|api[-_]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^\s"';,]+/gi, '$1[redacted]')
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[redacted]');
  return text.length > LIMITS.evidence ? `${text.slice(0, LIMITS.evidence - 1)}…` : text;
}

const httpUrls = (text) =>
  [...String(text ?? '').matchAll(/https?:\/\/[^\s<>"']+/g)].map((m) => m[0]).filter((u) => u.length <= 500);

const toInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Returns normalized finding objects (without owner/scan IDs), deduplicated per alert rule. */
export function normalizeZapReport(report) {
  const sites = Array.isArray(report?.site) ? report.site : [];
  const byFingerprint = new Map();

  for (const site of sites) {
    for (const alert of Array.isArray(site?.alerts) ? site.alerts : []) {
      const severity = RISK_TO_SEVERITY[Number(alert.riskcode)];
      if (!severity) continue;
      const ruleId = String(alert.alertRef ?? alert.pluginid ?? '').slice(0, 40);
      const title = toPlainText(alert.alert ?? alert.name, LIMITS.title);
      if (!ruleId || !title) continue;
      const fingerprint = `zap:${ruleId}`;

      const instances = (Array.isArray(alert.instances) ? alert.instances : []).map((i) => ({
        url: String(i.uri ?? '').slice(0, LIMITS.url),
        method: String(i.method ?? '').slice(0, 10),
        param: String(i.param ?? '').slice(0, LIMITS.param),
        evidence: safeEvidence(i.evidence),
      }));
      const occurrences = toInt(alert.count) ?? instances.length;

      const existing = byFingerprint.get(fingerprint);
      if (existing) {
        existing.instances.push(...instances);
        existing.occurrences += occurrences;
        continue;
      }
      byFingerprint.set(fingerprint, {
        source: 'zap',
        ruleId,
        fingerprint,
        title,
        severity,
        confidence: CONFIDENCE[Number(alert.confidence)] ?? null,
        description: toPlainText(alert.desc, LIMITS.description),
        remediation: toPlainText(alert.solution, LIMITS.remediation),
        references: httpUrls(alert.reference).slice(0, 5),
        cweId: toInt(alert.cweid),
        wascId: toInt(alert.wascid),
        instances,
        occurrences,
      });
    }
  }

  return [...byFingerprint.values()]
    .map((finding) => {
      // Unique by URL+method+param, capped.
      const seen = new Set();
      const instances = finding.instances.filter((i) => {
        const key = `${i.method} ${i.url} ${i.param}`;
        if (seen.has(key) || !i.url) return false;
        seen.add(key);
        return true;
      });
      return {
        ...finding,
        instances: instances.slice(0, MAX_INSTANCES_PER_FINDING),
        affectedUrl: instances[0]?.url ?? null,
        occurrences: Math.max(finding.occurrences, instances.length),
      };
    })
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, MAX_FINDINGS_PER_SCAN);
}

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

export function countBySeverity(findings) {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const { severity } of findings) counts[severity] += 1;
  return counts;
}

/**
 * Baseline score, 0-100. Deterministic and documented (docs/SECURITY.md):
 *   100 - (25 x critical + 10 x high + 4 x medium + 1 x low), floored at 0.
 * Each count is the number of distinct alert rules at that severity, not the
 * number of affected URLs. Informational findings do not lower the score.
 * It reflects one passive baseline scan only, not overall application security.
 */
export const SCORE_WEIGHTS = Object.freeze({ critical: 25, high: 10, medium: 4, low: 1, info: 0 });

export function calculateBaselineScore(counts) {
  const penalty = SEVERITY_ORDER.reduce((sum, s) => sum + SCORE_WEIGHTS[s] * (counts[s] ?? 0), 0);
  return Math.max(0, 100 - penalty);
}
