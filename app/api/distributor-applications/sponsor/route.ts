import { requireUser } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { resolveSponsor } from "@/lib/sponsor";

/** Looks up a Sponsor ID and returns the sponsor's name for the applicant to confirm before submitting. */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const sponsorId = searchParams.get("id");
    if (!sponsorId) return fail(400, "Sponsor ID is required");

    const sponsor = await resolveSponsor(sponsorId, user.id);
    if (!sponsor) return fail(404, "No distributor was found with that Sponsor ID");

    return ok({ name: sponsor.name, distributorId: sponsor.distributorId });
  } catch (error) {
    return handleApiError(error);
  }
}
