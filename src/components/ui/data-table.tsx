import { PropsWithChildren } from "react";
import { Card } from "@/components/ui/card";

type DataTableProps = PropsWithChildren<{
  title: string;
}>;

export function DataTable({ title, children }: DataTableProps) {
  return (
    <Card>
      <h2 className="section-title">{title}</h2>
      <div className="table-wrap">{children}</div>
    </Card>
  );
}
