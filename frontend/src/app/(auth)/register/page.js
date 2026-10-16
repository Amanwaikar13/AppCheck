import { Suspense } from "react";
import AuthCard, { AuthFormSkeleton } from "@/features/auth/AuthCard";
import RegisterForm from "@/features/auth/RegisterForm";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up AppCheck to analyze applications and code you are authorized to test."
    >
      <Suspense fallback={<AuthFormSkeleton fields={4} />}>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
