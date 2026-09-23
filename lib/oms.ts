import { prisma } from "@/lib/prisma";
import { ensureUniqueSlug } from "@/lib/slug";

type OmsProduct = {
  sku?: string | null;
  productName?: string | null;
  description?: string | null;
  categoryCode?: string | null;
  category?: string | null;
  price?: number | string | null;
  mrp?: number | string | null;
  purchasePrice?: number | string | null;
  availableQty?: number | string | null;
  stockQuantity?: number | string | null;
};

type OmsResponse = { data?: OmsProduct[]; message?: string };

type OmsSalesCenter = {
  SalesCenterCode?: string | null;
  SalesCenterName?: string | null;
  Country?: string | null;
  Address?: string | null;
  Telphone?: string | null;
  Mobile?: string | null;
  ContactPerson?: string | null;
};

const DEFAULT_TOKEN_URL = "http://nbewebapi.globaltechsolution.com.np:802/token";
const DEFAULT_RESET_URL = "http://nbewebapi.globaltechsolution.com.np:802/api/v1/full-reset";
const DEFAULT_ORDER_URL = "http://nbewebapi.globaltechsolution.com.np:802/api/v1/placeEcomOrder";
const OMS_CATEGORY_MARKER = "oms:";

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function stockValue(product: OmsProduct) {
  return Math.max(0, Math.floor(numberValue(product.availableQty ?? product.stockQuantity)));
}

/** OMS accepts monetary values as decimal strings. Avoid JS floating-point tails in the payload. */
function omsAmount(value: number) {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

async function fetchOmsAccessToken() {
  const username = process.env.OMS_USERNAME;
  const password = process.env.OMS_PASSWORD;
  if (!username || !password) {
    throw new Error("OMS is not configured. Set OMS_USERNAME and OMS_PASSWORD on the server.");
  }

  const tokenResponse = await fetch(process.env.OMS_TOKEN_URL || DEFAULT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password, grant_type: "password" }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!tokenResponse.ok) throw new Error(`OMS token request failed (${tokenResponse.status}).`);

  const tokenBody = (await tokenResponse.json()) as { access_token?: string; token?: string };
  const token = tokenBody.access_token ?? tokenBody.token;
  if (!token) throw new Error("OMS token response did not include an access token.");

  return token;
}

/** Fetch the complete current catalog from OMS. Credentials only ever live in server env vars. */
export async function fetchOmsCatalog(): Promise<OmsProduct[]> {
  const token = await fetchOmsAccessToken();
  const resetUrl = new URL(process.env.OMS_RESET_URL || DEFAULT_RESET_URL);
  resetUrl.searchParams.set("Storecode", process.env.OMS_STORE_CODE || "DXNECOME01");
  const catalogResponse = await fetch(resetUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!catalogResponse.ok) throw new Error(`OMS catalog request failed (${catalogResponse.status}).`);
  const payload = (await catalogResponse.json()) as OmsResponse;
  if (!Array.isArray(payload.data)) throw new Error("OMS catalog response did not contain product data.");
  return payload.data;
}

