"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import { ErrorState, Spinner } from "@/components/ui/Feedback";
import FormField from "@/components/ui/FormField";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown } from "@/hooks/useCooldown";
import { formatCountdown } from "@/lib/rateLimit";
import { safeNextPath } from "@/lib/safeRedirect";
import { register as registerAccount } from "./authSlice";
import PasswordField from "./PasswordField";
import SuccessNotice from "./SuccessNotice";
import { PASSWORD_MIN_LENGTH, applyServerErrors, emailRules, nameRules, newPasswordRules } from "./validation";

export default function RegisterForm() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const { isAuthenticated } = useAuth();
  const [succeeded, setSucceeded] = useState(false);
  // After a 429, submitting again is pointless until the server's Retry-After passes.
  const cooldown = useCooldown();

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (isAuthenticated) router.replace(next);
  }, [isAuthenticated, next, router]);

  const onSubmit = async ({ name, email, password }) => {
    const result = await dispatch(registerAccount({ name, email, password }));
    // Cancelled because an identical request is already in flight: nothing to show.
    if (result.meta?.condition) return;
    if (registerAccount.fulfilled.match(result)) {
      setSucceeded(true);
      return;
    }
    if (result.payload?.code === "RATE_LIMITED") {
      cooldown.start(result.payload.retryAfterSeconds ?? 60);
      setError("root.server", { type: "rateLimited", message: result.payload.message });
      return;
    }
    const message = applyServerErrors(result.payload, setError, ["name", "email", "password"]);
    if (message) setError("root.server", { message });
  };

  if (succeeded) return <SuccessNotice>Account created. Taking you to your dashboard…</SuccessNotice>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root?.server && (
        <ErrorState title={errors.root.server.type === "rateLimited" ? "Temporarily rate limited" : "Could not create your account"}>
          {errors.root.server.message}
        </ErrorState>
      )}

      <FormField
        id="name"
        placeholder="Enter your full name"
        label="Name"
        autoComplete="name"
        error={errors.name?.message}
        inputProps={field("name", nameRules)}
      />
      <FormField
        id="email"
        placeholder="you@example.com"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        inputProps={field("email", emailRules)}
      />
      <PasswordField
        id="password"
        placeholder="Create a strong password"
        label="Password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A passphrase works well.`}
        error={errors.password?.message}
        inputProps={field("password", newPasswordRules)}
      />
      <PasswordField
        id="confirmPassword"
        placeholder="Re-enter your password"
        label="Confirm password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        inputProps={field("confirmPassword", {
          required: "Confirm your password",
          validate: (value, values) => value === values.password || "Passwords do not match",
        })}
      />

      <Button type="submit" className="w-full" disabled={isSubmitting || cooldown.active}>
        {isSubmitting
          ? <Spinner label="Creating account…" />
          : cooldown.active
            ? `Try again in ${formatCountdown(cooldown.remaining)}`
            : "Create account"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="rounded font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
