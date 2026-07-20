import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BookletAuthError, requireBookletUser } from "../../../lib/booklet-auth";
import {
  assertMailboxOAuthEnabled,
  revokeMailboxConnection,
} from "../../../lib/broker-agent";

export const config = { includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    assertMailboxOAuthEnabled();
    const user = await requireBookletUser(req);
    const connectionId = String((req.body as { connectionId?: string })?.connectionId || "");
    if (!connectionId) {
      res.status(400).json({ error: "connectionId is required" });
      return;
    }
    const result = await revokeMailboxConnection(connectionId, user.uid);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof BookletAuthError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Disconnect failed";
    res.status(500).json({ error: message });
  }
}
