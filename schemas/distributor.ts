import { z } from "zod";

export const distributorApplicationSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(120),
  phone: z.string().min(7, "Enter a valid phone number").max(20).optional().or(z.literal("")),
  reason: z.string().max(2000).optional().or(z.literal("")),
});

export type DistributorApplicationInput = z.infer<typeof distributorApplicationSchema>;

export const reviewApplicationSchema = z.object({
  rejectionReason: z.string().max(500).optional().or(z.literal("")),
});

export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;
