import { z } from "zod";

export const adminPasswordVerifySchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const adminPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const adminSessionResponseSchema = z.object({
  sessionToken: z.string(),
  expiresAt: z.string(),
  expiresIn: z.number(),
});

export type AdminPasswordVerify = z.infer<typeof adminPasswordVerifySchema>;
export type AdminPasswordChange = z.infer<typeof adminPasswordChangeSchema>;
export type AdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;
