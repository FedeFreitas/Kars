import { Router } from "express";
import { requireAuth, attachFreshPermissions } from "../middlewares/auth.js";
import {
  createMovementService,
  getMovementHistoryService,
  listLatestMovementsService,
  listMovementsByCarService,
  updateMovementService
} from "../services/carMovementService.js";

const router = Router();
router.use(requireAuth, attachFreshPermissions);

function canView(req) {
  const p = req.user?.permissions || {};
  return p.view_movements || p.edit_movements || p.create_movements || p.manage_movement_catalogs;
}
function canCreate(req) {
  const p = req.user?.permissions || {};
  return p.create_movements || p.edit_movements || p.manage_movement_catalogs;
}
function canEdit(req) {
  const p = req.user?.permissions || {};
  return p.edit_movements || p.manage_movement_catalogs;
}

router.get("/", async (req, res) => {
  if (!canView(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const rows = await listLatestMovementsService(req.query.q || "");
    res.json({ movements: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/car/:carId", async (req, res) => {
  if (!canView(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const data = await listMovementsByCarService(req.params.carId);
    res.json(data);
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.get("/:id/history", async (req, res) => {
  if (!canView(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const history = await getMovementHistoryService(req.params.id);
    res.json({ history });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  if (!canCreate(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const movement = await createMovementService(req.body, req.user?.id);
    res.status(201).json({ movement });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/:id", async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const movement = await updateMovementService(req.params.id, req.body, req.user?.id);
    res.json({ movement });
  } catch (e) {
    const code = e.message.includes("nao encontrada") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

export default router;
