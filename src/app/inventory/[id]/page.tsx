import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getInventorySettings } from "@/lib/inventory-settings";
import { InventoryDetailScreen } from "@/components/inventory-detail-screen";
import { isVoidedPurchaseNote } from "@/lib/purchase-utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function toStockStatus(
  stockQty: number,
  lowStockThreshold: number,
  enableLowStockAlerts: boolean
) {
  if (stockQty <= 0) {
    return { label: "Out of Stock", className: "inventory-status-out" };
  }
  if (enableLowStockAlerts && stockQty <= Math.max(0, lowStockThreshold)) {
    return { label: "Low Stock", className: "inventory-status-low" };
  }
  return { label: "In Stock", className: "inventory-status-in" };
}

export default async function InventoryDetailPage({ params }: Params) {
  const { id } = await params;

  const [product, settings, recentMovements, recentPurchaseRefs] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        description: true,
        compatibleUnits: true,
        barcode: true,
        unit: true,
        unitCost: true,
        sellingPrice: true,
        stockQty: true,
        isActive: true,
        lowStockThreshold: true,
        createdAt: true,
        updatedAt: true,
        uom: {
          select: {
            code: true,
            name: true
          }
        }
      }
    }),
    getInventorySettings(),
    prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        type: true,
        qtyDelta: true,
        referenceType: true,
        refId: true,
        reason: true,
        user: {
          select: {
            name: true,
            username: true
          }
        }
      }
    }),
    prisma.purchaseItem.findMany({
      where: {
        productId: id,
        purchase: {
          status: "POSTED"
        }
      },
      orderBy: [
        { purchase: { purchaseDate: "desc" } },
        { purchase: { updatedAt: "desc" } }
      ],
      take: 10,
      select: {
        purchase: {
          select: {
            supplierName: true,
            notes: true
          }
        }
      }
    })
  ]);

  if (!product) {
    notFound();
  }

  const lastSupplier =
    recentPurchaseRefs.find((entry) => !isVoidedPurchaseNote(entry.purchase.notes))?.purchase
      .supplierName ?? null;

  return (
    <InventoryDetailScreen
      item={{
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        description: product.description ?? "",
        compatibleUnits: product.compatibleUnits ?? "",
        barcode: product.barcode ?? null,
        unit: product.unit,
        unitCost: Number(product.unitCost),
        sellingPrice: Number(product.sellingPrice),
        stockQty: Number(product.stockQty),
        isActive: product.isActive,
        lowStockThreshold: Number(product.lowStockThreshold),
        lastSupplier,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        uomCode: product.uom?.code ?? null,
        uomName: product.uom?.name ?? null
      }}
      stockStatus={toStockStatus(
        Number(product.stockQty),
        Number(product.lowStockThreshold),
        settings.enableLowStockAlerts
      )}
      movements={recentMovements.map((movement) => ({
        id: movement.id,
        createdAt: movement.createdAt.toISOString(),
        type: movement.type,
        quantityChange: Number(movement.qtyDelta),
        reference: [movement.referenceType, movement.refId].filter(Boolean).join(" #"),
        reason: movement.reason ?? "",
        actor: movement.user.name?.trim() || movement.user.username?.trim() || ""
      }))}
    />
  );
}
