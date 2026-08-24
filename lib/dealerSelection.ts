import { prisma } from "@/lib/prisma";
import { CITYWIDE_WARD_NO, resolveOrCreateWard } from "@/lib/ward";

export interface CartLine {
  productId: number;
  variantId: number | null;
  quantity: number;
}

export interface DealerOption {
  dealerId: number;
  dealerName: string;
  isPrimary: boolean;
  canFulfillOrder: boolean;
  stockStatus: "Available" | "Partial" | "Unavailable";
  shippingCharge: number;
}

export interface DealerSelectionResult {
  /** False when no dealer exists anywhere in the system yet — checkout should fall back to the
   * pre-dealer municipality/zone shipping flow entirely rather than blocking every order. Only
   * once this is true does dealer selection become a required step. */
  dealerSystemActive: boolean;
  primary: DealerOption | null;
  alternatives: DealerOption[];
  noneAvailable: boolean;
}

/** Safety net against pathological data only — not a UX-driving cap. A real city's dealer count
 * (seen in practice: 50-60) is expected to exceed the old "top 5" limit; the checkout UI shows
 * every eligible dealer in a scrollable list rather than truncating it. */
const MAX_ALTERNATIVES = 100;

/**
 * Resolves dealer options for a customer's City (municipality) + cart. Matching is city-wide:
 * any dealer with a ward-assignment row anywhere inside that municipality is a candidate — a city
 * has many wards, so different dealers can each cover a different ward of the same city and all
 * show up here as separate selectable options.
 *
 * Ward still matters for precision when the customer's exact `wardNo` is known (at final order
 * placement; omitted during the checkout page's early city-only preview, before the customer has
 * finished their address): a dealer specifically assigned to that exact ward outranks one only
 * assigned city-wide, and its ward-specific shipping-charge override (if any) is used ahead of a
 * city-wide override. Without a wardNo, only city-wide (`CITYWIDE_WARD_NO`) assignments/overrides
 * can be resolved with certainty, so those are preferred as the estimate shown at that stage.
 */
