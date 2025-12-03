import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import sharp from "sharp";
import { findCarsByImage } from "../repositories/carRepo.js";
import { findTemplatesByImage } from "../repositories/emailRepo.js";
import { getUserById } from "../repositories/userRepo.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "public", "uploads");

async function listFiles(dir, prefix = "/uploads") {
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      const nested = await listFiles(fullPath, relPath);
      files.push(...nested);
    } else {
      const stat = await fs.promises.stat(fullPath);
      files.push({
        path: relPath.replace(/\\/g, "/"),
        size: stat.size,
        type: guessMime(entry.name),
        created_at: stat.birthtime
      });
    }
  }
  return files;
}

router.get("/images", async (req, res) => {
  try {
    const user = await ensureUploadPermission(req, res);
    if (!user) return;
    const files = await listFiles(uploadsDir);
    const enriched = [];
    for (const file of files) {
      const cars = await findCarsByImage(file.path);
      const templates = await findTemplatesByImage(file.path);
      enriched.push({
        ...file,
        usages: {
          cars: cars.map((c) => ({ id: c.id, plate: c.plate, model: c.model })),
          templates
        }
      });
    }
    res.json({ images: enriched });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/images", async (req, res) => {
  try {
    const user = await ensureUploadPermission(req, res);
    if (!user) return;
    const dataUrl = req.body?.data;
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      return res.status(400).json({ error: "Imagem invalida" });
    }
    const saved = await saveBase64Image(dataUrl);
    res.json({ path: saved });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/images", async (req, res) => {
  try {
    const user = await ensureUploadPermission(req, res);
    if (!user) return;
    const imagePath = req.body?.path;
    if (!imagePath || typeof imagePath !== "string") return res.status(400).json({ error: "path obrigatorio" });
    const cars = await findCarsByImage(imagePath);
    const templates = await findTemplatesByImage(imagePath);
    if (cars.length || templates.length) {
      return res.status(400).json({ error: "Imagem em uso em algum cadastro" });
    }
    const full = path.join(uploadsDir, imagePath.replace("/uploads/", ""));
    await fs.promises.unlink(full);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

function guessMime(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    avif: "image/avif"
  };
  return map[ext] || "application/octet-stream";
}

async function ensureUploadPermission(req, res) {
  const user = await getUserById(req.user?.id);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (!user.can_edit_cars && !user.can_edit_email_templates) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user;
}

async function saveBase64Image(dataUrl) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) throw new Error("Imagem invalida");
  const base64 = matches[2];
  const buffer = Buffer.from(base64, "base64");
  const webp = await sharp(buffer).webp({ quality: 80 }).toBuffer();
  const dir = path.join(uploadsDir, "emails");
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.webp`;
  const full = path.join(dir, filename);
  await fs.promises.writeFile(full, webp);
  return `/uploads/emails/${filename}`;
}
