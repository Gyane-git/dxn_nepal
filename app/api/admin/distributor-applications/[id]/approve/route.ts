import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";
import { sendMailBestEffort, distributorApplicationApprovedEmail } from "@/lib/mail";
import { generateDistributorId } from "@/lib/distributorId";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid application id");

    const application = await prisma.distributorApplication.findUnique({ where: { id }, include: { user: true } });
    if (!application) return fail(404, "Application not found");
    if (application.status !== "PENDING") return fail(400, `Application is already ${application.status.toLowerCase()}`);

    const { distributorId, user } = await prisma.$transaction(async (tx) => {
      const newDistributorId = await generateDistributorId(tx);

      const updatedUser = await tx.user.update({
        where: { id: application.userId },
        data: { role: "DISTRIBUTOR", distributorId: newDistributorId, distributorApprovedAt: new Date() },
      });

      await tx.distributorApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          distributorId: newDistributorId,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      return { distributorId: newDistributorId, user: updatedUser };
    });

    await notify(user.id, `Your distributor application was approved! Your Distributor ID is ${distributorId}.`);
    await sendMailBestEffort({
      to: user.email,
      ...distributorApplicationApprovedEmail({ name: user.name, distributorId }),
    });

    return ok({ distributorId }, "Application approved");
  } catch (error) {
    return handleApiError(error);
  }
}
