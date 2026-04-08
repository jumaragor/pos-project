"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

type TrendPoint = {
  label: string;
  value: number;
};

type SalesTrendCardProps = {
  data: {
    today: TrendPoint[];
    last7: TrendPoint[];
    last30: TrendPoint[];
  };
};

type PeriodKey = keyof SalesTrendCardProps["data"];

const periodLabels: Record<PeriodKey, string> = {
  today: "Today",
  last7: "Last 7 Days",
  last30: "Last 30 Days"
};

function buildPath(points: TrendPoint[]) {
  if (!points.length) return "";
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 90 - (point.value / maxValue) * 70;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function SalesTrendCard({ data }: SalesTrendCardProps) {
  const [period, setPeriod] = useState<PeriodKey>("last7");
  const points = data[period];

  const summary = useMemo(() => {
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const max = points.reduce((best, point) => (point.value > best.value ? point : best), points[0] ?? { label: "-", value: 0 });
    return { total, peakLabel: max.label, peakValue: max.value };
  }, [points]);

  if (!points.length || points.every((point) => point.value === 0)) {
    return (
      <Card className="dashboard-panel">
        <div className="dashboard-panel-head">
          <div>
            <h2 className="section-title">Sales Trend</h2>
            <p className="dashboard-panel-subtitle">Daily sales performance overview</p>
          </div>
        </div>
        <div className="dashboard-empty">No sales data yet for the selected period.</div>
      </Card>
    );
  }

  return (
    <Card className="dashboard-panel">
      <div className="dashboard-panel-head dashboard-panel-head-wrap">
        <div>
          <h2 className="section-title">Sales Trend</h2>
          <p className="dashboard-panel-subtitle">Daily sales performance overview</p>
        </div>
        <div className="dashboard-segmented">
          {Object.entries(periodLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={period === key ? "dashboard-segment active" : "dashboard-segment"}
              onClick={() => setPeriod(key as PeriodKey)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-chart-summary">
        <div>
          <span className="dashboard-chart-summary-label">Sales in period</span>
          <strong>{formatCurrency(summary.total)}</strong>
        </div>
        <div>
          <span className="dashboard-chart-summary-label">Peak point</span>
          <strong>
            {summary.peakLabel} · {formatCurrency(summary.peakValue)}
          </strong>
        </div>
      </div>

      <div className="dashboard-line-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Sales trend chart">
          <defs>
            <linearGradient id="dashboardTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(29,78,216,0.26)" />
              <stop offset="100%" stopColor="rgba(29,78,216,0.02)" />
            </linearGradient>
          </defs>
          <path d="M 0 90 L 100 90" className="dashboard-line-chart-axis" />
          <path
            d={`${buildPath(points)} L 100 90 L 0 90 Z`}
            className="dashboard-line-chart-fill"
            fill="url(#dashboardTrendFill)"
          />
          <path d={buildPath(points)} className="dashboard-line-chart-path" />
        </svg>
      </div>

      <div className="dashboard-line-labels">
        {points.map((point) => (
          <span key={`${period}-${point.label}`}>{point.label}</span>
        ))}
      </div>
    </Card>
  );
}
