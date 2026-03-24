import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Action =
  | "VOID_REFUND"
  | "INVENTORY_ADJUST"
  | "EDIT_PRICING"
  | "VIEW_PROFIT"
  | "MANAGE_USERS";

const matrix: Record<Action, Role[]> = {
  VOID_REFUND: [Role.OWNER, Role.MANAGER],
  INVENTORY_ADJUST: [Role.OWNER, Role.MANAGER],
  EDIT_PRICING: [Role.OWNER, Role.MANAGER],
  VIEW_PROFIT: [Role.OWNER, Role.MANAGER],
  MANAGE_USERS: [Role.OWNER, Role.MANAGER]
};

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function can(role: Role, action: Action) {
  return matrix[action].includes(role);
}

export function assertPermission(role: Role, action: Action) {
  if (!can(role, action)) {
    throw new Error("FORBIDDEN");
  }
}
