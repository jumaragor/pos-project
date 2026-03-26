import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, status: true }
  });
  if (!user || user.status !== "ACTIVE") {
    return null;
  }
  return {
    id: user.id,
    role: user.role as Role
  };
}
