import { CategoryStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function asOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

async function requireAdmin() {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER"].includes(actor.role)) {
    return forbidden();
  }
  return actor;
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { id } = await params;
    const body = await request.json();
    const name = asOptionalText(body.name);
    const code = normalizeCode(body.code);
    const skuPrefix = normalizeCode(body.skuPrefix);
    if (!name || !code || !skuPrefix) {
      return badRequest("Category Name, Category Code, and SKU Prefix are required");
    }

    const existing = await prisma.category.findFirst({
      where: {
        id: { not: id },
        OR: [{ code }, { skuPrefix }]
      },
      select: { id: true, code: true, skuPrefix: true }
    });
    if (existing) {
      return badRequest(
        existing.code === code ? "Category Code must be unique" : "SKU Prefix must be unique"
      );
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        code,
        skuPrefix,
        description: asOptionalText(body.description),
        status: body.status === CategoryStatus.INACTIVE ? CategoryStatus.INACTIVE : CategoryStatus.ACTIVE,
        sortOrder: Number(body.sortOrder ?? 0) || 0
      }
    });

    if (category.status === CategoryStatus.ACTIVE) {
      await prisma.product.updateMany({
        where: { categoryId: category.id },
        data: { category: category.name }
      });
    }

    return ok(category);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to update category");
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { id } = await params;
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return badRequest("Categories linked to products cannot be deleted. Set the category to inactive instead.");
    }
    await prisma.category.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to delete category");
  }
}
