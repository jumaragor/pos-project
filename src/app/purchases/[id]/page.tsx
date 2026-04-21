import { notFound } from "next/navigation";
import { PurchaseDetailScreen } from "@/components/purchase-detail-screen";
import { getPurchaseDetail } from "@/lib/purchases-data";

type Params = { params: Promise<{ id: string }> };

export default async function PurchaseDetailPage({ params }: Params) {
  const { id } = await params;
  const purchase = await getPurchaseDetail(id);

  if (!purchase) {
    notFound();
  }

  return (
    <div className="grid">
      <PurchaseDetailScreen purchase={purchase} />
    </div>
  );
}
