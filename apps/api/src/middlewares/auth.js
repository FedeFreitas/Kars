import jwt from "jsonwebtoken";
import { ACCESS_SECRET } from "../config/auth.js";
import { getUserById } from "../repositories/userRepo.js";

function buildPermissions(fresh) {
  return fresh
    ? {
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
    : {};
}

export function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.split(" ")[1];
  const cookieToken = req.cookies?.access_token;
  const token = bearer || cookieToken;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || {}
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export function requirePermission(...perms) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    // Sempre usa permissoes mais recentes do banco para evitar acessos com token desatualizado
    const fresh = await getUserById(req.user.id);
    const permissions = buildPermissions(fresh);
    req.user.permissions = permissions;
    const allowed = perms.every((p) => permissions[p]);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export async function attachFreshPermissions(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    const fresh = await getUserById(req.user.id);
    req.user.permissions = buildPermissions(fresh);
    next();
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
  }
}
