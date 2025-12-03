import { getLeadByEmail, moveLeadStage } from "../repositories/leadRepo.js";
import { insertEvent } from "../repositories/leadRepo.js";

export async function reopenMyLead(user) {
  if (!user?.email) throw new Error("Unauthorized");
  const lead = await getLeadByEmail(user.email);
  if (!lead) throw new Error("Lead not found");
  if (!["not_rented", "archived"].includes(lead.stage)) throw new Error("Lead not eligible");
  const updated = await moveLeadStage(lead.id, "created");
  await insertEvent({
    leadId: lead.id,
    authorId: user.id,
    type: "stage_change",
    fromStage: lead.stage,
    toStage: "created"
  });
  return updated;
}
