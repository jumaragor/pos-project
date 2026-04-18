import { Prisma } from "@prisma/client";
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

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 500);
    const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
    const where: Prisma.UnitOfMeasureWhereInput = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(query
        ? {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [total, uoms] = await Promise.all([
      prisma.unitOfMeasure.count({ where }),
      prisma.unitOfMeasure.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          sortOrder: true,
          _count: { select: { products: true } }
        },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize
      })
    ]);

    return ok({
      items: uoms.map((uom) => ({
        ...uom,
        productCount: uom._count.products
      })),
      pagination: buildPagination(requestedPage, pageSize, total)
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to fetch units of measure");
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
    const code = normalizeCode(body.code);
    const name = normalizeName(body.name);
    if (!code || !name) {
      return badRequest("UOM code and name are required");
    }

    const existing = await prisma.unitOfMeasure.findFirst({
      where: {
        OR: [{ code }, { name }]
      },
      select: { id: true, code: true, name: true }
    });
    if (existing) {
      return badRequest(existing.code === code ? "UOM code must be unique" : "UOM name must be unique");
    }

    const uom = await prisma.unitOfMeasure.create({
      data: {
        code,
        name,
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder ?? 0) || 0
      }
    });

    return created(uom);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create unit of measure");
  }
}
