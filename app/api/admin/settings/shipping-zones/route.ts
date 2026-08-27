import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { shippingZoneSchema } from "@/schemas/admin-settings";

function serialize(zone: { rate: unknown; freeShippingMinOrder: unknown; [key: string]: unknown }) {
  return {
    ...zone,
    rate: Number(zone.rate),
    freeShippingMinOrder: zone.freeShippingMinOrder ? Number(zone.freeShippingMinOrder) : null,
  };
}

export async function GET() {
  try {
    await requirePermission("settings.view");
    const zones = await prisma.shippingZone.findMany({ orderBy: [{ isDefault: "asc" }, { country: "asc" }] });
    return ok(zones.map(serialize));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("settings.manage");
    const body = await request.json();
    const parsed = shippingZoneSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const data = parsed.data;
    const existing = await prisma.shippingZone.findUnique({ where: { country: data.country } });
    if (existing) return fail(409, `A shipping zone for ${data.country} already exists`);

    const zone = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.shippingZone.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.shippingZone.create({
        data: {
          country: data.country,
          label: data.label,
          rate: data.rate,
          freeShippingMinOrder: data.freeShippingMinOrder ?? null,
          isDefault: data.isDefault,
        },
      });
    });

    return ok(serialize(zone), "Shipping zone created");
  } catch (error) {
    return handleApiError(error);
  }
}
