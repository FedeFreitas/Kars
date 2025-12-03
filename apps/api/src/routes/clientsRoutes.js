import { Router } from "express";
import {
  listClients,
  getClient,
  updateClient,
  clientStats,
  clientMonthlyStats,
  ignoreClientHistoryEntry,
  listTariffOptionsService,
  addTariffOptionService
} from "../services/clientService.js";
import { requirePermission } from "../middlewares/auth.js";

const router = Router();

router.get("/", requirePermission("view_clients"), async (req, res) => {
  try {
    const clients = await listClients({ q: req.query.q });
    res.json({ clients });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/history/:id/ignore", requirePermission("void_finance"), async (req, res) => {
  try {
    const result = await ignoreClientHistoryEntry(req.params.id, req.user?.id);
    res.json(result);
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.get("/tariffs", requirePermission("view_clients"), async (_req, res) => {
  try {
    const options = await listTariffOptionsService();
    res.json({ options });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/tariffs", requirePermission("edit_clients"), async (req, res) => {
  try {
    const option = await addTariffOptionService(req.body || {});
    res.status(201).json({ option });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/stats/summary", requirePermission("view_clients"), async (_req, res) => {
  try {
    const stats = await clientStats();
    res.json({ stats });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/stats/monthly", requirePermission("view_clients"), async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 12;
    const stats = await clientMonthlyStats(limit);
    res.json({ stats });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/:userId", requirePermission("view_clients"), async (req, res) => {
  try {
    const data = await getClient(req.params.userId);
    res.json(data);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.patch("/:userId", requirePermission("edit_clients"), async (req, res) => {
  try {
    const payload = { ...req.body, user_id: req.params.userId };
    const profile = await updateClient(payload, req.user?.id);
    res.json({ profile });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
