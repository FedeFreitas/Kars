import { Router } from "express";
import { requirePermission, requireAuth, attachFreshPermissions } from "../middlewares/auth.js";
import {
  createCar,
  getCarDetail,
  listCarsService,
  updateCarService,
  listOptions,
  createOption,
  updateOption
} from "../services/carService.js";

const router = Router();

router.use(requireAuth, attachFreshPermissions);

router.get("/", async (req, res) => {
  const p = req.user?.permissions || {};
  if (!(p.view_cars || p.view_movements || p.manage_movement_catalogs || p.edit_cars)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const cars = await listCarsService({ search: req.query.q });
    res.json({ cars });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/options", async (req, res) => {
  try {
    const includeInactive = req.query.all === "1" || req.query.all === "true";
    const p = req.user?.permissions || {};
    if (!(p.view_cars || p.view_movements || p.manage_movement_catalogs || p.edit_cars)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const options = await listOptions(req.query.kind, includeInactive);
    res.json({ options });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/options", async (req, res) => {
  try {
    const p = req.user?.permissions || {};
    if (!(p.edit_cars || p.manage_movement_catalogs)) return res.status(403).json({ error: "Forbidden" });
    const opt = await createOption(req.query.kind, req.body);
    res.status(201).json({ option: opt });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/options/:id", async (req, res) => {
  try {
    const p = req.user?.permissions || {};
    if (!(p.edit_cars || p.manage_movement_catalogs)) return res.status(403).json({ error: "Forbidden" });
    const opt = await updateOption(req.params.id, req.body);
    res.json({ option: opt });
  } catch (e) {
    const code = e.message.includes("nao encontrada") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.get("/:id", async (req, res) => {
  const p = req.user?.permissions || {};
  if (!(p.view_cars || p.view_movements || p.manage_movement_catalogs || p.edit_cars)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const data = await getCarDetail(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post("/", requirePermission("edit_cars"), async (req, res) => {
  try {
    const car = await createCar(req.body, req.user?.id);
    res.status(201).json({ car });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/:id", requirePermission("edit_cars"), async (req, res) => {
  try {
    const car = await updateCarService(req.params.id, req.body, req.user?.id);
    res.json({ car });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

export default router;
