import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";
import { can } from "@/lib/rbac";

export async function GET() {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }
  if (!can(actor.role, "MANAGE_USERS")) {
    return forbidden();
  }
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  return ok(users);
}

export async function POST(request: NextRequest) {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }
  if (!can(actor.role, "MANAGE_USERS")) {
    return forbidden();
  }
  const body = await request.json();
  if (!body.name || !body.username || !body.email || !body.password || !body.role) {
    return badRequest("name, username, email, password, and role are required");
  }
  const normalizedRole = body.role === "ADMIN" ? "OWNER" : body.role;
  const role = normalizedRole as Role;
  if (![Role.OWNER, Role.CASHIER, Role.MANAGER].includes(role)) {
    return badRequest("Invalid role");
  }
  const status = body.status === UserStatus.INACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      username: String(body.username).trim().toLowerCase(),
      email: body.email.toLowerCase(),
      passwordHash,
      role,
      status
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true
    }
  });
  return created(user);
}
