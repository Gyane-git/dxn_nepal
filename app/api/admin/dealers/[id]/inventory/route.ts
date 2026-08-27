import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";
import { z } from "zod";

/**
 * Lists published products alongside this dealer's current stock for each (0 when no row exists
 * yet). A login linked to this exact dealer (self-service) sees only its own already-assigned
 * products — never the full catalog, never another dealer's. Admin staff with `dealers.view` see
 * every published product (assigned or not) so they can choose what to assign.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: rawId } = await params;
    const dealerId = Number(rawId);
    if (Number.isNaN(dealerId)) return fail(400, "Invalid dealer id");

    const isSelfService = !admin.isSuperAdmin && admin.dealerId === dealerId;
    if (!isSelfService) {
      if (admin.dealerId != null && admin.dealerId !== dealerId) {
        return fail(403, "You can only view your own dealer's inventory");
      }
      if (!admin.isSuperAdmin && !admin.permissions.has("dealers.view")) {
        return fail(403, "Missing permission: dealers.view");
      }
    }

    const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
    if (!dealer) return fail(404, "Dealer not found");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const { page, pageSize, skip } = parsePagination(searchParams);

    if (isSelfService) {
      // Query from DealerInventory itself so pagination/search never misses assigned products
      // that fall outside a page of the full product catalog — this dealer's assignment set is
      // typically small, and this mirrors app/api/dealer/inventory's storefront-facing query.
      const rows = await prisma.dealerInventory.findMany({
        where: {
          dealerId,
          variantId: null,
          status: "ACTIVE",
          // Must match the same "PUBLISHED" criterion used below for the admin's own
          // assignment view, so a self-viewing dealer never sees a different count than what
          // the admin sees checked in the "Assigned products only" list for this same dealer.
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
        assigned: true,
      }));
      return ok({ items, total: items.length, page: 1, pageSize });
    }

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
    const rowByProductId = new Map(inventoryRows.map((r) => [r.productId, r]));

    const items = products.map((p) => {
      const row = rowByProductId.get(p.id);
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        image: p.featuredImage,
        globalStock: p.stock,
        dealerStock: row?.stock ?? 0,
        assigned: row?.status === "ACTIVE",
      };
    });

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

/** Updates dealer-held stock. A dealer's own login may update its own stock (self-service, no
 * `dealers.edit` needed) — never another dealer's, never assign/unassign (see PATCH below). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: rawId } = await params;
    const dealerId = Number(rawId);
    if (Number.isNaN(dealerId)) return fail(400, "Invalid dealer id");

    const isSelfService = !admin.isSuperAdmin && admin.dealerId === dealerId;
    if (!isSelfService) {
      if (admin.dealerId != null && admin.dealerId !== dealerId) {
        return fail(403, "You can only update your own dealer's inventory");
      }
      if (!admin.isSuperAdmin && !admin.permissions.has("dealers.edit")) {
        return fail(403, "Missing permission: dealers.edit");
      }
    }

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
    if (!existing || existing.status !== "ACTIVE") {
      return fail(400, "Assign this product to the dealer before setting its stock");
    }

    const row = await prisma.dealerInventory.update({ where: { id: existing.id }, data: { stock: data.stock } });

    return ok(row, "Stock updated");
  } catch (error) {
    return handleApiError(error);
  }
}

const toggleAssignmentSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  assigned: z.boolean(),
});

/**
 * Assigns (creates the row, stock starts at 0) or deactivates ("unassigns") a product for this
 * dealer — the deactivated row's stock is preserved so reassigning later restores it. A dealer
 * can never assign/unassign products to itself, regardless of permissions — only real admin
 * staff (not linked to any dealer) or the Super Admin may call this.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("dealers.edit");
    if (admin.dealerId != null) {
      return fail(403, "Only an administrator can assign products to a dealer");
    }
    const { id: rawId } = await params;
    const dealerId = Number(rawId);
    if (Number.isNaN(dealerId)) return fail(400, "Invalid dealer id");

    const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
    if (!dealer) return fail(404, "Dealer not found");

    const body = await request.json();
    const parsed = toggleAssignmentSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;
    const variantId = data.variantId ?? null;

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return fail(404, "Product not found");

    const existing = await prisma.dealerInventory.findFirst({
      where: { dealerId, productId: data.productId, variantId },
    });
    const status = data.assigned ? "ACTIVE" : "INACTIVE";

    const row = existing
      ? await prisma.dealerInventory.update({ where: { id: existing.id }, data: { status } })
      : await prisma.dealerInventory.create({
          data: { dealerId, productId: data.productId, variantId, status, stock: 0 },
        });

    return ok(row, data.assigned ? "Product assigned" : "Product unassigned");
  } catch (error) {
    return handleApiError(error);
  }
}
