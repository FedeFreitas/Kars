"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureSession } from "@/services/auth";
import {
  listCars,
  getCar,
  createCar,
  updateCar,
  listCarOptions,
  createCarOption
} from "@/services/cars";
import { useToast } from "@/components/ToastProvider";

const YEARS = Array.from({ length: 51 }, (_, i) => 2000 + i);
const FUEL_OPTIONS = ["GNV", "FLEX", "Elétrico", "Hibrido"];
const COLORS = ["Branco", "Preto", "Prata", "Cinza", "Azul", "Vermelho", "Verde", "Amarelo", "Marrom", "Bege"];
const DISPLACEMENTS = ["1.0", "1.2", "1.3", "1.4", "1.5", "1.6", "1.8", "2.0", "2.2", "2.4", "2.8", "3.0", "3.6", "4.0+"];
const VERSIONS = ["Sedan", "Hatch", "SUV", "Pickup", "Minivan", "Coupé"];
const STATUS = ["Disponivel", "Indisponivel"];
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads")) return `${API_BASE}${url}`;
  return url;
}

export default function CarrosPage() {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const perms = session?.user?.permissions || {};
  const canView = !!(perms.view_cars || perms.edit_cars);
  const canEdit = !!perms.edit_cars;

  const [cars, setCars] = useState([]);
  const [options, setOptions] = useState({ category: [], model: [], rate: [], tracker: [], supplier: [] });
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState({ open: false, car: null });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [imagePreview, setImagePreview] = useState("");
  const [optModal, setOptModal] = useState({ open: false, kind: "", name: "", amount: "" });

  function defaultForm() {
    return {
      plate: "",
      category: "",
      renavam: "",
      model: "",
      year_fabrication: "",
      year_model: "",
      supplier: "",
      fuel: "",
      tracker: "",
      spare_key: false,
      color: "",
      status: "Disponivel",
      displacement: "",
      version: "",
      rate: "",
      notes: "",
      image_url: ""
    };
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await ensureSession();
        const permsMe = me?.user?.permissions || {};
        setSession(me);
        if (!me?.user || !(permsMe.view_cars || permsMe.edit_cars)) {
          setError("Acesso negado.");
          setLoading(false);
          return;
        }
        const [carsRes, optsCat, optsModel, optsRate, optsTracker, optsSupplier] = await Promise.all([
          listCars(),
          listCarOptions("category"),
          listCarOptions("model"),
          listCarOptions("rate"),
          listCarOptions("tracker"),
          listCarOptions("supplier")
        ]);
        setCars(carsRes.cars || []);
        setOptions({
          category: optsCat.options || [],
          model: optsModel.options || [],
          rate: optsRate.options || [],
          tracker: optsTracker.options || [],
          supplier: optsSupplier.options || []
        });
      } catch (e) {
        setError(e.message || "Erro ao carregar carros");
        toast.error(e.message || "Erro ao carregar carros");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return cars
      .filter((c) => {
        if (filters.status) return (c.status || "").toLowerCase() === filters.status.toLowerCase();
        return true;
      })
      .filter((c) => {
        const term = filters.q.toLowerCase();
        if (!term) return true;
        return (
          (c.plate || "").toLowerCase().includes(term) ||
          (c.model || "").toLowerCase().includes(term) ||
          (c.category || "").toLowerCase().includes(term) ||
          (c.supplier || "").toLowerCase().includes(term)
        );
      });
  }, [cars, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function openNew() {
    setForm(defaultForm());
    setImagePreview("");
    setModal({ open: true, car: null });
  }

  async function openEdit(carId) {
    try {
      const data = await getCar(carId);
      const car = data.car || data;
      setForm({
        plate: car.plate || "",
        category: car.category || "",
        renavam: car.renavam || "",
        model: car.model || "",
        year_fabrication: car.year_fabrication || "",
        year_model: car.year_model || "",
        supplier: car.supplier || "",
        fuel: car.fuel || "",
        tracker: car.tracker || "",
        spare_key: !!car.spare_key,
        color: car.color || "",
        status: car.status || "Disponivel",
        displacement: car.displacement || "",
        version: car.version || "",
        rate: car.rate || "",
        notes: car.notes || "",
        image_url: car.image_url || ""
      });
      setImagePreview(resolveImageUrl(car.image_url || ""));
      setModal({ open: true, car: car });
    } catch (e) {
      toast.error(e.message || "Erro ao carregar carro");
    }
  }

  async function saveCar() {
    setSaving(true);
    try {
      const payload = { ...form };
      payload.year_fabrication = payload.year_fabrication ? Number(payload.year_fabrication) : null;
      payload.year_model = payload.year_model ? Number(payload.year_model) : null;
      payload.rate = payload.rate ? Number(payload.rate) : null;
      if (!modal.car) {
        await createCar(payload);
        toast.success("Carro criado");
      } else {
        await updateCar(modal.car.id, payload);
        toast.success("Carro atualizado");
      }
      const res = await listCars();
      setCars(res.cars || []);
      setModal({ open: false, car: null });
    } catch (e) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result;
      setForm((f) => ({ ...f, image_url: base64 }));
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  }

  async function addOption(kind) {
    try {
      const body = { name: optModal.name, amount: optModal.amount ? Number(optModal.amount) : null };
      const res = await createCarOption(kind, body);
      setOptions((prev) => ({
        ...prev,
        [kind]: [...(prev[kind] || []), res.option]
      }));
      setOptModal({ open: false, kind: "", name: "", amount: "" });
    } catch (e) {
      toast.error(e.message || "Erro ao criar opção");
    }
  }

  if (loading) return <div className="p-6 text-neutral-700">Carregando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <main className="min-h-screen bg-neutral-50 p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Carros</h1>
          <p className="text-neutral-600 text-sm">Cadastro e edição de veículos.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={filters.q}
            onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }}
            placeholder="Buscar por placa, modelo, categoria..."
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
          />
          <select
            value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
          >
            <option value="">Status</option>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {canEdit && (
            <button
              onClick={openNew}
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold"
            >
              Novo carro
            </button>
          )}
        </div>
      </header>

      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between text-sm text-neutral-600">
          <span>{filtered.length} resultados</span>
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
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tarifa</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-semibold">{c.plate}</td>
                  <td className="px-3 py-2">{c.model}</td>
                  <td className="px-3 py-2">{c.category}</td>
                  <td className="px-3 py-2">{c.supplier}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-1 rounded-full border border-neutral-200 text-xs">{c.status}</span>
                  </td>
                  <td className="px-3 py-2">{c.rate ? `R$ ${Number(c.rate).toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <button
                        onClick={() => openEdit(c.id)}
                        className="px-3 py-1 rounded border border-neutral-300 text-xs hover:border-neutral-500"
                      >
                        Editar
                      </button>
                    ) : <span className="text-neutral-400 text-xs">-</span>}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="text-center py-4 text-neutral-500">Nenhum carro.</td></tr>
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

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-3xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">{modal.car ? "Editar carro" : "Novo carro"}</h3>
              <button onClick={() => setModal({ open: false, car: null })} className="text-neutral-500 hover:text-neutral-800 text-xl">×</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Placa
                <input
                  value={form.plate}
                  onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                />
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Categoria
                <div className="flex gap-2">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2 flex-1"
                  >
                    <option value="">Selecione</option>
                    {options.category.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <button onClick={() => setOptModal({ open: true, kind: "category", name: "", amount: "" })} className="px-3 py-2 rounded border text-xs">Novo</button>
                </div>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Renavam
                <input value={form.renavam} onChange={(e) => setForm((f) => ({ ...f, renavam: e.target.value }))} className="border border-neutral-200 rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Modelo
                <div className="flex gap-2">
                  <select
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2 flex-1"
                  >
                    <option value="">Selecione</option>
                    {options.model.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <button onClick={() => setOptModal({ open: true, kind: "model", name: "", amount: "" })} className="px-3 py-2 rounded border text-xs">Novo</button>
                </div>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Ano Fabricação
                <select
                  value={form.year_fabrication}
                  onChange={(e) => setForm((f) => ({ ...f, year_fabrication: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Ano Modelo
                <select
                  value={form.year_model}
                  onChange={(e) => setForm((f) => ({ ...f, year_model: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Fornecedor
                <div className="flex gap-2">
                  <select
                    value={form.supplier}
                    onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2 flex-1"
                  >
                    <option value="">Selecione</option>
                    {options.supplier.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <button onClick={() => setOptModal({ open: true, kind: "supplier", name: "", amount: "" })} className="px-3 py-2 rounded border text-xs">Novo</button>
                </div>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Combustível
                <select
                  value={form.fuel}
                  onChange={(e) => setForm((f) => ({ ...f, fuel: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {FUEL_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Rastreador
                <div className="flex gap-2">
                  <select
                    value={form.tracker}
                    onChange={(e) => setForm((f) => ({ ...f, tracker: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2 flex-1"
                  >
                    <option value="">Selecione</option>
                    {options.tracker.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <button onClick={() => setOptModal({ open: true, kind: "tracker", name: "", amount: "" })} className="px-3 py-2 rounded border text-xs">Novo</button>
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={form.spare_key} onChange={(e) => setForm((f) => ({ ...f, spare_key: e.target.checked }))} />
                Possui chave reserva
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Cor
                <select
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Cilindrada
                <select
                  value={form.displacement}
                  onChange={(e) => setForm((f) => ({ ...f, displacement: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {DISPLACEMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Versão
                <select
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Tarifa
                <div className="flex gap-2">
                  <select
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2 flex-1"
                  >
                    <option value="">Selecione</option>
                    {options.rate.map((o) => (
                      <option key={o.id} value={o.amount || o.name}>
                        {o.name}{o.amount ? ` - R$ ${Number(o.amount).toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setOptModal({ open: true, kind: "rate", name: "", amount: "" })} className="px-3 py-2 rounded border text-xs">Novo</button>
                </div>
              </label>
            </div>
            <label className="text-sm text-neutral-700 flex flex-col gap-1">
              Observações
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="border border-neutral-200 rounded-lg px-3 py-2 min-h-[80px]"
              />
            </label>
            <div className="text-sm text-neutral-700 flex flex-col gap-2">
              <span>Imagem do veículo</span>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {imagePreview ? (
                <img src={imagePreview} alt="Pré-visualização" className="w-48 h-32 object-cover rounded-lg border" />
              ) : (
                <div className="w-48 h-32 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center text-xs text-neutral-500">
                  Pré-visualização
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal({ open: false, car: null })} className="px-3 py-2 rounded border border-neutral-300">Cancelar</button>
              <button
                onClick={saveCar}
                disabled={saving}
                className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {optModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border shadow-2xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-neutral-900">Nova opção ({optModal.kind})</h4>
              <button onClick={() => setOptModal({ open: false, kind: "", name: "", amount: "" })} className="text-neutral-500 hover:text-neutral-800 text-xl">×</button>
            </div>
            <label className="text-sm text-neutral-700 flex flex-col gap-1">
              Nome
              <input
                value={optModal.name}
                onChange={(e) => setOptModal((o) => ({ ...o, name: e.target.value }))}
                className="border border-neutral-200 rounded-lg px-3 py-2"
              />
            </label>
            {optModal.kind === "rate" && (
              <label className="text-sm text-neutral-700 flex flex-col gap-1">
                Valor
                <input
                  type="number"
                  step="0.01"
                  value={optModal.amount}
                  onChange={(e) => setOptModal((o) => ({ ...o, amount: e.target.value }))}
                  className="border border-neutral-200 rounded-lg px-3 py-2"
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOptModal({ open: false, kind: "", name: "", amount: "" })} className="px-3 py-2 rounded border border-neutral-300">Cancelar</button>
              <button
                onClick={() => addOption(optModal.kind)}
                className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
                disabled={!optModal.name}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


