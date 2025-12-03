import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  deleteRefreshByUserId,
  listUsers,
  updateUserRole,
  updateUserPermissions,
  updateUserEmailById,
  findUserByEmail,
  getUserById,
  updateUserName,
  setUserPassword
} from "../repositories/userRepo.js";
import { updateLeadsEmail } from "../repositories/leadRepo.js";
import { updateProfileEmailByEmail } from "../repositories/clientRepo.js";
import { requirePermission } from "../middlewares/auth.js";
import { verifyTwoFactor } from "../services/authService.js";

const router = Router();
const roleSchema = z.enum(["pending", "client", "admin"]);
const permSchema = z.object({
  can_view_leads: z.boolean().optional(),
  can_edit_leads: z.boolean().optional(),
  can_view_clients: z.boolean().optional(),
  can_edit_clients: z.boolean().optional(),
  can_view_users: z.boolean().optional(),
  can_edit_users: z.boolean().optional(),
  can_view_finance: z.boolean().optional(),
  can_edit_finance: z.boolean().optional(),
  can_manage_finance_types: z.boolean().optional(),
  can_void_finance: z.boolean().optional(),
  can_view_cars: z.boolean().optional(),
  can_edit_cars: z.boolean().optional(),
  can_view_movements: z.boolean().optional(),
  can_create_movements: z.boolean().optional(),
  can_edit_movements: z.boolean().optional(),
  can_manage_movement_catalogs: z.boolean().optional(),
  can_view_email_templates: z.boolean().optional(),
  can_edit_email_templates: z.boolean().optional()
});
const emailSchema = z.object({ email: z.string().email() });
const profileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  twofa_code: z.string().optional(),
  twofa_code_id: z.string().uuid().optional()
});

router.get("/", requirePermission("view_users"), async (_req, res) => {
  const users = await listUsers();
  res.json({ users });
});

router.post("/:id/role", requirePermission("edit_users"), async (req, res) => {
  try {
    const role = roleSchema.parse(req.body.role);
    const user = await updateUserRole(req.params.id, role);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/permissions", requirePermission("edit_users"), async (req, res) => {
  try {
    const payload = permSchema.parse(req.body || {});
    const user = await updateUserPermissions(req.params.id, payload);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/logout", requirePermission("edit_users"), async (req, res) => {
  try {
    await deleteRefreshByUserId(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/email", requirePermission("edit_users"), async (req, res) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const currentUser = await getUserById(req.params.id);
    const oldEmail = currentUser?.email;
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== req.params.id) {
      return res.status(400).json({ error: "Email ja cadastrado" });
    }
    const user = await updateUserEmailById(req.params.id, email);
    if (!user) return res.status(404).json({ error: "User not found" });
    const sourceEmail = oldEmail || user.email;
    await updateLeadsEmail(sourceEmail, email);
    await updateProfileEmailByEmail(sourceEmail, email);
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/profile", requirePermission("edit_users"), async (req, res) => {
  try {
    const payload = profileSchema.parse(req.body || {});
    const current = await getUserById(req.params.id);
    if (!current) return res.status(404).json({ error: "User not found" });

    let user = current;

    if (payload.name && payload.name !== current.name) {
      user = await updateUserName(req.params.id, payload.name);
    }

    if (payload.email && payload.email !== current.email) {
      const existing = await findUserByEmail(payload.email);
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ error: "Email ja cadastrado" });
      }
      user = await updateUserEmailById(req.params.id, payload.email);
      await updateLeadsEmail(current.email, payload.email);
      await updateProfileEmailByEmail(current.email, payload.email);
    }

    if (payload.password) {
      if (!payload.twofa_code || !payload.twofa_code_id) {
        return res.status(400).json({ error: "2FA obrigatório para trocar senha" });
      }
      await verifyTwoFactor({
        codeId: payload.twofa_code_id,
        code: payload.twofa_code,
        req,
        rememberDevice: false,
        purpose: "password_change"
      });
      const hash = await bcrypt.hash(payload.password, 10);
      user = await setUserPassword(req.params.id, hash);
    }

    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
