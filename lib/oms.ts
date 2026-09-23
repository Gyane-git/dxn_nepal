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
const OMS_CATEGORY_MARKER = "oms:";

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function stockValue(product: OmsProduct) {
  return Math.max(0, Math.floor(numberValue(product.availableQty ?? product.stockQuantity)));
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
    if (existing) {
      await prisma.dealer.update({ where: { id: existing.id }, data });
      updatedDealers++;
    } else {
      await prisma.dealer.create({ data });
      createdDealers++;
    }
  }
  return { receivedDealers: centers.length, createdDealers, updatedDealers, skippedDealers };
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
