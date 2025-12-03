"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureSession } from "@/services/auth";
import { listClients } from "@/services/clients";
import {
  createFinanceClosing,
  listFinanceClosings,
  listFinanceEntries,
  payFinanceClosing,
  cancelFinanceClosing,
  sendFinanceClosing,
  listFinanceSendQueue,
  getFinanceClosing,
  addClosingEntry,
  removeClosingEntry,
  payClosingClient
} from "@/services/finance";
import { useToast } from "@/components/ToastProvider";

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPeriod(refDate, cycle) {
  const d = startOfDay(refDate);
  if (cycle === "diario") {
    return { start: d, end: d };
  }
  if (cycle === "mensal") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start, end };
  }
  // semanal
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - day + 1);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(start.getDate() + 6);
  return { start, end };
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

function shiftPeriod(start, end, cycle, direction = -1) {
  const delta = direction === -1 ? -1 : 1;
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (cycle === "diario") {
    s.setDate(s.getDate() + delta);
    e.setDate(e.getDate() + delta);
    return { start: s, end: e };
  }
  if (cycle === "mensal") {
    s.setMonth(s.getMonth() + delta);
    e.setMonth(e.getMonth() + delta);
    return { start: s, end: e };
  }
  // semanal
  s.setDate(s.getDate() + delta * 7);
  e.setDate(e.getDate() + delta * 7);
  return { start: s, end: e };
}

function formatDate(d) {
  if (!d) return "";
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return "";
  return dateObj.toISOString().slice(0, 10);
}

