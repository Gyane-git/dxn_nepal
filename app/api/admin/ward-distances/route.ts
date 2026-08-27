import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { resolveOrCreateWard } from "@/lib/ward";
import { z } from "zod";

/** Lists the admin-configured ward-to-ward proximity table used to rank alternative dealers. */
export async function GET() {
  try {
    await requirePermission("dealers.view");
    const distances = await prisma.wardDistance.findMany({
      include: {
        fromWard: { include: { municipality: { select: { id: true, name: true } } } },
        toWard: { include: { municipality: { select: { id: true, name: true } } } },
      },
      orderBy: { id: "desc" },
    });
    return ok(distances);
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  fromMunicipalityId: z.number().int().positive(),
  fromWardNo: z.number().int().positive(),
  toMunicipalityId: z.number().int().positive(),
  toWardNo: z.number().int().positive(),
  distance: z.number().int().min(0).max(1000),
});

/** Sets the proximity between two wards. Symmetric: dealer ranking checks the pair in either direction. */
export async function POST(request: Request) {
  try {
    await requirePermission("dealers.edit");
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const fromWard = await resolveOrCreateWard(data.fromMunicipalityId, data.fromWardNo);
    const toWard = await resolveOrCreateWard(data.toMunicipalityId, data.toWardNo);
    if (fromWard.id === toWard.id) return fail(400, "Choose two different wards");

    const existing = await prisma.wardDistance.findFirst({
      where: {
        OR: [
          { fromWardId: fromWard.id, toWardId: toWard.id },
          { fromWardId: toWard.id, toWardId: fromWard.id },
        ],
      },
    });

    const row = existing
      ? await prisma.wardDistance.update({ where: { id: existing.id }, data: { distance: data.distance } })
      : await prisma.wardDistance.create({
          data: { fromWardId: fromWard.id, toWardId: toWard.id, distance: data.distance },
        });

    return ok(row, "Ward distance saved");
  } catch (error) {
    return handleApiError(error);
  }
}
