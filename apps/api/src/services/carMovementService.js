import { z } from "zod";
import { getCarById } from "../repositories/carRepo.js";
import {
  getMovementById,
  insertMovement,
  insertMovementHistory,
  listMovementHistory,
  listMovementsByCar,
  listLatestMovements,
  updateMovement
} from "../repositories/carMovementRepo.js";

const statusList = [
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

const serviceTypes = ["Funilaria", "Mecanica", "Funilaria/Mecanica"];
const serviceEtas = ["imediata", "1-7 dias", "8-14 dias", "15-21 dias", "22-28 dias", ">28 dias"];

const dateOrString = z.preprocess((v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}, z.union([z.date(), z.null()]));

const createSchema = z.object({
  car_id: z.string().uuid(),
  status: z.string().min(3),
  km: z.union([z.number().int(), z.null()]).optional(),
  movement_date: dateOrString.optional(),
  obs: z.union([z.string(), z.null()]).optional(),
  client_id: z.string().uuid().optional(),
  client_rate: z.union([z.number(), z.null()]).optional(),
  is_reserve: z.boolean().optional(),
  shop_id: z.string().uuid().optional(),
  service_type: z.string().optional(),
  service_eta: z.string().optional(),
  tow_id: z.string().uuid().optional(),
  yard_id: z.string().uuid().optional(),
  yard_availability: z.string().optional(),
  team_id: z.string().uuid().optional()
});

const updateSchema = z.object({
  obs: z.union([z.string(), z.null()]).optional(),
  movement_date: dateOrString.optional(),
  km: z
    .preprocess((v) => {
      if (v === "" || v === undefined) return undefined;
      if (v === null) return null;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    }, z.union([z.number().int(), z.null()]))
    .optional()
});

function normalizeStatus(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function validateConditional(parsed) {
  const st = normalizeStatus(parsed.status);
  if (statusList.includes(st) === false) {
    throw new Error("Status de movimentacao invalido");
  }
  if (st === "parceiro") {
    if (!parsed.client_id) throw new Error("Selecione o cliente parceiro");
  }
  if (st === "finalizado") {
    if (!parsed.client_id) throw new Error("Selecione o cliente finalizado");
  }
  if (st === "oficina") {
    if (!parsed.shop_id) throw new Error("Selecione a oficina");
    if (!parsed.service_type || !serviceTypes.includes(parsed.service_type)) {
      throw new Error("Selecione o tipo de servico");
    }
    if (!parsed.service_eta || !serviceEtas.includes(parsed.service_eta)) {
      throw new Error("Selecione a previsao de saida");
    }
  }
  if (st === "guincho" && !parsed.tow_id) throw new Error("Selecione o guincho");
  if (st === "patio") {
    if (!parsed.yard_id) throw new Error("Selecione o patio");
    if (!parsed.yard_availability || !["disponivel", "indisponivel"].includes(parsed.yard_availability)) {
      throw new Error("Disponibilidade invalida");
    }
  }
  if (st === "equipe" && !parsed.team_id) throw new Error("Selecione a equipe");
  return parsed;
}

function diffChanges(current, next) {
  const diff = {};
  const normalize = (val) => {
    if (val instanceof Date) return val.toISOString();
    if (val === undefined) return null;
    if (val === "") return null;
    return val;
  };
  Object.keys(next).forEach((k) => {
    const prevVal = normalize(current[k]);
    const nextVal = normalize(next[k]);
    if (prevVal !== nextVal) {
      diff[k] = { from: prevVal ?? null, to: nextVal ?? null };
    }
  });
  return diff;
}

export async function listLatestMovementsService(q) {
  return listLatestMovements(q);
}

export async function listMovementsByCarService(carId) {
  const car = await getCarById(carId);
  if (!car) throw new Error("Carro nao encontrado");
  const movements = await listMovementsByCar(carId);
  return { car, movements };
}

export async function createMovementService(payload, authorId) {
  const parsed = createSchema.parse(payload);
  const status = normalizeStatus(parsed.status);
  parsed.status = status;
  // sempre registra com data/hora atual
  parsed.movement_date = new Date();
  validateConditional(parsed);

  const car = await getCarById(parsed.car_id);
  if (!car) throw new Error("Carro nao encontrado");
  if (!(car.status || "").toLowerCase().startsWith("dispon")) {
    throw new Error("Somente carros ativos/disponiveis podem receber movimentacao");
  }

  const movement = await insertMovement({
    ...parsed,
    author_id: authorId || null
  });

  const creationDiff = {};
  Object.keys(parsed).forEach((k) => { creationDiff[k] = { from: null, to: parsed[k] }; });
  await insertMovementHistory(movement.id, authorId, creationDiff);
  return movement;
}

export async function updateMovementService(id, payload, authorId) {
  const parsed = updateSchema.parse(payload);
  const current = await getMovementById(id);
  if (!current) throw new Error("Movimentacao nao encontrada");
  const updated = await updateMovement(id, parsed);
  const diff = diffChanges(current, parsed);
  if (Object.keys(diff).length) {
    await insertMovementHistory(id, authorId, diff);
  }
  return updated;
}

export async function getMovementHistoryService(id) {
  return listMovementHistory(id);
}
