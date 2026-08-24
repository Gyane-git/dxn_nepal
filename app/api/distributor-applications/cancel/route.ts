import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

/** Lets a user withdraw their own pending distributor application. */
export async function POST() {
  try {
    const user = await requireUser();

    const application = await prisma.distributorApplication.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    if (!application) return fail(404, "You have no pending application to cancel");

    await prisma.distributorApplication.update({
      where: { id: application.id },
      data: { status: "CANCELLED" },
    });

    return ok(null, "Application cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
