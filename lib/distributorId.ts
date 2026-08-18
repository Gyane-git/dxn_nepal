import type { Prisma } from "@prisma/client";

const DISTRIBUTOR_ID_PATTERN = /^DXN-\d+$/i;

/** True when `value` looks like a Distributor ID (e.g. "DXN-100001") rather than an email/other identifier. */
export function isDistributorId(value: string): boolean {
  return DISTRIBUTOR_ID_PATTERN.test(value.trim());
}

/**
 * Atomically reserves the next Distributor ID via a locked singleton counter row
 * (same "singleton" upsert pattern as EmailSettings/PaymentSettings) — no randomness,
 * no collision risk. Must be called inside the same transaction that upgrades the user,
 * and only ever from the admin approval flow.
 */
export async function generateDistributorId(tx: Prisma.TransactionClient): Promise<string> {
  const sequence = await tx.distributorSequence.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastValue: 100001 },
    update: { lastValue: { increment: 1 } },
  });
  return `DXN-${sequence.lastValue}`;
}
