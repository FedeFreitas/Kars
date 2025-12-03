import { Router } from "express";
import { requirePermission } from "../middlewares/auth.js";
import {
  createFinanceEntry,
  createFinanceType,
  getFinanceEntryDetail,
  listFinanceEntries,
  listFinanceClosings,
  listFinanceTypes,
  addFinanceNote,
  updateFinanceEntry,
  updateFinanceType,
  createFinanceClosing,
  payFinanceClosing,
  cancelFinanceClosing,
  enqueueClosingSend,
  getFinanceClosing,
  listClosingSendQueue,
  addEntryToFinanceClosing,
  removeEntryFromFinanceClosing,
  payFinanceClosingClient
} from "../services/financeService.js";

const router = Router();

router.get("/entries", requirePermission("view_finance"), async (req, res) => {
  try {
    const filters = {
      clientId: req.query.clientId,
      startDue: req.query.startDue,
      endDue: req.query.endDue,
      status: req.query.status,
      typeId: req.query.typeId,
      kind: req.query.kind
    };
    const entries = await listFinanceEntries(filters);
    res.json({ entries });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/entries", requirePermission("edit_finance"), async (req, res) => {
  try {
    const entry = await createFinanceEntry(req.body);
    res.status(201).json({ entry });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/entries/:id", requirePermission("view_finance"), async (req, res) => {
  try {
    const data = await getFinanceEntryDetail(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

const checkEntryPermission = (req, res, next) => {
  const wantsVoid = req.body?.voided === true;
  const checker = wantsVoid ? requirePermission("void_finance") : requirePermission("edit_finance");
  return checker(req, res, next);
};

router.patch("/entries/:id", checkEntryPermission, async (req, res) => {
  try {
    const entry = await updateFinanceEntry(req.params.id, req.body, req.user?.id);
    if (!entry) return res.status(404).json({ error: "Lancamento nao encontrado" });
    res.json({ entry });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.post("/entries/:id/notes", requirePermission("edit_finance"), async (req, res) => {
  try {
    const note = await addFinanceNote(req.params.id, req.body?.message, req.user?.id);
    res.status(201).json({ note });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.get("/types", requirePermission("view_finance"), async (_req, res) => {
  try {
    const types = await listFinanceTypes();
    res.json({ types });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/types", requirePermission("manage_finance_types"), async (req, res) => {
  try {
    const type = await createFinanceType(req.body);
    res.status(201).json({ type });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/types/:id", requirePermission("manage_finance_types"), async (req, res) => {
  try {
    const type = await updateFinanceType(req.params.id, req.body);
    if (!type) return res.status(404).json({ error: "Tipo nao encontrado" });
    res.json({ type });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.get("/closings", requirePermission("view_finance"), async (_req, res) => {
  try {
    const closings = await listFinanceClosings();
    res.json({ closings });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/closings", requirePermission("edit_finance"), async (req, res) => {
  try {
    const closing = await createFinanceClosing(req.body, req.user?.id);
    res.status(201).json({ closing });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/closings/:id/pay", requirePermission("edit_finance"), async (req, res) => {
  try {
    const closing = await payFinanceClosing(req.params.id);
    res.json({ closing });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.post("/closings/:id/send", requirePermission("edit_finance"), async (req, res) => {
  try {
    await enqueueClosingSend(req.params.id, req.body?.client_ids);
    res.json({ queued: true });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.patch("/closings/:id/cancel", requirePermission("edit_finance"), async (req, res) => {
  try {
    const closing = await cancelFinanceClosing(req.params.id);
    res.json({ closing });
  } catch (e) {
    const code = e.message.includes("nao encontrado") ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

router.get("/closings/send-queue", requirePermission("view_finance"), async (_req, res) => {
  try {
    const queue = await listClosingSendQueue();
    res.json({ queue });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/closings/:id", requirePermission("view_finance"), async (req, res) => {
  try {
    const data = await getFinanceClosing(req.params.id);
    if (!data) return res.status(404).json({ error: "Fechamento nao encontrado" });
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/closings/:id/entries", requirePermission("edit_finance"), async (req, res) => {
  try {
    const data = await addEntryToFinanceClosing(req.params.id, req.body?.entry_id, req.user?.id);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/closings/:id/entries/:entryId", requirePermission("edit_finance"), async (req, res) => {
  try {
    const data = await removeEntryFromFinanceClosing(req.params.id, req.params.entryId, req.user?.id);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/closings/:id/clients/:clientId/pay", requirePermission("edit_finance"), async (req, res) => {
  try {
    const data = await payFinanceClosingClient(req.params.id, req.params.clientId, req.user?.id);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
