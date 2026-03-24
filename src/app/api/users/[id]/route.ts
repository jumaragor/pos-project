import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }
  if (!can(actor.role, "MANAGE_USERS")) {
    return forbidden();
  }
  const body = await request.json();
  const { id } = await params;
  const normalizedRole = body.role === "ADMIN" ? "OWNER" : body.role;
  const role = normalizedRole as Role;
  const status = body.status === UserStatus.INACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
  const passwordHash =
    typeof body.password === "string" && body.password.trim()
      ? await bcrypt.hash(body.password, 10)
      : undefined;
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      username: typeof body.username === "string" ? body.username.trim().toLowerCase() : undefined,
      email: typeof body.email === "string" ? body.email.toLowerCase() : undefined,
      role,
      status,
      ...(passwordHash ? { passwordHash } : {})
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true
    }
  });
  return ok(user);
}
