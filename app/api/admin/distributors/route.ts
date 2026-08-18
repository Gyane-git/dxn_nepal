import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    const distributors = await prisma.user.findMany({
      where: {
        role: "DISTRIBUTOR",
        ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
      },
      select: { id: true, name: true, email: true, distributorId: true },
      orderBy: { name: "asc" },
    });

    return ok(distributors);
  } catch (error) {
    return handleApiError(error);
  }
}
