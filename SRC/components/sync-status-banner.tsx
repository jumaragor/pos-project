"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/offline-db";

type SyncState = "offline" | "synced" | "syncing" | "error";

async function syncNow(setState: (state: SyncState) => void) {
  setState("syncing");
  const ops = await db.pendingOps.where("status").equals("pending").toArray();
  if (!ops.length) {
    setState("synced");
    return;
  }
  try {
    const response = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operations: ops.map((op) => ({ opId: op.opId, type: op.type, payload: op.payload }))
      })
    });
    const data = await response.json();
    for (const result of data.results) {
      const item = ops.find((op) => op.opId === result.opId);
      if (!item?.id) continue;
      if (result.status === "processed" || result.status === "already_processed") {
        await db.pendingOps.delete(item.id);
      } else {
        await db.pendingOps.update(item.id, {
          status: "error",
          retries: item.retries + 1,
          error: result.message
        });
      }
    }
    setState("synced");
  } catch {
    setState("error");
  }
}

export function SyncStatusBanner() {
  const [state, setState] = useState<SyncState>(typeof navigator === "undefined" ? "synced" : "offline");

  useEffect(() => {
    const onOnline = async () => {
      await syncNow(setState);
      const since = (await db.meta.get("lastSyncAt"))?.value;
      const pull = await fetch(`/api/sync/pull?since=${encodeURIComponent(since ?? "")}`);
      const payload = await pull.json();
      for (const product of payload.products ?? []) {
        await db.cachedProducts.put({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          sellingPrice: Number(product.sellingPrice),
          stockQty: Number(product.stockQty),
          updatedAt: product.updatedAt
        });
      }
      await db.meta.put({ key: "lastSyncAt", value: payload.serverTime });
      setState("synced");
    };
    const onOffline = () => setState("offline");
    if (navigator.onLine) {
      void onOnline();
    } else {
      setState("offline");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const label =
    state === "offline"
      ? "Offline: pending operations will sync when online."
      : state === "syncing"
        ? "Syncing pending operations..."
        : state === "error"
          ? "Sync error: retrying in background."
          : "Synced";

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        borderColor: state === "error" ? "#b54747" : undefined
      }}
    >
      <strong>Sync Status:</strong> {label}
    </div>
  );
}
