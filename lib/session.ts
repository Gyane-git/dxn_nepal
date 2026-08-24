import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "You must be logged in");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Admin access required");
  return user;
}

/** A dealer is a capability granted to a Distributor account (see Dealer.userId), not a separate role. */
export async function requireDealer() {
  const user = await requireUser();
  const dealer = await prisma.dealer.findUnique({ where: { userId: user.id } });
  if (!dealer || dealer.status !== "ACTIVE") throw new ApiError(403, "Dealer access required");
  return { user, dealer };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
