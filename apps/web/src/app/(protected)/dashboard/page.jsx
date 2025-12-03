"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { ensureSession } from "@/services/auth";
import { listLeads } from "@/services/leads";
import { getClientStats, getClientMonthlyStats } from "@/services/clients";
import { useToast } from "@/components/ToastProvider";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const brand = {
  yellow: "#ffd500",
  black: "#0f172a"
};

function StatCard({ title, value, subtitle, accent = "bg-white" }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 shadow-sm p-5 ${accent}`}>
      <p className="text-sm text-neutral-500">{title}</p>
      <h3 className="text-2xl font-semibold text-neutral-900">{value}</h3>
      {subtitle && <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [clientStats, setClientStats] = useState({ active: 0, inactive: 0, total: 0 });
  const [clientMonthly, setClientMonthly] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0]
    };
  });

  useEffect(() => {
    (async () => {
      try {
        const session = await ensureSession();
        if (!session?.user) {
          window.location.href = "/login?next=/dashboard";
          return;
        }
        if (session.user.role === "pending") {
          window.location.href = "/aguardando";
          return;
        }
        const [{ leads }, cs, cm] = await Promise.all([
          listLeads(),
          getClientStats().catch(() => ({ stats: { active: 0, inactive: 0, total: 0 } })),
          getClientMonthlyStats().catch(() => ({ stats: [] }))
        ]);
        setLeads(leads || []);
        setClientStats(cs?.stats || { active: 0, inactive: 0, total: 0 });
        setClientMonthly(cm?.stats || []);
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const start = range.start ? new Date(range.start).getTime() : null;
    const end = range.end ? new Date(range.end).getTime() + 24 * 60 * 60 * 1000 : null;
    if (!start || !end) return leads;
    return leads.filter((l) => {
      const baseDate = l.stage_entered_at || l.created_at || l.updated_at;
      if (!baseDate) return false;
      const t = new Date(baseDate).getTime();
      return t >= start && t < end;
    });
  }, [leads, range]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const byStage = filtered.reduce((acc, l) => {
      acc[l.stage] = (acc[l.stage] || 0) + 1;
      return acc;
    }, {});
    const rented = byStage.rented || 0;
    const notRented = byStage.not_rented || 0;
    const contact = byStage.contact || 0;
    const created = byStage.created || 0;
    const conversion = total ? Math.round((rented / total) * 100) : 0;
    const loss = total ? Math.round((notRented / total) * 100) : 0;
    const contactRate = total ? Math.round(((contact + rented + notRented) / total) * 100) : 0;
    return { total, byStage, rented, notRented, conversion, loss, contactRate, created };
  }, [filtered]);

  const recent = useMemo(() => filtered.slice(0, 8), [filtered]);

  // Stats de clientes filtrados pelo range (usando dados mensais)
  const clientRangeStats = useMemo(() => {
    if (!clientMonthly.length) return { active: 0, inactive: 0, total: 0 };
    const start = range.start ? new Date(range.start).getTime() : null;
    const end = range.end ? new Date(range.end).getTime() + 24 * 60 * 60 * 1000 : null;
    let active = 0;
    let inactive = 0;
    clientMonthly.forEach((m) => {
      const parts = m.month.split("-");
      if (parts.length !== 2) return;
      const monthStart = new Date(`${parts[0]}-${parts[1]}-01`).getTime();
      const monthEnd = new Date(`${parts[0]}-${parts[1]}-01`);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      const mEndTs = monthEnd.getTime();
      const overlaps = (!start || mEndTs > start) && (!end || monthStart < end);
      if (!overlaps) return;
      active += m.active || 0;
      inactive += m.inactive || 0;
    });
    return { active, inactive, total: active + inactive };
  }, [clientMonthly, range]);

  const clientMonthlyCurrentYear = useMemo(() => {
    const year = new Date().getFullYear();
    return clientMonthly.filter((m) => m.month?.startsWith(`${year}-`));
  }, [clientMonthly]);

  const clientChart = useMemo(() => {
    const source = clientMonthlyCurrentYear;
    if (!source?.length) return { labels: [], datasets: [] };
    const labels = source.map((m) => m.month);
    return {
      labels,
      datasets: [
        {
          label: "Ativos",
          data: source.map((m) => m.active || 0),
          backgroundColor: "#22c55e",
          borderRadius: 6
        },
        {
          label: "Inativos",
          data: source.map((m) => m.inactive || 0),
          backgroundColor: "#f87171",
          borderRadius: 6
        }
      ]
    };
  }, [clientMonthlyCurrentYear]);

  const clientChartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }),
    []
  );

  const stagesDisplay = [
    { id: "created", label: "Cadastrado" },
    { id: "contact", label: "Contato" },
    { id: "rented", label: "Locação" },
    { id: "not_rented", label: "Não fechou" },
    { id: "archived", label: "Arquivo" }
  ];

  return (
    <main className="min-h-screen bg-neutral-50">
      <section
        className="p-8 md:p-10 text-neutral-900"
        style={{ background: `linear-gradient(120deg, ${brand.yellow} 0%, #fff7b3 50%, #ffffff 100%)` }}
      >
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-neutral-700 mt-2 mb-10">Visão geral do funil de leads.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 -mt-16 pb-10">
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
        {loading ? (
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6">Carregando métricas...</div>
        ) : (
          <>
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-sm text-neutral-600">Início</label>
                <input
                  type="date"
                  value={range.start}
                  onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-neutral-600">Fim</label>
                <input
                  type="date"
                  value={range.end}
                  onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <StatCard title="Leads totais" value={stats.total} subtitle="Todos os cards no funil" accent="bg-white" />
              <StatCard title="Locações realizadas" value={stats.rented} subtitle="Stage rented" accent="bg-white" />
              <StatCard title="Taxa de conversão" value={`${stats.conversion}%`} subtitle="rented / total" accent="bg-white" />
              <StatCard title="Taxa de contato" value={`${stats.contactRate}%`} subtitle="(contact+rented+not_rented) / total" accent="bg-white" />
              <StatCard title="Clientes ativos" value={clientRangeStats.active} subtitle="Perfis ativos no filtro" accent="bg-white" />
              <StatCard title="Clientes inativos" value={clientRangeStats.inactive} subtitle="Perfis inativos no filtro" accent="bg-white" />
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900">Distribuição por etapa</h3>
                  <span className="text-xs text-neutral-500">Atualizado agora</span>
                </div>
                <div className="space-y-3">
                  {stagesDisplay.map((s) => {
                    const value = stats.byStage[s.id] || 0;
                    const pct = stats.total ? Math.round((value / stats.total) * 100) : 0;
                    return (
                      <div key={s.id}>
                        <div className="flex justify-between text-sm text-neutral-700">
                          <span>{s.label}</span>
                          <span>{value} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-neutral-100 rounded-full h-2 mt-1 overflow-hidden">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: s.id === "rented" ? "#22c55e" : s.id === "not_rented" ? "#ef4444" : brand.black
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900">Resumo rápido</h3>
                </div>
                <div className="space-y-3 text-sm text-neutral-700">
                  <div className="flex justify-between"><span>Perdas</span><span>{stats.loss}%</span></div>
                  <div className="flex justify-between"><span>Novos (Cadastrado)</span><span>{stats.created}</span></div>
                  <div className="flex justify-between"><span>Contato em andamento</span><span>{stats.byStage.contact || 0}</span></div>
                  <div className="flex justify-between"><span>Arquivo</span><span>{stats.byStage.archived || 0}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white border border-neutral-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-neutral-900">Clientes ativos vs inativos por mês</h3>
                <span className="text-xs text-neutral-500">Ano vigente ({new Date().getFullYear()})</span>
              </div>
              {clientMonthlyCurrentYear.length === 0 ? (
                <div className="text-neutral-500 text-sm">Sem dados de clientes.</div>
              ) : (
                <div className="w-full">
                  <Bar data={clientChart} options={clientChartOptions} />
                </div>
              )}
            </div>

            <div className="mt-6 bg-white border border-neutral-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-neutral-900">Leads recentes</h3>
                <a href="/leads" className="text-sm text-neutral-700 hover:text-neutral-900 font-semibold">Ver todos</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-600 border-b">
                    <tr>
                      <th className="py-2">Nome</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Telefone</th>
                      <th className="py-2">Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2">{l.name}</td>
                        <td className="py-2 text-neutral-600">{l.email}</td>
                        <td className="py-2 text-neutral-600">{l.phone}</td>
                        <td className="py-2">
                          <span className="px-2 py-1 text-xs rounded-full border border-neutral-200 bg-neutral-50">{l.stage}</span>
                        </td>
                      </tr>
                    ))}
                    {recent.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-neutral-500 text-center">Nenhum lead ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
