import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  passwordChangeSchema,
  PASSWORD_CHANGE_DEFAULTS,
  type PasswordChangeData,
} from "@/lib/password-change";

interface ChangePasswordFormProps {
  /** The login password is seeded as the current password in the forced-change flow. */
  initialCurrentPassword: string;
  isPending: boolean;
  onSubmit: (data: PasswordChangeData) => void;
}

export function ChangePasswordForm({
  initialCurrentPassword,
  isPending,
  onSubmit,
}: ChangePasswordFormProps) {
  const form = useForm<PasswordChangeData, unknown, PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { ...PASSWORD_CHANGE_DEFAULTS, currentPassword: initialCurrentPassword },
    mode: "onChange",
  });

  useEffect(() => {
    form.reset({ ...PASSWORD_CHANGE_DEFAULTS, currentPassword: initialCurrentPassword });
  }, [initialCurrentPassword, form]);

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel required className="text-slate-700">
                Current password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  data-testid="input-change-current"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel required className="text-slate-700">
                New password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  data-testid="input-change-new"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-slate-500">At least 8 characters.</p>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel required className="text-slate-700">
                Confirm new password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  data-testid="input-change-confirm"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" data-testid="text-password-mismatch" />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full bg-teal-600 text-white hover:bg-teal-700"
          disabled={isPending}
          data-testid="button-change-password"
        >
          Update password
        </Button>
      </form>
    </Form>
  );
}
