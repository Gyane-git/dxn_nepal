import { z } from "zod";

const applicationAddressSchema = z.object({
  provinceId: z.number().int().positive("Province is required"),
  districtId: z.number().int().positive("District is required"),
  municipalityId: z.number().int().positive("City is required"),
  wardNo: z.number().int().positive("Ward is required"),
  toleArea: z.string().max(100).optional().or(z.literal("")),
  fullAddress: z.string().max(300).optional().or(z.literal("")),
  landmark: z.string().max(200).optional().or(z.literal("")),
});

const applicationBusinessSchema = z.object({
  businessName: z.string().max(150).optional().or(z.literal("")),
  businessType: z.string().max(100).optional().or(z.literal("")),
  panVatNumber: z.string().max(50).optional().or(z.literal("")),
  registrationNumber: z.string().max(50).optional().or(z.literal("")),
  businessAddress: z.string().max(300).optional().or(z.literal("")),
  businessPhone: z.string().max(20).optional().or(z.literal("")),
  businessEmail: z.string().max(150).email("Enter a valid business email").optional().or(z.literal("")),
  yearsInBusiness: z.number().int().min(0).max(100).optional(),
  estimatedMonthlySales: z.number().min(0).max(100_000_000).optional(),
  numberOfEmployees: z.number().int().min(0).max(100_000).optional(),
});

export const distributorApplicationSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(120),
  phone: z.string().min(7, "Enter a valid phone number").max(20).optional().or(z.literal("")),
  email: z.string().max(150).email("Enter a valid email").optional().or(z.literal("")),
  alternatePhone: z.string().min(7, "Enter a valid phone number").max(20).optional().or(z.literal("")),
  reason: z.string().max(2000).optional().or(z.literal("")),
  // Optional, but each block is all-or-nothing once started — see the form's own required-field enforcement.
  address: applicationAddressSchema.optional(),
  business: applicationBusinessSchema.optional(),
  /** A Distributor ID (e.g. "DXN-100001"), never a free-text name — validated server-side against real accounts, see lib/sponsor.ts. */
  sponsorId: z.string().max(30).optional().or(z.literal("")),
});

export type DistributorApplicationInput = z.infer<typeof distributorApplicationSchema>;

export const reviewApplicationSchema = z.object({
  rejectionReason: z.string().min(5, "A rejection reason is required").max(500),
});

export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;
