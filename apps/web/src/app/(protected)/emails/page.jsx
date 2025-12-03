"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureSession } from "@/services/auth";
import { listEmailTemplates, updateEmailTemplate, listEmailLogs } from "@/services/emails";
import { uploadImage } from "@/services/uploads";
import { useToast } from "@/components/ToastProvider";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

function resolveUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  if (path.startsWith("/uploads")) return `${API_BASE}${path}`;
  return path;
}

function HtmlEditor({ value, onChange, placeholders = [], toast }) {
  const ref = useRef(null);
  const wrapperRef = useRef(null);
  const toolbarRef = useRef(null);
  const lastExternalValue = useRef(value || "");
  const fileInputRef = useRef(null);
  const editInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [imgWidth, setImgWidth] = useState("");
  const [imgAlign, setImgAlign] = useState("center");
  const [selectedImg, setSelectedImg] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const incoming = value || "";
    if (target.innerHTML !== incoming) {
      target.innerHTML = incoming;
      // reposiciona toolbar se imagem estava selecionada
      const img = target.querySelector("img");
      if (img) syncToolbarFromNode(img);
    }
    lastExternalValue.current = value || "";
  }, [value]);

  function emit(html) {
    lastExternalValue.current = html;
    onChange(html);
  }

  function handleInput() {
    const html = ref.current?.innerHTML || "";
    lastExternalValue.current = html;
    emit(html);
  }

  function wrapWith(tag) {
    if (!ref.current) return;
    ref.current.focus();
    const selected = document.getSelection()?.toString() || "";
    document.execCommand("insertHTML", false, `<${tag}>${selected || "texto"}</${tag}>`);
    handleInput();
  }

  function applyAlign(alignment) {
    if (!ref.current) return;
    ref.current.focus();
    const cmd = alignment === "left" ? "justifyLeft" : alignment === "center" ? "justifyCenter" : "justifyRight";
    document.execCommand(cmd, false, null);
    handleInput();
  }

  function insertPlaceholder(ph) {
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand("insertText", false, ph);
    handleInput();
  }

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await safeImageData(file);
      if (!dataUrl) throw new Error("Arquivo de imagem invalido");
      const { path } = await uploadImage(dataUrl);
      const url = resolveUrl(path);
      const { imgStyle, wrapperStyle } = buildImageStyle();
      ref.current?.focus();
      document.execCommand("insertHTML", false, "");
      const sel = document.getSelection();
      const range = sel?.getRangeAt(0);
      if (range) {
        const wrapper = document.createElement("div");
        wrapper.dataset.imgWrapper = "1";
        wrapper.setAttribute("style", wrapperStyle);
        const img = document.createElement("img");
        img.setAttribute("src", url);
        img.setAttribute("alt", "");
        img.setAttribute("style", imgStyle);
        wrapper.appendChild(img);
        range.insertNode(wrapper);
        range.setStartAfter(wrapper);
        range.setEndAfter(wrapper);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      handleInput();
      toast?.success?.("Imagem inserida.");
    } catch (e) {
      setUploading(false);
      toast?.error?.("Erro ao processar imagem");
    } finally {
      setUploading(false);
    }
  }

  function buildImageStyle(alignOverride = imgAlign, widthOverride = imgWidth) {
    const width = widthOverride ? `width:${widthOverride}px;` : "";
    const imgStyle = `display:inline-block; max-width:100%; height:auto; ${width}`.trim();
    const textAlign = alignOverride === "left" ? "left" : alignOverride === "right" ? "right" : "center";
    const wrapperStyle = `display:block; width:100%; text-align:${textAlign}; margin:8px 0;`;
    return { imgStyle, wrapperStyle };
  }

  function findNearestImage() {
    const sel = document.getSelection();
    if (!sel?.anchorNode) return null;
    let node = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement;
    while (node && node.tagName !== "IMG") {
      node = node.parentElement;
    }
    return node || null;
  }

  function ensureWrapper(node, styleOverride = null) {
    if (!node) return null;
    let wrapper = node.parentElement;
    if (!wrapper || wrapper.dataset?.imgWrapper !== "1") {
      wrapper = document.createElement("div");
      wrapper.dataset.imgWrapper = "1";
    wrapper.style.display = "block";
    wrapper.style.width = "100%";
    wrapper.style.margin = "8px 0";
      node.replaceWith(wrapper);
      wrapper.appendChild(node);
    }
    const styleToUse = styleOverride || buildImageStyle().wrapperStyle;
    wrapper.setAttribute("style", styleToUse);
    wrapper.dataset.imgWrapper = "1";
    return wrapper;
  }

  async function editCurrentImage(file, targetNode) {
    if (!file) return;
    const imgNode = targetNode || findNearestImage();
    if (!imgNode) {
      toast?.error?.("Selecione uma imagem no editor para substituir.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await safeImageData(file);
      if (!dataUrl) throw new Error("Arquivo de imagem invalido");
      const { path } = await uploadImage(dataUrl);
      const url = resolveUrl(path);
      const { imgStyle, wrapperStyle } = buildImageStyle();
      const wrapper = ensureWrapper(imgNode, wrapperStyle);
      imgNode.setAttribute("src", url);
      imgNode.setAttribute("style", imgStyle);
      syncToolbarFromNode(imgNode);
      handleInput();
      toast?.success?.("Imagem atualizada.");
    } catch (e) {
      setUploading(false);
      toast?.error?.("Erro ao processar imagem");
    }
  }

  function syncToolbarFromNode(node) {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    setSelectedImg(node);
    const x = wrapperRect ? rect.left - wrapperRect.left : rect.left + window.scrollX;
    const y = wrapperRect ? rect.top - wrapperRect.top : rect.top + window.scrollY;
    setToolbarPos({ x, y: y - 36 });
    const styleWidth = node.style.width || "";
    setImgWidth(styleWidth ? parseInt(styleWidth, 10) || "" : "");
    const parentAlign = node.parentElement?.style?.textAlign || "";
    if (["left", "center", "right"].includes(parentAlign)) setImgAlign(parentAlign);
    else setImgAlign("center");
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function handleClick(e) {
      if (toolbarRef.current?.contains(e.target)) return;
      if (e.target.tagName === "IMG") {
        syncToolbarFromNode(e.target);
      } else {
        setSelectedImg(null);
      }
    }
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, []);

  function applyStyleToSelected(alignOverride = null) {
    if (!selectedImg) return;
    const { imgStyle, wrapperStyle } = buildImageStyle(alignOverride || imgAlign);
    const wrapper = ensureWrapper(selectedImg, wrapperStyle);
    selectedImg.setAttribute("style", imgStyle);
    handleInput();
  }

  return (
    <div ref={wrapperRef} className="border border-neutral-300 rounded-lg bg-white overflow-visible relative">
      <div className="px-2 py-1.5 bg-neutral-100 border-b border-neutral-200 flex flex-wrap gap-2 text-xs text-neutral-700">
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => wrapWith("strong")}>Negrito</button>
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => wrapWith("em")}>Italico</button>
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => wrapWith("p")}>Paragrafo</button>
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => wrapWith("a")}>Link</button>
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => applyAlign("left")}>Alinhar esq.</button>
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => applyAlign("center")}>Centralizar</button>
        <button type="button" className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400" onClick={() => applyAlign("right")}>Alinhar dir.</button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Enviando..." : "Imagem"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleUpload(file);
          }}
        />
        {placeholders?.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-neutral-500">Placeholders:</span>
            {placeholders.map((ph) => (
              <button
                key={ph}
                type="button"
                className="px-2 py-1 rounded border border-neutral-200 hover:border-neutral-400 font-mono text-[11px]"
                onClick={() => insertPlaceholder(ph)}
              >
                {ph}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[200px] px-3 py-2 font-sans text-sm leading-relaxed focus:outline-none"
        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      />
      {selectedImg && (
        <div
          ref={toolbarRef}
          className="absolute z-10 bg-white shadow-lg border border-neutral-200 rounded-md p-2 flex items-center gap-2 text-xs text-neutral-700"
          style={{ top: toolbarPos.y, left: toolbarPos.x }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-1">
            Largura:
            <input
              type="number"
              min="0"
              value={imgWidth}
              onChange={(e) => setImgWidth(e.target.value)}
              onBlur={applyStyleToSelected}
              className="w-16 px-2 py-1 border border-neutral-300 rounded"
              placeholder="auto"
            />
          </label>
          <select
            value={imgAlign}
            onChange={(e) => { const val = e.target.value; setImgAlign(val); applyStyleToSelected(val); }}
            className="px-2 py-1 border border-neutral-300 rounded"
          >
            <option value="left">Esq</option>
            <option value="center">Centro</option>
            <option value="right">Dir</option>
          </select>
          <button
            type="button"
          onClick={() => editInputRef.current?.click()}
          className="px-2 py-1 border border-neutral-300 rounded"
          >
            Substituir
          </button>
          <input
            ref={editInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) editCurrentImage(file, selectedImg);
            }}
          />
        <button
            type="button"
          onClick={() => {
            setSelectedImg(null);
            setImgWidth("");
            setImgAlign("center");
          }}
          className="px-2 py-1 border border-neutral-300 rounded"
        >
          Fechar
        </button>
      </div>
    )}
  </div>
  );
}

async function compressImage(file) {
  try {
    const maxSize = 1600;
    const quality = 0.8;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl); // fallback
      img.src = dataUrl;
    });
  } catch {
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function safeImageData(file) {
  try {
    return await compressImage(file);
  } catch {
    try {
      return await fileToDataUrl(file);
    } catch {
      return null;
    }
  }
}

function EditTemplateModal({ open, template, draft, onChange, onClose, onSave, saving, toast, useHtml, setUseHtml }) {
  if (!open || !template) return null;
  const required = template.required_placeholders || [];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Editar email</p>
            <h3 className="text-lg font-semibold text-neutral-900">{template.key}</h3>
            <p className="text-sm text-neutral-600">Conteudo obrigatorio deve manter: {required.length ? required.join(", ") : "sem placeholders"}</p>
          </div>
          <button onClick={onClose} className="text-sm text-neutral-600 hover:text-neutral-900">Fechar</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Assunto</label>
            <input
              value={draft.subject}
              onChange={(e) => onChange("subject", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:border-neutral-500"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-800">Corpo (texto)</label>
              <textarea
                value={draft.text ?? ""}
                onChange={(e) => onChange("text", e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:border-neutral-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useHtml}
                    onChange={(e) => setUseHtml(e.target.checked)}
                  />
                  <span>Usar corpo HTML</span>
                </label>
                {!!required.length && (
                  <span className="text-xs text-neutral-500">Placeholders obrigatorios: {required.join(", ")}</span>
                )}
              </div>
              {useHtml ? (
                <HtmlEditor
                  key={template.key}
                  value={draft.html ?? ""}
                  onChange={(val) => onChange("html", val)}
                  placeholders={required}
                  toast={toast}
                />
              ) : (
                <div className="text-xs text-neutral-600 bg-neutral-100 border border-dashed border-neutral-300 rounded-lg p-3">
                  O envio usara apenas o corpo em texto. Ative para editar HTML.
                </div>
              )}
            </div>
          </div>
          {required.length > 0 && (
            <div className="text-xs text-neutral-600">
              Placeholders obrigatorios: {required.join(", ")}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t bg-neutral-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500">Cancelar</button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar template"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmailsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");

  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState(5);

  const [logs, setLogs] = useState([]);
  const [logSearch, setLogSearch] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [logsLoading, setLogsLoading] = useState(false);

  const [editModal, setEditModal] = useState({ open: false, template: null });
  const [editDraft, setEditDraft] = useState({ subject: "", text: "", html: "" });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [useHtml, setUseHtml] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const me = await ensureSession();
        const perms = me?.user?.permissions || {};
        if (!me?.user || !perms.view_email_templates) {
          setAuthorized(false);
          setError("Acesso negado: permissoes de email necessarias.");
          return;
        }
        setAuthorized(true);
        setCanEdit(!!perms.edit_email_templates);
        const [{ templates }, { logs }] = await Promise.all([
          listEmailTemplates(),
          listEmailLogs({ limit: 100, offset: 0 })
        ]);
        const normalizedTemplates = (templates || []).map((t) => ({
          ...t,
          html: t.html ?? "",
          text: t.text ?? ""
        }));
        setTemplates(normalizedTemplates);
        setLogs(logs || []);
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.toLowerCase();
    return templates.filter((t) => {
      if (!term) return true;
      return t.key.toLowerCase().includes(term) || (t.subject || "").toLowerCase().includes(term);
    });
  }, [templates, templateSearch]);

  const templateTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTemplates.length / templatePageSize)),
    [filteredTemplates.length, templatePageSize]
  );
  const templatePaginated = useMemo(() => {
    const start = (templatePage - 1) * templatePageSize;
    return filteredTemplates.slice(start, start + templatePageSize);
  }, [filteredTemplates, templatePage, templatePageSize]);

  const filteredLogs = useMemo(() => {
    const term = logSearch.toLowerCase();
    return logs.filter((l) => {
      if (!term) return true;
      return (
        (l.to_email || "").toLowerCase().includes(term) ||
        (l.subject || "").toLowerCase().includes(term) ||
        (l.template_key || "").toLowerCase().includes(term)
      );
    });
  }, [logs, logSearch]);

  const logTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredLogs.length / logPageSize)),
    [filteredLogs.length, logPageSize]
  );
  const logPaginated = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return filteredLogs.slice(start, start + logPageSize);
  }, [filteredLogs, logPage, logPageSize]);

  useEffect(() => { setTemplatePage(1); }, [templateSearch, templatePageSize]);
  useEffect(() => { setLogPage(1); }, [logSearch, logPageSize]);

  function openEdit(t) {
    if (!canEdit) return;
    setEditModal({ open: true, template: t });
    setEditDraft({
      subject: t.subject || "",
      text: t.text ?? "",
      html: t.html ?? ""
    });
    setUseHtml(!!(t.html && t.html.trim().length));
  }

  function closeEdit() {
    setEditModal({ open: false, template: null });
    setEditDraft({ subject: "", text: "", html: "" });
    setSavingTemplate(false);
    setUseHtml(false);
  }

  async function handleSaveTemplate() {
    if (!editModal.template) return;
    const required = editModal.template.required_placeholders || [];
    const htmlToSend = useHtml ? (editDraft.html || "") : "";
    if (useHtml) {
      for (const ph of required) {
        if (!htmlToSend.includes(ph)) {
          toast.error(`O HTML deve manter ${ph}`);
          return;
        }
      }
    } else {
      const blob = `${editDraft.subject}${editDraft.text || ""}`;
      for (const ph of required) {
        if (!blob.includes(ph)) {
          toast.error(`O conteudo deve manter ${ph}`);
          return;
        }
      }
    }
    setSavingTemplate(true);
    try {
      const { template } = await updateEmailTemplate(editModal.template.key, {
        subject: editDraft.subject,
        text: editDraft.text ?? null,
        html: useHtml ? htmlToSend : null
      });
      setTemplates((prev) => prev.map((t) => (t.key === template.key ? template : t)));
      toast.success("Template atualizado.");
      closeEdit();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function refreshLogs() {
    setLogsLoading(true);
    try {
      const { logs } = await listEmailLogs({ limit: 100, offset: 0 });
      setLogs(logs || []);
      toast.success("Envios atualizados.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogsLoading(false);
    }
  }

  if (loading) {
    return <main className="p-6">Carregando emails...</main>;
  }

  if (!authorized) {
    return <main className="p-6 text-red-600">{error || "Acesso negado."}</main>;
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6 space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Emails do sistema</h1>
          <p className="text-neutral-600 text-sm">Visualize envios recentes e edite templates (com permissao).</p>
        </div>
        <div className="text-sm text-neutral-500">Permissao: visualizar {canEdit ? "e editar" : "somente visualizar"}</div>
      </header>

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">Templates</h2>
            <p className="text-neutral-600 text-sm">Inclui emails de autenticacao, boas-vindas e confirmacao.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Buscar por chave ou assunto"
              className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-full md:w-64"
            />
            <select
              value={templatePageSize}
              onChange={(e) => setTemplatePageSize(Number(e.target.value))}
              className="px-2 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
            >
              {[5, 10, 20].map((n) => <option key={n} value={n}>{n}/pag</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left px-4 py-3">Chave</th>
                <th className="text-left px-4 py-3">Assunto</th>
                <th className="text-left px-4 py-3">Obrigatorios</th>
                <th className="text-left px-4 py-3">Atualizado</th>
                <th className="px-4 py-3 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {templatePaginated.map((t) => (
                <tr key={t.key} className="border-t border-neutral-200">
                  <td className="px-4 py-3 font-mono text-xs">{t.key}</td>
                  <td className="px-4 py-3">{t.subject}</td>
                  <td className="px-4 py-3">
                    {t.required_placeholders?.length
                      ? <div className="flex flex-wrap gap-2">{t.required_placeholders.map((ph) => (
                        <span key={ph} className="px-2 py-1 rounded-full border border-neutral-200 bg-neutral-50 text-[11px] font-mono">{ph}</span>
                      ))}</div>
                      : <span className="text-xs text-neutral-500">Nenhum</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {t.updated_at ? new Date(t.updated_at).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(t)}
                      disabled={!canEdit}
                      className="px-3 py-2 text-sm rounded-lg border border-neutral-300 hover:border-neutral-500 disabled:opacity-60"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {templatePaginated.length === 0 && (
                <tr><td colSpan={5} className="text-center text-neutral-500 py-6">Nenhum template encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-t border-neutral-200">
          <div className="text-sm text-neutral-600">
            {filteredTemplates.length ? `${(templatePage - 1) * templatePageSize + 1}-${Math.min(templatePage * templatePageSize, filteredTemplates.length)} de ${filteredTemplates.length}` : "0 de 0"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
              disabled={templatePage === 1}
              className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
            >
              {"<"}
            </button>
            <span className="text-sm text-neutral-700">Pagina {templatePage} / {templateTotalPages}</span>
            <button
              onClick={() => setTemplatePage((p) => Math.min(templateTotalPages, p + 1))}
              disabled={templatePage === templateTotalPages}
              className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
            >
              {">"}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">Emails enviados</h2>
            <p className="text-neutral-600 text-sm">Ultimos envios registrados no sistema.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Buscar por destinatario, assunto ou template"
              className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-full md:w-72"
            />
            <select
              value={logPageSize}
              onChange={(e) => setLogPageSize(Number(e.target.value))}
              className="px-2 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}/pag</option>)}
            </select>
            <button
              onClick={refreshLogs}
              className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500 text-sm"
              disabled={logsLoading}
            >
              {logsLoading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left px-4 py-3">Destinatario</th>
                <th className="text-left px-4 py-3">Assunto</th>
                <th className="text-left px-4 py-3">Template</th>
                <th className="text-left px-4 py-3">Enviado em</th>
              </tr>
            </thead>
            <tbody>
              {logPaginated.map((l) => (
                <tr key={l.id} className="border-t border-neutral-200">
                  <td className="px-4 py-3">{l.to_email}</td>
                  <td className="px-4 py-3">{l.subject}</td>
                  <td className="px-4 py-3 font-mono text-xs">{l.template_key || "-"}</td>
                  <td className="px-4 py-3 text-neutral-500">{l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : "-"}</td>
                </tr>
              ))}
              {logPaginated.length === 0 && (
                <tr><td colSpan={4} className="text-center text-neutral-500 py-6">Nenhum envio encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-t border-neutral-200">
          <div className="text-sm text-neutral-600">
            {filteredLogs.length ? `${(logPage - 1) * logPageSize + 1}-${Math.min(logPage * logPageSize, filteredLogs.length)} de ${filteredLogs.length}` : "0 de 0"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLogPage((p) => Math.max(1, p - 1))}
              disabled={logPage === 1}
              className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
            >
              {"<"}
            </button>
            <span className="text-sm text-neutral-700">Pagina {logPage} / {logTotalPages}</span>
            <button
              onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
              disabled={logPage === logTotalPages}
              className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
            >
              {">"}
            </button>
          </div>
        </div>
      </section>

      <EditTemplateModal
        open={editModal.open}
        template={editModal.template}
        draft={editDraft}
        onChange={(field, value) => setEditDraft((prev) => ({ ...prev, [field]: value }))}
        onClose={closeEdit}
        onSave={handleSaveTemplate}
        saving={savingTemplate}
        toast={toast}
        useHtml={useHtml}
        setUseHtml={setUseHtml}
      />
    </main>
  );
}
