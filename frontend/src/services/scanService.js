import { apiClient } from "./apiClient";

// Scan records only: the API stores scan requests, but no scanner runs yet.
// Every record therefore stays "queued" with no score or findings.

export async function createUrlScan({ url }) {
  const { data } = await apiClient.post("/scans/url", { url });
  return data;
}

export async function createSourceScan({ projectName }) {
  const { data } = await apiClient.post("/scans/source", { projectName });
  return data;
}

/** One page of the user's scans. Only defined, non-empty params are sent. */
export async function listScans({ page, limit, type, status, sort } = {}) {
  const params = Object.fromEntries(
    Object.entries({ page, limit, type, status, sort }).filter(([, value]) => value)
  );
  const { data } = await apiClient.get("/scans", { params });
  return data;
}

export async function getScan(id) {
  const { data } = await apiClient.get(`/scans/${encodeURIComponent(id)}`);
  return data.scan;
}

/** Findings of one scan (owner only), most severe first. */
export async function getScanFindings(id) {
  const { data } = await apiClient.get(`/scans/${encodeURIComponent(id)}/findings`);
  return data;
}

/** Dashboard data: counts by status, five newest scans, open findings per severity. */
export async function getScanSummary() {
  const { data } = await apiClient.get("/scans/summary");
  return data;
}

/** Whether the URL scanner can actually run on the server right now. */
export async function getScannerStatus() {
  const { data } = await apiClient.get("/scanner/status");
  return data;
}
