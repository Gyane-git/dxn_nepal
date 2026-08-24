import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";
import { z } from "zod";

/** Lists published products alongside this dealer's current stock for each (0 when no row exists yet). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: rawId } = await params;
    const dealerId = Number(rawId);
    if (Number.isNaN(dealerId)) return fail(400, "Invalid dealer id");

    const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
    if (!dealer) return fail(404, "Dealer not found");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const { page, pageSize, skip } = parsePagination(searchParams);

    const where = {
      status: "PUBLISHED" as const,
      deletedAt: null,
      ...(search ? { name: { contains: search } } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: { id: true, name: true, sku: true, featuredImage: true, stock: true },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    const inventoryRows = await prisma.dealerInventory.findMany({
      where: { dealerId, productId: { in: products.map((p) => p.id) }, variantId: null },
    });
    const stockByProductId = new Map(inventoryRows.map((r) => [r.productId, r.stock]));

    const items = products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      image: p.featuredImage,
      globalStock: p.stock,
      dealerStock: stockByProductId.get(p.id) ?? 0,
    }));

    return ok({ items, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

const setStockSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: rawId } = await params;
    const dealerId = Number(rawId);
    if (Number.isNaN(dealerId)) return fail(400, "Invalid dealer id");

    const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
    if (!dealer) return fail(404, "Dealer not found");

    const body = await request.json();
    const parsed = setStockSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;
    const variantId = data.variantId ?? null;

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return fail(404, "Product not found");

    const existing = await prisma.dealerInventory.findFirst({
      where: { dealerId, productId: data.productId, variantId },
    });

    const row = existing
      ? await prisma.dealerInventory.update({ where: { id: existing.id }, data: { stock: data.stock } })
      : await prisma.dealerInventory.create({
          data: { dealerId, productId: data.productId, variantId, stock: data.stock },
        });

    return ok(row, "Stock updated");
  } catch (error) {
    return handleApiError(error);
  }
}
