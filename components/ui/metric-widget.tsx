import { Card } from "@/components/ui/card";

type MetricWidgetProps = {
  label: string;
  value: string;
  trend?: string;
  trendDir?: "up" | "down";
};

function Sparkline() {
  return (
    <svg className="sparkline" viewBox="0 0 100 30" role="img" aria-label="trend">
      <path d="M1 19 C 12 10, 22 21, 34 14 C 48 6, 56 20, 68 12 C 80 5, 91 11, 99 8" />
    </svg>
  );
}

export function MetricWidget({ label, value, trend, trendDir = "up" }: MetricWidgetProps) {
  const trendClass = trendDir === "up" ? "metric-trend trend-up" : "metric-trend trend-down";
  return (
    <Card className="metric-card">
      <p className="metric-label">{label}</p>
      <h3 className="metric-value">{value}</h3>
      {trend ? <span className={trendClass}>{trend}</span> : null}
      <Sparkline />
    </Card>
  );
}
