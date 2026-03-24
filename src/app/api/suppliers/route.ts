import { SupplierStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";
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
    const suppliers = await prisma.supplier.findMany({
      where: {
        ...(activeOnly ? { status: SupplierStatus.ACTIVE } : {}),
        ...(query
          ? {
              OR: [
                { supplierCode: { contains: query, mode: "insensitive" } },
                { supplierName: { contains: query, mode: "insensitive" } },
                { contactPerson: { contains: query, mode: "insensitive" } },
                { mobileNumber: { contains: query, mode: "insensitive" } },
                { emailAddress: { contains: query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ status: "asc" }, { supplierName: "asc" }]
    });
    return ok(suppliers);
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
