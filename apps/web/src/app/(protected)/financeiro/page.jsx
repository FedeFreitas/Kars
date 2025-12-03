"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureSession } from "@/services/auth";
import {
  addFinanceNote,
  createFinanceEntry,
  createFinanceType,
  getFinanceEntry,
  listFinanceEntries,
  listFinanceTypes,
  updateFinanceEntry,
  updateFinanceType
} from "@/services/finance";
import { listClients } from "@/services/clients";
import { useToast } from "@/components/ToastProvider";

const statusOptions = ["pendente", "pago", "cancelado"];
const kindOptions = [
  { value: "credit", label: "Credito" },
  { value: "debit", label: "Debito" }
];
const filterModes = [
  { key: "range", label: "Intervalo" },
  { key: "week", label: "Semana do ano" },
  { key: "all", label: "Todo o periodo" }
];

function classNames(...args) {
  return args.filter(Boolean).join(" ");
}

function weekRange(week, year) {
  if (!week || !year) return null;
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay() || 7;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - dow + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function parseLocalDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-").map((n) => Number(n));
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(date) {
  const parsed = parseLocalDate(date);
  return parsed ? parsed.toLocaleDateString("pt-BR") : "-";
}

function toLocalISODate(date) {
  const parsed = parseLocalDate(date);
  if (!parsed) return "";
  const y = parsed.getFullYear();
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currency(v) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

function isCaucaoEntry(entry) {
  const ref = `${entry?.type_name || ""} ${entry?.label || ""}`;
  const normalized = ref.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("caucao");
}

function deriveStatus(entry) {
  if (!entry) return "";
  const status = entry.status || entry.stored_status || "";
  if (status !== "pendente") return status;
  const due = entry.due_date || entry.dueDate;
  const dueDate = parseLocalDate(due);
  if (!dueDate) return status;
  const normalizedDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = new Date();
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return normalizedDue < normalizedToday ? "atrasado" : status;
}

function StatusPill({ status, voided }) {
  const map = {
    pago: "bg-green-100 text-green-800 border-green-200",
    pendente: "bg-amber-100 text-amber-800 border-amber-200",
    atrasado: "bg-red-100 text-red-800 border-red-200",
    cancelado: "bg-neutral-100 text-neutral-600 border-neutral-200"
  };
  return (
    <span className={classNames("px-2 py-1 rounded-full border text-xs font-medium", map[status] || "bg-neutral-100 text-neutral-700 border-neutral-200")}>
      {status}
      {voided ? " (anulado)" : ""}
    </span>
  );
}

function SearchSelect({
  label,
  placeholder = "Selecione",
  value,
  onChange,
  options,
  onSearch,
  loading,
  helper
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef(null);
  const onSearchRef = useRef(onSearch);
  const lastSearchedRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEsc(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      lastSearchedRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !onSearchRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const normalized = term.trim();
      if (normalized === lastSearchedRef.current) return;
      lastSearchedRef.current = normalized;
      onSearchRef.current?.(normalized);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, term]);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  return (
    <div ref={ref} className="w-full relative">
      {label && <label className="text-sm text-neutral-700 mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm focus:ring-2 focus:ring-neutral-200"
      >
        <span className="text-sm text-neutral-800 truncate">{selectedLabel}</span>
        <span className="text-neutral-500 text-xs ml-2">?</span>
      </button>
      {helper && <p className="text-xs text-neutral-500 mt-1">{helper}</p>}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-neutral-200">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-neutral-500">Carregando...</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500">Nenhum resultado</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value || "all"}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    
                  }}
                  className={classNames(
                    "w-full text-left px-3 py-2 text-sm hover:bg-neutral-50",
                    opt.value === value ? "bg-neutral-100" : ""
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default function FinanceiroPage() {
  const toast = useToast();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [types, setTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [filters, setFilters] = useState({
    clientId: "",
    status: "",
    kind: "",
    typeId: "",
    startDue: "",
    endDue: "",
    week: "",
    year: new Date().getFullYear()
  });
  const [filterMode, setFilterMode] = useState("all");
  const [permissions, setPermissions] = useState({
    view: false,
    edit: false,
    manageTypes: false,
    void: false
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [entryModal, setEntryModal] = useState({ open: false, entry: null, saving: false, loading: false });
  const [typeModal, setTypeModal] = useState({ open: false, editing: null, saving: false });
  const [entryForm, setEntryForm] = useState({
    client_id: "",
    type_id: "",
    label: "",
    description: "",
    kind: "debit",
    amount: "",
    emission_date: "",
    due_date: "",
    status: "pendente",
    voided: false
  });
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [typeForm, setTypeForm] = useState({ name: "", kind: "debit", description: "" });

  const loadClients = useCallback(async (q) => {
    try {
      setClientLoading(true);
      const res = await listClients(q ? { q } : {});
      setClients(res.clients || []);
    } catch (e) {
      toast.error(e.message || "Erro ao carregar clientes");
    } finally {
      setClientLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureSession();
        const perms = session?.user?.permissions || {};
        if (!session?.user || !perms.view_finance) {
          toast.error("Acesso restrito ao financeiro");
          setAuthorized(false);
          setLoading(false);
          return;
        }
        setPermissions({
          view: !!perms.view_finance,
          edit: !!perms.edit_finance,
          manageTypes: !!perms.manage_finance_types,
          void: !!perms.void_finance
        });
        setAuthorized(true);
        await Promise.all([loadTypes(), loadEntries()]);
        await loadClients("");
      } catch (e) {
        toast.error(e.message || "Erro ao carregar financeiro");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadClients]);

  function buildFilterPayload() {
    const payload = {
      clientId: filters.clientId,
      status: filters.status,
      kind: filters.kind,
      typeId: filters.typeId
    };
    if (filterMode === "range") {
      payload.startDue = filters.startDue || "";
      payload.endDue = filters.endDue || "";
    } else if (filterMode === "week" && filters.week) {
      const range = weekRange(Number(filters.week), Number(filters.year));
      if (range) {
        payload.startDue = toLocalISODate(range.start);
        payload.endDue = toLocalISODate(range.end);
      }
    }
    return payload;
  }

  async function loadEntries() {
    const payload = buildFilterPayload();
    const res = await listFinanceEntries(payload);
    setEntries(res.entries || []);
    setPage(1);
  }

  async function loadTypes() {
    const res = await listFinanceTypes();
    setTypes(res.types || []);
  }

  async function applyFilters() {
    try {
      setLoading(true);
      await loadEntries();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setFilters({
      clientId: "",
      status: "",
      kind: "",
      typeId: "",
      startDue: "",
      endDue: "",
      week: "",
      year: new Date().getFullYear()
    });
    setFilterMode("all");
    setPage(1);
    loadEntries().catch(() => {});
  }

  const derivedEntries = useMemo(
    () => entries.map((e) => ({ ...e, derivedStatus: deriveStatus(e) })),
    [entries]
  );
  const cautionEntries = useMemo(() => derivedEntries.filter((e) => isCaucaoEntry(e)), [derivedEntries]);
  const nonCautionEntries = useMemo(() => derivedEntries.filter((e) => !isCaucaoEntry(e)), [derivedEntries]);

  const stats = useMemo(() => {
    const valid = nonCautionEntries.filter((e) => !e.voided && e.derivedStatus !== "cancelado");
    const credit = valid.filter((e) => e.kind === "credit").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const debit = valid.filter((e) => e.kind === "debit").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const total = credit - debit;
    const paid = valid.filter((e) => e.derivedStatus === "pago").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const open = valid.filter((e) => e.derivedStatus === "pendente").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const late = valid.filter((e) => e.derivedStatus === "atrasado").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const cancelled = nonCautionEntries.filter((e) => e.derivedStatus === "cancelado").length;
    return { credit, debit, total, paid, open, late, cancelled };
  }, [nonCautionEntries]);

  const cautionStats = useMemo(() => {
    const valid = cautionEntries.filter((e) => !e.voided);
    const paid = valid
      .filter((e) => e.derivedStatus === "pago")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const late = valid
      .filter((e) => e.derivedStatus === "atrasado")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { paid, late };
  }, [cautionEntries]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(derivedEntries.length / pageSize)), [derivedEntries.length, pageSize]);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return derivedEntries.slice(start, start + pageSize);
  }, [derivedEntries, page, pageSize]);
  function openNewEntry() {
    setEntryForm({
      client_id: "",
      type_id: "",
      label: "",
      description: "",
      kind: "debit",
      amount: "",
      emission_date: "",
      due_date: "",
      status: "pendente",
      voided: false
    });
    setNotes([]);
    setHistory([]);
    setNoteDraft("");
    setEntryModal({ open: true, entry: null, saving: false, loading: false });
  }

  async function openEditEntry(entry) {
    setEntryModal({ open: true, entry, saving: false, loading: true });
    setNotes([]);
    setHistory([]);
    setNoteDraft("");
    try {
      const detail = await getFinanceEntry(entry.id);
      const payload = detail?.entry || entry;
      setEntryForm({
        client_id: payload.client_id || "",
        type_id: payload.type_id || "",
        label: payload.label || "",
        description: payload.description || "",
        kind: payload.kind || "debit",
        amount: payload.amount || "",
        emission_date: payload.emission_date ? payload.emission_date.split("T")[0] : "",
        due_date: payload.due_date ? payload.due_date.split("T")[0] : "",
        status: payload.status || "pendente",
        voided: !!payload.voided
      });
      setNotes(detail?.notes || []);
      setHistory(detail?.history || detail?.edits || []);
    } catch (e) {
      toast.error(e.message || "Erro ao carregar lancamento");
    } finally {
      setEntryModal((m) => ({ ...m, loading: false }));
    }
  }

  async function saveEntry() {
    setEntryModal((m) => ({ ...m, saving: true }));
    try {
      const payload = {
        ...entryForm,
        amount: Number(entryForm.amount || 0)
      };
      if (entryModal.entry) {
        await updateFinanceEntry(entryModal.entry.id, payload);
        toast.success("Lancamento atualizado");
      } else {
        await createFinanceEntry(payload);
        toast.success("Lancamento criado");
      }
      setEntryModal({ open: false, entry: null, saving: false, loading: false });
      await loadEntries();
    } catch (e) {
      toast.error(e.message || "Erro ao salvar");
      setEntryModal((m) => ({ ...m, saving: false }));
    }
  }

  async function voidEntry() {
    if (!entryModal.entry) return;
    setEntryModal((m) => ({ ...m, saving: true }));
    try {
      await updateFinanceEntry(entryModal.entry.id, { voided: true });
      toast.success("Lancamento anulado");
      setEntryModal({ open: false, entry: null, saving: false, loading: false });
      await loadEntries();
    } catch (e) {
      toast.error(e.message || "Nao foi possivel anular");
      setEntryModal((m) => ({ ...m, saving: false }));
    }
  }

  async function handleAddNote() {
    if (!entryModal.entry || !noteDraft.trim()) return;
    try {
      await addFinanceNote(entryModal.entry.id, noteDraft.trim());
      setNoteDraft("");
      await openEditEntry(entryModal.entry);
    } catch (e) {
      toast.error(e.message || "Erro ao adicionar observacao");
    }
  }

  function openTypeModal(type) {
    setTypeForm({
      name: type?.name || "",
      kind: type?.kind || "debit",
      description: type?.description || ""
    });
    setTypeModal({ open: true, editing: type || null, saving: false });
  }

  async function saveType() {
    setTypeModal((m) => ({ ...m, saving: true }));
    try {
      if (typeModal.editing) {
        await updateFinanceType(typeModal.editing.id, typeForm);
        toast.success("Tipo atualizado");
      } else {
        await createFinanceType(typeForm);
        toast.success("Tipo criado");
      }
      setTypeModal({ open: false, editing: null, saving: false });
      await loadTypes();
    } catch (e) {
      toast.error(e.message || "Erro ao salvar tipo");
      setTypeModal((m) => ({ ...m, saving: false }));
    }
  }
  if (loading) {
    return <div className="p-6 text-neutral-700">Carregando financeiro...</div>;
  }
  if (!authorized) {
    return <div className="p-6 text-neutral-700">Acesso restrito.</div>;
  }

  const clientOptions = [
    { value: "", label: "Todos" },
    ...clients.map((c) => ({
      value: c.user_id || c.id,
      label: `${c.nome || c.name || "Cliente"}${c.cpf ? ` - ${c.cpf}` : c.email ? ` - ${c.email}` : ""}`
    }))
  ];

  const weekInfo = filterMode === "week" && filters.week ? weekRange(Number(filters.week), Number(filters.year)) : null;

  return (
    <main className="min-h-screen bg-neutral-50 p-6 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-neutral-900">Financeiro</h1>
            {permissions.manageTypes && (
              <button
                onClick={() => openTypeModal(null)}
                className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white hover:border-neutral-500"
              >
                Tipos padrao
              </button>
            )}
            {permissions.edit && (
              <button
                onClick={openNewEntry}
                className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold shadow-sm"
              >
                Novo lancamento
              </button>
            )}
          </div>
          <p className="text-neutral-600 text-sm">
            Controle de creditos e debitos por cliente, com filtros por vencimento, status e tipos padrao.
          </p>
        </div>
      </header>

      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
            <SearchSelect
              label="Cliente"
              placeholder="Todos"
              value={filters.clientId}
              options={clientOptions}
              loading={clientLoading}
              onSearch={loadClients}
              onChange={(v) => setFilters((f) => ({ ...f, clientId: v }))}
              helper="Digite nome ou CPF para buscar"
            />
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-sm text-neutral-700">Periodo</label>
            <div className="flex flex-wrap gap-3">
              {filterModes.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="radio"
                    name="period"
                    checked={filterMode === m.key}
                    onChange={() => setFilterMode(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-40">
            <label className="text-sm text-neutral-700">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-neutral-300"
            >
              <option value="">Todos</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-40">
            <label className="text-sm text-neutral-700">Natureza</label>
            <select
              value={filters.kind}
              onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-neutral-300"
            >
              <option value="">Todas</option>
              {kindOptions.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-48">
            <label className="text-sm text-neutral-700">Tipo padrao</label>
            <select
              value={filters.typeId}
              onChange={(e) => setFilters((f) => ({ ...f, typeId: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-neutral-300"
            >
              <option value="">Todos</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        {filterMode === "week" && (
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2 w-full md:w-40">
              <label className="text-sm text-neutral-700">Semana</label>
              <input
                type="number"
                min={1}
                max={53}
                value={filters.week}
                onChange={(e) => setFilters((f) => ({ ...f, week: e.target.value }))}
                placeholder="Ex: 12"
                className="px-3 py-2 rounded-lg border border-neutral-300"
              />
            </div>
            <div className="flex flex-col gap-2 w-full md:w-40">
              <label className="text-sm text-neutral-700">Ano</label>
              <input
                type="number"
                value={filters.year}
                onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-neutral-300"
              />
            </div>
            <div className="flex items-end text-xs text-neutral-600 pb-1">
              {filters.week && weekInfo
                ? `Semana ${filters.week}/${filters.year}: ${formatDate(weekInfo.start)} - ${formatDate(weekInfo.end)}`
                : "Informe semana e ano para ver o intervalo que sera filtrado"}
            </div>
          </div>
        )}
        {filterMode === "range" && (
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2 w-full md:w-44">
              <label className="text-sm text-neutral-700">Vencimento inicio</label>
              <input
                type="date"
                value={filters.startDue}
                onChange={(e) => setFilters((f) => ({ ...f, startDue: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-neutral-300"
              />
            </div>
            <div className="flex flex-col gap-2 w-full md:w-44">
              <label className="text-sm text-neutral-700">Vencimento fim</label>
              <input
                type="date"
                value={filters.endDue}
                onChange={(e) => setFilters((f) => ({ ...f, endDue: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-neutral-300"
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={applyFilters}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold"
          >
            Aplicar filtros
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm"
          >
            Limpar
          </button>
        </div>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Creditos</p>
          <p className="text-xl font-semibold text-neutral-900">{currency(stats.credit)}</p>
        </div>
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Debitos</p>
          <p className="text-xl font-semibold text-neutral-900">{currency(stats.debit)}</p>
        </div>
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Total (C - D)</p>
          <p className="text-xl font-semibold text-neutral-900">{currency(stats.total)}</p>
        </div>
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Pago</p>
          <p className="text-xl font-semibold text-neutral-900">{currency(stats.paid)}</p>
        </div>
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Em aberto</p>
          <p className="text-xl font-semibold text-neutral-900">{currency(stats.open)}</p>
        </div>
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Atrasados</p>
          <p className="text-xl font-semibold text-neutral-900">{currency(stats.late)}</p>
          <p className="text-xs text-neutral-500 mt-1">Cancelados: {stats.cancelled}</p>
        </div>
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
          <p className="text-sm text-neutral-600">Caucao</p>
          <p className="text-xl font-semibold text-neutral-900">Pago: {currency(cautionStats.paid)}</p>
          <p className="text-xs text-neutral-500 mt-1">Atrasado: {currency(cautionStats.late)}</p>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-neutral-900">Lancamentos</h2>
            <span className="text-xs text-neutral-500">{derivedEntries.length} resultados</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <span>Linhas por pagina</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-neutral-300 rounded-lg px-2 py-1"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
              >
                {"<"}
              </button>
              <span>Pagina {page} / {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Natureza</th>
                <th className="px-2 py-2">Rotulo</th>
                <th className="px-2 py-2">Emissao</th>
                <th className="px-2 py-2">Vencimento</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((e) => (
                <tr key={e.id} className="border-t border-neutral-200">
                  <td className="px-2 py-2">{e.client_name || e.client_email || e.client_id}</td>
                  <td className="px-2 py-2">{e.type_name || "-"}</td>
                  <td className="px-2 py-2 capitalize">{e.kind === "credit" ? "Credito" : "Debito"}</td>
                  <td className="px-2 py-2">{e.label}</td>
                  <td className="px-2 py-2">{formatDate(e.emission_date)}</td>
                  <td className="px-2 py-2">{formatDate(e.due_date)}</td>
                  <td className="px-2 py-2">{currency(e.amount)}</td>
                  <td className="px-2 py-2">
                    <StatusPill status={e.derivedStatus || e.status} voided={e.voided} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {permissions.edit ? (
                      <button
                        onClick={() => openEditEntry(e)}
                        className="px-3 py-1 rounded border border-neutral-300 text-xs hover:border-neutral-500"
                      >
                        Detalhes
                      </button>
                    ) : (
                      <span className="text-neutral-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-5 text-neutral-500">Nenhum lancamento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {entryModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">
                {entryModal.entry ? "Editar lancamento" : "Novo lancamento"}
              </h3>
              <button
                onClick={() => setEntryModal({ open: false, entry: null, saving: false, loading: false })}
                className="text-neutral-500 hover:text-neutral-800 text-xl"
              >
                x
              </button>
            </div>
            {entryModal.loading ? (
              <div className="text-neutral-600">Carregando...</div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <SearchSelect
                    label="Cliente"
                    value={entryForm.client_id}
                    options={clientOptions}
                    loading={clientLoading}
                    onSearch={loadClients}
                    onChange={(v) => setEntryForm((f) => ({ ...f, client_id: v }))}
                  />
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Tipo padrao
                    <select
                      value={entryForm.type_id}
                      onChange={(e) => setEntryForm((f) => ({ ...f, type_id: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Natureza
                    <select
                      value={entryForm.kind}
                      onChange={(e) => setEntryForm((f) => ({ ...f, kind: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      {kindOptions.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Rotulo
                    <input
                      value={entryForm.label}
                      onChange={(e) => setEntryForm((f) => ({ ...f, label: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Valor
                    <input
                      type="number"
                      step="0.01"
                      value={entryForm.amount}
                      onChange={(e) => setEntryForm((f) => ({ ...f, amount: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Status
                    <select
                      value={entryForm.status}
                      onChange={(e) => setEntryForm((f) => ({ ...f, status: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Emissao
                    <input
                      type="date"
                      value={entryForm.emission_date}
                      onChange={(e) => setEntryForm((f) => ({ ...f, emission_date: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-neutral-700 flex flex-col gap-1">
                    Vencimento
                    <input
                      type="date"
                      value={entryForm.due_date}
                      onChange={(e) => setEntryForm((f) => ({ ...f, due_date: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    />
                  </label>
                </div>
                <label className="text-sm text-neutral-700 flex flex-col gap-1">
                  Descricao
                  <textarea
                    value={entryForm.description}
                    onChange={(e) => setEntryForm((f) => ({ ...f, description: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2 min-h-[80px]"
                  />
                </label>

                {entryModal.entry && (
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div className="border border-neutral-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-neutral-800">Observacoes</h4>
                        {permissions.edit && (
                          <button
                            onClick={handleAddNote}
                            disabled={!noteDraft.trim()}
                            className="px-3 py-1 rounded bg-neutral-900 text-white text-xs disabled:opacity-50"
                          >
                            Adicionar
                          </button>
                        )}
                      </div>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Escreva uma observacao..."
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 min-h-[70px]"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
                        {notes.length === 0 && <p className="text-neutral-500 text-xs">Sem observacoes.</p>}
                        {notes.map((n) => (
                          <div key={n.id || n.created_at} className="p-2 rounded border border-neutral-200 bg-neutral-50">
                            <p className="text-neutral-800">{n.message || n.text}</p>
                            <p className="text-xs text-neutral-500 mt-1">
                              {n.author_name || n.user_name || "Usuario"} - {formatDate(n.created_at || n.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-neutral-200 rounded-xl p-3 space-y-2">
                      <h4 className="font-semibold text-sm text-neutral-800">Historico de edicoes</h4>
                      <div className="max-h-56 overflow-y-auto space-y-2 text-sm">
                        {history.length === 0 && <p className="text-neutral-500 text-xs">Nenhum historico.</p>}
                        {history.map((h, idx) => (
                          <div key={h.id || idx} className="p-2 rounded border border-neutral-200 bg-neutral-50">
                            <p className="text-neutral-800">{h.description || h.change || "Alteracao registrada"}</p>
                            <p className="text-xs text-neutral-500 mt-1">
                              {h.author_name || h.user_name || "Usuario"} - {formatDate(h.created_at || h.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-2 pt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEntryModal({ open: false, entry: null, saving: false, loading: false })}
                      className="px-3 py-2 rounded border border-neutral-300"
                    >
                      Cancelar
                    </button>
                    {permissions.void && entryModal.entry && !entryForm.voided && (
                      <button
                        onClick={voidEntry}
                        disabled={entryModal.saving}
                        className="px-3 py-2 rounded border border-red-300 text-red-700"
                      >
                        Anular lancamento
                      </button>
                    )}
                  </div>
                  <button
                    onClick={saveEntry}
                    disabled={entryModal.saving}
                    className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {entryModal.saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {typeModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">
                {typeModal.editing ? "Editar tipo padrao" : "Novo tipo padrao"}
              </h3>
              <button
                onClick={() => setTypeModal({ open: false, editing: null, saving: false })}
                className="text-neutral-500 hover:text-neutral-800 text-xl"
              >
                x
              </button>
            </div>
            <label className="text-sm text-neutral-700 flex flex-col gap-1">
              Nome
              <input
                value={typeForm.name}
                onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                className="border border-neutral-200 rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm text-neutral-700 flex flex-col gap-1">
              Natureza
              <select
                value={typeForm.kind}
                onChange={(e) => setTypeForm((f) => ({ ...f, kind: e.target.value }))}
                className="border border-neutral-200 rounded-lg px-3 py-2"
              >
                {kindOptions.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-neutral-700 flex flex-col gap-1">
              Descricao
              <textarea
                value={typeForm.description}
                onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
                className="border border-neutral-200 rounded-lg px-3 py-2 min-h-[80px]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTypeModal({ open: false, editing: null, saving: false })}
                className="px-3 py-2 rounded border border-neutral-300"
              >
                Cancelar
              </button>
              <button
                onClick={saveType}
                disabled={typeModal.saving}
                className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
              >
                {typeModal.saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}









