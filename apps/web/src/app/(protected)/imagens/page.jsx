"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureSession } from "@/services/auth";
import { listImages, deleteImage } from "@/services/uploads";
import { useToast } from "@/components/ToastProvider";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

function resolveUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  if (path.startsWith("/uploads")) return `${API_BASE}${path}`;
  return path;
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function ImagensPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");

  const [images, setImages] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | used | unused
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const me = await ensureSession();
        const perms = me?.user?.permissions || {};
        if (!me?.user || !perms.edit_cars) {
          setAuthorized(false);
          setError("Acesso negado. Necessario permissao para editar carros.");
          return;
        }
        setAuthorized(true);
        setCanEdit(!!perms.edit_cars);
        const { images } = await listImages();
        setImages(images || []);
      } catch (e) {
        setError(e.message || "Erro ao carregar imagens");
        toast.error(e.message || "Erro ao carregar imagens");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return images.filter((img) => {
      const inUse = (img.usages?.cars?.length || 0) > 0 || (img.usages?.templates?.length || 0) > 0;
      if (filter === "used" && !inUse) return false;
      if (filter === "unused" && inUse) return false;
      if (!term) return true;
      return (
        (img.path || "").toLowerCase().includes(term) ||
        (img.type || "").toLowerCase().includes(term)
      );
    });
  }, [images, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, filter, pageSize]);

  async function handleDelete(path) {
    if (!canEdit) return;
    if (!window.confirm("Excluir esta imagem permanentemente?")) return;
    try {
      await deleteImage(path);
      setImages((prev) => prev.filter((img) => img.path !== path));
      toast.success("Imagem removida.");
    } catch (e) {
      toast.error(e.message || "Erro ao excluir");
    }
  }

  if (loading) return <main className="p-6">Carregando imagens...</main>;
  if (!authorized) return <main className="p-6 text-red-600">{error || "Acesso negado."}</main>;

  return (
    <main className="min-h-screen bg-neutral-50 p-6 space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Gerenciar imagens</h1>
          <p className="text-neutral-600 text-sm">Veja onde cada imagem é usada e remova apenas se não houver referência.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por caminho ou tipo"
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-full md:w-64 text-sm"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
          >
            <option value="all">Todas</option>
            <option value="used">Em uso</option>
            <option value="unused">Sem uso</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
          >
            {[12, 24, 48].map((n) => <option key={n} value={n}>{n}/página</option>)}
          </select>
        </div>
      </header>

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b text-sm text-neutral-700 flex items-center justify-between">
          <span>{filtered.length} imagens</span>
          <span className="text-neutral-500">Página {page} de {totalPages}</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {paginated.map((img) => {
            const carsUse = img.usages?.cars || [];
            const templatesUse = img.usages?.templates || [];
            const inUse = carsUse.length > 0 || templatesUse.length > 0;
            return (
              <div key={img.path} className="border border-neutral-200 rounded-lg overflow-hidden shadow-sm bg-neutral-50">
                <div className="w-full h-40 bg-white flex items-center justify-center overflow-hidden">
                  <img
                    src={resolveUrl(img.path)}
                    alt={img.path}
                    className="object-contain w-full h-full"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
                <div className="p-3 space-y-2 text-sm">
                  <div className="font-mono text-xs break-all">{img.path}</div>
                  <div className="text-neutral-600 text-xs">Tipo: {img.type}</div>
                  <div className="text-neutral-600 text-xs">Tamanho: {formatSize(img.size)}</div>
                  <div className="text-neutral-600 text-xs">
                    Uso: {inUse ? `${carsUse.length ? `${carsUse.length} carro(s)` : ""}${carsUse.length && templatesUse.length ? " · " : ""}${templatesUse.length ? `${templatesUse.length} template(s)` : ""}` : "Nenhum"}
                  </div>
                  {carsUse.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {carsUse.map((c) => (
                        <span key={c.id} className="px-2 py-1 rounded-full bg-neutral-200 text-[11px]">
                          {c.plate || "Sem placa"} {c.model ? `- ${c.model}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {templatesUse.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {templatesUse.map((t) => (
                        <span key={t.key} className="px-2 py-1 rounded-full bg-amber-100 text-[11px] border border-amber-200">
                          Template: {t.key}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(img.path)}
                      disabled={inUse || !canEdit}
                      className="px-3 py-1.5 rounded border text-xs font-semibold disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {paginated.length === 0 && (
            <div className="col-span-full text-center text-neutral-500 py-8 text-sm">
              Nenhuma imagem encontrada.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-neutral-700">
          <span>{filtered.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filtered.length)} de ${filtered.length}` : "0 de 0"}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50">{"<"}</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50">{">"}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
