import AppShell from "@/components/layout/AppShell";
import AuthGate from "@/features/auth/AuthGate";

export default function AppLayout({ children }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
