import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { distributorApplicationSchema } from "@/schemas/distributor";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "USER") {
      return fail(400, user.role === "DISTRIBUTOR" ? "You are already a distributor" : "Not eligible to apply");
    }

    const body = await request.json();
    const parsed = distributorApplicationSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const pending = await prisma.distributorApplication.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    if (pending) return fail(409, "You already have a pending distributor application");

    const application = await prisma.distributorApplication.create({
      data: {
        userId: user.id,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        reason: parsed.data.reason || null,
      },
    });

    return ok(application, "Application submitted");
  } catch (error) {
    return handleApiError(error);
  }
}
