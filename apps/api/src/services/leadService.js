import { z } from "zod";
import {
  archiveStale,
  createLead,
  getEvents,
  getLead,
  getNotes,
  getLeadByEmail,
  getLeadByCpf,
  insertEvent,
  insertNote,
  listLeads,
  moveLeadStage,
  updateLead,
  updateLeadsEmail,
  updateLeadsCpfByEmail,
} from "../repositories/leadRepo.js";
import {
  upsertLeadUser,
  ensureClientRoleByEmail,
  updateUserEmailByEmail,
} from "../repositories/userRepo.js";
import {
  updateProfileEmailByEmail,
  updateProfileCpfByEmail,
} from "../repositories/clientRepo.js";
import { sendMail } from "../utils/mailer.js";
import { encodeResetToken } from "../utils/resetToken.js";

export const STAGES = [
  "created",
  "contact",
  "rented",
  "not_rented",
  "archived",
];

const leadSchema = z.object({
  name: z.string().min(2),
  cpf: z.string().min(3).max(40).optional(),
  birthdate: z.string().optional(),
  phone: z.string().min(5),
  email: z.string().email(),
  city: z.string().optional(),
  ear: z.string().optional(),
  uber: z.string().optional(),
  overwrite: z.boolean().optional(),
});

export async function createLeadPublic(body, authorId = null) {
  const payload = leadSchema.parse(body);
  const { overwrite, ...data } = payload;
  const emailLead = await getLeadByEmail(data.email);
  const cpfLead = data.cpf ? await getLeadByCpf(data.cpf) : null;

  // se CPF já existe em outro lead diferente, bloquear sempre
  if (cpfLead && emailLead && cpfLead.id !== emailLead.id) {
    throw new Error("CPF já cadastrado");
  }
  if (cpfLead && !emailLead) {
    if (!overwrite) throw new Error("CPF já cadastrado");
    // atualizar lead existente por CPF
    await updateLead(cpfLead.id, {
      name: data.name,
      cpf: data.cpf || cpfLead.cpf,
      birthdate: data.birthdate || cpfLead.birthdate,
      phone: data.phone,
      city: data.city || cpfLead.city,
      ear: data.ear || cpfLead.ear,
      uber: data.uber || cpfLead.uber,
      email: data.email,
    });
    await ensureClientRoleByEmail(data.email);
    return getLead(cpfLead.id);
  }

  if (emailLead) {
    if (!overwrite) throw new Error("Email já cadastrado");
    await updateLead(emailLead.id, {
      name: data.name,
      cpf: data.cpf || emailLead.cpf,
      birthdate: data.birthdate || emailLead.birthdate,
      phone: data.phone,
      city: data.city || emailLead.city,
      ear: data.ear || emailLead.ear,
      uber: data.uber || emailLead.uber,
    });
    await ensureClientRoleByEmail(data.email);
    return getLead(emailLead.id);
  }

  const user = await upsertLeadUser({ email: data.email, name: data.name });
  const lead = await createLead({
    ...data,
    user_id: user.id,
    stage: "created",
  });
  await insertEvent({
    leadId: lead.id,
    authorId,
    type: "created",
    toStage: "created",
  });
  await ensureClientRoleByEmail(data.email);

  try {
    const appUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const token = encodeResetToken(data.email);
    const resetLink = `${appUrl.replace(
      /\/$/,
      ""
    )}/login?reset=1&t=${encodeURIComponent(token)}`;
    await sendMail({
      to: data.email,
      subject: "Cadastro recebido na Kars",
      text: [
        `Olá, ${data.name || "tudo bem"}?`,
        "",
        "Recebemos seu cadastro na Kars. Nossa equipe entrará em contato em breve.",
        "Enquanto isso, você já pode acompanhar seu status criando sua senha e acessando o portal:",
        "{{reset_link}}",
        "",
        "Basta clicar no link, inserir seu e-mail e escolher a senha para entrar.",
        "",
        "Obrigado por escolher a Kars!",
      ].join("\n"),
      templateKey: "welcome_lead",
      params: { reset_link: resetLink },
    });
  } catch (e) {
    console.error("Falha ao enviar email de boas-vindas", e?.message);
  }

  return lead;
}

export async function listLeadsService(filters) {
  await archiveStale().catch(() => {});
  const stage =
    filters.stage && STAGES.includes(filters.stage) ? filters.stage : undefined;
  const search = filters.q || undefined;
  return listLeads({ stage, search });
}

function diffChanged(current, next) {
  const diff = {};
  for (const key of Object.keys(next)) {
    if (next[key] !== current[key]) {
      diff[key] = { from: current[key], to: next[key] };
    }
  }
  return diff;
}

export async function updateLeadService(id, data, authorId) {
  const lead = await getLead(id);
  if (!lead) throw new Error("Lead not found");
  const parsed = leadSchema.partial().parse(data);
  if (parsed.email && parsed.email !== lead.email) {
    const emailLead = await getLeadByEmail(parsed.email);
    if (emailLead && emailLead.id !== id)
      throw new Error("Email já cadastrado");
  }
  if (parsed.cpf && parsed.cpf !== lead.cpf) {
    const cpfLead = await getLeadByCpf(parsed.cpf);
    if (cpfLead && cpfLead.id !== id) throw new Error("CPF já cadastrado");
  }
  const diff = diffChanged(lead, { ...lead, ...parsed });
  if (!Object.keys(diff).length) return lead;
  const updated = await updateLead(id, parsed);
  if (parsed.email && parsed.email !== lead.email) {
    await syncEmails(lead.email, parsed.email);
  }
  if (parsed.cpf && parsed.cpf !== lead.cpf) {
    await syncCpf(parsed.email || lead.email, parsed.cpf);
  }
  await insertEvent({ leadId: id, authorId, type: "edit", diff });
  return updated;
}

export async function moveLeadService(id, toStage, authorId) {
  if (!STAGES.includes(toStage)) throw new Error("Invalid stage");
  const lead = await getLead(id);
  if (!lead) throw new Error("Lead not found");
  const updated = await moveLeadStage(id, toStage);
  await insertEvent({
    leadId: id,
    authorId,
    type: "stage_change",
    fromStage: lead.stage,
    toStage,
  });
  return updated;
}

export async function addNoteService(id, message, authorId) {
  const lead = await getLead(id);
  if (!lead) throw new Error("Lead not found");
  const note = await insertNote({ leadId: id, authorId, message });
  await insertEvent({ leadId: id, authorId, type: "note", diff: { message } });
  return note;
}

export async function leadDetailsService(id) {
  const lead = await getLead(id);
  if (!lead) throw new Error("Lead not found");
  const [notes, events] = await Promise.all([getNotes(id), getEvents(id, 100)]);
  return { lead, notes, events };
}

async function syncEmails(oldEmail, newEmail) {
  if (!oldEmail || !newEmail || oldEmail === newEmail) return;
  await updateLeadsEmail(oldEmail, newEmail);
  await updateUserEmailByEmail(oldEmail, newEmail);
  await updateProfileEmailByEmail(oldEmail, newEmail);
}

async function syncCpf(email, cpf) {
  if (!email || !cpf) return;
  await updateLeadsCpfByEmail(email, cpf);
  await updateProfileCpfByEmail(email, cpf);
}
