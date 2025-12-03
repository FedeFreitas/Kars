import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";
import { getTemplate, logEmail } from "../repositories/emailRepo.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mailcatcher",
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
});

function render(content, params) {
  if (!content) return content;
  return content.replace(/{{\s*([\w]+)\s*}}/g, (_m, key) =>
    params && params[key] !== undefined ? params[key] : `{{${key}}}`
  );
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  templateKey,
  params = {},
  requiredPlaceholders = [],
}) {
  const from = process.env.MAIL_FROM || "no-reply@kars.local";
  try {
    if (templateKey) {
      const tpl = await getTemplate(templateKey);
      if (tpl) {
        subject = tpl.subject || subject;
        text = tpl.text || text;
        html = tpl.html || html;
        requiredPlaceholders =
          tpl.required_placeholders || requiredPlaceholders;
      }
    }
    const blob = `${subject || ""} ${text || ""} ${html || ""}`;
    for (const ph of requiredPlaceholders || []) {
      if (!blob.includes(ph)) {
        throw new Error(`Template precisa conter ${ph}`);
      }
    }
    const renderedSubject = render(subject, params);
    const renderedText = render(text, params);
    const renderedHtml = render(html, params);
    await transporter.sendMail({
      from,
      to,
      subject: renderedSubject,
      text: renderedText,
      html: renderedHtml,
    });
    try {
      await logEmail({
        templateKey,
        to,
        subject: renderedSubject,
        text: renderedText,
        html: renderedHtml,
      });
    } catch {}
  } catch (e) {
    logger.error({ err: e }, "mail send failed");
    throw new Error("Falha ao enviar email");
  }
}
