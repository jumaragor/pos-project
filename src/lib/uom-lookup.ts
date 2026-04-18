import { prisma } from "@/lib/prisma";

type UomSummary = {
  code: string;
  name: string;
};

export async function buildUomLookup(uomIds: Array<string | null | undefined>) {
  const normalizedIds = [...new Set(uomIds.filter((value): value is string => typeof value === "string" && value.length > 0))];

  if (!normalizedIds.length) {
    return new Map<string, UomSummary>();
  }

  const uoms = await prisma.unitOfMeasure.findMany({
    where: { id: { in: normalizedIds } },
    select: {
      id: true,
      code: true,
      name: true
    }
  });

  return new Map<string, UomSummary>(
    uoms.map((uom) => [
      uom.id,
      {
        code: uom.code,
        name: uom.name
      }
    ])
  );
}
