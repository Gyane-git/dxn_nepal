import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";
import { sendMailBestEffort, distributorApplicationRejectedEmail } from "@/lib/mail";
import { reviewApplicationSchema } from "@/schemas/distributor";
import { recordAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("distributors.reject");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid application id");

    const body = await request.json().catch(() => ({}));
    const parsed = reviewApplicationSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const application = await prisma.distributorApplication.findUnique({ where: { id }, include: { user: true } });
    if (!application) return fail(404, "Application not found");
    if (application.status !== "PENDING") return fail(400, `Application is already ${application.status.toLowerCase()}`);

    const rejectionReason = parsed.data.rejectionReason;

    await prisma.distributorApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: "distributor_application.reject",
      entityType: "DistributorApplication",
      entityId: id,
      oldValue: { status: application.status },
      newValue: { status: "REJECTED" },
      reason: rejectionReason,
    });

    await notify(application.userId, "Your distributor application was not approved. You remain a valued customer.", {
      type: "distributor_application",
      link: "/distributor",
    });
    await sendMailBestEffort({
      to: application.user.email,
      ...distributorApplicationRejectedEmail({ name: application.user.name }, rejectionReason),
    });

    return ok(null, "Application rejected");
  } catch (error) {
    return handleApiError(error);
  }
}
