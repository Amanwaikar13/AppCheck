import { Suspense } from "react";
import AuthCard, { AuthFormSkeleton } from "@/features/auth/AuthCard";
import LoginForm from "@/features/auth/LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Welcome back. Sign in to your AppCheck workspace.">
      <Suspense fallback={<AuthFormSkeleton fields={2} />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
