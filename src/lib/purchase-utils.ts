export const PURCHASE_VOID_MARKER = "[VOIDED]";

export function isVoidedPurchaseNote(notes: string | null | undefined) {
  return typeof notes === "string" && notes.includes(PURCHASE_VOID_MARKER);
}

export function buildVoidedPurchaseNote(existingNotes: string | null | undefined, voidReason?: string | null) {
  const base = (existingNotes ?? "").trim();
  const reason = typeof voidReason === "string" ? voidReason.trim() : "";
  if (isVoidedPurchaseNote(base)) return base;
  const prefixedReason = reason ? `${PURCHASE_VOID_MARKER} ${reason}` : PURCHASE_VOID_MARKER;
  return base ? `${prefixedReason}\n${base}` : prefixedReason;
}
