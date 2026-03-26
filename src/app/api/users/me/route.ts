import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/http";
import { getAuthUser } from "@/lib/api-auth";

export async function GET() {
  const actor = await getAuthUser();
  if (!actor) {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      status: true
    }
  });

  if (!user) {
    return unauthorized();
  }

  return ok(user);
}
