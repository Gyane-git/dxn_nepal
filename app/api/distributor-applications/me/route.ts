import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const application = await prisma.distributorApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok(application);
  } catch (error) {
    return handleApiError(error);
  }
}
