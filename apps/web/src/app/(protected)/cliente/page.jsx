"use client";

import { useEffect, useState } from "react";
import { ensureSession } from "@/services/auth";
import { useToast } from "@/components/ToastProvider";

export default function ClientePage() {
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureSession();
        if (!session?.user) {
          window.location.href = "/login?next=/cliente";
          return;
        }
        if (session.user.role === "pending") {
          window.location.href = "/aguardando";
          return;
        }
        const r = await fetch("/api/my-lead", { credentials: "include", cache: "no-store" });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Lead não encontrado");
        setLead(data.lead);
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      }
    })();
  }, []);

  async function reopen() {
    try {
      const r = await fetch("/api/my-lead/reopen", { method: "POST", credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Erro ao solicitar contato");
      setLead(data.lead);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="bg-white border border-neutral-200 shadow-xl rounded-2xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Bem-vindo!</h1>
        {error && <p className="text-red-600 mt-2">{error}</p>}
        {lead ? (
          <div className="mt-4 text-left space-y-2 text-neutral-700">
            <p><strong>Nome:</strong> {lead.name}</p>
            <p><strong>Email:</strong> {lead.email}</p>
            <p><strong>Telefone:</strong> {lead.phone}</p>
            <p><strong>Cidade:</strong> {lead.city || "—"}</p>
            <div className="p-3 rounded-lg bg-[var(--brand-gray)] border border-neutral-200">
              <strong>Etapa atual:</strong> {lead.stage}
            </div>
            {["not_rented", "archived"].includes(lead.stage) && (
              <button
                onClick={reopen}
                className="mt-2 px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: "#0f172a" }}
              >
                Solicitar novo contato
              </button>
            )}
          </div>
        ) : !error ? <p className="mt-4 text-neutral-600">Carregando seus dados...</p> : null}
      </div>
    </main>
  );
}
