import AuthGuard from "@/components/AuthGuard";
import AppNav from "@/components/AppNav";
// garante que nunca seja cacheado estaticamente
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }) {
  return (
    <AuthGuard>
      <AppNav />
      {children}
    </AuthGuard>
  );
}
