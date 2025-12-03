import { z } from "zod";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { getUserById } from "../repositories/userRepo.js";
import { getClientByUserId } from "../repositories/clientRepo.js";
import {
  getEntryById,
  getTypeById,
  insertEntry,
  insertEntryHistory,
  insertEntryNote,
  insertType,
  insertClosing,
  listClosings,
  listEntries,
  listEntryHistory,
  listEntryNotes,
  listTypes,
  markClosingPaid,
  cancelClosing,
  addEntryToClosing,
  removeEntryFromClosing,
  getClosingWithEntries,
  markClosingClientPaid,
  updateClosingPayload,
  insertClosingSendLog,
  listClosingSendLogs,
  updateEntry,
  updateType
} from "../repositories/financeRepo.js";

const amountInput = z.preprocess((v) => {
  if (typeof v === "string") return Number(v.replace(",", "."));
  return v;
}, z.number().min(0, "Valor deve ser positivo"));

const entrySchema = z.object({
  client_id: z.string().uuid(),
  type_id: z.union([z.string().uuid(), z.null()]).optional(),
  label: z.string().min(2),
  description: z.string().optional(),
  amount: amountInput,
  emission_date: z.string().min(10),
  due_date: z.string().min(10),
  status: z.enum(["pendente", "pago", "atrasado", "cancelado", "em_fechamento"]).optional(),
  kind: z.enum(["credit", "debit"])
});

const updateEntrySchema = z.object({
  client_id: z.string().uuid().optional(),
  type_id: z.union([z.string().uuid(), z.null()]).optional(),
  label: z.string().min(2).optional(),
  description: z.string().optional(),
  amount: amountInput.optional(),
  emission_date: z.string().min(10).optional(),
  due_date: z.string().min(10).optional(),
  status: z.enum(["pendente", "pago", "atrasado", "cancelado", "em_fechamento"]).optional(),
  kind: z.enum(["credit", "debit"]).optional(),
  voided: z.boolean().optional()
});

const filtersSchema = z.object({
  clientId: z.string().uuid().optional(),
  startDue: z.string().min(10).optional(),
  endDue: z.string().min(10).optional(),
  status: z.enum(["pendente", "pago", "atrasado", "cancelado", "em_fechamento"]).optional(),
  typeId: z.string().uuid().optional(),
  kind: z.enum(["credit", "debit"]).optional()
});

const typeSchema = z.object({
  name: z.string().min(2),
  kind: z.enum(["credit", "debit"]).optional(),
  description: z.string().optional()
});

const noteSchema = z.object({
  message: z.string().min(1)
});

const closingSchema = z.object({
  period_start: z.string().min(10),
  period_end: z.string().min(10),
  cycle: z.enum(["diario", "semanal", "mensal"]).default("semanal"),
  entry_ids: z.array(z.string().uuid()).min(0).default([]),
  total: z.number().optional(),
  client_count: z.number().optional(),
  payload: z.any().optional(),
  entries_snapshot: z.array(z.any()).optional()
});

const closingSendSchema = z.object({
  id: z.string().uuid(),
  client_ids: z.array(z.string()).optional()
});

const closingEntrySchema = z.object({
  entry_id: z.string().uuid()
});

const closingClientSchema = z.object({
  client_id: z.string().uuid()
});

