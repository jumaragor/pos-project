import { SupplierStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";
import { buildPagination, DEFAULT_PAGE_SIZE, parsePositiveInt } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

function asOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toStatus(value: unknown) {
  if (value === SupplierStatus.ACTIVE || value === SupplierStatus.INACTIVE) {
    return value;
  }
  return SupplierStatus.ACTIVE;
}

async function generateSupplierCode() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SUP-${yyyy}${mm}${dd}`;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const countToday = await prisma.supplier.count({
    where: { createdAt: { gte: todayStart, lt: todayEnd } }
  });
  return `${prefix}-${String(countToday + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000);
    const where = {
      ...(activeOnly ? { status: SupplierStatus.ACTIVE } : {}),
      ...(query
        ? {
            OR: [
              { supplierCode: { contains: query, mode: "insensitive" as const } },
              { supplierName: { contains: query, mode: "insensitive" as const } },
              { contactPerson: { contains: query, mode: "insensitive" as const } },
              { mobileNumber: { contains: query, mode: "insensitive" as const } },
              { emailAddress: { contains: query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        select: {
          id: true,
          supplierCode: true,
          supplierName: true,
          contactPerson: true,
          mobileNumber: true,
          emailAddress: true,
          address: true,
          notes: true,
          status: true
        },
        orderBy: [{ status: "asc" }, { supplierName: "asc" }],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize
      })
    ]);
    return ok({
      items: suppliers,
      pagination: buildPagination(requestedPage, pageSize, total)
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to fetch suppliers");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const body = await request.json();
    const supplierName = asOptionalText(body.supplierName);
    if (!supplierName) {
      return badRequest("supplierName is required");
    }

    const supplierCode = await generateSupplierCode();
    const supplier = await prisma.supplier.create({
      data: {
        supplierCode,
        supplierName,
        contactPerson: asOptionalText(body.contactPerson),
        mobileNumber: asOptionalText(body.mobileNumber),
        emailAddress: asOptionalText(body.emailAddress),
        address: asOptionalText(body.address),
        notes: asOptionalText(body.notes),
        status: toStatus(body.status)
      }
    });
    return created(supplier);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to create supplier");
  }
}
