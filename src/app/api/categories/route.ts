import { prisma } from "@/lib/prisma";
import { ok, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: {
        _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });

    return ok(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        productCount: c._count.products,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
