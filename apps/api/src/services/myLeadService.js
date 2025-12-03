import { getLeadByEmail } from "../repositories/leadRepo.js";

export async function myLead(req, res) {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthorized" });
    const lead = await getLeadByEmail(email);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    res.json({ lead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
