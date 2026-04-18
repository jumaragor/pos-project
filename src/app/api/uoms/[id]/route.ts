import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

async function requireAdmin() {
  const actor = await getAuthUser();
  if (!actor) return unauthorized();
  if (!["OWNER", "MANAGER"].includes(actor.role)) return forbidden();
  return actor;
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const body = await request.json();
    const code = normalizeCode(body.code);
    const name = normalizeName(body.name);
    if (!code || !name) {
      return badRequest("UOM code and name are required");
    }

    const existing = await prisma.unitOfMeasure.findFirst({
      where: {
        id: { not: id },
        OR: [{ code }, { name }]
      },
      select: { id: true, code: true, name: true }
    });
    if (existing) {
      return badRequest(existing.code === code ? "UOM code must be unique" : "UOM name must be unique");
    }

    const uom = await prisma.unitOfMeasure.update({
      where: { id },
      data: {
        code,
        name,
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder ?? 0) || 0
      }
    });

    return ok(uom);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to update unit of measure");
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const productCount = await prisma.product.count({ where: { uomId: id } });
    if (productCount > 0) {
      return badRequest("Units of measure linked to products cannot be deleted. Set the UOM to inactive instead.");
    }

    await prisma.unitOfMeasure.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to delete unit of measure");
  }
}
