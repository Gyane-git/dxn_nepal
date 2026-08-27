import { prisma } from "@/lib/prisma";
import { requireDealerPermission } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";

/** Lists orders assigned to the current user's dealer — never another dealer's, enforced by the where clause. */
export async function GET(request: Request) {
  try {
    const { dealer } = await requireDealerPermission("orders.view");
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const { page, pageSize, skip } = parsePagination(searchParams);

    const where = {
      dealerId: dealer.id,
      ...(status
        ? { status: status as "PROCESSING" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED" }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { placedAt: "desc" },
        include: { items: true },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const data = orders.map((order) => ({
      ...order,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      tax: Number(order.tax),
      total: Number(order.total),
      items: order.items.map((item) => ({ ...item, price: Number(item.price) })),
    }));

    return ok({ orders: data, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
