import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  description: z.string().max(500).nullable().optional(),
  permissions: z.array(z.string()).default([]),
});

export type RoleInput = z.infer<typeof roleSchema>;
