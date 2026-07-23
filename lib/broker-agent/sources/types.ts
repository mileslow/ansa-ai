export type SourceConnectorId = "ansa_library" | "gmail" | "outlook";

/** Reserved for later iterations — not registered in CONNECTORS yet. */
export type FutureSourceConnectorId = "desktop" | "carrier_web";

export type AnySourceConnectorId = SourceConnectorId | FutureSourceConnectorId;

export type SourceQuery = {
  ownerId: string;
  companyId: string;
  keywords?: string[];
  employerName?: string;
  planYear?: string;
  limit?: number;
  /** For mailbox connectors: which connection doc ids to use. */
  connectionIds?: string[];
};

export type SourceHit = {
  id: string;
  connectorId: SourceConnectorId;
  title: string;
  snippet?: string;
  mimeType?: string;
  fileName?: string;
  sourceUrl?: string | null;
  receivedAt?: string | null;
  meta?: Record<string, unknown>;
};

export type SourceFetchResult = {
  hit: SourceHit;
  fileName: string;
  mimeType: string;
  data?: Buffer;
  text?: string;
  sourceKind:
    | "company_library"
    | "mailbox_message"
    | "mailbox_attachment";
  sourceUrl?: string | null;
  intakeCategory?:
    | "employer"
    | "rates"
    | "documents"
    | "template"
    | "census"
    | "instructions";
};

export type SourceConnector = {
  id: SourceConnectorId;
  list(query: SourceQuery): Promise<SourceHit[]>;
  fetch(hitId: string, query: SourceQuery): Promise<SourceFetchResult>;
};
