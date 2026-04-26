import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SequenceClient = PrismaClient | Prisma.TransactionClient;

type SequenceType = "purchase" | "sale";

const SEQUENCE_KEYS: Record<SequenceType, string> = {
  purchase: "sequence.purchase",
  sale: "sequence.sale"
};

function formatSequenceNumber(sequence: number) {
  return String(sequence).padStart(Math.max(3, String(sequence).length), "0");
}

function formatDocumentDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function getExistingMaxSequence(type: SequenceType) {
  if (type === "purchase") {
    const [row] = await prisma.$queryRaw<Array<{ maxSequence: number | null }>>`
      SELECT MAX(CAST(SUBSTRING("purchaseNumber" FROM '([0-9]+)$') AS INTEGER)) AS "maxSequence"
      FROM "Purchase"
      WHERE "purchaseNumber" IS NOT NULL
    `;
    return row?.maxSequence ?? 0;
  }

  const [row] = await prisma.$queryRaw<Array<{ maxSequence: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("number" FROM '([0-9]+)$') AS INTEGER)) AS "maxSequence"
    FROM "Transaction"
    WHERE "number" IS NOT NULL
  `;
  return row?.maxSequence ?? 0;
}

async function nextSequenceValue(db: SequenceClient, type: SequenceType) {
  const initialValue = (await getExistingMaxSequence(type)) + 1;
  const sequenceKey = SEQUENCE_KEYS[type];
  const [row] = await db.$queryRaw<Array<{ value: string }>>`
    WITH next_sequence AS (
      INSERT INTO "AppSetting" ("key", "value", "updatedAt")
      VALUES (${sequenceKey}, ${String(initialValue)}, NOW())
      ON CONFLICT ("key")
      DO UPDATE SET
        "value" = (("AppSetting"."value")::INTEGER + 1)::TEXT,
        "updatedAt" = NOW()
      RETURNING "value"
    )
    SELECT "value" FROM next_sequence
  `;

  const parsed = Number.parseInt(row?.value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Failed to generate ${type} sequence number`);
  }
  return parsed;
}

export async function generatePurchaseNumber(db: SequenceClient, purchaseDate: Date) {
  const sequence = await nextSequenceValue(db, "purchase");
  return `PUR-${formatDocumentDate(purchaseDate)}-${formatSequenceNumber(sequence)}`;
}

export async function generateSaleNumber(db: SequenceClient, transactionDate: Date = new Date()) {
  const sequence = await nextSequenceValue(db, "sale");
  return `TX-${formatDocumentDate(transactionDate)}-${formatSequenceNumber(sequence)}`;
}
