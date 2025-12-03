"use client";

import { useEffect, useMemo, useState } from "react";
import { addNote, getLead, listLeads, moveLead, updateLead, createLead } from "@/services/leads";
import { ensureSession } from "@/services/auth";
import { useToast } from "@/components/ToastProvider";

const STAGES = [
  { id: "created", title: "Cadastrado", color: "border-yellow-300 bg-yellow-50" },
  { id: "contact", title: "Contato realizado", color: "border-blue-200 bg-blue-50" },
  { id: "rented", title: "Locação realizada", color: "border-emerald-200 bg-emerald-50" },
  { id: "not_rented", title: "Locação não realizada", color: "border-red-200 bg-red-50" },
  { id: "archived", title: "Arquivo", color: "border-neutral-200 bg-neutral-50" }
];

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(entered) {
  if (!entered) return "-";
  const ms = Date.now() - new Date(entered).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function toDateInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

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

export default function LeadsPage() {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const perms = me?.user?.permissions || {};
  const canEdit = !!perms.edit_leads;
  const canView = !!(perms.view_leads || perms.edit_leads);
  const [newLead, setNewLead] = useState({
    open: false,
    data: { name: "", phone: "", email: "", city: "", cpf: "", birthdate: "", ear: "Não", uber: "Não" }
  });
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", action: null });
  const [archivedModal, setArchivedModal] = useState({ open: false, filter: "" });

  async function fetchLeads() {
    setLoading(true);
    setError("");
    try {
      const { leads } = await listLeads({ q: filter });
      setLeads(leads);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureSession();
        setMe(session);
        if (session?.user?.role === "pending") {
          window.location.href = "/aguardando";
          return;
        }
        const allowed = !!(session?.user?.permissions?.view_leads || session?.user?.permissions?.edit_leads);
        if (session?.user && !allowed) {
          setError("Acesso restrito");
          return;
        }
        await fetchLeads();
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map = {};
    STAGES.forEach((s) => { map[s.id] = []; });
    leads.forEach((l) => {
      if (!map[l.stage]) map[l.stage] = [];
      map[l.stage].push(l);
    });
    return map;
  }, [leads]);

  async function openLead(id) {
    try {
      const data = await getLead(id);
      setSelected(data);
      setNoteText("");
    } catch (e) {
      setError(e.message);
    }
  }

async function saveLead(fields) {
  if (!selected) return;
  setSaving(true);
    try {
      const { lead } = await updateLead(selected.lead.id, fields);
      setSelected((prev) => ({ ...prev, lead: { ...prev.lead, ...lead } }));
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)));
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openConfirm(title, message, action) {
    setConfirm({ open: true, title, message, action });
  }
  function closeConfirm() {
    setConfirm({ open: false, title: "", message: "", action: null });
  }

  async function addNoteAction() {
    if (!noteText.trim() || !selected) return;
    openConfirm("Confirmar observação", "Deseja salvar esta observação?", async () => {
      setSaving(true);
      try {
        const { note } = await addNote(selected.lead.id, noteText.trim());
        setSelected((prev) => ({ ...prev, notes: [note, ...(prev?.notes || [])] }));
        setNoteText("");
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setSaving(false);
      }
    });
  }

  async function move(id, toStage) {
    openConfirm("Mover lead", "Confirmar movimentação de etapa?", async () => {
      setSaving(true);
      try {
        const { lead } = await moveLead(id, toStage);
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...lead } : l)));
        if (selected?.lead.id === id) {
          setSelected((prev) => ({ ...prev, lead: { ...prev.lead, ...lead } }));
        }
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setSaving(false);
        setDraggingId(null);
      }
    });
  }

  function onDragStart(id) { setDraggingId(id); }
  function onDrop(toStage) {
    if (!draggingId) return;
    move(draggingId, toStage);
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <header className="flex flex-wrap gap-4 items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Leads</h1>
          <p className="text-neutral-600 text-sm">Arraste os cards entre etapas ou clique para editar.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nome, email, telefone ou cidade"
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-72"
          />
          {canEdit && (
            <button
              onClick={() => setNewLead({ open: true, data: { name: "", phone: "", email: "", city: "" } })}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#ffd500", color: "#0f172a" }}
            >
              Novo lead
            </button>
          )}
          <button
            onClick={fetchLeads}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-semibold shadow hover:bg-neutral-800"
          >
            Atualizar
          </button>
        </div>
      </header>

      {!canView ? (
        <div className="text-neutral-600">Acesso restrito. Solicite permissão a um administrador.</div>
      ) : loading ? (
        <div className="text-neutral-600">Carregando leads...</div>
      ) : (
        <div className="grid gap-4 md:gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`rounded-2xl border ${stage.color} p-3 flex flex-col gap-3 min-h-[280px]`}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => onDrop(stage.id)}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-neutral-900">{stage.title}</h2>
                <span className="text-xs text-neutral-500">{grouped[stage.id]?.length || 0}</span>
              </div>
              <div className="flex flex-col gap-3">
                {(stage.id === "archived" ? (grouped[stage.id] || []).slice(0, 10) : grouped[stage.id] || []).map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => onDragStart(lead.id)}
                    onClick={() => openLead(lead.id)}
                    className="bg-white border border-neutral-200 rounded-xl p-3 shadow-sm cursor-grab hover:-translate-y-0.5 transition"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-neutral-900">{lead.name}</h3>
                      <span className="text-xs text-neutral-500">{fmtDuration(lead.stage_entered_at)}</span>
                    </div>
                    <p className="text-sm text-neutral-600">{lead.city || "Cidade não informada"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-700">
                      <span className="px-2 py-1 bg-neutral-100 rounded-lg border border-neutral-200">{lead.phone}</span>
                      <span className="px-2 py-1 bg-neutral-100 rounded-lg border border-neutral-200">{lead.email}</span>
                      {lead.ear && <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">EAR: {lead.ear}</span>}
                      {lead.uber && <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg">Uber: {lead.uber}</span>}
                    </div>
                  </article>
                ))}
                {(!grouped[stage.id] || grouped[stage.id].length === 0) && (
                  <div className="text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-lg p-3 text-center">
                    Sem leads nesta etapa.
                  </div>
                )}
                {stage.id === "archived" && grouped[stage.id]?.length > 10 && (
                  <button
                    onClick={() => setArchivedModal({ open: true, filter: "" })}
                    className="text-sm text-neutral-700 underline"
                  >
                    Ver todos arquivados
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-100">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">{selected.lead.name}</h3>
                <p className="text-sm text-neutral-500">
                  Etapa: {STAGES.find((s) => s.id === selected.lead.stage)?.title || selected.lead.stage} •
                  Tempo na etapa: {fmtDuration(selected.lead.stage_entered_at)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-800">✕</button>
            </div>

            <div className="grid md:grid-cols-3 gap-6 p-6 max-h-[80vh] overflow-y-auto">
              <div className="md:col-span-2 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    ["name", "Nome completo"],
                    ["phone", "Telefone"],
                    ["email", "E-mail"],
                    ["city", "Cidade"],
                    ["cpf", "CPF/CNPJ"],
                    ["birthdate", "Nascimento"],
                    ["ear", "EAR"],
                    ["uber", "Uber"]
                  ].map(([field, label]) => (
                    <label key={field} className="flex flex-col gap-1 text-sm text-neutral-700">
                      {label}
                      {field === "ear" ? (
                        <select
                          defaultValue={selected.lead[field] || "Não"}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === (selected.lead[field] || "")) return;
                            if (!canEdit || field === "email") return;
                            setConfirm({
                              open: true,
                              title: "Confirmar edição",
                              message: `Confirmar edição de ${label}?`,
                              action: () => saveLead({ [field]: val })
                            });
                          }}
                          className="px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-400 disabled:opacity-60"
                        >
                          <option>Sim</option>
                          <option>Não</option>
                        </select>
                      ) : field === "uber" ? (
                        <select
                          defaultValue={selected.lead[field] || "Não"}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === (selected.lead[field] || "")) return;
                            if (!canEdit || field === "email") return;
                            setConfirm({
                              open: true,
                              title: "Confirmar edição",
                              message: `Confirmar edição de ${label}?`,
                              action: () => saveLead({ [field]: val })
                            });
                          }}
                          className="px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-400 disabled:opacity-60"
                        >
                          <option>Sim</option>
                          <option>Não</option>
                        </select>
                      ) : (
                        <input
                          type={field === "birthdate" ? "date" : "text"}
                          defaultValue={field === "birthdate" ? toDateInput(selected.lead[field]) : (selected.lead[field] || "")}
                          disabled={(field === "email") || !canEdit}
                          onBlur={(e) => {
                            const val = e.target.value;
                            const current = field === "birthdate" ? toDateInput(selected.lead[field]) : (selected.lead[field] || "");
                            if (val === current) return;
                            if (!canEdit || field === "email") return;
                            setConfirm({
                              open: true,
                              title: "Confirmar edição",
                              message: `Confirmar edição de ${label}?`,
                              action: () => saveLead({ [field]: val })
                            });
                          }}
                          className="px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-400 disabled:opacity-60"
                        />
                      )}
                    </label>
                  ))}
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-800 mb-2">Mover etapa</p>
                  <div className="flex flex-wrap gap-2">
                    {STAGES.map((s) => (
                      <button
                        key={s.id}
                        disabled={saving || s.id === selected.lead.stage || !canEdit}
                        onClick={() => move(selected.lead.id, s.id)}
                        className={`px-3 py-2 rounded-lg border text-sm ${
                          s.id === selected.lead.stage
                            ? "bg-neutral-200 border-neutral-300 text-neutral-600"
                            : "bg-white border-neutral-200 hover:border-neutral-400"
                        }`}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-800 mb-2">Histórico</p>
                  <div className="space-y-2 text-sm text-neutral-700 max-h-48 overflow-y-auto pr-1">
                    {selected.events?.length ? selected.events.map((ev) => (
                      <div key={ev.id} className="border border-neutral-200 rounded-lg p-3 bg-gradient-to-br from-white to-neutral-50 shadow-sm">
                        <div className="flex justify-between text-xs text-neutral-500 mb-1">
                          <span className="capitalize">{ev.type.replace("_", " ")}</span>
                          <span>{fmtDate(ev.created_at)}</span>
                        </div>
                        <div className="text-xs text-neutral-500 mb-1">
                          {ev.author_name || ev.author_email ? (
                            <>Por <strong>{ev.author_name || ev.author_email}</strong></>
                          ) : "Autor não identificado"}
                        </div>
                        {ev.from_stage && (
                          <p className="text-neutral-800 text-sm">De <strong>{ev.from_stage}</strong> para <strong>{ev.to_stage}</strong></p>
                        )}
                        {ev.diff && (
                          <div className="mt-2 text-xs bg-white border border-neutral-200 rounded p-2 space-y-1">
                            {Object.entries(ev.diff).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-2">
                                <span className="text-neutral-600">{k}</span>
                                <span className="text-neutral-800">{`${v?.from || ""} → ${v?.to || ""}`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )) : <div className="text-neutral-500">Sem histórico ainda.</div>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                  <p className="font-semibold text-neutral-800 text-sm mb-2">Adicionar observação</p>
                  <textarea
                    value={noteText}
                    disabled={!canEdit}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white"
                    placeholder="Próximos passos, bloqueios, follow-up..."
                  />
                  <button
                    onClick={addNoteAction}
                    disabled={saving || !noteText.trim() || !canEdit}
                    className="mt-2 w-full bg-neutral-900 text-white px-3 py-2 rounded-lg hover:bg-neutral-800 disabled:opacity-60"
                  >
                    Salvar observação
                  </button>
                </div>

                <div className="border border-neutral-200 rounded-xl p-3 bg-white max-h-[320px] overflow-y-auto">
                  <p className="font-semibold text-neutral-800 text-sm mb-2">Observações</p>
                  <div className="space-y-2 text-sm">
                    {selected.notes?.length ? selected.notes.map((n) => (
                      <div key={n.id} className="border border-neutral-200 rounded-lg p-2 bg-neutral-50">
                        <p className="text-neutral-800">{n.message}</p>
                        <div className="flex justify-between text-xs text-neutral-500 mt-1">
                          <span>{n.author_name || n.author_email || "Autor não identificado"}</span>
                          <span>{fmtDate(n.created_at)}</span>
                        </div>
                      </div>
                    )) : <div className="text-neutral-500 text-sm">Nenhuma observação.</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {newLead.open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-neutral-900">Novo lead</h3>
              <button onClick={() => setNewLead({ open: false, data: newLead.data })} className="text-neutral-500 hover:text-neutral-800">✕</button>
            </div>
            {[
              ["name", "Nome"],
              ["phone", "Telefone"],
              ["email", "E-mail"],
              ["city", "Cidade"],
              ["cpf", "CPF/CNPJ"],
              ["birthdate", "Nascimento"]
            ].map(([field, label]) => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-sm text-neutral-600">{label}</label>
                <input
                  type={field === "birthdate" ? "date" : "text"}
                  placeholder={label}
                  value={newLead.data[field] || ""}
                  onChange={(e) => setNewLead((prev) => ({ ...prev, data: { ...prev.data, [field]: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50"
                />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-600">EAR</label>
              <select
                value={newLead.data.ear}
                onChange={(e) => setNewLead((prev) => ({ ...prev, data: { ...prev.data, ear: e.target.value } }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50"
              >
                <option>Sim</option>
                <option>Não</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-600">Cadastrado na Uber?</label>
              <select
                value={newLead.data.uber}
                onChange={(e) => setNewLead((prev) => ({ ...prev, data: { ...prev.data, uber: e.target.value } }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50"
              >
                <option>Sim</option>
                <option>Não</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewLead({ open: false, data: newLead.data })}
                className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500"
              >
                Cancelar
              </button>
              <button
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    await createLead(newLead.data);
                    await fetchLeads();
                    setNewLead({ open: false, data: { name: "", phone: "", email: "", city: "" } });
                  } catch (e) {
                    setError(e.message);
                    toast.error(e.message);
                  } finally {
                    setCreating(false);
                  }
                }}
                className="px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: "#0f172a" }}
              >
                {creating ? "Salvando..." : "Criar lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onCancel={closeConfirm}
        onConfirm={async () => {
          if (confirm.action) await confirm.action();
          closeConfirm();
        }}
      />

      {archivedModal.open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-neutral-900">Leads arquivados</h3>
              <button onClick={() => setArchivedModal({ open: false, filter: "" })} className="text-neutral-500 hover:text-neutral-800">✕</button>
            </div>
            <input
              placeholder="Filtrar por nome, email ou telefone"
              value={archivedModal.filter}
              onChange={(e) => setArchivedModal((m) => ({ ...m, filter: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200"
            />
            <div className="max-h-[400px] overflow-y-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100 text-neutral-700">
                  <tr>
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">Telefone</th>
                    <th className="text-left px-3 py-2">Cidade</th>
                    <th className="text-left px-3 py-2">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {(grouped.archived || [])
                    .filter((l) => {
                      const term = archivedModal.filter.toLowerCase();
                      if (!term) return true;
                      return (
                        (l.name || "").toLowerCase().includes(term) ||
                        (l.email || "").toLowerCase().includes(term) ||
                        (l.phone || "").toLowerCase().includes(term) ||
                        (l.cpf || "").toLowerCase().includes(term)
                      );
                    })
                    .map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-neutral-200 hover:bg-neutral-50 cursor-pointer"
                        onClick={() => { setArchivedModal({ open: false, filter: "" }); openLead(l.id); }}
                      >
                        <td className="px-3 py-2">{l.name}</td>
                        <td className="px-3 py-2 text-neutral-600">{l.email}</td>
                        <td className="px-3 py-2 text-neutral-600">{l.phone}</td>
                        <td className="px-3 py-2 text-neutral-600">{l.city}</td>
                        <td className="px-3 py-2 text-neutral-500">{fmtDate(l.updated_at || l.stage_entered_at)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}



