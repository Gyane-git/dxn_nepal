import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";

/** Distributors not yet promoted to Dealer — the only accounts eligible to become one. */
export async function GET(request: Request) {
  try {
    await requirePermission("dealers.view");
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    const distributors = await prisma.user.findMany({
      where: {
        role: "DISTRIBUTOR",
        dealer: null,
        ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { distributorId: { contains: search } }] } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, distributorId: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    return ok(distributors);
  } catch (error) {
    return handleApiError(error);
  }
}
