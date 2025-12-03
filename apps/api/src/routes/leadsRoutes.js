import { Router } from "express";
import { z } from "zod";
import {
  STAGES,
  addNoteService,
  leadDetailsService,
  listLeadsService,
  moveLeadService,
  updateLeadService
} from "../services/leadService.js";
import { requirePermission } from "../middlewares/auth.js";

const router = Router();

// Admins podem ler leads para o dashboard mesmo sem permissao granular
router.get("/", async (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return requirePermission("view_leads")(req, res, next);
}, async (req, res) => {
  try {
    const { stage, q } = req.query;
    const leads = await listLeadsService({ stage, q });
    res.json({ leads, stages: STAGES });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/:id", requirePermission("view_leads"), async (req, res) => {
  try {
    const data = await leadDetailsService(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.patch("/:id", requirePermission("edit_leads"), async (req, res) => {
  try {
    const updated = await updateLeadService(req.params.id, req.body, req.user?.id);
    res.json({ lead: updated });
  } catch (e) {
    res.status(e.message === "Lead not found" ? 404 : 400).json({ error: e.message });
  }
});

router.post("/:id/move", requirePermission("edit_leads"), async (req, res) => {
  try {
    const toStage = z.string().parse(req.body.toStage);
    const lead = await moveLeadService(req.params.id, toStage, req.user?.id);
    res.json({ lead });
  } catch (e) {
    const code = e.message === "Lead not found" ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.post("/:id/notes", requirePermission("edit_leads"), async (req, res) => {
  try {
    const message = z.string().min(1).parse(req.body.message);
    const note = await addNoteService(req.params.id, message, req.user?.id);
    res.json({ note });
  } catch (e) {
    const code = e.message === "Lead not found" ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

export default router;
