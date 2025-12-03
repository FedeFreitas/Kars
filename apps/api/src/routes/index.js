import { Router } from "express";
import authRoutes from "./authRoutes.js";
import { requireAuth } from "../middlewares/auth.js";
import leadsRoutes from "./leadsRoutes.js";
import { createLeadPublic } from "../services/leadService.js";
import usersRoutes from "./usersRoutes.js";
import { myLead } from "../services/myLeadService.js";
import { reopenMyLead } from "../services/reopenService.js";
import clientsRoutes from "./clientsRoutes.js";
import financeRoutes from "./financeRoutes.js";
import { getUserById } from "../repositories/userRepo.js";
import carsRoutes from "./carsRoutes.js";
import carMovementsRoutes from "./carMovementsRoutes.js";
import emailRoutes from "./emailRoutes.js";
import uploadsRoutes from "./uploadsRoutes.js";

const router = Router();
router.use("/auth", authRoutes);

// lead público via landing
router.post("/lead", async (req, res) => {
  try {
    const lead = await createLeadPublic(req.body, req.user?.id);
    res.status(201).json({ lead });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// rotas protegidas
router.use("/leads", requireAuth, leadsRoutes);
router.use("/clients", requireAuth, clientsRoutes);
router.use("/finance", requireAuth, financeRoutes);
router.use("/users", requireAuth, usersRoutes);
router.use("/cars", requireAuth, carsRoutes);
router.use("/car-movements", requireAuth, carMovementsRoutes);
router.use("/emails", requireAuth, emailRoutes);
router.use("/uploads", requireAuth, uploadsRoutes);
router.get("/my-lead", requireAuth, myLead);
router.post("/my-lead/reopen", requireAuth, async (req, res) => {
  try {
    const lead = await reopenMyLead(req.user);
    res.json({ lead });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.get("/me", requireAuth, async (req, res) => {
  const fresh = await getUserById(req.user.id);
  if (!fresh) return res.status(404).json({ error: "User not found" });
  res.json({
    user: {
      id: fresh.id,
      email: fresh.email,
      name: fresh.name,
      role: fresh.role,
      permissions: {
        view_leads: fresh.can_view_leads,
        edit_leads: fresh.can_edit_leads,
        view_clients: fresh.can_view_clients,
        edit_clients: fresh.can_edit_clients,
        view_users: fresh.can_view_users,
        edit_users: fresh.can_edit_users,
        view_finance: fresh.can_view_finance,
        edit_finance: fresh.can_edit_finance,
        manage_finance_types: fresh.can_manage_finance_types,
        void_finance: fresh.can_void_finance,
        view_cars: fresh.can_view_cars,
        edit_cars: fresh.can_edit_cars,
        view_movements: fresh.can_view_movements,
        create_movements: fresh.can_create_movements,
        edit_movements: fresh.can_edit_movements,
        manage_movement_catalogs: fresh.can_manage_movement_catalogs,
        view_email_templates: fresh.can_view_email_templates,
        edit_email_templates: fresh.can_edit_email_templates
      }
    }
  });
});

router.get("/", (req, res) => {
  res.status(200).json({ message: "API estǭ funcionando", version: "1.0.0" });
});

export default router;
