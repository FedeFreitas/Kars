"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureSession, logout } from "@/services/auth";

const brandYellow = "#ffd500";

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(null);

  const hideNav = pathname.startsWith("/login");
  const perms = session?.user?.permissions || {};

  async function loadSession() {
    try {
      const s = await ensureSession();
      setSession(s);
    } catch {
      setSession(null);
    }
  }

  useEffect(() => {
    loadSession();
  }, [pathname]);

  if (hideNav) return null;

  const links = [
    ...(session?.user &&
    session.user.role !== "pending" &&
    session.user.role !== "client"
      ? [{ href: "/dashboard", label: "Home" }]
      : []),
    ...(session?.user &&
    (perms.view_finance ||
      perms.edit_finance ||
      perms.manage_finance_types ||
      perms.void_finance)
      ? [{ href: "/financeiro", label: "Financeiro" }]
      : []),
    ...(session?.user && (perms.view_finance || perms.edit_finance)
      ? [{ href: "/fechamento", label: "Fechamento" }]
      : []),
    ...(session?.user && (perms.view_cars || perms.edit_cars)
      ? [{ href: "/carros", label: "Carros" }]
      : []),
    ...(session?.user && perms.edit_cars
      ? [{ href: "/imagens", label: "Imagens" }]
      : []),
    ...(session?.user && (perms.view_leads || perms.edit_leads)
      ? [{ href: "/leads", label: "Leads" }]
      : []),
    ...(session?.user && (perms.view_clients || perms.edit_clients)
      ? [{ href: "/clientes", label: "Clientes" }]
      : []),
    ...(session?.user &&
    (perms.view_movements ||
      perms.create_movements ||
      perms.edit_movements ||
      perms.manage_movement_catalogs)
      ? [{ href: "/movimentacoes", label: "Movimentacoes" }]
      : []),
    ...(session?.user &&
    (perms.view_email_templates || perms.edit_email_templates)
      ? [{ href: "/emails", label: "Emails" }]
      : []),
    ...(session?.user && (perms.view_users || perms.edit_users)
      ? [{ href: "/usuarios", label: "Usuarios" }]
      : []),
    ...(session?.user?.role === "client"
      ? [{ href: "/cliente", label: "Meu status" }]
      : []),
  ];

  const canOpenMovement =
    session?.user &&
    (perms.create_movements ||
      perms.edit_movements ||
      perms.manage_movement_catalogs ||
      perms.view_movements);

  function triggerMovementModal() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-movement-modal"));
      window.sessionStorage.setItem("openMovementModal", "1");
    }
    if (pathname !== "/movimentacoes") {
      router.push("/movimentacoes?nova=1");
    }
  }

  return (
    <nav className="w-full bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-semibold text-neutral-900">Kars</span>
        <div className="flex gap-4 text-sm text-neutral-700 flex-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2 py-1 rounded ${
                pathname === link.href
                  ? "bg-neutral-200 text-neutral-900"
                  : "hover:bg-neutral-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        {canOpenMovement && (
          <button
            onClick={triggerMovementModal}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800"
          >
            Nova movimentação
          </button>
        )}
        {session?.user && (
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: brandYellow, color: "#111827" }}
          >
            Sair
          </button>
        )}
      </div>
    </nav>
  );
}