/** Fetch sales centers from OMS. These are read-only master records in this app. */
export async function fetchOmsSalesCenters(): Promise<OmsSalesCenter[]> {
  const token = await fetchOmsAccessToken();
  const url = new URL("http://nbewebapi.globaltechsolution.com.np:802/api/v1/full-salescenter");
  url.searchParams.set("storeCode", process.env.OMS_STORE_CODE || "DXNECOME01");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OMS sales-center request failed (${response.status}).`);
  const payload = (await response.json()) as { data?: OmsSalesCenter[] };
  if (!Array.isArray(payload.data)) throw new Error("OMS sales-center response did not contain dealer data.");
  return payload.data;
}

/** Upserts OMS sales centers without touching locally managed inventory, cities, or shipping rules. */
export async function syncOmsSalesCenters() {
  const centers = await fetchOmsSalesCenters();
  const catalog = await prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    select: { id: true, stock: true },
  });
  let createdDealers = 0;
  let updatedDealers = 0;
  let skippedDealers = 0;

  for (const center of centers) {
    const salesCenterCode = center.SalesCenterCode?.trim();
    const name = center.SalesCenterName?.trim();
    if (!salesCenterCode || !name) {
      skippedDealers++;
      continue;
    }
    const phone = center.Mobile?.trim() || center.Telphone?.trim() || null;
    const data = {
      salesCenterCode,
      name,
      country: center.Country?.trim() || null,
      address: center.Address?.trim() || null,
      phone,
      contactPerson: center.ContactPerson?.trim() || null,
      status: "ACTIVE" as const,
    };
    const existing = await prisma.dealer.findFirst({
      where: { OR: [{ salesCenterCode }, { name }] },
    });
    const dealer = existing
      ? await prisma.dealer.update({ where: { id: existing.id }, data })
      : await prisma.dealer.create({ data });
    if (existing) {
      updatedDealers++;
    } else {
      createdDealers++;
    }
    // All OMS products are assigned on first sync. createMany only adds missing rows, so a
    // dealer's manually edited stock is retained on later OMS dealer syncs.
    if (catalog.length > 0) {
      await prisma.dealerInventory.createMany({
        data: catalog.map((product) => ({
          dealerId: dealer.id,
          productId: product.id,
          variantId: null,
          stock: product.stock,
          status: "ACTIVE",
        })),
        skipDuplicates: true,
      });
    }
  }
  return { receivedDealers: centers.length, createdDealers, updatedDealers, skippedDealers };
}

/**
 * Sends a locally committed order to OMS. The local order is never rolled back when OMS is
 * temporarily unavailable; payment/order integrity remains authoritative in this application.
 */
export async function postOrderToOms(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      dealer: { select: { salesCenterCode: true } },
      user: { select: { name: true, distributorId: true, phone: true } },
      items: { include: { product: { select: { sku: true, price: true } } } },
    },
  });
  if (!order) throw new Error("Order not found");
  const salesCenter = order.dealer?.salesCenterCode;
  if (!salesCenter) throw new Error("No OMS sales center is assigned to this order");
  if (order.items.some((item) => !item.product.sku)) throw new Error("One or more order items do not have an OMS SKU");

  // OMS returns only a generic 500 for an unknown SKU. Validate first so staff receive an
  // actionable error and never believe an unsupported legacy/local product was dispatched.
  const omsSkus = new Set((await fetchOmsCatalog()).map((product) => product.sku?.trim()).filter(Boolean));
  const unknownSku = order.items.find((item) => !omsSkus.has(item.product.sku!.trim()));
  if (unknownSku) throw new Error(`${unknownSku.product.sku} is not available in the OMS catalog. Sync products or use an OMS product before sending this order.`);

  const token = await fetchOmsAccessToken();
  const omsDate = (date: Date) => date.toISOString().slice(0, 19);
  const payload = {
    storeCode: process.env.OMS_STORE_CODE || "DXNECOME01",
    // OMS's placeEcomOrder stored procedure expects a numeric order number (as in its sample
    // payload). The storefront's display number can be alphanumeric, so use the stable local id.
    orderNumber: String(order.id),
    SalesCenter: salesCenter,
    orderId: String(order.id),
    Updated: omsDate(order.updatedAt),
    // Keep this simple ASCII text: some OMS installations reject Unicode/punctuation in remarks.
    remarks: `Ecommerce order ${order.id}`,
    membercode: order.user.distributorId ?? "",
    // A normal ecommerce account is not an OMS member. A fabricated member/user code can make
    // the OMS stored procedure fail with its otherwise unhelpful generic 500 response.
    membername: order.user.distributorId ? order.user.name : "",
    membermobile: order.phone || order.user.phone || "",
    // COD is collected on delivery, so OMS receives zero as in its provided sample.
    PaymentAmount: order.paymentStatus === "PAID" ? omsAmount(Number(order.total)) : "0",
    CustomerName: order.fullName,
    Cashbankname: process.env.OMS_CASH_BANK_NAME || "10",
    Order: order.items.map((item) => {
      const unitPrice = Number(item.price);
      const catalogPrice = Number(item.product.price);
      const quantity = item.quantity;
      const discountAmount = Math.max(0, catalogPrice - unitPrice) * quantity;
      return {
        sku: item.product.sku!,
        quantity: String(quantity),
        unitPrice: omsAmount(unitPrice),
        finalPrice: omsAmount(unitPrice * quantity),
        remarks: "",
        DiscountAmount: omsAmount(discountAmount),
        Discountrate: String(item.discountPercent ?? 0),
        DispatchAmount: "0",
      };
    }),
    userDetails: {
      userName: order.user.distributorId ? order.user.name : "",
      userCode: order.user.distributorId ?? "",
      phone: order.phone || order.user.phone || "",
      deliveryTime: omsDate(order.placedAt),
    },
  };
  // Diagnostics deliberately exclude token, phone, address, and customer details.
  console.info("[oms] sending order", {
    orderId: order.id,
    orderNumber: payload.orderNumber,
    salesCenter: payload.SalesCenter,
    paymentAmount: payload.PaymentAmount,
    items: payload.Order.map((item) => ({ sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice, finalPrice: item.finalPrice })),
  });
  const response = await fetch(process.env.OMS_ORDER_URL || DEFAULT_ORDER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const rawResponse = await response.text();
  let responseBody: { status?: unknown; message?: unknown } | null = null;
  try {
    responseBody = rawResponse ? JSON.parse(rawResponse) as { status?: unknown; message?: unknown } : null;
  } catch {
    // Some OMS failures are plain text or HTML; retain a short safe excerpt below.
  }
  if (!response.ok) {
    const detail = typeof responseBody?.message === "string" ? responseBody.message : rawResponse.trim().slice(0, 500);
    throw new Error(detail ? `OMS order request failed (${response.status}): ${detail}` : `OMS order request failed (${response.status}).`);
  }
  if (typeof responseBody?.status === "string" && responseBody.status.toLowerCase() !== "success") {
    throw new Error(typeof responseBody.message === "string" ? responseBody.message : "OMS did not accept the order");
  }
  await prisma.order.update({ where: { id: orderId }, data: { omsSyncStatus: "SUCCESS", omsSyncError: null, omsSyncedAt: new Date() } });
}

/** Upserts OMS categories and products. Product images remain local and are never overwritten. */
export async function syncOmsCatalog() {
  const sourceProducts = await fetchOmsCatalog();
  const categories = new Map<string, { code: string; name: string }>();
  for (const product of sourceProducts) {
    const code = product.categoryCode?.trim();
    const name = product.category?.trim();
    if (code && name) categories.set(code, { code, name });
  }

  const categoryIds = new Map<string, number>();
  let createdCategories = 0;
  let updatedCategories = 0;
  for (const category of categories.values()) {
    // The deployed database predates an OMS-code column. Store the stable source code in the
    // otherwise unused icon field so sync works immediately without a schema migration.
    const existing = await prisma.category.findFirst({
      where: { OR: [{ icon: `${OMS_CATEGORY_MARKER}${category.code}` }, { name: category.name }] },
    });
    if (existing) {
      await prisma.category.update({ where: { id: existing.id }, data: { icon: `${OMS_CATEGORY_MARKER}${category.code}`, name: category.name, status: "ACTIVE", deletedAt: null } });
      categoryIds.set(category.code, existing.id);
      updatedCategories++;
    } else {
      const slug = await ensureUniqueSlug(prisma.category, `${category.code}-${category.name}`);
      const created = await prisma.category.create({ data: { icon: `${OMS_CATEGORY_MARKER}${category.code}`, name: category.name, slug, status: "ACTIVE" } });
      categoryIds.set(category.code, created.id);
      createdCategories++;
    }
  }

  let createdProducts = 0;
  let updatedProducts = 0;
  let skippedProducts = 0;
  for (const source of sourceProducts) {
    const sku = source.sku?.trim();
    const name = source.productName?.trim();
    const categoryId = source.categoryCode ? categoryIds.get(source.categoryCode.trim()) : undefined;
    if (!sku || !name || !categoryId) {
      skippedProducts++;
      continue;
    }
    const stock = stockValue(source);
    const price = numberValue(source.price);
    const mrp = numberValue(source.mrp);
    const existing = await prisma.product.findUnique({ where: { sku } });
    const data = {
      name,
      categoryId,
      shortDescription: source.description?.trim() || null,
      fullDescription: source.description?.trim() || name,
      costPrice: numberValue(source.purchasePrice),
      price,
      compareAtPrice: mrp > price ? mrp : null,
      stock,
      stockStatus: stock > 0 ? ("IN_STOCK" as const) : ("OUT_OF_STOCK" as const),
      status: "PUBLISHED" as const,
      deletedAt: null,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updatedProducts++;
    } else {
      const slug = await ensureUniqueSlug(prisma.product, `${sku}-${name}`);
      await prisma.product.create({
        data: { ...data, sku, slug, minimumOrderQuantity: 1, publishedAt: new Date(), colorway: "green" },
      });
      createdProducts++;
    }
  }

  return { receivedProducts: sourceProducts.length, createdProducts, updatedProducts, skippedProducts, createdCategories, updatedCategories };
}
