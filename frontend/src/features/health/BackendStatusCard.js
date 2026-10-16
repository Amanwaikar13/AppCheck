"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Alert, Skeleton } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { formatTime } from "@/lib/format";

const DATABASE_TONES = {
  connected: "success",
  connecting: "warning",
  disconnecting: "warning",
  disconnected: "danger",
};

function Row({ icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="flex items-center gap-2.5 text-[13px] text-slate-600">
        <Icon name={icon} className="size-4 text-slate-400" />
        {label}
      </dt>
      <dd className="text-[13px] font-medium text-slate-900">{children}</dd>
    </div>
  );
}

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/** Live result of GET /health: API reachability, database state, environment. */
export default function BackendStatusCard({ id = "system-status" }) {
  const { isLoading, requestStatus, report, error, checkedAt, refresh } = useBackendHealth();

  return (
    <Card
      id={id}
      className="scroll-mt-24"
      title="System status"
      description="Connectivity between this app, the AppCheck API, and MongoDB."
      action={
        <Button variant="secondary" size="sm" onClick={refresh} disabled={isLoading}>
          <Icon name="refresh" className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Checking…" : "Check again"}
        </Button>
      }
    >
      <div aria-live="polite">
        {isLoading && !report && !error ? (
          <div role="status" aria-label="Checking backend status" className="space-y-3 py-1">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : (
          <dl className="-my-2.5 divide-y divide-slate-100">
            <Row icon="server" label="API server">
              {requestStatus === "failed" ? (
                <Badge dot tone="danger">Unreachable</Badge>
              ) : (
                <Badge dot tone="success">Online</Badge>
              )}
            </Row>
            <Row icon="database" label="Database">
              {report ? (
                <Badge dot tone={DATABASE_TONES[report.database.status] ?? "neutral"}>
                  {capitalize(report.database.status)}
                </Badge>
              ) : (
                <Badge dot>Unknown</Badge>
              )}
            </Row>
            <Row icon="shield" label="Overall">
              {report?.status === "healthy" ? (
                <Badge dot tone="success">Healthy</Badge>
              ) : (
                <Badge dot tone="danger">Unhealthy</Badge>
              )}
            </Row>
            {report && (
              <Row icon="settings" label="Environment">
                {capitalize(report.environment)}
              </Row>
            )}
            {checkedAt && (
              <Row icon="clock" label="Last checked">
                <span className="tabular-nums">{formatTime(checkedAt)}</span>
              </Row>
            )}
          </dl>
        )}

        {error && (
          <Alert tone="danger" title="API not reachable" className="mt-4">
            {error}
          </Alert>
        )}
      </div>
    </Card>
  );
}
