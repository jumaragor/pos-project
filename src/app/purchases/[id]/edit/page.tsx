import { notFound } from "next/navigation";
import { PurchaseStatus } from "@prisma/client";
import { PurchaseEntryScreen } from "@/components/purchase-entry-screen";
import { getPurchaseDetail } from "@/lib/purchases-data";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";

type Params = { params: Promise<{ id: string }> };

export default async function EditPurchasePage({ params }: Params) {
  const { id } = await params;
  const purchase = await getPurchaseDetail(id);

  if (!purchase || purchase.status !== PurchaseStatus.DRAFT || isVoidedPurchaseNote(purchase.notes)) {
    notFound();
  }

  return (
    <div className="grid">
      <PurchaseEntryScreen mode="edit" initialPurchase={purchase} />
    </div>
  );
}
