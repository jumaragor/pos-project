import { SupplierStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

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

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const { id } = await params;
    const body = await request.json();
    const supplierName = asOptionalText(body.supplierName);
    if (!supplierName) {
      return badRequest("supplierName is required");
    }
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        supplierName,
        contactPerson: asOptionalText(body.contactPerson),
        mobileNumber: asOptionalText(body.mobileNumber),
        emailAddress: asOptionalText(body.emailAddress),
        address: asOptionalText(body.address),
        notes: asOptionalText(body.notes),
        status: toStatus(body.status)
      }
    });
    return ok(supplier);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to update supplier");
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const { id } = await params;
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.INACTIVE }
    });
    return ok(supplier);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to deactivate supplier");
  }
}
