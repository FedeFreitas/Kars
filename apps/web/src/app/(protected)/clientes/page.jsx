"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureSession } from "@/services/auth";
import { listClients, getClient, updateClient, listTariffOptions, createTariffOption } from "@/services/clients";
import { useToast } from "@/components/ToastProvider";
import { updateClientHistoryIgnore } from "@/services/clients";

const fields = [
  { key: "nome", label: "Nome" },
  { key: "tarifa", label: "Tarifa", type: "select" },
  { key: "tipo_tarifa", label: "Tipo de tarifa", type: "select" },
  { key: "cobranca_tipo", label: "Cobrança", type: "select", options: [{ value: "pre", label: "Pré-pago" }, { value: "pos", label: "Pós-pago" }] },
  { key: "ciclo_fechamento", label: "Ciclo de fechamento", type: "select", options: [
    { value: "diario", label: "Diário" },
    { value: "semanal", label: "Semanal" },
    { value: "mensal", label: "Mensal" }
  ] },
  { key: "nome_uber", label: "Nome Uber" },
  { key: "birthdate", label: "Nascimento", type: "date" },
  { key: "cpf", label: "CPF" },
  { key: "rg", label: "RG" },
  { key: "cnh", label: "CNH" },
  { key: "validade_cnh", label: "Validade CNH", type: "date" },
  { key: "observacoes", label: "Observacoes", textarea: true },
  { key: "email", label: "E-mail" },
  { key: "email_uber", label: "E-mail Uber" },
  { key: "celular", label: "Celular" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "contato_emergencia_nome", label: "Contato emergencia - nome" },
  { key: "contato_emergencia_numero", label: "Contato emergencia - numero" },
  { key: "endereco_rua", label: "Rua" },
  { key: "endereco_numero", label: "Numero" },
  { key: "endereco_complemento", label: "Complemento" },
  { key: "endereco_cep", label: "CEP" },
  { key: "endereco_bairro", label: "Bairro" },
  { key: "endereco_cidade", label: "Cidade" },
  { key: "endereco_estado", label: "Estado" },
  { key: "banco_favorecido", label: "Favorecido" },
  { key: "banco_cpf_cnpj", label: "CPF/CNPJ do favorecido" },
  { key: "banco_nome", label: "Banco" },
  { key: "banco_agencia", label: "Agencia" },
  { key: "banco_conta", label: "Conta" },
  { key: "banco_digito", label: "Digito" },
  { key: "banco_tipo", label: "Tipo de conta" },
  { key: "banco_pix", label: "Pix" },
  { key: "caucao", label: "Caucao" },
  { key: "forma_pagamento", label: "Forma de pagamento" }
];

