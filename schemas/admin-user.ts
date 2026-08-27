import { z } from "zod";

export const createAdminUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(150),
  email: z.string().email("Invalid email address").max(150),
  phone: z.string().max(20).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  adminRoleId: z.coerce.number().int().positive().nullable(),
  /** Links this new login to an existing Dealer record (Dealer.userId) — reuses requireDealer(),
   * so once set the account gets access to /account/dealer-orders and /account/dealer-inventory,
   * scoped strictly to that one dealer. Optional — most admin-panel accounts aren't dealers. */
  dealerId: z.coerce.number().int().positive().nullable().optional(),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

export const updateAdminUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(150),
  phone: z.string().max(20).optional().or(z.literal("")),
  adminRoleId: z.coerce.number().int().positive().nullable(),
  status: z.enum(["ACTIVE", "DISABLED"]),
  password: z.string().min(8, "Password must be at least 8 characters").max(72).optional().or(z.literal("")),
  dealerId: z.coerce.number().int().positive().nullable().optional(),
});

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