export async function getDealerOptions(
  municipalityId: number,
  cart: CartLine[],
  wardNo?: number
): Promise<DealerSelectionResult> {
  const activeDealerCount = await prisma.dealer.count({ where: { status: "ACTIVE" } });
  if (activeDealerCount === 0) {
    return { dealerSystemActive: false, primary: null, alternatives: [], noneAvailable: true };
  }

  const wardsInCity = await prisma.ward.findMany({ where: { municipalityId }, select: { id: true, wardNo: true } });
  // Materialize the customer's exact ward (if given) so an admin-configured exact-ward
  // assignment/override can be matched precisely, even if no one has referenced that ward before.
  const exactWard =
    wardNo != null && wardNo !== CITYWIDE_WARD_NO ? await resolveOrCreateWard(municipalityId, wardNo) : null;
  const allWards = exactWard && !wardsInCity.some((w) => w.id === exactWard.id) ? [...wardsInCity, exactWard] : wardsInCity;

  if (allWards.length === 0) {
    return { dealerSystemActive: true, primary: null, alternatives: [], noneAvailable: true };
  }
  const wardIdToWardNo = new Map(allWards.map((w) => [w.id, w.wardNo]));
  const wardIds = allWards.map((w) => w.id);

  const assignments = await prisma.dealerWardAssignment.findMany({
    where: { wardId: { in: wardIds } },
    include: { dealer: true },
  });

  const byDealer = new Map<number, (typeof assignments)[number]["dealer"]>();
  let exactPrimaryDealerId: number | null = null;
  let citywidePrimaryDealerId: number | null = null;
  for (const a of assignments) {
    if (a.dealer.status !== "ACTIVE") continue;
    byDealer.set(a.dealerId, a.dealer);
    if (a.priority !== 1) continue;
    const thisWardNo = wardIdToWardNo.get(a.wardId);
    if (exactWard != null && a.wardId === exactWard.id) exactPrimaryDealerId = a.dealerId;
    else if (thisWardNo === CITYWIDE_WARD_NO) citywidePrimaryDealerId = a.dealerId;
  }
  // An exact-ward match always outranks a merely city-wide one — never two dealers both "primary".
  const primaryDealerId = exactPrimaryDealerId ?? citywidePrimaryDealerId;

  if (byDealer.size === 0) {
    return { dealerSystemActive: true, primary: null, alternatives: [], noneAvailable: true };
  }

  const dealerIds = [...byDealer.keys()];
  const productIds = [...new Set(cart.map((l) => l.productId))];

  const [inventoryRows, shippingOverrides] = await Promise.all([
    prisma.dealerInventory.findMany({ where: { dealerId: { in: dealerIds }, productId: { in: productIds } } }),
    prisma.dealerShippingCharge.findMany({
      where: { dealerId: { in: dealerIds }, wardId: { in: wardIds }, isActive: true },
    }),
  ]);

  const stockKey = (dealerId: number, productId: number, variantId: number | null) =>
    `${dealerId}:${productId}:${variantId ?? "base"}`;
  const stockMap = new Map(inventoryRows.map((r) => [stockKey(r.dealerId, r.productId, r.variantId), r.stock]));

  // Precedence per dealer: exact-ward override > city-wide override > (fall through to the
  // dealer's own default shippingCharge below). An exact-ward override always wins once known.
  const overrideByDealer = new Map<number, number>();
  for (const o of shippingOverrides) {
    const thisWardNo = wardIdToWardNo.get(o.wardId);
    const isExact = exactWard != null && o.wardId === exactWard.id;
    const isCitywide = thisWardNo === CITYWIDE_WARD_NO;
    const current = overrideByDealer.get(o.dealerId);
    if (isExact || (isCitywide && current == null)) overrideByDealer.set(o.dealerId, Number(o.charge));
  }

  const options: DealerOption[] = dealerIds.map((dealerId) => {
    const dealer = byDealer.get(dealerId)!;
    let hasAny = false;
    let hasAll = true;
    for (const line of cart) {
      const stock = stockMap.get(stockKey(dealerId, line.productId, line.variantId)) ?? 0;
      if (stock > 0) hasAny = true;
      if (stock < line.quantity) hasAll = false;
    }
    return {
      dealerId,
      dealerName: dealer.name,
      isPrimary: dealerId === primaryDealerId,
      canFulfillOrder: hasAll,
      stockStatus: hasAll ? "Available" : hasAny ? "Partial" : "Unavailable",
      shippingCharge: overrideByDealer.get(dealerId) ?? Number(dealer.shippingCharge),
    };
  });

  options.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.canFulfillOrder !== b.canFulfillOrder) return a.canFulfillOrder ? -1 : 1;
    if (a.shippingCharge !== b.shippingCharge) return a.shippingCharge - b.shippingCharge;
    return a.dealerId - b.dealerId;
  });

  const primary = options.find((o) => o.isPrimary) ?? null;
  const rest = primary ? options.filter((o) => !o.isPrimary) : options;
  const alternatives = rest.slice(0, MAX_ALTERNATIVES);
  const noneAvailable = !primary?.canFulfillOrder && !alternatives.some((a) => a.canFulfillOrder);

  return { dealerSystemActive: true, primary, alternatives, noneAvailable };
}

/** Re-validates a specific dealer can fulfill the given cart right now — the checkout-time authority, never the client. */
export async function verifyDealerCanFulfill(dealerId: number, cart: CartLine[]): Promise<boolean> {
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
  if (!dealer || dealer.status !== "ACTIVE") return false;

  for (const line of cart) {
    const row = await prisma.dealerInventory.findFirst({
      where: { dealerId, productId: line.productId, variantId: line.variantId },
    });
    if ((row?.stock ?? 0) < line.quantity) return false;
  }
  return true;
}
