"use client";

import Link from "next/link";
import { PurchaseStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PencilIcon } from "@/components/ui/app-icons";
import { useToast } from "@/components/toast-provider";

export function PurchaseDetailActions({
  purchaseId,
  status,
  isVoided
}: {
  purchaseId: string;
  status: PurchaseStatus;
  isVoided: boolean;
}) {
  const router = useRouter();
  const { success } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  async function voidPurchase() {
    if (submitting || isVoided || status !== PurchaseStatus.POSTED) return;
    const reason = voidReason.trim();
    if (!reason) {
      alert("Void reason is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(result.error ?? "Failed to void purchase");
        return;
      }
      setVoidOpen(false);
      setVoidReason("");
      success("Process successful");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (isVoided) return null;

  return (
    <>
      <div className="purchases-page-actions">
        {status === PurchaseStatus.DRAFT ? (
          <Link href={`/purchases/${purchaseId}/edit`} className="btn-secondary purchases-detail-edit-btn">
            <PencilIcon className="purchases-detail-edit-icon" />
            Edit
          </Link>
        ) : null}
        {status === PurchaseStatus.POSTED ? (
          <button type="button" className="btn-danger" disabled={submitting} onClick={() => setVoidOpen(true)}>
            Void
          </button>
        ) : null}
      </div>

      {voidOpen ? (
        <div className="inventory-modal-overlay" onClick={() => !submitting && setVoidOpen(false)}>
          <div className="inventory-modal purchases-void-modal" onClick={(event) => event.stopPropagation()}>
            <div className="inventory-modal-header">
              <h3 className="section-title">Void Purchase</h3>
            </div>
            <div className="inventory-modal-body purchases-void-body">
              <div className="muted">Provide a reason for voiding this transaction.</div>
              <label className="form-field">
                <span className="field-label">Reason</span>
                <textarea
                  rows={3}
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  placeholder="Enter void reason"
                  autoFocus
                />
              </label>
            </div>
            <div className="inventory-modal-footer">
              <button type="button" className="btn-secondary" disabled={submitting} onClick={() => setVoidOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" disabled={submitting} onClick={() => void voidPurchase()}>
                {submitting ? "Voiding..." : "Void"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
