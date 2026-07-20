import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BookletAuthError, requireBookletUser } from "../../../lib/booklet-auth";
import {
  assertMailboxOAuthEnabled,
  listActiveMailboxConnections,
} from "../../../lib/broker-agent";

export const config = { includeFiles: "lib/**" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    assertMailboxOAuthEnabled();
    const user = await requireBookletUser(req);
    const connections = await listActiveMailboxConnections(user.uid);
    res.status(200).json({
      connections: connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        email: c.email || null,
        status: c.status,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    if (error instanceof BookletAuthError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Mailbox status failed";
    res.status(500).json({ error: message });
  }
}
