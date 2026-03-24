import { CategoryStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/http";
import { buildPagination, DEFAULT_PAGE_SIZE, parsePositiveInt } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

function asOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
    const where: Prisma.CategoryWhereInput = {
      ...(activeOnly ? { status: CategoryStatus.ACTIVE } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
              { skuPrefix: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [total, categories] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          skuPrefix: true,
          description: true,
          status: true,
          sortOrder: true,
          _count: { select: { products: true } }
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize
      })
    ]);

    return ok({
      items: categories.map((category) => ({
        ...category,
        productCount: category._count.products
      })),
      pagination: buildPagination(requestedPage, pageSize, total)
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to fetch categories");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    if (!["OWNER", "MANAGER"].includes(actor.role)) {
      return forbidden();
    }

    const body = await request.json();
    const name = asOptionalText(body.name);
    const code = normalizeCode(body.code);
    const skuPrefix = normalizeCode(body.skuPrefix);
    if (!name || !code || !skuPrefix) {
      return badRequest("Category Name, Category Code, and SKU Prefix are required");
    }

    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ code }, { skuPrefix }]
      },
      select: { id: true, code: true, skuPrefix: true }
    });
    if (existing) {
      return badRequest(
        existing.code === code ? "Category Code must be unique" : "SKU Prefix must be unique"
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        code,
        skuPrefix,
        description: asOptionalText(body.description),
        status: body.status === CategoryStatus.INACTIVE ? CategoryStatus.INACTIVE : CategoryStatus.ACTIVE,
        sortOrder: Number(body.sortOrder ?? 0) || 0
      }
    });

    return created(category);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create category");
  }
}
