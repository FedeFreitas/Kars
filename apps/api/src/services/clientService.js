import { z } from "zod";
import {
  listClientProfiles,
  getClientByUserId,
  getProfileByUserId,
  upsertClientProfile,
  insertClientHistory,
  getClientHistory,
  updateProfileEmailByEmail,
  updateProfileCpfByEmail,
  getClientStats,
  getClientMonthlyStats,
  ignoreClientHistory,
  listTariffOptions,
  addTariffOption
} from "../repositories/clientRepo.js";
import { getUserById, findUserByEmail, updateUserEmailById } from "../repositories/userRepo.js";
import { updateLeadsEmail, updateLeadsCpfByEmail, getLeadByEmail, getLeadByCpf } from "../repositories/leadRepo.js";

const clientSchema = z.object({
  user_id: z.string().uuid(),
  nome: z.string().optional(),
  tarifa: z.string().optional(),
  tipo_tarifa: z.string().optional(),
  cobranca_tipo: z.enum(["pre", "pos"]).optional(),
  ciclo_fechamento: z.enum(["diario", "semanal", "mensal"]).optional(),
  locacao_inicio: z.string().optional(),
  locacao_fim: z.string().optional(),
  nome_uber: z.string().optional(),
  birthdate: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  cnh: z.string().optional(),
  validade_cnh: z.string().optional(),
  observacoes: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  email_uber: z.union([z.string().email(), z.literal("")]).optional(),
  celular: z.string().optional(),
  whatsapp: z.string().optional(),
  contato_emergencia_nome: z.string().optional(),
  contato_emergencia_numero: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_complemento: z.string().optional(),
  endereco_cep: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  banco_favorecido: z.string().optional(),
  banco_cpf_cnpj: z.string().optional(),
  banco_nome: z.string().optional(),
  banco_agencia: z.string().optional(),
  banco_conta: z.string().optional(),
  banco_digito: z.string().optional(),
  banco_tipo: z.string().optional(),
  banco_pix: z.string().optional(),
  caucao: z.string().optional(),
  forma_pagamento: z.string().optional(),
  active: z.boolean().nullish()
});

const tariffOptionSchema = z.object({
  kind: z.enum(["tarifa", "tipo_tarifa"]),
  value: z.string().min(1)
});

function normalizeValue(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return null;
    // normaliza datas para yyyy-mm-dd
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    return trimmed;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

function buildChanges(current, payload) {
  const changes = {};
  Object.keys(payload).forEach((key) => {
    const nextVal = normalizeValue(payload[key]);
    let prevVal = normalizeValue(current[key]);
    if (key === "active" && (prevVal === undefined || prevVal === null)) {
      prevVal = true; // legado assume ativo
    }
    if (nextVal === undefined) return;
    const bothEmpty = (nextVal === null || nextVal === "") && (prevVal === null || prevVal === undefined || prevVal === "");
    if (bothEmpty) return;
    if (nextVal === prevVal) return;
    changes[key] = payload[key]; // guardar valor original enviado para update
  });
  return changes;
}

export async function listClients(filter) {
  return listClientProfiles({ search: filter.q });
}

export async function listTariffOptionsService() {
  return listTariffOptions();
}

export async function addTariffOptionService(data) {
  const parsed = tariffOptionSchema.parse(data);
  return addTariffOption(parsed.kind, parsed.value);
}

export async function getClient(userId) {
  const profile = await getClientByUserId(userId);
  if (!profile) throw new Error("Cliente nao encontrado");
  const history = profile.profile_id ? await getClientHistory(profile.profile_id, 100) : [];
  return { profile, history };
}

export async function updateClient(data, authorId) {
  const parsed = clientSchema.parse(data);
  const { user_id, ...payload } = parsed;
  const current = (await getProfileByUserId(user_id)) || {};
  const changes = buildChanges(current, payload);
  let user = await getUserById(user_id);
  if (!user) throw new Error("Usuario nao encontrado");

  if (changes.cpf) {
    const lead = await getLeadByEmail(user.email);
    if (lead) {
      const otherCpf = await getLeadByCpf(changes.cpf);
      if (otherCpf && otherCpf.id !== lead.id) throw new Error("CPF ja cadastrado");
    }
  }

  if (changes.email && changes.email !== user.email) {
    const exists = await findUserByEmail(changes.email);
    if (exists && exists.id !== user_id) throw new Error("Email ja cadastrado");
    await updateUserEmailById(user_id, changes.email);
    await updateLeadsEmail(user.email, changes.email);
    await updateProfileEmailByEmail(user.email, changes.email);
    user = { ...user, email: changes.email };
  }

  if (!Object.keys(changes).length) return current;
  const profile = await upsertClientProfile(user_id, changes);
  if (profile?.profile_id) {
    const diff = {};
    Object.keys(changes).forEach((key) => {
      diff[key] = { from: normalizeValue(current[key]), to: normalizeValue(changes[key]) };
    });
    await insertClientHistory(profile.profile_id, authorId, diff);
  }
  if (changes.cpf) {
    await updateLeadsCpfByEmail(user.email, changes.cpf);
    await updateProfileCpfByEmail(user.email, changes.cpf);
  }
  return profile;
}

export async function clientStats() {
  return getClientStats();
}

export async function clientMonthlyStats(limitMonths = 12) {
  return getClientMonthlyStats(limitMonths);
}

export async function ignoreClientHistoryEntry(id, authorId) {
  const parsedId = z.string().uuid().parse(id);
  const ok = await ignoreClientHistory(parsedId, authorId);
  if (!ok) throw new Error("Historico nao encontrado ou ja ignorado");
  return { ok: true };
}
