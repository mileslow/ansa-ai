import { ansaLibraryConnector } from "./ansa-library";
import { gmailConnector } from "./gmail";
import { outlookConnector } from "./outlook";
import type { SourceConnector, SourceConnectorId, SourceHit, SourceQuery } from "./types";

const CONNECTORS: Record<SourceConnectorId, SourceConnector> = {
  ansa_library: ansaLibraryConnector,
  gmail: gmailConnector,
  outlook: outlookConnector,
};

export function getSourceConnector(id: SourceConnectorId) {
  return CONNECTORS[id];
}

export async function searchAllSources(query: SourceQuery): Promise<SourceHit[]> {
  const limit = query.limit ?? 25;
  const perConnector = Math.max(5, Math.ceil(limit / 3));
  const [library, gmail, outlook] = await Promise.all([
    ansaLibraryConnector.list({ ...query, limit: perConnector }),
    gmailConnector.list({ ...query, limit: perConnector }).catch((error) => {
      console.error("gmail source list failed", { error });
      return [] as SourceHit[];
    }),
    outlookConnector.list({ ...query, limit: perConnector }).catch((error) => {
      console.error("outlook source list failed", { error });
      return [] as SourceHit[];
    }),
  ]);
  return [...library, ...gmail, ...outlook].slice(0, limit);
}

export async function fetchSourceHit(hitId: string, query: SourceQuery) {
  if (hitId.startsWith("ansa_library:"))
    return ansaLibraryConnector.fetch(hitId, query);
  if (hitId.startsWith("gmail:")) return gmailConnector.fetch(hitId, query);
  if (hitId.startsWith("outlook:")) return outlookConnector.fetch(hitId, query);
  throw new Error(`Unknown source hit id: ${hitId}`);
}

export * from "./types";
export { ansaLibraryConnector } from "./ansa-library";
export { gmailConnector, gmailAuthUrl, exchangeGmailCode, fetchGmailProfileEmail } from "./gmail";
export {
  outlookConnector,
  outlookAuthUrl,
  exchangeOutlookCode,
  fetchOutlookProfileEmail,
} from "./outlook";
export {
  assertMailboxOAuthEnabled,
  buildOAuthState,
  parseOAuthState,
  encryptSecret,
  decryptSecret,
  listActiveMailboxConnections,
  saveMailboxConnection,
  revokeMailboxConnection,
  getMailboxConnection,
} from "./mailbox-tokens";