function toBRL(n) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function downloadCSV(rows, filename) {
  const header = Object.keys(rows[0] || {}).join(",");
  const body = rows.map((r) => Object.values(r).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FechamentoPage() {
  const toast = useToast();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [entries, setEntries] = useState([]);
  const [closings, setClosings] = useState([]);
  const [sendQueue, setSendQueue] = useState([]);
  const [closingDetail, setClosingDetail] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [includeMap, setIncludeMap] = useState({});
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [sendLogs, setSendLogs] = useState([]);
  const [cycle, setCycle] = useState("semanal");
  const period = getPeriod(new Date(), cycle);
  const [weekStart, setWeekStart] = useState(period.start);
  const [weekEnd, setWeekEnd] = useState(period.end);
  const [weekNumber, setWeekNumber] = useState(() => {
    const current = getPeriod(new Date(), "semanal");
    const onejan = new Date(current.start.getFullYear(), 0, 1);
    const week = Math.ceil(((current.start - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return week;
  });
  const [weekYear, setWeekYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await ensureSession();
        const perms = me?.user?.permissions || {};
        if (!perms.view_finance && !perms.edit_finance) {
          setAuthorized(false);
          toast.error("Acesso negado ao fechamento");
          return;
        }
        setAuthorized(true);
        const [{ clients: clientList }, { entries: financeEntries }, { closings: closingsList }, { queue }] = await Promise.all([
          listClients(),
          listFinanceEntries({ startDue: formatDate(weekStart), endDue: formatDate(weekEnd), status: "pendente" }),
          listFinanceClosings(),
          listFinanceSendQueue()
        ]);
        setClients(clientList || []);
        setEntries(financeEntries || []);
        setClosings(closingsList || []);
        setSendQueue(queue || []);
      } catch (e) {
        toast.error(e.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // load once

  async function refreshData() {
    try {
      setLoading(true);
      const [{ clients: clientList }, { entries: financeEntries }, { closings: closingsList }, { queue }] = await Promise.all([
        listClients(),
        listFinanceEntries({ startDue: formatDate(weekStart), endDue: formatDate(weekEnd), status: "pendente" }),
        listFinanceClosings(),
        listFinanceSendQueue()
      ]);
      setClients(clientList || []);
      setEntries(financeEntries || []);
      setClosings(closingsList || []);
      setSendQueue(queue || []);
    } catch (e) {
      toast.error(e.message || "Erro ao atualizar fechamento");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    const term = search.toLowerCase();
    const periodStart = weekStart;
    const periodEnd = weekEnd;
    const filtered = clients
      .map((c) => {
        const clientCycle = c.ciclo_fechamento || "semanal";
        if (clientCycle !== cycle) return null;
        if (c.active === false) return null;
        const billingMode = c.cobranca_tipo || "pos";
        const tariffType = (c.tipo_tarifa || "semanal").toLowerCase();
        const tariffBaseDays = tariffType === "mensal" ? 30 : tariffType === "diario" ? 1 : 7;
        const tariff = Number(c.tarifa || 0) || 0;
        const locStart = c.locacao_inicio ? new Date(c.locacao_inicio) : null;
        const locEnd = c.locacao_fim ? new Date(c.locacao_fim) : null;
        const inPeriod =
          !locEnd ||
          (locEnd && locEnd >= periodStart && locEnd <= periodEnd) ||
          c.active ||
          c.active === undefined ||
          c.active === null;
        if (!inPeriod) return null;
        const overlapStart = locStart && locStart > periodStart ? locStart : periodStart;
        const overlapEnd = locEnd && locEnd < periodEnd ? locEnd : periodEnd;
        const days = Math.max(1, Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
        const proratedTariff = (tariff * days) / tariffBaseDays;
        const related = entries.filter((e) => e.client_id === c.user_id && !e.voided && e.status !== "cancelado" && e.status !== "em_fechamento");
        const credits = related.filter((e) => e.kind === "credit").reduce((sum, e) => sum + (e.amount || 0), 0);
        const debits = related.filter((e) => e.kind === "debit").reduce((sum, e) => sum + (e.amount || 0), 0);
        const total = credits - debits - proratedTariff;
        return {
          id: c.user_id,
          nome: c.nome || c.user_name || "Sem nome",
          email: c.email,
          tarifa: proratedTariff,
          credits,
          debits,
          total,
          entries: related,
          billingMode,
          clientCycle
        };
      })
      .filter((row) => row)
      .filter((row) => {
        if (!term) return true;
        return row.nome.toLowerCase().includes(term) || (row.email || "").toLowerCase().includes(term);
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return filtered;
  }, [clients, entries, search]);

  function exportCSV() {
    if (!rows.length) {
      toast.info("Nada para exportar");
      return;
    }
    const data = rows.map((r) => ({
      Cliente: r.nome,
      Email: r.email || "-",
      Ciclo: r.clientCycle,
      Cobranca: r.billingMode,
      TarifaSemanal: r.tarifa,
      Creditos: r.credits,
      Debitos: r.debits,
      Saldo: r.total
    }));
    downloadCSV(data, `fechamento_${formatDate(weekStart)}_${formatDate(weekEnd)}.csv`);
  }

  function getEmailBody(row) {
    return [
      `Ola ${row.nome},`,
      ``,
      `Segue demonstrativo da semana ${formatDate(weekStart)} a ${formatDate(weekEnd)}:`,
      `- Tarifa semanal: ${toBRL(row.tarifa)}`,
      `- Creditos lancados: ${toBRL(row.credits)}`,
      `- Debitos lancados: ${toBRL(row.debits)}`,
      `- Saldo da semana: ${toBRL(row.total)}`,
      ``,
      `Qualquer duvida, estamos a disposicao.`
    ].join("\n");
  }

  async function generateClosing() {
    if (!rows.length) {
      toast.error("Nenhum cliente com lancamentos pendentes para gerar fechamento");
      return;
    }
    setSaving(true);
    try {
      const rowsSelecionados = rows;
      const entryIds = Array.from(
        new Set(
          rowsSelecionados.flatMap((r) => (r.entries || []).map((e) => e.id).filter(Boolean))
        )
      );
      const entriesSnapshot = rowsSelecionados.flatMap((r, idx) =>
        (r.entries || []).map((e, i) => ({
          id: e.id || `${r.id || r.email || "c"}-${idx}-${i}`,
          client_id: r.id,
          client_email: r.email,
          client_name: r.nome,
          label: e.label || "Lancamento",
          amount: e.amount || 0,
          kind: e.kind || (e.amount >= 0 ? "credit" : "debit"),
          status: e.status || "-",
          type_name: e.type_name || e.typeLabel || "Lancamento",
          type_kind: e.type_kind || null
        }))
      );
      const payload = {
        period_start: formatDate(weekStart),
        period_end: formatDate(weekEnd),
        cycle,
        entry_ids: entryIds,
        total: rowsSelecionados.reduce((sum, r) => sum + Number(r.total || 0), 0),
        client_count: rowsSelecionados.length,
        payload: {
          rows: rowsSelecionados.map((r) => ({
            id: r.id,
            cliente: r.nome,
            email: r.email,
            tarifa: r.tarifa,
            credits: r.credits,
            debits: r.debits,
            total: r.total,
            entry_ids: r.entries?.map((e) => e.id) || []
          })),
          entries: entriesSnapshot
        }
      };
      const { closing } = await createFinanceClosing(payload);
      toast.success("Fechamento gerado e salvo");
      setClosings((c) => [closing, ...(c || [])]);
    } catch (e) {
      toast.error(e.message || "Nao foi possivel gerar fechamento");
    } finally {
      setSaving(false);
    }
  }

  async function markClosingPaid(id) {
    setPayingId(id);
    try {
      const { closing } = await payFinanceClosing(id);
      setClosings((list) => list.map((c) => (c.id === id ? closing : c)));
      toast.success("Fechamento marcado como pago e lancamentos atualizados");
    } catch (e) {
      toast.error(e.message || "Nao foi possivel marcar como pago");
    } finally {
      setPayingId(null);
    }
  }

  async function sendClosing(id) {
    setSendingId(id);
    try {
      await sendFinanceClosing(id);
      setClosings((list) => list.map((c) => (c.id === id ? { ...c, status: c.status === "pago" ? "pago" : "enviado" } : c)));
      toast.success("Envio enfileirado");
      const { queue } = await listFinanceSendQueue();
      setSendQueue(queue || []);
    } catch (e) {
      toast.error(e.message || "Nao foi possivel enfileirar envio");
    } finally {
      setSendingId(null);
    }
  }

  async function sendClosingSelected() {
    if (!closingDetail?.closing?.id) return;
    const source =
      (closingDetail.rows && closingDetail.rows.length
        ? closingDetail.rows
        : Array.from(
            new Map(
              (closingDetail.entries || []).map((e) => [e.client_id || e.client_email, { id: e.client_id, email: e.client_email }])
            ).values()
          )) || [];
    const selected = source
      .filter((r) => includeMap[r.id || r.email] === true)
      .map((r) => r.id || r.email)
      .filter(Boolean);
    if (!selected.length) {
      toast.error("Selecione ao menos um cliente para enviar");
      return;
    }
    setSendingId(closingDetail.closing.id);
    try {
      await sendFinanceClosing(closingDetail.closing.id, selected);
      toast.success("Envio enfileirado para selecionados");
      const { queue } = await listFinanceSendQueue();
      setSendQueue(queue || []);
    } catch (e) {
      toast.error(e.message || "Nao foi possivel enfileirar envio");
    } finally {
      setSendingId(null);
    }
  }

  async function openClosingDetail(id) {
    try {
      const data = await getFinanceClosing(id);
      setClosingDetail(data);
      const map = {};
      if (data.rows && data.rows.length) {
        data.rows.forEach((r) => {
          if (r.id) map[r.id] = true;
          else if (r.email) map[r.email] = true;
        });
      } else {
        (data.entries || []).forEach((e) => {
          if (e.client_id) map[e.client_id] = true;
        });
      }
      setIncludeMap(map);
      setSendLogs(data.send_logs || []);
    } catch (e) {
      toast.error(e.message || "Nao foi possivel carregar fechamento");
    }
  }

  async function handleAddEntry(closingId, entryId) {
    try {
      const data = await addClosingEntry(closingId, entryId);
      setClosingDetail(data);
      toast.success("Lancamento adicionado ao fechamento");
    } catch (e) {
      toast.error(e.message || "Nao foi possivel adicionar");
    }
  }

  async function handleRemoveEntry(closingId, entryId) {
    try {
      const data = await removeClosingEntry(closingId, entryId);
      setClosingDetail(data);
      toast.success("Lancamento removido do fechamento");
    } catch (e) {
      toast.error(e.message || "Nao foi possivel remover");
    }
  }

  async function handlePayClient(closingId, clientId) {
    setPayingId(clientId);
    try {
      const data = await payClosingClient(closingId, clientId);
      setClosingDetail(data);
      toast.success("Cliente marcado como pago");
    } catch (e) {
      toast.error(e.message || "Nao foi possivel marcar cliente como pago");
    } finally {
      setPayingId(null);
    }
  }

  async function cancelClosing(id) {
    setCancelingId(id);
    try {
      await cancelFinanceClosing(id);
      toast.success("Fechamento cancelado");
      await refreshData();
      if (closingDetail?.closing?.id === id) setClosingDetail(null);
    } catch (e) {
      toast.error(e.message || "Nao foi possivel cancelar fechamento");
    } finally {
      setCancelingId(null);
    }
  }

  async function resendClient(closingId, clientId) {
    if (!clientId) {
      toast.error("Cliente invalido para reenvio");
      return;
    }
    try {
      await sendFinanceClosing(closingId, [clientId]);
      toast.success("Reenvio enfileirado");
      const { queue } = await listFinanceSendQueue();
      setSendQueue(queue || []);
    } catch (e) {
      toast.error(e.message || "Nao foi possivel reenviar");
    }
  }

  if (!authorized) return <main className="p-6 text-red-600">Acesso negado.</main>;
  if (loading) return <main className="p-6">Carregando fechamento...</main>;

  return (
    <main className="min-h-screen bg-neutral-50 p-6 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Fechamento {cycle}</h1>
          <p className="text-neutral-600 text-sm">Resumo de creditos, debitos e tarifa por cliente conforme ciclo.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={cycle}
            onChange={(e) => {
              const nextCycle = e.target.value;
              setCycle(nextCycle);
              if (nextCycle === "semanal") {
                const wr = weekRange(weekNumber, weekYear) || getPeriod(new Date(), "semanal");
                setWeekStart(wr.start);
                setWeekEnd(wr.end);
              } else if (nextCycle === "mensal") {
                const base = getPeriod(new Date(), "mensal");
                setWeekStart(base.start);
                setWeekEnd(base.end);
              } else {
                const d = getPeriod(new Date(), "diario");
                setWeekStart(d.start);
                setWeekEnd(d.end);
              }
            }}
            className="px-3 py-2 rounded border border-neutral-200 bg-white text-sm"
          >
            <option value="diario">Fechamento diario</option>
            <option value="semanal">Fechamento semanal</option>
            <option value="mensal">Fechamento mensal</option>
          </select>
          {cycle === "diario" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700">Início</label>
                <input
                  type="date"
                  value={formatDate(weekStart)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setWeekStart(d);
                  }}
                  className="px-2 py-1 rounded border border-neutral-200 bg-white text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700">Fim</label>
                <input
                  type="date"
                  value={formatDate(weekEnd)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setWeekEnd(d);
                  }}
                  className="px-2 py-1 rounded border border-neutral-200 bg-white text-sm"
                />
              </div>
            </>
          )}
          {cycle === "semanal" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700">Semana</label>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={weekNumber}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setWeekNumber(val);
                    const wr = weekRange(val, weekYear);
                    if (wr) {
                      setWeekStart(wr.start);
                      setWeekEnd(wr.end);
                    }
                  }}
                  className="px-2 py-1 rounded border border-neutral-200 bg-white text-sm w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700">Ano</label>
                <input
                  type="number"
                  value={weekYear}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setWeekYear(val);
                    const wr = weekRange(weekNumber, val);
                    if (wr) {
                      setWeekStart(wr.start);
                      setWeekEnd(wr.end);
                    }
                  }}
                  className="px-2 py-1 rounded border border-neutral-200 bg-white text-sm w-24"
                />
              </div>
            </>
          )}
          {cycle === "mensal" && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-700">Mes</label>
              <input
                type="month"
                value={`${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split("-").map((n) => Number(n));
                  const start = new Date(y, m - 1, 1);
                  const end = new Date(y, m, 0);
                  setWeekStart(start);
                  setWeekEnd(end);
                }}
                className="px-2 py-1 rounded border border-neutral-200 bg-white text-sm"
              />
            </div>
          )}
          <button
            type="button"
            onClick={refreshData}
            className="px-3 py-2 rounded bg-neutral-900 text-white text-sm"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-2 rounded bg-emerald-600 text-white text-sm"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={generateClosing}
            disabled={saving || !rows.length}
            className="px-3 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-60"
          >
            {saving ? "Gerando..." : "Gerar fechamento"}
          </button>
          <button
            type="button"
            onClick={() => setQueueModalOpen(true)}
            className="px-3 py-2 rounded border border-neutral-300 text-sm"
          >
            Ver fila de envio
          </button>
        </div>
      </header>

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex flex-wrap gap-3 items-center justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou email"
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-full md:w-72 text-sm"
          />
          <span className="text-sm text-neutral-600">{rows.length} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Tarifa semanal</th>
                <th className="text-left px-4 py-3">Créditos (semana)</th>
                <th className="text-left px-4 py-3">Débitos (semana)</th>
                <th className="text-left px-4 py-3">Saldo da semana</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{r.nome}</div>
                    <div className="text-xs text-neutral-500">{r.email || "Sem email"}</div>
                  </td>
                  <td className="px-4 py-3">{toBRL(r.tarifa)}</td>
                  <td className="px-4 py-3 text-emerald-700">{toBRL(r.credits)}</td>
                  <td className="px-4 py-3 text-red-700">{toBRL(r.debits)}</td>
                  <td className="px-4 py-3 font-semibold">{toBRL(r.total)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="px-3 py-1.5 rounded border border-neutral-300 text-xs hover:border-neutral-500"
                      onClick={() => navigator.clipboard.writeText(getEmailBody(r)).then(() => toast.success("Demonstrativo copiado para a área de transferência"))}
                    >
                      Copiar demonstrativo
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-neutral-500 py-6">Nenhum cliente encontrado para o período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {closingDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Detalhes do fechamento</h2>
                <p className="text-sm text-neutral-600">
                  Periodo {formatDate(new Date(closingDetail.closing.period_start))} a {formatDate(new Date(closingDetail.closing.period_end))}
                </p>
              </div>
              <button
                onClick={() => setClosingDetail(null)}
                className="px-3 py-2 rounded border border-neutral-300 text-sm"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 space-y-3">
              {(() => {
                const rowsSnapshot = (closingDetail.rows && closingDetail.rows.length ? closingDetail.rows : closingDetail.closing?.payload?.rows) || [];
                const entryGroups = ((closingDetail.entries && closingDetail.entries.length ? closingDetail.entries : closingDetail.closing?.payload?.entries) || []).reduce((acc, e) => {
                  const key = e.client_id || e.client_email || "desconhecido";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(e);
                  return acc;
                }, {});
                const dataToShow =
                  rowsSnapshot.length > 0
                    ? rowsSnapshot.map((r) => {
                        const entries = entryGroups[r.id] || entryGroups[r.email] || [];
                        const baseSummary = { tarifa: r.tarifa || 0, credits: r.credits || 0, debits: r.debits || 0, total: r.total || 0 };
                        // sempre inclui linha de tarifa + saldo; cred/deb detalhados vêm dos lancamentos reais (com tipo financeiro)
                        const combinedEntries = [
                          { id: `tarifa-${r.id || r.email || "tar"}`, label: "Tarifa semanal", amount: baseSummary.tarifa, kind: "debit", status: "-" },
                          ...entries.map((e, idx) => ({
                            id: e.id || `${e.label || "item"}-${idx}`,
                            label: e.label || "Lancamento",
                            amount: e.amount,
                            kind: e.kind || (e.amount >= 0 ? "credit" : "debit"),
                            status: e.status || "-",
                            type_name: e.type_name || e.typeLabel || "Lancamento",
                            type_kind: e.type_kind || e.kind || null
                          })),
                          {
                            id: `saldo-${r.id || r.email || "saldo"}`,
                            label: "Saldo da semana",
                            amount: baseSummary.total,
                            kind: null,
                            status: "-"
                          }
                        ];
                        return {
                          client_id: r.id || null,
                          client_name: r.cliente || "Cliente",
                          email: r.email,
                          summary: baseSummary,
                          entries: combinedEntries
                        };
                      })
                    : Object.values(entryGroups).map((list) => {
                        const tarifaSnapshot =
                          closingDetail.closing?.payload?.rows?.find((r) => r.id === list[0]?.client_id || r.email === list[0]?.client_email)?.tarifa || 0;
                        const credits = list.filter((e) => e.kind === "credit").reduce((s, e) => s + Number(e.amount || 0), 0);
                        const debits = list.filter((e) => e.kind === "debit").reduce((s, e) => s + Number(e.amount || 0), 0);
                        const combinedEntries = [
                          { id: `tarifa-${list[0]?.client_id || list[0]?.client_email || "tar"}`, label: "Tarifa semanal", amount: tarifaSnapshot, kind: "debit", status: "-" },
                          ...list.map((e, idx) => ({
                            id: e.id || `${e.label || "item"}-${idx}`,
                            label: e.label || "Lancamento",
                            amount: e.amount,
                            kind: e.kind || (e.amount >= 0 ? "credit" : "debit"),
                            status: e.status || "-",
                            type_name: e.type_name || "Lancamento",
                            type_kind: e.type_kind || e.kind || null
                          })),
                          {
                            id: `saldo-${list[0]?.client_id || list[0]?.client_email || "saldo"}`,
                            label: "Saldo da semana",
                            amount: credits - debits - tarifaSnapshot,
                            kind: null,
                            status: "-"
                          }
                        ];
                        return {
                          client_id: list[0]?.client_id,
                          client_name: list[0]?.client_name || "Cliente",
                          email: list[0]?.client_email,
                          summary: {
                            tarifa: tarifaSnapshot,
                            credits,
                            debits,
                            total: credits - debits - tarifaSnapshot
                          },
                          entries: combinedEntries
                        };
                      });
                return dataToShow.map((group, idx) => {
                  const clientPending = group.entries.filter((e) => e.status !== "pago");
                  const key = group.client_id || group.email || idx;
                  const included = includeMap[group.client_id || group.email] !== false;
                  return (
                    <div key={key} className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-neutral-900">{group.client_name}</div>
                      <div className="text-xs text-neutral-500">
                        {group.entries.length} lancamentos | {group.email || "Sem email"}
                      </div>
                      <div className="text-xs text-neutral-600">
                        Tarifa: {toBRL(group.summary.tarifa || 0)} | Creditos: {toBRL(group.summary.credits || 0)} | Debitos: {toBRL(group.summary.debits || 0)} | Saldo: {toBRL(group.summary.total || 0)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={(e) => setIncludeMap((m) => ({ ...m, [group.client_id || group.email]: e.target.checked }))}
                            />
                            Incluir no envio
                          </label>
                          <button
                            type="button"
                            onClick={() => handlePayClient(closingDetail.closing.id, group.client_id)}
                            disabled={payingId === group.client_id || clientPending.length === 0}
                            className="px-3 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-60"
                          >
                            {payingId === group.client_id ? "Atualizando..." : "Marcar pago"}
                          </button>
                          <button
                            type="button"
                            onClick={() => resendClient(closingDetail.closing.id, group.client_id)}
                            className="px-3 py-2 rounded border border-neutral-300 text-sm"
                          >
                            Reenviar
                          </button>
                          <button
                            type="button"
                            onClick={() => setClientDetail({ ...group })}
                            className="px-3 py-2 rounded bg-neutral-900 text-white text-sm"
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              {(closingDetail.rows || []).length === 0 && (closingDetail.entries || []).length === 0 && (
                <div className="px-4 py-6 text-sm text-neutral-500">Nenhum cliente associado.</div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t">
              <button
                type="button"
                onClick={sendClosingSelected}
                disabled={sendingId === closingDetail?.closing?.id}
                className="px-4 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-60"
              >
                {sendingId === closingDetail?.closing?.id ? "Enviando..." : "Enviar selecionados"}
              </button>
            </div>
          </div>
        </div>
      )}

      {clientDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{clientDetail.client_name}</h3>
                <p className="text-sm text-neutral-600">{clientDetail.email || "Sem email"}</p>
              </div>
              <button
                type="button"
                onClick={() => setClientDetail(null)}
                className="px-3 py-2 rounded border border-neutral-300 text-sm"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-2 py-1">Label</th>
                      <th className="text-left px-2 py-1">Valor</th>
                      <th className="text-left px-2 py-1">Tipo padrao</th>
                      <th className="text-left px-2 py-1">Natureza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientDetail.entries.map((e, idx) => (
                      <tr key={e.id || `${e.label}-${idx}`} className="border-t">
                        <td className="px-2 py-1">{e.label}</td>
                        <td className="px-2 py-1">{toBRL(e.amount)}</td>
                        <td className="px-2 py-1">{e.type_name || "-"}</td>
                        <td className="px-2 py-1 capitalize">
                          {e.kind === "credit" ? "Credito" : e.kind === "debit" ? "Debito" : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border border-neutral-200 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-neutral-800 mb-2">Historico de envios</h4>
                <div className="space-y-1 text-xs text-neutral-700">
                  {sendLogs
                    .filter((l) => l.client_id === clientDetail.client_id)
                    .map((l) => (
                      <div key={l.id} className="flex justify-between border border-neutral-200 rounded px-2 py-1">
                        <span>{formatDate(l.created_at)}</span>
                        <span className={l.status === "enviado" ? "text-emerald-700" : "text-red-600"}>
                          {l.status}
                          {l.error ? ` - ${l.error}` : ""}
                        </span>
                      </div>
                    ))}
                  {sendLogs.filter((l) => l.client_id === clientDetail.client_id).length === 0 && (
                    <p className="text-neutral-500">Nenhum envio registrado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {queueModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Fila de envio</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const { queue } = await listFinanceSendQueue();
                    setSendQueue(queue || []);
                  }}
                  className="px-3 py-2 rounded border border-neutral-300 text-sm"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => setQueueModalOpen(false)}
                  className="px-3 py-2 rounded border border-neutral-300 text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="divide-y">
              {(sendQueue || []).map((item, idx) => (
                <div key={item.id || idx} className="px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>ID: {item.id}</span>
                    <span>Status: {item.status || "fila"}</span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    Clientes: {item?.progress?.totalClients ?? 0} | Enviados: {item?.progress?.sent ?? 0} | Falhas: {item?.progress?.failed ?? 0}
                  </div>
                  {item.error && <div className="text-xs text-red-600">Erro: {item.error}</div>}
                  {item.deliveries && item.deliveries.length > 0 && (
                    <div className="text-xs text-neutral-700 space-y-1">
                      {item.deliveries.map((d, i) => (
                        <div key={i} className="flex justify-between border border-neutral-200 rounded px-2 py-1">
                          <span>{d.email || d.clientId || "Cliente"}</span>
                          <span className={d.status === "enviado" ? "text-emerald-700" : d.status === "erro" ? "text-red-600" : ""}>
                            {d.status || "pendente"} {d.error ? `- ${d.error}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(sendQueue || []).length === 0 && <div className="px-4 py-6 text-sm text-neutral-500">Fila vazia.</div>}
            </div>
          </div>
        </div>
      )}

      {clientDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{clientDetail.client_name}</h3>
                <p className="text-sm text-neutral-600">{clientDetail.email || "Sem email"}</p>
              </div>
              <button
                type="button"
                onClick={() => setClientDetail(null)}
                className="px-3 py-2 rounded border border-neutral-300 text-sm"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-2 py-1">Label</th>
                      <th className="text-left px-2 py-1">Valor</th>
                      <th className="text-left px-2 py-1">Tipo padrao</th>
                      <th className="text-left px-2 py-1">Natureza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientDetail.entries.map((e, idx) => (
                      <tr key={e.id || `${e.label}-${idx}`} className="border-t">
                        <td className="px-2 py-1">{e.label}</td>
                        <td className="px-2 py-1">{toBRL(e.amount)}</td>
                        <td className="px-2 py-1">{e.type_name || "-"}</td>
                        <td className="px-2 py-1 capitalize">
                          {e.kind === "credit" ? "Credito" : e.kind === "debit" ? "Debito" : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border border-neutral-200 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-neutral-800 mb-2">Historico de envios</h4>
                <div className="space-y-1 text-xs text-neutral-700">
                  {sendLogs
                    .filter((l) => l.client_id === clientDetail.client_id)
                    .map((l) => (
                      <div key={l.id} className="flex justify-between border border-neutral-200 rounded px-2 py-1">
                        <span>{formatDate(l.created_at)}</span>
                        <span className={l.status === "enviado" ? "text-emerald-700" : "text-red-600"}>
                          {l.status}
                          {l.error ? ` - ${l.error}` : ""}
                        </span>
                      </div>
                    ))}
                  {sendLogs.filter((l) => l.client_id === clientDetail.client_id).length === 0 && (
                    <p className="text-neutral-500">Nenhum envio registrado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Fechamentos gerados</h2>
            <p className="text-sm text-neutral-600">Associa os lancamentos pendentes do periodo. Marque como pago ou envie demonstrativo.</p>
          </div>
          <span className="text-sm text-neutral-600">{closings?.length || 0} registros</span>
        </div>
        <div className="divide-y">
          {(closings || []).map((c) => (
            <div key={c.id} className="px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
              <div className="space-y-1">
                <div className="font-semibold text-neutral-900">
                  {c.cycle || "semanal"}: {formatDate(new Date(c.period_start))} a {formatDate(new Date(c.period_end))}
                </div>
                <div className="text-sm text-neutral-600">
                  {c.entry_count || 0} lancamentos | {c.client_count || 0} clientes | Total {toBRL(c.total)}
                </div>
                <div className="text-xs text-neutral-500">Status: {c.status}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openClosingDetail(c.id)}
                  className="px-3 py-2 rounded border border-neutral-300 text-sm"
                >
                  Detalhes
                </button>
                <button
                  type="button"
                  onClick={() => sendClosing(c.id)}
                  disabled={sendingId === c.id}
                  className="px-3 py-2 rounded border border-neutral-300 text-sm disabled:opacity-60"
                >
                  {sendingId === c.id ? "Enviando..." : "Enviar demonstrativo"}
                </button>
                <button
                  type="button"
                  onClick={() => cancelClosing(c.id)}
                  disabled={cancelingId === c.id || c.status === "cancelado"}
                  className="px-3 py-2 rounded border border-red-300 text-sm text-red-700 disabled:opacity-60"
                >
                  {cancelingId === c.id ? "Cancelando..." : "Cancelar"}
                </button>
              </div>
            </div>
          ))}
          {(closings || []).length === 0 && (
            <div className="px-4 py-6 text-sm text-neutral-500">Nenhum fechamento gerado ainda.</div>
          )}
        </div>
      </section>
    </main>
  );
}
