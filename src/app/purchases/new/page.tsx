import { PurchaseEntryScreen } from "@/components/purchase-entry-screen";

export default function NewPurchasePage() {
  return (
    <div className="grid">
      <PurchaseEntryScreen mode="create" />
    </div>
  );
}
