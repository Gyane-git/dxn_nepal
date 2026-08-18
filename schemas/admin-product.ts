import { z } from "zod";

const imageInputSchema = z.object({
  url: z.string(),
  alt: z.string().max(200).default(""),
  sortOrder: z.number().int().default(0),
});

const distributorDiscountRuleSchema = z.object({
  distributorId: z.coerce.number().int(),
  discountPercent: z.number().min(0, "Must be 0 or more").max(100, "Must be 100 or less"),
});

const baseProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().max(220).optional(),
  sku: z.string().max(80).nullable().optional(),
  categoryId: z.coerce.number().int({ message: "Category is required" }),
  brandId: z.coerce.number().int().nullable().optional(),

  shortDescription: z.string().max(2000).nullable().optional(),
  fullDescription: z.string().min(1, "Description is required"),

  costPrice: z.number().nonnegative().nullable().optional(),
  price: z.number().nonnegative("Price must be positive"),
  compareAtPrice: z.number().nonnegative().nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).nullable().optional(),
  discountValue: z.number().nonnegative().nullable().optional(),
  taxClass: z.string().max(100).nullable().optional(),

  stock: z.number().int().nonnegative().default(0),
  lowStockAlert: z.number().int().nonnegative().nullable().optional(),
  stockStatus: z.enum(["IN_STOCK", "OUT_OF_STOCK", "ON_BACKORDER"]).default("IN_STOCK"),
  minimumOrderQuantity: z.number().int().positive().default(1),
  maximumOrderQuantity: z.number().int().positive().nullable().optional(),

  weight: z.number().nonnegative().nullable().optional(),
  length: z.number().nonnegative().nullable().optional(),
  width: z.number().nonnegative().nullable().optional(),
  height: z.number().nonnegative().nullable().optional(),

  featuredImage: z.string().nullable().optional(),
  images: z.array(imageInputSchema).default([]),

  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isSpecial: z.boolean().default(false),
  isWeekly: z.boolean().default(false),
  isFlash: z.boolean().default(false),

  metaTitle: z.string().max(160).nullable().optional(),
  metaDescription: z.string().max(320).nullable().optional(),
  metaKeywords: z.string().max(320).nullable().optional(),

  warranty: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().max(60)).default([]),
  colorway: z.string().max(40).default("green"),

  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  publishedAt: z.string().datetime().nullable().optional(),

  relatedIds: z.array(z.coerce.number().int()).default([]),
  crossSellIds: z.array(z.coerce.number().int()).default([]),
  upSellIds: z.array(z.coerce.number().int()).default([]),

  hasDiscount: z.boolean().default(false),
  forCustomer: z.boolean().default(false),
  customerDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  forDistributor: z.boolean().default(false),
  distributorDiscounts: z.array(distributorDiscountRuleSchema).default([]),

  hasPointValue: z.boolean().default(false),
  pvDistributorIds: z.array(z.coerce.number().int()).default([]),
});

export const productSchema = baseProductSchema.superRefine((data, ctx) => {
  if (!data.hasDiscount) return;

  if (data.forCustomer && (data.customerDiscountPercent === null || data.customerDiscountPercent === undefined)) {
    ctx.addIssue({
      code: "custom",
      path: ["customerDiscountPercent"],
      message: "Customer discount percentage is required",
    });
  }

  if (data.forDistributor) {
    if (data.distributorDiscounts.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["distributorDiscounts"],
        message: "Select at least one distributor and a discount percentage",
      });
    }
    const seen = new Set<number>();
    for (const [i, rule] of data.distributorDiscounts.entries()) {
      if (seen.has(rule.distributorId)) {
        ctx.addIssue({ code: "custom", path: ["distributorDiscounts", i], message: "Duplicate distributor" });
      }
      seen.add(rule.distributorId);
    }
  }
}).superRefine((data, ctx) => {
  if (!data.hasPointValue) return;

  if (data.pvDistributorIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["pvDistributorIds"],
      message: "Select at least one distributor to earn PV on this product",
    });
  }
  if (new Set(data.pvDistributorIds).size !== data.pvDistributorIds.length) {
    ctx.addIssue({ code: "custom", path: ["pvDistributorIds"], message: "Duplicate distributor" });
  }
});

export type ProductInput = z.infer<typeof baseProductSchema>;

export const productBulkActionSchema = z.object({
  ids: z.array(z.coerce.number().int()).min(1),
  action: z.enum(["delete", "restore", "publish", "unpublish", "archive", "feature", "unfeature"]),
});

export type ProductBulkActionInput = z.infer<typeof productBulkActionSchema>;
