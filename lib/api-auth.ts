import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return null;
  }
  return {
    id: session.user.id,
    role: session.user.role as Role
  };
}
