import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/session";
import { isDistributorId } from "@/lib/distributorId";

export interface SponsorInfo {
  id: number;
  name: string;
  distributorId: string;
}

/**
 * Resolves a Sponsor ID to an actual Distributor account. A sponsor must be an existing,
 * approved Distributor — never arbitrary text, and never the applicant themselves. Returns
 * null when no sponsor was given (sponsorship is optional); throws a user-facing ApiError for
 * any other invalid input so the caller can surface it directly.
 */
export async function resolveSponsor(
  sponsorId: string | null | undefined,
  applicantUserId: number
): Promise<SponsorInfo | null> {
  const trimmed = sponsorId?.trim();
  if (!trimmed) return null;

  if (!isDistributorId(trimmed)) {
    throw new ApiError(400, "Sponsor ID must be a valid Distributor ID (e.g. DXN-100001)");
  }

  const sponsor = await prisma.user.findUnique({
    where: { distributorId: trimmed.toUpperCase() },
    select: { id: true, name: true, role: true, distributorId: true },
  });

  if (!sponsor) throw new ApiError(400, "No distributor was found with that Sponsor ID");
  if (sponsor.role !== "DISTRIBUTOR") throw new ApiError(400, "The Sponsor ID must belong to an active distributor");
  if (sponsor.id === applicantUserId) throw new ApiError(400, "You cannot sponsor your own application");

  return { id: sponsor.id, name: sponsor.name, distributorId: sponsor.distributorId! };
}
