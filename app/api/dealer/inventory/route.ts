import { prisma } from "@/lib/prisma";
import { requireDealerPermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { z } from "zod";

const LOW_STOCK_THRESHOLD = 5;

/** Only ever returns the caller's own dealer.id (from the session) — never a client-supplied dealer id, so one dealer can never read another's inventory. */
export async function GET(request: Request) {
  try {
    const { dealer } = await requireDealerPermission("dealer_inventory.view");
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    const rows = await prisma.dealerInventory.findMany({
      where: {
        dealerId: dealer.id,
        variantId: null,
        status: "ACTIVE",
        // Must match the same "PUBLISHED" criterion the admin's assignment view is built from
        // (app/api/admin/dealers/[id]/inventory GET) — otherwise a product that's since gone to
        // DRAFT/ARCHIVED would still show here even though the admin's assigned-count excludes it.
        product: { status: "PUBLISHED", deletedAt: null, ...(search ? { name: { contains: search } } : {}) },
      },
      include: { product: { select: { id: true, name: true, sku: true, featuredImage: true, stock: true } } },
      orderBy: { product: { name: "asc" } },
    });

    const items = rows.map((r) => ({
      productId: r.productId,
      name: r.product.name,
      sku: r.product.sku,
      image: r.product.featuredImage,
      globalStock: r.product.stock,
      dealerStock: r.stock,
    }));

    const summary = {
      assignedCount: items.length,
      totalStock: items.reduce((sum, i) => sum + i.dealerStock, 0),
      lowStockCount: items.filter((i) => i.dealerStock > 0 && i.dealerStock <= LOW_STOCK_THRESHOLD).length,
      outOfStockCount: items.filter((i) => i.dealerStock === 0).length,
    };

    return ok({ items, summary });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateStockSchema = z.object({
  productId: z.number().int().positive(),
  stock: z.number().int().min(0).max(1_000_000),
});

/** Updates only the caller's own DealerInventory row (dealerId from the session), and only when that product is currently assigned (ACTIVE) to them. Never touches Product.stock (global stock). */
export async function PUT(request: Request) {
  try {
    const { dealer } = await requireDealerPermission("dealer_inventory.update");
    const body = await request.json();
    const parsed = updateStockSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const existing = await prisma.dealerInventory.findFirst({
      where: { dealerId: dealer.id, productId: data.productId, variantId: null },
    });
    if (!existing || existing.status !== "ACTIVE") {
      return fail(403, "This product is not assigned to you");
    }

    const row = await prisma.dealerInventory.update({ where: { id: existing.id }, data: { stock: data.stock } });
    return ok(row, "Stock updated");
  } catch (error) {
    return handleApiError(error);
  }
}
