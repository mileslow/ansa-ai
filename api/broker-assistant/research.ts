import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BookletAuthError, requireBookletUser } from "../../lib/booklet-auth";
import {
  assertBrokerAssistantEnabled,
  listAssistantAudit,
  listPendingApprovals,
  listResearchItems,
  updateResearchItem,
} from "../../lib/broker-assistant";

export const config = { includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    assertBrokerAssistantEnabled();
    const user = await requireBookletUser(req);

    if (req.method === "GET") {
      const status = String(req.query.status || "open") as "open" | "done" | "all";
      const [research, audit, approvals] = await Promise.all([
        listResearchItems(user.uid, status),
        listAssistantAudit(user.uid),
        listPendingApprovals(user.uid),
      ]);
      return res.status(200).json({ research, audit, approvals });
    }

    if (req.method === "POST") {
      const body = (req.body || {}) as {
        id?: string;
        status?: "open" | "done";
        note?: string;
      };
      if (!body.id) return res.status(400).json({ error: "id is required" });
      const updated = await updateResearchItem(body.id, user.uid, {
        ...(body.status ? { status: body.status } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      });
      return res.status(200).json({ item: updated });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof BookletAuthError)
      return res.status(error.statusCode).json({ error: error.message });
    const message = error instanceof Error ? error.message : "Research API failed";
    return res.status(500).json({ error: message });
  }
}
