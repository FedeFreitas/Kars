
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureSession } from "@/services/auth";
import { useToast } from "@/components/ToastProvider";
import {
  listLatestMovements,
  listMovementsByCar,
  createMovement,
  updateMovement,
  getMovementHistory
} from "@/services/carMovements";
import { listCars, listCarOptions, createCarOption, updateCarOption } from "@/services/cars";
import { listClients } from "@/services/clients";

const STATUS_OPTIONS = [
  "parceiro",
  "oficina",
  "guincho",
  "patio",
  "equipe",
  "finalizado",
  "apreendido",
  "furto/roubo",
  "sinistro",
  "devolucao fornecedor",
  "devolucao ao fornecedor"
];
const SERVICE_TYPES = ["Funilaria", "Mecanica", "Funilaria/Mecanica"];
const SERVICE_ETAS = ["imediata", "1-7 dias", "8-14 dias", "15-21 dias", "22-28 dias", ">28 dias"];

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}

function SearchSelect({ label, placeholder = "Selecione", value, onChange, options, onSearch }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    function clickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);
  useEffect(() => {
    if (open) onSearch?.(term);
  }, [open, term, onSearch]);
  const sel = options.find((o) => o.value === value)?.label || placeholder;
  return (
    <div className="w-full" ref={ref}>
      {label && <label className="text-sm text-neutral-700 mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-neutral-300 bg-white shadow-sm"
      >
        <span className="text-sm text-neutral-800 truncate">{sel}</span>
        <span className="text-neutral-500 text-xs">▼</span>
      </button>
      {open && (
        <div className="mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-64 overflow-auto z-30">
          <div className="p-2 border-b border-neutral-200">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
            />
          </div>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500">Nenhum resultado</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value || opt.label}
                className={classNames(
                  "w-full text-left px-3 py-2 text-sm hover:bg-neutral-50",
                  opt.value === value ? "bg-neutral-100" : ""
                )}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
export default function MovimentacoesPage() {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const perms = session?.user?.permissions || {};
  const canView = perms.view_movements || perms.edit_movements || perms.create_movements || perms.manage_movement_catalogs;
  const canEdit = perms.edit_movements || perms.manage_movement_catalogs;
  const canCreate = perms.create_movements || perms.edit_movements || perms.manage_movement_catalogs;
  const canManageCatalog = perms.manage_movement_catalogs || perms.edit_cars;

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState(10);
  const [editMovement, setEditMovement] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editForm, setEditForm] = useState({ obs: "", movement_date: "", km: "" });

  const [saving, setSaving] = useState(false);
  const [newModal, setNewModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [cars, setCars] = useState([]);
  const [clients, setClients] = useState([]);
  const [options, setOptions] = useState({ shops: [], tows: [], yards: [], teams: [] });
  const [newForm, setNewForm] = useState({
    car_id: "",
    status: "parceiro",
    km: "",
    obs: "",
    client_id: "",
    client_rate: "",
    is_reserve: false,
    shop_id: "",
    service_type: "",
    service_eta: "",
    tow_id: "",
    yard_id: "",
    yard_availability: "disponivel",
    team_id: ""
  });
  const [searching, setSearching] = useState({});
  const [catalogDraft, setCatalogDraft] = useState("");
  const [catalogKind, setCatalogKind] = useState("shop");

  useEffect(() => {
    (async () => {
      try {
        const me = await ensureSession();
        const permsMe = me?.user?.permissions || {};
        if (!me?.user || !(permsMe.view_movements || permsMe.edit_movements || permsMe.create_movements || permsMe.manage_movement_catalogs)) {
          setError("Acesso negado.");
          setLoading(false);
          return;
        }
        setSession(me);
        await refreshData();
        if (typeof window !== "undefined") {
          const listener = () => setNewModal(true);
          window.addEventListener("open-movement-modal", listener);
          if (window.location.search.includes("nova=1") || window.sessionStorage.getItem("openMovementModal")) {
            setNewModal(true);
            window.sessionStorage.removeItem("openMovementModal");
          }
          return () => window.removeEventListener("open-movement-modal", listener);
        }
      } catch (e) {
        setError(e.message || "Erro ao carregar movimentações");
        toast.error(e.message || "Erro ao carregar movimentações");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshData() {
    const [mv, carRes, clientRes, shopRes, towRes, yardRes, teamRes] = await Promise.all([
      listLatestMovements(),
      listCars(),
      listClients({ q: "" }),
      listCarOptions("shop"),
      listCarOptions("tow"),
      listCarOptions("yard"),
      listCarOptions("team")
    ]);
    setMovements(mv.movements || []);
    setCars(carRes.cars || []);
    const activeClients = (clientRes.clients || []).filter((c) => c.active !== false && c.profile_active !== false);
    setClients(activeClients);
    setOptions({
      shops: shopRes.options || [],
      tows: towRes.options || [],
      yards: yardRes.options || [],
      teams: teamRes.options || []
    });
  }

  const filteredMovs = useMemo(() => {
    const term = search.toLowerCase();
    return movements.filter((m) => {
      if (!term) return true;
      return (
        (m.plate || "").toLowerCase().includes(term) ||
        (m.model || "").toLowerCase().includes(term) ||
        (m.supplier || "").toLowerCase().includes(term)
      );
    });
  }, [movements, search]);
  const totalPages = Math.max(1, Math.ceil(filteredMovs.length / pageSize));
  const paginated = filteredMovs.slice((page - 1) * pageSize, page * pageSize);

  function resetConditionalFields() {
    setNewForm((f) => ({
      ...f,
      client_id: "",
      client_rate: "",
      is_reserve: false,
      shop_id: "",
      service_type: "",
      service_eta: "",
      tow_id: "",
      yard_id: "",
      yard_availability: "disponivel",
      team_id: ""
    }));
  }

  async function openDetail(carId) {
    try {
      const data = await listMovementsByCar(carId);
      setSelected(data);
      if (data.movements?.[0]) {
        setEditMovement(data.movements[0]);
        setEditForm({
          obs: data.movements[0].obs || "",
          movement_date: data.movements[0].movement_date ? data.movements[0].movement_date.split("T")[0] : "",
          km: data.movements[0].km || ""
        });
        setShowEditor(false);
      }
    } catch (e) {
      toast.error(e.message || "Erro ao carregar histórico");
    }
  }

  const filteredHistory = useMemo(() => {
    const term = historyFilter.toLowerCase();
    const cleaned = history.filter((h) => {
      const vals = Object.values(h.diff || {});
      const creation = vals.length > 0 && vals.every((v) => v?.from === null);
      return !creation;
    });
    if (!cleaned.length) return [];
    return cleaned.filter((h) => {
      if (!term) return true;
      const diffStr = JSON.stringify(h.diff || {}).toLowerCase();
      return diffStr.includes(term) || (h.author_name || "").toLowerCase().includes(term);
    });
  }, [history, historyFilter]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historySize));
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * historySize, historyPage * historySize);

  async function loadHistory(movementId) {
    try {
      const h = await getMovementHistory(movementId);
      setHistory(h.history || []);
      setHistoryPage(1);
    } catch (e) {
      toast.error(e.message || "Erro ao carregar histórico");
    }
  }

  async function saveEdit() {
    if (!editMovement) return;
    setSaving(true);
    try {
      const payload = {
        obs: editForm.obs,
        km: editForm.km === "" ? null : Number(editForm.km),
        movement_date: editForm.movement_date || undefined
      };
      await updateMovement(editMovement.id, payload);
      toast.success("Movimentação atualizada");
      if (selected?.car?.id) openDetail(selected.car.id);
    } catch (e) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
      setShowEditor(false);
    }
  }

  async function saveNew() {
    setSaving(true);
    try {
      const payload = { ...newForm };
      payload.km = payload.km ? Number(payload.km) : null;
      payload.client_rate = payload.client_rate ? Number(payload.client_rate) : null;
      const st = payload.status;
      if (st !== "parceiro" && st !== "finalizado") {
        payload.client_id = "";
        payload.client_rate = null;
        payload.is_reserve = false;
      }
      if (st !== "parceiro") payload.is_reserve = false;
      if (st !== "oficina") {
        payload.shop_id = "";
        payload.service_type = "";
        payload.service_eta = "";
      }
      if (st !== "guincho") payload.tow_id = "";
      if (st !== "patio") {
        payload.yard_id = "";
        payload.yard_availability = "disponivel";
      }
      if (st !== "equipe") payload.team_id = "";

      if (!payload.car_id) throw new Error("Selecione o carro");
      if (st === "parceiro" && !payload.client_id) throw new Error("Selecione o cliente parceiro");
      if (st === "finalizado" && !payload.client_id) throw new Error("Selecione o cliente finalizado");
      if (st === "oficina") {
        if (!payload.shop_id) throw new Error("Selecione a oficina");
        if (!payload.service_type) throw new Error("Selecione o tipo de serviço");
        if (!payload.service_eta) throw new Error("Selecione a previsão de saída");
      }
      if (st === "guincho" && !payload.tow_id) throw new Error("Selecione o guincho");
      if (st === "patio") {
        if (!payload.yard_id) throw new Error("Selecione o pátio");
        if (!payload.yard_availability) throw new Error("Selecione a disponibilidade");
      }
      if (st === "equipe" && !payload.team_id) throw new Error("Selecione a equipe");

      await createMovement(payload);
      toast.success("Movimentação criada");
      setNewModal(false);
      await refreshData();
    } catch (e) {
      toast.error(e.message || "Erro ao criar movimentação");
    } finally {
      setSaving(false);
    }
  }

  const availabilityLabel = (m) => {
    const avail = (m?.yard_availability || "disponivel").toLowerCase();
    const danger = avail.includes("indispon");
    return (
      <span className={classNames("px-2 py-1 rounded-full border text-xs", danger ? "border-red-300 text-red-700 bg-red-50" : "border-green-300 text-green-700 bg-green-50")}>
        {avail || "disponivel"}
      </span>
    );
  };

  if (loading) return <div className="p-6 text-neutral-700">Carregando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const alerts = (m) => {
    const alertList = [];
    if ((m.yard_availability || "").toLowerCase().includes("indispon")) alertList.push("Carro indisponível");
    if (m.car_rate && m.client_rate && Number(m.car_rate) !== Number(m.client_rate)) alertList.push("Tarifa diferente");
    return alertList;
  };

  const statusPill = (status, avail) => {
    const danger = (avail || "").toLowerCase().includes("indisponivel");
    return (
      <span className={classNames("px-2 py-1 rounded-full border text-xs", danger ? "border-red-300 text-red-700 bg-red-50" : "border-green-300 text-green-700 bg-green-50")}>
        {status || "-"}
      </span>
    );
  };

  async function handleSearch(kind, term) {
    if (kind === "car") {
      setSearching((s) => ({ ...s, car: true }));
      const res = await listCars({ q: term });
      setCars(res.cars || []);
      setSearching((s) => ({ ...s, car: false }));
    }
    if (kind === "client") {
      setSearching((s) => ({ ...s, client: true }));
      const res = await listClients({ q: term || "" });
      const active = (res.clients || []).filter((c) => c.active !== false && c.profile_active !== false);
      setClients(active);
      setSearching((s) => ({ ...s, client: false }));
    }
    if (["shop", "tow", "yard", "team"].includes(kind)) {
      setSearching((s) => ({ ...s, [kind]: true }));
      const res = await listCarOptions(kind);
      setOptions((o) => ({ ...o, [`${kind}s`]: res.options || [] }));
      setSearching((s) => ({ ...s, [kind]: false }));
    }
  }

  async function saveCatalog() {
    if (!catalogDraft.trim()) return;
    try {
      await createCarOption(catalogKind, { name: catalogDraft });
      toast.success("Cadastro salvo");
      setCatalogDraft("");
      const res = await listCarOptions(catalogKind);
      setOptions((o) => ({ ...o, [`${catalogKind}s`]: res.options || [] }));
    } catch (e) {
      toast.error(e.message || "Erro ao salvar cadastro");
    }
  }

  async function toggleCatalogActive(kind, opt) {
    try {
      await updateCarOption(opt.id, { active: !opt.active });
      const res = await listCarOptions(kind, true);
      setOptions((o) => ({ ...o, [`${kind}s`]: res.options || [] }));
    } catch (e) {
      toast.error(e.message || "Erro ao atualizar");
    }
  }
  return (
    <main className="min-h-screen bg-neutral-50 p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Movimentações</h1>
          <p className="text-neutral-600 text-sm">Última movimentação de cada carro ativo.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por placa, modelo, fornecedor"
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
          />
          {canManageCatalog && (
            <button onClick={() => setManageModal(true)} className="px-3 py-2 rounded-lg border border-neutral-300 text-sm">
              Gerenciar cadastros
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => { setNewModal(true); resetConditionalFields(); }}
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold"
            >
              Nova movimentação
            </button>
          )}
        </div>
      </header>

      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between text-sm text-neutral-600">
          <span>{filteredMovs.length} resultados</span>
          <div className="flex items-center gap-2">
            <span>Linhas:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-neutral-200 rounded px-2 py-1"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Placa</th>
                <th className="px-3 py-2">Modelo</th>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">KM</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Disponibilidade</th>
                <th className="px-3 py-2">Detentor</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Tarifa veículo</th>
                <th className="px-3 py-2">Tarifa cliente</th>
                <th className="px-3 py-2">Obs</th>
                <th className="px-3 py-2">Alertas</th>
                <th className="px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((m) => (
                <tr key={m.movement_id || m.car_id} className="border-t hover:bg-neutral-50 cursor-pointer" onClick={() => openDetail(m.car_id)}>
                  <td className="px-3 py-2 font-semibold">{m.plate}</td>
                  <td className="px-3 py-2">{m.model}</td>
                  <td className="px-3 py-2">{m.supplier}</td>
                  <td className="px-3 py-2">{m.km || "-"}</td>
                  <td className="px-3 py-2">{statusPill(m.movement_status, m.yard_availability)}</td>
                  <td className="px-3 py-2">{availabilityLabel(m)}</td>
                  <td className="px-3 py-2">{m.client_name || m.client_email || "-"}</td>
                  <td className="px-3 py-2">{m.category || "-"}</td>
                  <td className="px-3 py-2">{m.car_rate ? `R$ ${Number(m.car_rate).toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2">{m.client_rate ? `R$ ${Number(m.client_rate).toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]">{m.obs || "-"}</td>
                  <td className="px-3 py-2 text-xs text-red-700 space-y-1">
                    {alerts(m).map((a) => <div key={a}>{a}</div>)}
                    {alerts(m).length === 0 && <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="px-3 py-2">{m.movement_date ? new Date(m.movement_date).toLocaleString("pt-BR") : "-"}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={13} className="text-center py-4 text-neutral-500">Nenhuma movimentação.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm text-neutral-700">
          <span>Página {page} de {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50">{"<"}</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50">{">"}</button>
          </div>
        </div>
      </section>
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-5xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-3 items-center">
                {selected.car?.image_url ? (
                  <img src={selected.car.image_url} alt="Carro" className="w-16 h-16 rounded-lg object-cover border" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-neutral-100 border flex items-center justify-center text-xs text-neutral-500">Sem foto</div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Histórico - {selected.car?.plate}</h3>
                  <p className="text-sm text-neutral-600">
                    {selected.car?.model} • {selected.car?.supplier} • {selected.car?.category} • Cor: {selected.car?.color || "-"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Renavam: {selected.car?.renavam || "-"} • Observações do carro: {selected.car?.notes || "-"}
                  </p>
                </div>
              </div>
              <button onClick={() => { setSelected(null); setHistory([]); }} className="text-neutral-500 hover:text-neutral-800 text-xl">✕</button>
            </div>

            {editMovement && (
              <div className="border rounded-xl p-3 bg-neutral-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-neutral-800">Detalhes da última movimentação</span>
                  {canEdit && (
                    <button
                      onClick={() => setShowEditor((v) => !v)}
                      className="text-sm px-3 py-1 rounded border border-neutral-300"
                    >
                      {showEditor ? "Fechar edição" : "Editar movimentação"}
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-3 text-sm mb-2">
                  <div><span className="font-medium">Status:</span> {statusPill(editMovement.status, editMovement.yard_availability)}</div>
                  <div><span className="font-medium">Disponibilidade:</span> {availabilityLabel(editMovement)}</div>
                  <div><span className="font-medium">KM:</span> {editMovement.km || "-"}</div>
                  <div><span className="font-medium">Detentor:</span> {editMovement.client_name || editMovement.client_email || "-"}</div>
                  <div><span className="font-medium">Tarifa cliente:</span> {editMovement.client_rate ? `R$ ${Number(editMovement.client_rate).toFixed(2)}` : "-"}</div>
                  <div><span className="font-medium">Observação:</span> {editMovement.obs || "-"}</div>
                </div>

                {showEditor && (
                  <>
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      <label className="flex flex-col gap-1">
                        Data movimentação
                        <input
                          type="date"
                          value={editForm.movement_date}
                          onChange={(e) => setEditForm((f) => ({ ...f, movement_date: e.target.value }))}
                          className="border border-neutral-200 rounded px-3 py-2"
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        KM
                        <input
                          type="number"
                          value={editForm.km}
                          onChange={(e) => setEditForm((f) => ({ ...f, km: e.target.value }))}
                          className="border border-neutral-200 rounded px-3 py-2"
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="flex flex-col gap-1 md:col-span-3">
                        Observação
                        <textarea
                          value={editForm.obs}
                          onChange={(e) => setEditForm((f) => ({ ...f, obs: e.target.value }))}
                          className="border border-neutral-200 rounded px-3 py-2 min-h-[80px]"
                          disabled={!canEdit}
                        />
                      </label>
                    </div>
                    {canEdit && (
                      <div className="mt-2 text-right">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
                        >
                          {saving ? "Salvando..." : "Salvar edição"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="text-sm text-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Movimentações</h4>
                <div className="flex items-center gap-2">
                  <input
                    value={historyFilter}
                    onChange={(e) => { setHistoryFilter(e.target.value); setHistoryPage(1); }}
                    placeholder="Filtrar histórico"
                    className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
                  />
                  <button
                    onClick={() => selected.movements?.[0] && loadHistory(selected.movements[0].id)}
                    className="px-3 py-2 rounded border border-neutral-300 text-xs"
                  >
                    Ver histórico de edição
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-left">
                    <tr>
                      <th className="px-2 py-2">Data</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Disponibilidade</th>
                      <th className="px-2 py-2">Cliente</th>
                      <th className="px-2 py-2">KM</th>
                      <th className="px-2 py-2">Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.movements?.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="px-2 py-2">{m.movement_date ? new Date(m.movement_date).toLocaleString("pt-BR") : "-"}</td>
                        <td className="px-2 py-2">{m.status}</td>
                        <td className="px-2 py-2">{m.yard_availability || "disponivel"}</td>
                        <td className="px-2 py-2">{m.client_name || m.client_email || "-"}</td>
                        <td className="px-2 py-2">{m.km || "-"}</td>
                        <td className="px-2 py-2">{m.obs || "-"}</td>
                      </tr>
                    ))}
                    {!selected.movements?.length && (
                      <tr><td colSpan={6} className="text-center py-3 text-neutral-500">Sem movimentações.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {paginatedHistory.length > 0 && (
              <div className="text-sm text-neutral-700 border-t pt-3">
                <h4 className="font-semibold mb-2">Histórico de edições</h4>
                <div className="max-h-60 overflow-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 text-left">
                      <tr>
                        <th className="px-2 py-2">Data</th>
                        <th className="px-2 py-2">Autor</th>
                        <th className="px-2 py-2">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((h) => (
                        <tr key={h.id} className="border-t">
                          <td className="px-2 py-2 whitespace-nowrap">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-2 py-2">{h.author_name || h.author_email || "-"}</td>
                          <td className="px-2 py-2 break-all">{JSON.stringify(h.diff)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Página {historyPage} de {totalHistoryPages}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50">{"<"}</button>
                    <button onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages} className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50">{">"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {newModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-3xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Nova movimentação</h3>
              <button onClick={() => setNewModal(false)} className="text-neutral-500 hover:text-neutral-800 text-xl">✕</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <SearchSelect
                label="Carro"
                placeholder="Selecione o carro"
                value={newForm.car_id}
                onChange={(v) => setNewForm((f) => ({ ...f, car_id: v }))}
                options={cars.map((c) => ({ value: c.id, label: `${c.plate} - ${c.model}` }))}
                onSearch={(t) => handleSearch("car", t)}
              />
              <label className="flex flex-col gap-1 text-sm text-neutral-700">
                Status
                <select
                  value={newForm.status}
                  onChange={(e) => { resetConditionalFields(); setNewForm((f) => ({ ...f, status: e.target.value })); }}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-neutral-700">
                KM
                <input
                  type="number"
                  value={newForm.km}
                  onChange={(e) => setNewForm((f) => ({ ...f, km: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-neutral-700 md:col-span-2">
                Observação
                <textarea
                  value={newForm.obs}
                  onChange={(e) => setNewForm((f) => ({ ...f, obs: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              {newForm.status === "parceiro" && (
                <>
                  <SearchSelect
                    label="Cliente parceiro"
                    placeholder="Selecione o cliente"
                    value={newForm.client_id}
                    onChange={(v) => setNewForm((f) => ({ ...f, client_id: v }))}
                    options={clients.map((c) => ({ value: c.user_id || c.id, label: `${c.nome || c.name || c.user_name || c.email}` }))}
                    onSearch={(t) => handleSearch("client", t)}
                  />
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={!!newForm.is_reserve}
                      onChange={(e) => setNewForm((f) => ({ ...f, is_reserve: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    Carro reserva
                  </label>
                </>
              )}

              {newForm.status === "oficina" && (
                <>
                  <SearchSelect
                    label="Oficina"
                    value={newForm.shop_id}
                    onChange={(v) => setNewForm((f) => ({ ...f, shop_id: v }))}
                    options={options.shops.map((o) => ({ value: o.id, label: o.name }))}
                    onSearch={(t) => handleSearch("shop", t)}
                  />
                  <label className="flex flex-col gap-1 text-sm text-neutral-700">
                    Tipo de serviço
                    <select
                      value={newForm.service_type}
                      onChange={(e) => setNewForm((f) => ({ ...f, service_type: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione</option>
                      {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-neutral-700">
                    Previsão de saída
                    <select
                      value={newForm.service_eta}
                      onChange={(e) => setNewForm((f) => ({ ...f, service_eta: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione</option>
                      {SERVICE_ETAS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </>
              )}

              {newForm.status === "guincho" && (
                <SearchSelect
                  label="Guincho"
                  value={newForm.tow_id}
                  onChange={(v) => setNewForm((f) => ({ ...f, tow_id: v }))}
                  options={options.tows.map((o) => ({ value: o.id, label: o.name }))}
                  onSearch={(t) => handleSearch("tow", t)}
                />
              )}

              {newForm.status === "patio" && (
                <>
                  <SearchSelect
                    label="Pátio"
                    value={newForm.yard_id}
                    onChange={(v) => setNewForm((f) => ({ ...f, yard_id: v }))}
                    options={options.yards.map((o) => ({ value: o.id, label: o.name }))}
                    onSearch={(t) => handleSearch("yard", t)}
                  />
                  <label className="flex flex-col gap-1 text-sm text-neutral-700">
                    Disponibilidade
                    <select
                      value={newForm.yard_availability}
                      onChange={(e) => setNewForm((f) => ({ ...f, yard_availability: e.target.value }))}
                      className="border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      <option value="disponivel">Disponível</option>
                      <option value="indisponivel">Indisponível</option>
                    </select>
                  </label>
                </>
              )}

              {newForm.status === "equipe" && (
                <SearchSelect
                  label="Equipe"
                  value={newForm.team_id}
                  onChange={(v) => setNewForm((f) => ({ ...f, team_id: v }))}
                  options={options.teams.map((o) => ({ value: o.id, label: o.name }))}
                  onSearch={(t) => handleSearch("team", t)}
                />
              )}

              {newForm.status === "finalizado" && (
                <SearchSelect
                  label="Cliente finalizado"
                  value={newForm.client_id}
                  onChange={(v) => setNewForm((f) => ({ ...f, client_id: v }))}
                  options={clients.map((c) => ({ value: c.user_id || c.id, label: `${c.nome || c.name || c.user_name || c.email}` }))}
                  onSearch={(t) => handleSearch("client", t)}
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNewModal(false)} className="px-3 py-2 rounded border border-neutral-300">Cancelar</button>
              <button
                onClick={saveNew}
                disabled={saving}
                className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-3xl w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Gerenciar cadastros</h3>
              <button onClick={() => setManageModal(false)} className="text-neutral-500 hover:text-neutral-800 text-xl">✕</button>
            </div>
            <div className="flex gap-2 flex-wrap text-sm">
              {["shop", "tow", "yard", "team"].map((k) => (
                <button
                  key={k}
                  onClick={() => setCatalogKind(k)}
                  className={classNames(
                    "px-3 py-2 rounded border text-xs",
                    catalogKind === k ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300"
                  )}
                >
                  {k === "shop" ? "Oficinas" : k === "tow" ? "Guinchos" : k === "yard" ? "Pátios" : "Equipes"}
                </button>
              ))}
            </div>
            <div className="border rounded-lg p-3 max-h-64 overflow-auto text-sm">
              {(options[`${catalogKind}s`] || []).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex-1">
                    <input
                      defaultValue={o.name}
                      onBlur={async (e) => {
                        const val = e.target.value.trim();
                        if (val && val !== o.name) {
                          try {
                            await updateCarOption(o.id, { name: val });
                            toast.success("Nome atualizado");
                          } catch (err) {
                            toast.error(err.message || "Erro ao atualizar");
                          }
                        }
                      }}
                      className="w-full px-2 py-1 rounded border border-neutral-200"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-neutral-700 ml-3">
                    <input type="checkbox" checked={o.active} onChange={() => toggleCatalogActive(catalogKind, o)} />
                    Ativo
                  </label>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={catalogDraft}
                onChange={(e) => setCatalogDraft(e.target.value)}
                placeholder="Novo cadastro"
                className="flex-1 px-3 py-2 rounded border border-neutral-200"
              />
              <button onClick={saveCatalog} className="px-3 py-2 rounded bg-neutral-900 text-white text-sm">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
