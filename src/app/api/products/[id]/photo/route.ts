import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function handleUpload(request: NextRequest, { params }: Params) {
  try {
    const actor = await getAuthUser();
    if (!actor) {
      return unauthorized();
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return badRequest("Image file is required");
    }
    if (!file.type.startsWith("image/")) {
      return badRequest("Only image files are allowed");
    }
    if (file.size > 5 * 1024 * 1024) {
      return badRequest("Image must be 5MB or less");
    }

    const { id } = await params;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const safeExt = (ext ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
    const filename = `${id}-${Date.now()}.${safeExt}`;
    const publicDir = path.join(process.cwd(), "public", "uploads", "products");
    await fs.mkdir(publicDir, { recursive: true });
    const filePath = path.join(publicDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const photoUrl = `/uploads/products/${filename}`;
    const product = await prisma.product.update({
      where: { id },
      data: { photoUrl }
    });
    return ok({ photoUrl: product.photoUrl });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Failed to upload photo");
  }
}

export async function PUT(request: NextRequest, context: Params) {
  return handleUpload(request, context);
}

export async function POST(request: NextRequest, context: Params) {
  return handleUpload(request, context);
}
