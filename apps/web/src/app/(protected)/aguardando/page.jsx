"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ensureSession } from "@/services/auth";
import { createLead } from "@/services/leads";
import { useToast } from "@/components/ToastProvider";

export default function AguardandoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    birthdate: "",
    phone: "",
    email: "",
    city: "",
    ear: "Não",
    uber: "Não"
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await ensureSession();
      if (!session?.user) {
        window.location.href = "/login?next=/aguardando";
        return;
      }
      if (session.user.role !== "pending") {
        window.location.href = "/cliente";
        return;
      }
      setForm((f) => ({ ...f, name: session.user.name || "", email: session.user.email || "" }));
      setLoading(false);
    })();
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      await createLead({ ...form, overwrite: true });
      setMsg("Dados enviados! Você agora está como cliente e lead no funil.");
      setTimeout(() => { window.location.href = "/cliente"; }, 800);
    } catch (e) {
      setErr(e.message || "Erro ao enviar dados");
      toast.error(e.message || "Erro ao enviar dados");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-neutral-50 flex items-center justify-center">Carregando...</main>;

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white border border-neutral-200 shadow-xl rounded-2xl p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-semibold text-neutral-900">Aguardando aprovação</h1>
        <p className="text-neutral-600 mt-3">
          Seu cadastro foi recebido. Um administrador precisa liberar seu acesso ao painel.
        </p>
        <p className="text-neutral-700 mt-4 font-medium">Quer adiantar seus dados para locação?</p>

        <form onSubmit={submit} className="grid md:grid-cols-2 gap-4 mt-4">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Nome
            <input className="px-3 py-2 border border-neutral-200 rounded-lg" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            E-mail
            <input className="px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-100" value={form.email} disabled />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            CPF/CNPJ
            <input className="px-3 py-2 border border-neutral-200 rounded-lg" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Data de nascimento
            <input className="px-3 py-2 border border-neutral-200 rounded-lg" type="date" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            WhatsApp
            <input className="px-3 py-2 border border-neutral-200 rounded-lg" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Cidade
            <input className="px-3 py-2 border border-neutral-200 rounded-lg" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Possui EAR?
            <select className="px-3 py-2 border border-neutral-200 rounded-lg" value={form.ear} onChange={(e) => set("ear", e.target.value)}>
              <option>Sim</option><option>Não</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Cadastrado na Uber?
            <select className="px-3 py-2 border border-neutral-200 rounded-lg" value={form.uber} onChange={(e) => set("uber", e.target.value)}>
              <option>Sim</option><option>Não</option>
            </select>
          </label>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "#0f172a" }}>
              {saving ? "Enviando..." : "Enviar dados"}
            </button>
          </div>
        </form>

        {msg && <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">{msg}</div>}
        {err && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{err}</div>}

        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="px-4 py-2 rounded-lg border border-neutral-200 hover:border-neutral-400">
            Voltar ao site
          </Link>
          <Link href="/login" className="px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800">
            Ir para login
          </Link>
        </div>
      </div>
    </main>
  );
}
