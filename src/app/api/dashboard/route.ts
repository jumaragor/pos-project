import { ok } from "@/lib/http";
import { getDashboardData } from "@/lib/dashboard";

export async function GET() {
  return ok(await getDashboardData());
}