function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md p-5">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="text-neutral-700 mt-2">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500">Cancelar</button>
          <button onClick={onConfirm} className="px-3 py-2 rounded-lg text-white" style={{ backgroundColor: "#0f172a" }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function section(title, keys, form, setForm, disabled, dynamic = {}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-800">{title}</h4>
      <div className="grid md:grid-cols-2 gap-3">
        {keys.map((key) => {
          const meta = fields.find((f) => f.key === key);
          if (!meta) return null;
          const isEmail = key === "email";
          const dynOptions = dynamic.options?.[key];
          const onAdd = dynamic.onAdd?.[key];
          const options = dynOptions || meta.options || [];
          if (meta.textarea) {
            return (
              <label key={key} className="flex flex-col gap-1 text-sm text-neutral-700 md:col-span-2">
                {meta.label}
                <textarea
                  value={form[key] || ""}
                  disabled={disabled || isEmail}
                  onChange={(e) => {
                    if (isEmail) return;
                    setForm((prev) => ({ ...prev, [key]: e.target.value }));
                  }}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white"
                />
              </label>
            );
          }
          return (
            <label key={key} className="flex flex-col gap-1 text-sm text-neutral-700">
              {meta.label}
              {meta.type === "select" ? (
                <div className="flex gap-2">
                  <select
                    value={form[key] || ""}
                    disabled={disabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white"
                  >
                    <option value="">Selecione</option>
                    {options.map((opt) => (
                      <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                    ))}
                  </select>
                  {onAdd && (
                    <button
                      type="button"
                      onClick={() => onAdd(setForm, key)}
                      disabled={disabled}
                      className="px-2 py-2 text-xs rounded border border-neutral-200 hover:border-neutral-400"
                    >
                      Novo
                    </button>
                  )}
                </div>
              ) : (
                <input
                  type={meta.type === "date" ? "date" : "text"}
                  value={form[key] || ""}
                  disabled={disabled || isEmail}
                  onChange={(e) => {
                    if (isEmail) return;
                    setForm((prev) => ({ ...prev, [key]: e.target.value }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white"
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [clients, setClients] = useState([]);
  const [tariffOptions, setTariffOptions] = useState([]);
  const [tariffTypeOptions, setTariffTypeOptions] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", action: null });
  const [statusSaving, setStatusSaving] = useState(false);
  const [historyIgnoreLoading, setHistoryIgnoreLoading] = useState(null);
  const [tariffModal, setTariffModal] = useState({ open: false, kind: "", value: "", setForm: null, field: "" });

  const perms = session?.user?.permissions || {};
  const canEdit = !!perms.edit_clients;
  const canVoidFinance = !!perms.void_finance;
  const canView = !!(perms.view_clients || perms.edit_clients);
  const canEditBilling = canEdit; // mesmo controle de edição

  useEffect(() => {
    (async () => {
      try {
        const me = await ensureSession();
        setSession(me);
        const allowed = !!(me?.user?.permissions?.view_clients || me?.user?.permissions?.edit_clients);
        if (!me?.user || !allowed) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
        setAuthorized(true);
        await fetchTariffs();
        await fetchClients();
      } catch (e) {
        toast.error(e.message);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchClients(term = search) {
    setLoading(true);
    try {
      const { clients } = await listClients({ q: term });
      const list = clients || [];
      setClients(list);
      const tariffs = Array.from(new Set(list.map((c) => c.tarifa).filter(Boolean)));
      const tariffTypes = Array.from(new Set(list.map((c) => c.tipo_tarifa).filter(Boolean)));
      setTariffOptions(tariffs);
      setTariffTypeOptions(tariffTypes);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTariffs() {
    try {
      const { options } = await listTariffOptions();
      const tariffs = (options || []).filter((o) => o.kind === "tarifa").map((o) => o.value);
      const tariffTypes = (options || []).filter((o) => o.kind === "tipo_tarifa").map((o) => o.value);
      setTariffOptions(tariffs);
      setTariffTypeOptions(tariffTypes);
    } catch (e) {
      toast.error(e.message || "Erro ao carregar tarifas");
    }
  }

  async function openClient(userId) {
    try {
      const data = await getClient(userId);
      setSelected(data);
      // garante que a tarifa e tipo estejam disponíveis nos selects
      setTariffOptions((prev) => {
        const next = new Set(prev);
        if (data.profile.tarifa) next.add(data.profile.tarifa);
        return Array.from(next);
      });
      setTariffTypeOptions((prev) => {
        const next = new Set(prev);
        if (data.profile.tipo_tarifa) next.add(data.profile.tipo_tarifa);
        return Array.from(next);
      });
      setForm({
        user_id: data.profile.user_id,
        nome: data.profile.nome || data.profile.user_name || "",
        tarifa: data.profile.tarifa || "",
        tipo_tarifa: data.profile.tipo_tarifa || "",
        nome_uber: data.profile.nome_uber || "",
        birthdate: data.profile.birthdate ? data.profile.birthdate.split("T")[0] : "",
        cpf: data.profile.cpf || "",
        rg: data.profile.rg || "",
        cnh: data.profile.cnh || "",
        validade_cnh: data.profile.validade_cnh ? data.profile.validade_cnh.split("T")[0] : "",
        observacoes: data.profile.observacoes || "",
        cobranca_tipo: data.profile.cobranca_tipo || "",
        ciclo_fechamento: data.profile.ciclo_fechamento || "",
        email: data.profile.email || data.profile.user_email || "",
        email_uber: data.profile.email_uber || "",
        celular: data.profile.celular || "",
        whatsapp: data.profile.whatsapp || "",
        contato_emergencia_nome: data.profile.contato_emergencia_nome || "",
        contato_emergencia_numero: data.profile.contato_emergencia_numero || "",
        endereco_rua: data.profile.endereco_rua || "",
        endereco_numero: data.profile.endereco_numero || "",
        endereco_complemento: data.profile.endereco_complemento || "",
        endereco_cep: data.profile.endereco_cep || "",
        endereco_bairro: data.profile.endereco_bairro || "",
        endereco_cidade: data.profile.endereco_cidade || "",
        endereco_estado: data.profile.endereco_estado || "",
        banco_favorecido: data.profile.banco_favorecido || "",
        banco_cpf_cnpj: data.profile.banco_cpf_cnpj || "",
        banco_nome: data.profile.banco_nome || "",
        banco_agencia: data.profile.banco_agencia || "",
        banco_conta: data.profile.banco_conta || "",
        banco_digito: data.profile.banco_digito || "",
        banco_tipo: data.profile.banco_tipo || "",
        banco_pix: data.profile.banco_pix || "",
        caucao: data.profile.caucao || "",
        forma_pagamento: data.profile.forma_pagamento || "",
        active: data.profile.active !== false
      });
    } catch (e) {
      toast.error(e.message);
    }
  }

  function openTariffModal(kind, setFormFn, field) {
    setTariffModal({ open: true, kind, value: "", setForm: setFormFn, field });
  }

  async function saveTariffOption() {
    if (!tariffModal.value || !tariffModal.kind) {
      toast.error("Informe um valor");
      return;
    }
    try {
      await createTariffOption({ kind: tariffModal.kind, value: tariffModal.value });
      if (tariffModal.kind === "tarifa") {
        setTariffOptions((prev) => (prev.includes(tariffModal.value) ? prev : [...prev, tariffModal.value]));
      } else {
        setTariffTypeOptions((prev) => (prev.includes(tariffModal.value) ? prev : [...prev, tariffModal.value]));
      }
      if (tariffModal.setForm && tariffModal.field) {
        tariffModal.setForm((prev) => ({ ...prev, [tariffModal.field]: tariffModal.value }));
      }
      toast.success("Opção adicionada");
      setTariffModal({ open: false, kind: "", value: "", setForm: null, field: "" });
    } catch (e) {
      toast.error(e.message || "Erro ao adicionar opção");
    }
  }

  async function saveProfile(payloadOverride) {
    if (!selected?.profile?.user_id) return;
    setSaving(true);
    try {
      const body = payloadOverride || form;
      const { profile } = await updateClient(selected.profile.user_id, body);
      // refetch para atualizar histórico/status
      const fresh = await getClient(selected.profile.user_id);
      setSelected(fresh);
      setForm((prev) => ({ ...prev, active: fresh.profile.active }));
      setClients((prev) => prev.map((c) => (c.user_id === profile.user_id ? { ...c, ...profile } : c)));
      toast.success("Cliente atualizado");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function ignoreHistory(entryId) {
    if (!canVoidFinance) return;
    setHistoryIgnoreLoading(entryId);
    try {
      await updateClientHistoryIgnore(entryId);
      toast.success("Registro ocultado dos KPIs.");
      // refetch client to refresh history
      if (selected?.profile?.user_id) {
        const data = await getClient(selected.profile.user_id);
        setSelected(data);
      }
    } catch (e) {
      toast.error(e.message || "Erro ao ocultar registro");
    } finally {
      setHistoryIgnoreLoading(null);
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return clients.filter((c) => {
      const matchTerm =
        !term ||
        (c.nome || c.user_name || "").toLowerCase().includes(term) ||
        (c.user_email || "").toLowerCase().includes(term) ||
        (c.cpf || "").toLowerCase().includes(term) ||
        (c.whatsapp || "").toLowerCase().includes(term);
      const active = c.active !== false;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && active) ||
        (statusFilter === "inactive" && !active);
      return matchTerm && matchStatus;
    });
  }, [clients, search, statusFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
          <p className="text-neutral-600 text-sm">Visualização editor/admin; edição apenas admin. Emails só por /usuarios.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, CPF ou WhatsApp"
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <button
            onClick={() => fetchClients()}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-semibold shadow hover:bg-neutral-800"
          >
            Atualizar
          </button>
        </div>
      </header>

      {!authorized ? (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">Acesso restrito a editor ou admin.</div>
      ) : loading ? (
        <div className="text-neutral-600">Carregando clientes...</div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">CPF</th>
                <th className="text-left px-4 py-3">WhatsApp</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Atualizado</th>
                <th className="text-left px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr
                  key={c.user_id}
                  className="border-t border-neutral-200 hover:bg-neutral-50 cursor-pointer"
                  onClick={() => openClient(c.user_id)}
                >
                  <td className="px-4 py-3">{c.nome || c.user_name || "Sem nome"}</td>
                  <td className="px-4 py-3">{c.user_email}</td>
                  <td className="px-4 py-3">{c.cpf || "-"}</td>
                  <td className="px-4 py-3">{c.whatsapp || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${c.active === false ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                      {c.active === false ? "Inativo" : "Ativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {c.updated_at ? new Date(c.updated_at).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = c.active === false ? true : false;
                          setConfirm({
                            open: true,
                            title: next ? "Ativar cliente" : "Inativar cliente",
                            message: `Deseja ${next ? "ativar" : "inativar"} este cliente?`,
                            action: async () => {
                              try {
                                const { profile } = await updateClient(c.user_id, { active: next });
                                setClients((prev) => prev.map((p) => (p.user_id === c.user_id ? { ...p, active: profile.active } : p)));
                                if (selected?.profile?.user_id === c.user_id) {
                                  const fresh = await getClient(c.user_id);
                                  setSelected(fresh);
                                }
                              } catch (err) {
                                toast.error(err.message);
                              }
                            }
                          });
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-neutral-300 hover:border-neutral-500"
                      >
                        {c.active === false ? "Ativar" : "Inativar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="text-center text-neutral-500 py-6">Nenhum cliente.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-t border-neutral-200">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <span>Linhas por página</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-neutral-300 rounded-lg px-2 py-1 bg-white"
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-neutral-500">
                {filtered.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filtered.length)} de ${filtered.length}` : "0 de 0"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
              >
                ←
              </button>
              <span className="text-sm text-neutral-700">Página {page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">{selected.profile.nome || selected.profile.user_name || "Cliente"}</h3>
                <p className="text-sm text-neutral-600">{selected.profile.user_email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-800">✕</button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {section("Dados pessoais", ["nome", "birthdate", "cpf", "rg", "cnh", "validade_cnh", "nome_uber"], form, setForm, !canEdit)}
                {section("Cobranca e ciclo", ["tarifa", "tipo_tarifa", "cobranca_tipo", "ciclo_fechamento"], form, setForm, !canEdit, {
                  options: { tarifa: tariffOptions, tipo_tarifa: tariffTypeOptions },
                  onAdd: {
                    tarifa: (setFormFn, field) => openTariffModal("tarifa", setFormFn, field),
                    tipo_tarifa: (setFormFn, field) => openTariffModal("tipo_tarifa", setFormFn, field)
                  }
                })}
                {section("Contatos", ["email", "email_uber", "celular", "whatsapp", "contato_emergencia_nome", "contato_emergencia_numero"], form, setForm, !canEdit)}
                {section("Endereço", ["endereco_rua", "endereco_numero", "endereco_complemento", "endereco_cep", "endereco_bairro", "endereco_cidade", "endereco_estado"], form, setForm, !canEdit)}
                {section("Dados bancarios", ["banco_favorecido", "banco_cpf_cnpj", "banco_nome", "banco_agencia", "banco_conta", "banco_digito", "banco_tipo", "banco_pix"], form, setForm, !canEdit)}
                {section("Financeiro", ["caucao", "forma_pagamento"], form, setForm, !canEdit)}
                {section("Observacoes", ["observacoes"], form, setForm, !canEdit)}
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-neutral-600 space-y-1">
                  <div>Visualização: editor/admin. Edição: apenas admin. Histórico registra autor e diff.</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${selected.profile.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {selected.profile.active ? "Ativo" : "Inativo"}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() =>
                          setConfirm({
                            open: true,
                            title: selected.profile.active ? "Inativar cliente" : "Ativar cliente",
                            message: `Deseja ${selected.profile.active ? "inativar" : "ativar"} este cliente?`,
                            action: async () => {
                              setStatusSaving(true);
                              try {
                                await saveProfile({ active: !selected.profile.active });
                              } finally {
                                setStatusSaving(false);
                              }
                            }
                          })
                        }
                        disabled={statusSaving}
                        className="px-3 py-1.5 rounded-lg text-sm border border-neutral-300 hover:border-neutral-500 disabled:opacity-60"
                      >
                        {selected.profile.active ? "Inativar" : "Ativar"}
                      </button>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    disabled={saving}
                    onClick={() =>
                      setConfirm({
                        open: true,
                        title: "Confirmar edicao",
                        message: "Deseja salvar as alteracoes deste cliente?",
                        action: saveProfile
                      })
                    }
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: "#0f172a" }}
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>

              <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
                <p className="font-semibold text-neutral-800 text-sm mb-2">Histórico de edicoes</p>
                <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
                  {selected.history?.length ? selected.history.map((h) => (
                    <div key={h.id} className="bg-white border border-neutral-200 rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between text-xs text-neutral-500 mb-1">
                        <span>{h.author_name || h.author_email || "Autor desconhecido"}</span>
                        <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="space-y-1">
                        {h.diff && Object.entries(h.diff).map(([key, change]) => (
                          <div key={key} className="flex justify-between gap-2 text-xs">
                            <span className="text-neutral-600">{key}</span>
                            <span className="text-neutral-800">{`${change?.from ?? ""} -> ${change?.to ?? ""}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : <div className="text-neutral-500 text-sm">Sem histórico ainda.</div>}
                </div>
              </div>

              <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                <p className="font-semibold text-neutral-800 text-sm mb-2">Histórico de ativações</p>
                <div className="space-y-2 text-sm max-h-56 overflow-y-auto">
                  {selected.history?.filter((h) => h.diff && h.diff.active !== undefined)?.length ? (
                    selected.history
                      .filter((h) => h.diff && h.diff.active !== undefined)
                      .map((h) => (
                        <div key={h.id} className="border border-neutral-200 rounded-lg p-2 bg-neutral-50">
                          <div className="flex justify-between text-xs text-neutral-500 mb-1">
                            <span>{h.author_name || h.author_email || "Autor desconhecido"}</span>
                            <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="text-sm text-neutral-800">
                            Status: {h.diff.active?.from === true ? "Ativo" : "Inativo"} → {h.diff.active?.to === true ? "Ativo" : "Inativo"}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-neutral-500 text-sm">Sem histórico de ativações.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tariffModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-neutral-900">
                {tariffModal.kind === "tarifa" ? "Nova tarifa" : "Novo tipo de tarifa"}
              </h4>
              <button
                onClick={() => setTariffModal({ open: false, kind: "", value: "", setForm: null, field: "" })}
                className="text-neutral-500 hover:text-neutral-800"
              >
                ✕
              </button>
            </div>
            <input
              value={tariffModal.value}
              onChange={(e) => setTariffModal((prev) => ({ ...prev, value: e.target.value }))}
              placeholder={tariffModal.kind === "tarifa" ? "Ex: 500.00" : "Ex: semanal"}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTariffModal({ open: false, kind: "", value: "", setForm: null, field: "" })}
                className="px-3 py-2 rounded border border-neutral-300"
              >
                Cancelar
              </button>
              <button
                onClick={saveTariffOption}
                className="px-4 py-2 rounded bg-neutral-900 text-white"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onCancel={() => setConfirm({ open: false, title: "", message: "", action: null })}
        onConfirm={async () => {
          if (confirm.action) await confirm.action();
          setConfirm({ open: false, title: "", message: "", action: null });
        }}
      />
    </main>
  );
}




