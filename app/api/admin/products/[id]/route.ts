import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { z } from "zod";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("products.view");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid product id");

    // A dealer-linked login may only view products actually assigned to its own dealer, and
    // only while the product is currently PUBLISHED — matching the list's same rule.
    if (!admin.isSuperAdmin && admin.dealerId != null) {
      const assignment = await prisma.dealerInventory.findFirst({
        where: { dealerId: admin.dealerId, productId: id, status: "ACTIVE", product: { status: "PUBLISHED" } },
      });
      if (!assignment) return fail(404, "Product not found");
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        relationsFrom: { include: { related: { select: { id: true, name: true } } } },
        distributorDiscounts: true,
        distributorPvRules: true,
      },
    });
    if (!product) return fail(404, "Product not found");

    return ok({
      ...product,
      price: Number(product.price),
      costPrice: product.costPrice ? Number(product.costPrice) : null,
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      discountValue: product.discountValue ? Number(product.discountValue) : null,
      weight: product.weight ? Number(product.weight) : null,
      length: product.length ? Number(product.length) : null,
      width: product.width ? Number(product.width) : null,
      height: product.height ? Number(product.height) : null,
      relatedIds: product.relationsFrom.filter((r) => r.type === "RELATED").map((r) => r.relatedId),
      crossSellIds: product.relationsFrom.filter((r) => r.type === "CROSS_SELL").map((r) => r.relatedId),
      upSellIds: product.relationsFrom.filter((r) => r.type === "UP_SELL").map((r) => r.relatedId),
      customerDiscountPercent: product.customerDiscountPercent ? Number(product.customerDiscountPercent) : null,
      distributorDiscounts: product.distributorDiscounts.map((d) => ({
        distributorId: d.distributorId,
        discountPercent: Number(d.discountPercent),
      })),
      pvDistributorIds: product.distributorPvRules.map((p) => p.distributorId),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("products.edit");
    if (admin.dealerId != null) {
      return fail(403, "Dealers cannot edit central products");
    }
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid product id");

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return fail(404, "Product not found");

    const body = await request.json();
    const parsed = z.object({
      featuredImage: z.string().nullable().optional(),
      images: z.array(z.object({ url: z.string(), alt: z.string().max(200).default(""), sortOrder: z.number().int().default(0) })).default([]),
    }).safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const data = parsed.data;

    const product = await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });

      const updated = await tx.product.update({
        where: { id },
        data: {
          featuredImage: data.featuredImage || null,
          images: {
            create: data.images.map((img, i) => ({ url: img.url, alt: img.alt, sortOrder: img.sortOrder ?? i })),
          },
        },
      });

      return updated;
    });

    return ok(product, "Product images updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    await requirePermission("products.delete");
    return fail(403, "Products are managed by OMS and cannot be deleted here.");
    /*
    if (admin.dealerId != null) {
      return fail(403, "Dealers cannot delete central products");
    }
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid product id");

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return fail(404, "Product not found");

    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return ok(null, "Product moved to trash"); */
  } catch (error) {
    return handleApiError(error);
  }
}
