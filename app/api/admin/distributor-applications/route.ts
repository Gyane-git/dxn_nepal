import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const { page, pageSize, skip } = parsePagination(searchParams);

    const where = status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {};

    const [applications, total] = await Promise.all([
      prisma.distributorApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.distributorApplication.count({ where }),
    ]);

    return ok({ applications, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
