import { Router } from "express";
import { z } from "zod";
import { listEmailLogs, listTemplates, upsertTemplate, getTemplate } from "../repositories/emailRepo.js";
import { getUserById } from "../repositories/userRepo.js";

const router = Router();

async function ensurePerm(req, res, permKey) {
  const user = await getUserById(req.user.id);
  const allowed = user && user[`can_${permKey}`];
  if (!allowed) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.get("/templates", async (req, res) => {
  if (!(await ensurePerm(req, res, "view_email_templates"))) return;
  const templates = await listTemplates();
  res.json({ templates });
});

router.patch("/templates/:key", async (req, res) => {
  if (!(await ensurePerm(req, res, "edit_email_templates"))) return;
  try {
    const key = req.params.key;
    const body = z.object({
      subject: z.string().min(3),
      text: z.string().nullable().optional(),
      html: z.string().nullable().optional()
    }).parse(req.body);

    const html = body.html ?? "";
    const text = body.text ?? "";
    const useHtml = (html || "").trim().length > 0;
    const current = await getTemplate(key);
    const required = current?.required_placeholders || [];
    const blob = `${body.subject}${text}`;
    for (const ph of required) {
      if (useHtml) {
        if (!html.includes(ph)) throw new Error(`HTML precisa manter o placeholder obrigatorio ${ph}`);
      } else if (!blob.includes(ph)) {
        throw new Error(`Conteudo precisa manter o placeholder obrigatorio ${ph}`);
      }
    }
    const saved = await upsertTemplate({
      key,
      subject: body.subject,
      text,
      html: useHtml ? html : null
    });
    res.json({ template: saved });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/logs", async (req, res) => {
  if (!(await ensurePerm(req, res, "view_email_templates"))) return;
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  const logs = await listEmailLogs({ limit, offset });
  res.json({ logs });
});

export default router;