function ensureDatesOrder(emission, due) {
  if (!emission || !due) return;
  const emis = new Date(emission);
  const dueDate = new Date(due);
  if (Number.isNaN(emis.getTime()) || Number.isNaN(dueDate.getTime())) return;
  if (dueDate < emis) throw new Error("Data de vencimento nao pode ser anterior a emissao");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createClientPdf(closing, client, entries) {
  const dir = path.join(process.cwd(), "uploads", "closings", closing.id);
  ensureDir(dir);
  const filePath = path.join(dir, `${client.id || client.email || "cliente"}.pdf`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(16).text("Demonstrativo de Fechamento", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Periodo: ${closing.period_start} a ${closing.period_end}`);
    doc.text(`Cliente: ${client.name || "Cliente"} - ${client.email || ""}`);
    doc.moveDown();
    entries.forEach((en) => {
      doc.text(`${en.label} - ${en.kind === "credit" ? "Credito" : "Debito"}: R$ ${Number(en.amount || 0).toFixed(2)}`);
    });
    const total = entries.reduce(
      (sum, en) => sum + (en.kind === "credit" ? Number(en.amount || 0) : -Number(en.amount || 0)),
      0
    );
    doc.moveDown();
    doc.fontSize(13).text(`Total: R$ ${total.toFixed(2)}`, { align: "right" });
    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

async function ensureClient(userId) {
  const user = await getUserById(userId);
  if (!user || user.role !== "client") throw new Error("Cliente invalido");
  const profile = await getClientByUserId(userId);
  if (!profile) throw new Error("Cliente nao possui perfil cadastrado");
  return user;
}

export async function listFinanceEntries(filters = {}) {
  const parsed = filtersSchema.parse(filters);
  return listEntries(parsed);
}

export async function createFinanceEntry(data) {
  const parsed = entrySchema.parse(data);
  await ensureClient(parsed.client_id);

  let type = null;
  if (parsed.type_id) {
    type = await getTypeById(parsed.type_id);
    if (!type) throw new Error("Tipo nao encontrado");
  }

  ensureDatesOrder(parsed.emission_date, parsed.due_date);

  const payload = {
    ...parsed,
    type_id: parsed.type_id || null,
    status: parsed.status || "pendente"
  };
  return insertEntry(payload);
}

export async function updateFinanceEntry(id, data, authorId) {
  const parsed = updateEntrySchema.parse(data);
  const current = await getEntryById(id);
  if (!current) throw new Error("Lancamento nao encontrado");

  let type = null;
  if (parsed.type_id !== undefined && parsed.type_id !== null) {
    type = await getTypeById(parsed.type_id);
    if (!type) throw new Error("Tipo nao encontrado");
  }
  const nextKind = parsed.kind || current.kind;
  if (!nextKind) throw new Error("Tipo do lancamento obrigatorio");

  const nextClientId = parsed.client_id || current.client_id;
  await ensureClient(nextClientId);

  ensureDatesOrder(parsed.emission_date || current.emission_date, parsed.due_date || current.due_date);

  const updates = {
    ...parsed,
    kind: nextKind
  };
  const updated = await updateEntry(id, updates);

  // registra historico se houve alteracao relevante
  const diff = {};
  const keysToTrack = ["label", "description", "amount", "emission_date", "due_date", "status", "kind", "type_id", "client_id", "voided"];
  keysToTrack.forEach((k) => {
    const prevVal = current[k];
    const nextVal = updates[k] !== undefined ? updates[k] : current[k];
    const normalizedPrev = prevVal instanceof Date ? prevVal.toISOString().slice(0, 10) : prevVal;
    const normalizedNext = nextVal instanceof Date ? nextVal.toISOString().slice(0, 10) : nextVal;
    if (normalizedPrev !== normalizedNext) {
      diff[k] = { from: normalizedPrev ?? null, to: normalizedNext ?? null };
    }
  });
  if (Object.keys(diff).length) {
    await insertEntryHistory({ entryId: id, authorId: authorId || null, diff });
  }
  return updated;
}

export async function listFinanceTypes() {
  return listTypes();
}

export async function createFinanceType(data) {
  const parsed = typeSchema.parse(data);
  return insertType({ ...parsed, kind: parsed.kind || null });
}

export async function updateFinanceType(id, data) {
  const parsed = typeSchema.partial().parse(data);
  return updateType(id, parsed);
}

export async function addFinanceNote(entryId, message, authorId) {
  const entry = await getEntryById(entryId);
  if (!entry) throw new Error("Lancamento nao encontrado");
  const parsed = noteSchema.parse({ message });
  return insertEntryNote({ entryId, authorId, message: parsed.message });
}

export async function getFinanceEntryDetail(entryId) {
  const entry = await getEntryById(entryId);
  if (!entry) throw new Error("Lancamento nao encontrado");
  const [notes, history] = await Promise.all([listEntryNotes(entryId), listEntryHistory(entryId, 100)]);
  return { entry, notes, history };
}

export async function createFinanceClosing(data, authorId = null) {
  const parsed = closingSchema.parse(data);
  const start = new Date(parsed.period_start);
  const end = new Date(parsed.period_end);
  if (end < start) throw new Error("Periodo invalido");
  const closing = await insertClosing(
    {
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      cycle: parsed.cycle,
      total: parsed.total || 0,
      entry_count: parsed.entry_ids?.length || 0,
      client_count: parsed.client_count || 0,
      payload: {
        ...(parsed.payload || {}),
        entries: parsed.entries_snapshot || parsed.payload?.entries || []
      }
    },
    parsed.entry_ids
  );
  await Promise.all(
    parsed.entry_ids.map((entryId) =>
      insertEntryHistory({
        entryId,
        authorId: authorId || data.author_id || null,
        diff: { status: { from: "pendente", to: "em_fechamento", via: "closing" } }
      }).catch(() => null)
    )
  );
  return closing;
}

export async function listFinanceClosings() {
  return listClosings();
}

export async function payFinanceClosing(id) {
  return markClosingPaid(id);
}

export async function cancelFinanceClosing(id) {
  return cancelClosing(id);
}

// envio assíncrono simplificado (fila em memória)
const closingSendQueue = [];
let sending = false;

async function processQueue() {
  if (sending) return;
  sending = true;
  while (closingSendQueue.length) {
    const item = closingSendQueue.shift();
    try {
      item.status = "enviando";
      const detail = await getClosingWithEntries(item.id);
      if (!detail) throw new Error("Fechamento nao encontrado");
      const smtpHost = process.env.SMTP_HOST || "127.0.0.1";
      const smtpPort = Number(process.env.SMTP_PORT || 1025);
      const smtpUser = process.env.SMTP_USER || undefined;
      const smtpPass = process.env.SMTP_PASS || undefined;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        ignoreTLS: true,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        tls: { rejectUnauthorized: false }
      });
      const grouped = (detail.entries || []).reduce((acc, e) => {
        const key = e.client_id || e.client_email;
        if (!key) return acc;
        acc[key] = acc[key] || { id: e.client_id, email: e.client_email, name: e.client_name || "Cliente", entries: [] };
        acc[key].entries.push(e);
        return acc;
      }, {});
      // fallback to snapshot rows when nao ha entries (ex: so tarifa)
      if (Object.keys(grouped).length === 0 && Array.isArray(detail.rows)) {
        detail.rows.forEach((r) => {
          const key = r.id || r.email;
          if (!key) return;
          const entries = [];
          if (r.tarifa) entries.push({ label: "Tarifa", kind: "debit", amount: r.tarifa });
          if (r.credits) entries.push({ label: "Creditos", kind: "credit", amount: r.credits });
          if (r.debits) entries.push({ label: "Debitos", kind: "debit", amount: r.debits });
          grouped[key] = {
            id: r.id,
            email: r.email,
            name: r.cliente || "Cliente",
            entries
          };
        });
      }
      const clients = Object.values(grouped).filter((c) => {
        if (!item.client_ids || item.client_ids.length === 0) return true;
        return (c.id && item.client_ids.includes(c.id)) || (c.email && item.client_ids.includes(c.email));
      });
      item.progress = { totalClients: clients.length, sent: 0, failed: 0 };
      item.deliveries = [];
      for (const cli of clients) {
        const delivery = { clientId: cli.id, email: cli.email, status: "enviando" };
        try {
          const pdfPath = await createClientPdf(detail.closing, { id: cli.id, email: cli.email, name: cli.name }, cli.entries);
          const lines = [
            `Ola ${cli.name},`,
            `Segue demonstrativo do periodo ${detail.closing.period_start} a ${detail.closing.period_end}:`,
            ...cli.entries.map((en) => `- ${en.label}: ${en.amount}`),
            "",
            "Qualquer duvida, estamos a disposicao."
          ].join("\n");
          await transporter.sendMail({
            from: process.env.MAIL_FROM || "no-reply@app.local",
            to: cli.email,
            subject: `Fechamento ${detail.closing.period_start} a ${detail.closing.period_end}`,
            text: lines,
            attachments: [{ filename: `demonstrativo_${detail.closing.period_start}_${detail.closing.period_end}.pdf`, path: pdfPath }]
          });
          item.progress.sent += 1;
          delivery.status = "enviado";
          delivery.pdf = pdfPath;
          await insertClosingSendLog({ closingId: detail.closing.id, clientId: cli.id, email: cli.email, status: "enviado", error: null });
        } catch (err) {
          item.progress.failed += 1;
          delivery.status = "erro";
          delivery.error = err.message;
          await insertClosingSendLog({ closingId: detail.closing.id, clientId: cli.id, email: cli.email, status: "erro", error: err.message });
        }
        item.deliveries.push(delivery);
      }
      item.status = "enviado";
    } catch (e) {
      item.status = "erro";
      item.error = e.message;
    }
  }
  sending = false;
}

export async function enqueueClosingSend(id, clientIds) {
  const parsed = closingSendSchema.parse({ id, client_ids: clientIds });
  closingSendQueue.push({
    id: parsed.id,
    client_ids: parsed.client_ids || [],
    status: "fila",
    progress: { totalClients: 0, sent: 0, failed: 0 },
    deliveries: []
  });
  processQueue().catch(() => {});
  return { queued: true };
}

export async function listClosingSendQueue() {
  return closingSendQueue;
}

export async function getFinanceClosing(id) {
  const data = await getClosingWithEntries(id);
  if (!data) return null;
  const logs = await listClosingSendLogs(id);
  return { ...data, send_logs: logs };
}

export async function addEntryToFinanceClosing(closingId, entryId, authorId = null) {
  closingEntrySchema.parse({ entry_id: entryId });
  const data = await addEntryToClosing(closingId, entryId);
  const entry = await getEntryById(entryId);
  await insertEntryHistory({
    entryId,
    authorId,
    diff: { status: { from: "pendente", to: "em_fechamento", via: "closing" } }
  }).catch(() => null);
  const closing = await getClosingWithEntries(closingId);
  const payloadEntries = closing?.closing?.payload?.entries || [];
  const updatedPayload = {
    ...(closing?.closing?.payload || {}),
    entries: [...payloadEntries.filter((e) => e.id !== entryId), entry || {}]
  };
  await updateClosingPayload(closingId, updatedPayload);
  return getClosingWithEntries(closingId);
}

export async function removeEntryFromFinanceClosing(closingId, entryId, authorId = null) {
  const data = await removeEntryFromClosing(closingId, entryId);
  await insertEntryHistory({
    entryId,
    authorId,
    diff: { status: { from: "em_fechamento", to: "pendente", via: "closing" } }
  }).catch(() => null);
  const closing = await getClosingWithEntries(closingId);
  const payloadEntries = closing?.closing?.payload?.entries || [];
  const updatedPayload = {
    ...(closing?.closing?.payload || {}),
    entries: payloadEntries.filter((e) => e.id !== entryId)
  };
  await updateClosingPayload(closingId, updatedPayload);
  return getClosingWithEntries(closingId);
}

export async function payFinanceClosingClient(closingId, clientId, authorId = null) {
  closingClientSchema.parse({ client_id: clientId });
  const data = await markClosingClientPaid(closingId, clientId);
  await Promise.all(
    (data.entries || [])
      .filter((e) => e.client_id === clientId)
      .map((e) =>
        insertEntryHistory({
          entryId: e.id,
          authorId,
          diff: { status: { from: e.status, to: "pago", via: "closing" } }
        }).catch(() => null)
      )
  );
  const closing = await getClosingWithEntries(closingId);
  const payloadEntries = closing?.closing?.payload?.entries || [];
  const updatedPayload = {
    ...(closing?.closing?.payload || {}),
    entries: payloadEntries.map((e) => (e.client_id === clientId ? { ...e, status: "pago" } : e))
  };
  await updateClosingPayload(closingId, updatedPayload);
  return getClosingWithEntries(closingId);
}
