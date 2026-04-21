import { PurchaseEntryScreen } from "@/components/purchase-entry-screen";
import type { PurchaseDetailRow } from "@/components/purchases/types";

export function PurchaseDetailScreen({ purchase }: { purchase: PurchaseDetailRow }) {
  return <PurchaseEntryScreen mode="view" initialPurchase={purchase} />;
}
