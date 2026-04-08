import Link from "next/link";
import { Card } from "@/components/ui/card";

type ActionAlert = {
  type: string;
  count: number;
  severity: "high" | "medium" | "low";
  message: string;
  href: string;
};

const ALERT_PRIORITY: Record<string, number> = {
  negative: 1,
  out: 2,
  low: 3,
  "no-sales": 4,
  pending: 5
};

const VISIBLE_ALERTS = 3;

export function ActionPanel({ alerts }: { alerts: ActionAlert[] }) {
  const orderedAlerts = [...alerts].sort(
    (a, b) => (ALERT_PRIORITY[a.type] ?? 999) - (ALERT_PRIORITY[b.type] ?? 999)
  );
  const visibleAlerts = orderedAlerts.slice(0, VISIBLE_ALERTS);
  const remainingCount = Math.max(orderedAlerts.length - visibleAlerts.length, 0);

  return (
    <Card className="dashboard-action-panel">
      <div className="dashboard-action-head">
        <h2 className="section-title">Action Required</h2>
      </div>

      {orderedAlerts.length ? (
        <div className="dashboard-action-list">
          {visibleAlerts.map((alert) => (
            <Link
              key={`${alert.type}-${alert.severity}`}
              href={alert.href}
              className={`dashboard-action-item severity-${alert.severity}`}
            >
              <span>{alert.message}</span>
            </Link>
          ))}
          {remainingCount > 0 ? (
            <span className="dashboard-action-more">+{remainingCount} more</span>
          ) : null}
        </div>
      ) : (
        <div className="dashboard-action-empty">All systems normal</div>
      )}
    </Card>
  );
}
