import { z } from "zod";
import {
  listCars,
  getCarById,
  insertCar,
  updateCar,
  insertCarHistory,
  listCarHistory,
  listCarOptions,
  createCarOption,
  updateCarOptionRepo
} from "../repositories/carRepo.js";
import { getUserById } from "../repositories/userRepo.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import sharp from "sharp";

const strOpt = z.union([z.string(), z.null()]).optional();
const numOpt = z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isNaN(parsed) ? v : parsed;
    }
    return v;
  },
  z.union([z.number(), z.null()])
);

const imageSchema = z.union([z.string(), z.null()]).optional().refine((val) => {
  if (val === undefined || val === null) return true;
  if (typeof val !== "string") return false;
  return val.startsWith("http") || val.startsWith("/uploads") || val.startsWith("data:image");
}, { message: "Invalid image path" });

const carSchema = z.object({
  plate: z.string().min(3),
  category: strOpt,
  renavam: strOpt,
  model: strOpt,
  year_fabrication: z.union([z.number().int(), z.null()]).optional(),
  year_model: z.union([z.number().int(), z.null()]).optional(),
  supplier: strOpt,
  fuel: strOpt,
  tracker: strOpt,
  spare_key: z.boolean().optional(),
  color: strOpt,
  status: strOpt,
  displacement: strOpt,
  version: strOpt,
  rate: numOpt,
  notes: strOpt,
  image_url: imageSchema
});

const updateSchema = carSchema.partial();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function diffChanges(current, next) {
  const diff = {};
  const normalize = (val) => {
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (val === undefined) return null;
    if (val === "") return null;
    if (val === null) return null;
    if (typeof val === "string") {
      const num = Number(val);
      if (!Number.isNaN(num) && val.trim() !== "") return num;
      return val;
    }
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

export async function listCarsService(filters) {
  return listCars(filters || {});
}

export async function getCarDetail(id) {
  const car = await getCarById(id);
  if (!car) throw new Error("Carro nao encontrado");
  const history = await listCarHistory(id, 100);
  return { car, history };
}

export async function createCar(data, authorId) {
  const parsed = await parseWithImage(data);
  const car = await insertCar(parsed);
  await insertCarHistory(car.id, authorId, Object.fromEntries(Object.keys(parsed).map((k) => [k, { from: null, to: parsed[k] }])));
  return car;
}

export async function updateCarService(id, data, authorId) {
  const parsed = await parseWithImage(data, true);
  const current = await getCarById(id);
  if (!current) throw new Error("Carro nao encontrado");
  const updated = await updateCar(id, parsed);
  const diff = diffChanges(current, parsed);
  if (Object.keys(diff).length) {
    await insertCarHistory(id, authorId, diff);
  }
  return updated;
}

export async function ensureClientUser(userId) {
  const u = await getUserById(userId);
  if (!u) throw new Error("Usuario nao encontrado");
  return u;
}

export async function listOptions(kind, includeInactive = false) {
  return listCarOptions(kind, includeInactive);
}

export async function createOption(kind, payload) {
  const schema = z.object({
    name: z.string().min(2),
    amount: z.number().optional()
  });
  const parsed = schema.parse(payload);
  return createCarOption(kind, parsed.name, parsed.amount);
}

export async function updateOption(id, payload) {
  const schema = z.object({
    active: z.boolean().optional(),
    name: z.string().min(1).optional(),
    amount: z.number().optional()
  });
  const parsed = schema.parse(payload);
  if (!parsed || !Object.keys(parsed).length) throw new Error("Nada para atualizar");
  const updated = await updateCarOptionRepo(id, parsed);
  if (!updated) throw new Error("Opcao nao encontrada");
  return updated;
}

async function parseWithImage(data, partial = false) {
  // valida campos
  const parsed = partial ? updateSchema.parse(data) : carSchema.parse(data);
  // trata imagem se vier como data URL
  if (parsed.image_url && typeof parsed.image_url === "string" && parsed.image_url.startsWith("data:image")) {
    parsed.image_url = await saveBase64Image(parsed.image_url);
  }
  return parsed;
}

async function saveBase64Image(dataUrl) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) throw new Error("Imagem invalida");
  const base64 = matches[2];
  const buffer = Buffer.from(base64, "base64");
  const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
  // grava em apps/api/public/uploads/cars (servido em /uploads)
  const dir = path.join(__dirname, "..","public", "uploads", "cars");
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.webp`;
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, webpBuffer);
  return `/uploads/cars/${filename}`;
}
