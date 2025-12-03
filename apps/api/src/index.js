import "dotenv/config";
import express from "express";
import cors from "cors";

import cookieParser from "cookie-parser";

import router from "./routes/index.js";
import path from "path";
import { fileURLToPath } from "url";

// n tem
import { logger } from "./utils/logger.js";

const app = express();
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
// arquivos estaticos (imagens) servidos de apps/api/public/uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

app.use("/api", router);
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

const PORT = Number(process.env.API_PORT) || 4000;

app.listen(PORT, () => logger.info(`API on http://localhost:${PORT}`));
