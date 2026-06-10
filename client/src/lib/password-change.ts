import { z } from "zod";

/**
 * Shared change-password contract for the portal-login forced-change flow and
 * the profile page. One schema, two consumers — keeps the min-length and
 * confirm-match rules from drifting apart again.
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

export const PASSWORD_CHANGE_DEFAULTS: PasswordChangeData = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};
