import { Router } from "express";
import { z } from "zod";
import {
  register,
  login,
  rotate,
  doLogout,
  setAuthCookies,
  clearAuthCookies,
  verifyTwoFactor,
  sendTwoFactor,
  requestPasswordReset,
  confirmPasswordReset
} from "../services/authService.js";
import { requireAuth } from "../middlewares/auth.js";
import { decodeResetToken } from "../utils/resetToken.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const body = z.object({
      email: z.string().email(),
      name: z.string().min(1).optional(),
      password: z.string().min(6)
    }).parse(req.body);

    const user = await register(body);
    const auth = await login({ email: body.email, password: body.password, req });
    if (!auth.requires2fa) setAuthCookies(res, auth);
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, requires2fa: !!auth.requires2fa, codeId: auth.codeId, expiresAt: auth.expiresAt });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(6)
    }).parse(req.body);
    const auth = await login({ ...body, req });
    if (auth?.requiresReset) {
      res.json({ requiresReset: true, codeId: auth.codeId, expiresAt: auth.expiresAt, email: body.email });
      return;
    }
    if (auth.requires2fa) {
      res.json({ requires2fa: true, codeId: auth.codeId, expiresAt: auth.expiresAt });
      return;
    }
    setAuthCookies(res, auth);
    res.json({ user: auth.user });
  } catch (e) { res.status(401).json({ error: e.message }); }
});

router.post("/2fa/verify", async (req, res) => {
  try {
    const body = z.object({
      codeId: z.string().uuid(),
      code: z.string().min(6).max(6),
      rememberDevice: z.boolean().optional(),
      purpose: z.enum(["login", "password_change"]).default("login")
    }).parse(req.body);
    const result = await verifyTwoFactor({ ...body, req, rememberDevice: body.rememberDevice ?? true });
    if (result.access && result.refreshPlain) {
      setAuthCookies(res, result);
      res.json({ user: result.user, trusted: body.rememberDevice ?? true });
    } else {
      res.json({ ok: true });
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/2fa/send", requireAuth, async (req, res) => {
  try {
    const body = z.object({
      purpose: z.enum(["password_change", "login"]).default("password_change")
    }).parse(req.body || {});
    const sent = await sendTwoFactor({ userId: req.user.id, purpose: body.purpose, req });
    res.json({ codeId: sent.codeId, expiresAt: sent.expiresAt });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const r = await rotate(req.cookies?.refresh_token);
    setAuthCookies(res, r);
    res.json({ ok: true });
  } catch (e) { res.status(401).json({ error: e.message }); }
});

router.post("/logout", async (req, res) => {
  await doLogout(req.cookies?.refresh_token);
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.post("/reset/request", async (req, res) => {
  try {
    const body = z.object({ email: z.string().email().optional(), token: z.string().optional() }).parse(req.body);
    let email = body.email;
    if (!email && body.token) {
      email = decodeResetToken(body.token);
    }
    if (!email) throw new Error("Email ou token obrigat�rio");
    const sent = await requestPasswordReset({ email, req });
    res.json({ codeId: sent.codeId, expiresAt: sent.expiresAt });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/reset/decode", (req, res) => {
  try {
    const body = z.object({ token: z.string() }).parse(req.body);
    const email = decodeResetToken(body.token);
    res.json({ email });
  } catch (e) {
    res.status(400).json({ error: "Token inv�lido" });
  }
});

router.post("/reset/confirm", async (req, res) => {
  try {
    const body = z.object({
      codeId: z.string().uuid(),
      code: z.string().min(6).max(6),
      password: z.string().min(6)
    }).parse(req.body);
    await confirmPasswordReset({ ...body, req });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
