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
import { login } from "./authSlice";
import PasswordField from "./PasswordField";
import SuccessNotice from "./SuccessNotice";
import { applyServerErrors, emailRules } from "./validation";

export default function LoginForm() {
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
  } = useForm({ mode: "onTouched", defaultValues: { email: "", password: "" } });

  // Already signed in (or just signed in): continue to the requested page.
  useEffect(() => {
    if (isAuthenticated) router.replace(next);
  }, [isAuthenticated, next, router]);

  const onSubmit = async (values) => {
    const result = await dispatch(login(values));
    // Cancelled because an identical request is already in flight: nothing to show.
    if (result.meta?.condition) return;
    if (login.fulfilled.match(result)) {
      setSucceeded(true);
      return;
    }
    if (result.payload?.code === "RATE_LIMITED") {
      cooldown.start(result.payload.retryAfterSeconds ?? 60);
      setError("root.server", { type: "rateLimited", message: result.payload.message });
      return;
    }
    const message = applyServerErrors(result.payload, setError, ["email", "password"]);
    if (message) setError("root.server", { message });
  };

  if (succeeded) return <SuccessNotice>Signed in. Taking you to AppCheck…</SuccessNotice>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root?.server && (
        <ErrorState title={errors.root.server.type === "rateLimited" ? "Temporarily rate limited" : "Sign-in failed"}>
          {errors.root.server.message}
        </ErrorState>
      )}

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
        placeholder="Enter your password"
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        inputProps={field("password", { required: "Password is required" })}
      />

      <Button type="submit" className="w-full" disabled={isSubmitting || cooldown.active}>
        {isSubmitting
          ? <Spinner label="Signing in…" />
          : cooldown.active
            ? `Try again in ${formatCountdown(cooldown.remaining)}`
            : "Sign in"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        New to AppCheck?{" "}
        <Link
          href={next === "/dashboard" ? "/register" : `/register?next=${encodeURIComponent(next)}`}
          className="rounded font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
