"use client";

import { Card } from "@/components/ui/card";

type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card className="dashboard-kpi-card">
      <p className="dashboard-kpi-label">{label}</p>
      <strong className="dashboard-kpi-value">{value}</strong>
    </Card>
  );
}
