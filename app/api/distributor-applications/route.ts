import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { distributorApplicationSchema } from "@/schemas/distributor";
import { resolveSponsor } from "@/lib/sponsor";
import { resolveOrCreateWard } from "@/lib/ward";
import { validateAddressLocation } from "@/lib/checkoutCore";
import { notify } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "USER") {
      return fail(400, user.role === "DISTRIBUTOR" ? "You are already a distributor" : "Not eligible to apply");
    }

    const body = await request.json();
    const parsed = distributorApplicationSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const pending = await prisma.distributorApplication.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    if (pending) return fail(409, "You already have a pending distributor application");

    const sponsor = await resolveSponsor(data.sponsorId, user.id);

    let wardId: number | null = null;
    if (data.address) {
      await validateAddressLocation(
        data.address.provinceId,
        data.address.districtId,
        data.address.municipalityId,
        data.address.wardNo
      );
      const ward = await resolveOrCreateWard(data.address.municipalityId, data.address.wardNo);
      wardId = ward.id;
    }

    const application = await prisma.distributorApplication.create({
      data: {
        userId: user.id,
        fullName: data.fullName,
        phone: data.phone || null,
        email: data.email || null,
        alternatePhone: data.alternatePhone || null,
        reason: data.reason || null,
        sponsorDistributorId: sponsor?.id ?? null,
        provinceId: data.address?.provinceId ?? null,
        districtId: data.address?.districtId ?? null,
        municipalityId: data.address?.municipalityId ?? null,
        wardId,
        toleArea: data.address?.toleArea || null,
        fullAddress: data.address?.fullAddress || null,
        landmark: data.address?.landmark || null,
        businessName: data.business?.businessName || null,
        businessType: data.business?.businessType || null,
        panVatNumber: data.business?.panVatNumber || null,
        registrationNumber: data.business?.registrationNumber || null,
        businessAddress: data.business?.businessAddress || null,
        businessPhone: data.business?.businessPhone || null,
        businessEmail: data.business?.businessEmail || null,
        yearsInBusiness: data.business?.yearsInBusiness ?? null,
        estimatedMonthlySales: data.business?.estimatedMonthlySales ?? null,
        numberOfEmployees: data.business?.numberOfEmployees ?? null,
      },
    });

    if (sponsor) {
      await notify(sponsor.id, `${user.name} applied for a distributorship using your Sponsor ID.`, {
        type: "distributor_application",
      });
    }

    return ok(application, "Application submitted");
  } catch (error) {
    return handleApiError(error);
  }
}
