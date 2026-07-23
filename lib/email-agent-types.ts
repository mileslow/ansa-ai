export type EmailConnectionStatus =
  | "connected"
  | "reauth_required"
  | "disconnected"
  | "error";

export type EmailConnection = {
  id: string;
  ownerId: string;
  provider: "google";
  nylasGrantId: string;
  emailAddress: string;
  status: EmailConnectionStatus;
  connectedAt: string;
  updatedAt: string;
  disconnectedAt?: string | null;
  lastWebhookAt?: string | null;
  lastErrorCode?: string | null;
};

export type AllowedSender = {
  id: string;
  normalizedEmail: string;
  displayEmail: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MailboxAddress = {
  name?: string;
  email: string;
};

export type MailboxHeader = {
  name: string;
  value: string;
};

export type MailboxMessage = {
  id: string;
  grantId: string;
  threadId?: string;
  subject: string;
  body: string;
  snippet: string;
  date: number;
  from: MailboxAddress[];
  to: MailboxAddress[];
  cc: MailboxAddress[];
  headers: MailboxHeader[];
};

export type MailboxThread = {
  id: string;
  subject: string;
  messages: MailboxMessage[];
};

export type SentMessage = {
  id: string;
  threadId?: string;
};

export type EmailSenderMemory = {
  id: string;
  ownerId: string;
  connectionId: string;
  senderId: string;
  senderEmail: string;
  key: string;
  value: string;
  category: "identity" | "preference" | "project" | "relationship" | "other";
  sourceMessageId: string;
  createdAt: string;
  updatedAt: string;
};

export interface MailboxProvider {
  createGoogleConnectUrl(input: {
    state: string;
    redirectUri: string;
    loginHint?: string;
  }): string;
  completeConnection(input: {
    code: string;
    redirectUri: string;
  }): Promise<{
    grantId: string;
    emailAddress: string;
    provider: string;
  }>;
  getMessage(grantId: string, messageId: string): Promise<MailboxMessage>;
  getThread(grantId: string, threadId: string): Promise<MailboxThread>;
  searchMessages?(grantId: string, input: {
    participantEmail: string;
    query: string;
    limit: number;
  }): Promise<MailboxMessage[]>;
  reply(input: {
    grantId: string;
    messageId: string;
    recipient: MailboxAddress;
    body: string;
    idempotencyKey: string;
  }): Promise<SentMessage>;
  disconnect(grantId: string): Promise<void>;
}

export type NylasWebhookEvent = {
  id: string;
  type: string;
  time: number;
  data: {
    applicationId?: string;
    object: {
      id: string;
      grantId?: string;
      threadId?: string;
      grantStatus?: string;
    };
  };
};

export type McpToolRisk =
  | "read_only_low"
  | "read_only_sensitive"
  | "reversible_mutation"
  | "prohibited";

export type TrustedMcpTool = {
  name: string;
  description?: string;
  risk: McpToolRisk;
  sensitiveArgumentKeys?: string[];
  argumentPolicy?: {
    allowedKeys?: string[];
    requiredKeys?: string[];
    allowedValues?: Record<string, Array<string | number | boolean>>;
    stringPrefixes?: Record<string, string[]>;
    maximumBytes?: number;
  };
};

export type TrustedMcpServer = {
  id: string;
  label: string;
  description?: string;
  serverUrl?: string;
  connectorId?: string;
  tools: TrustedMcpTool[];
  trustStatus: "reviewed";
  timeoutMs?: number;
  privacyNotes?: string;
};

export type McpConnection = {
  id: string;
  ownerId: string;
  registryServerId: string;
  serverLabel: string;
  status: EmailConnectionStatus;
  secretRef: string;
  connectedAt: string;
  updatedAt: string;
};

export type SenderToolGrant = {
  id: string;
  mcpConnectionId: string;
  allowedTools: string[];
  approvalMode: "automatic" | "owner_approval";
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EffectiveMcpServer = {
  registryServerId: string;
  mcpConnectionId: string;
  label: string;
  description?: string;
  serverUrl?: string;
  connectorId?: string;
  authorization: string;
  allowedTools: string[];
  requireApproval: "never" | "always";
  toolRisks: Record<string, McpToolRisk>;
  sensitiveArgumentKeys: Record<string, string[]>;
  argumentPolicies: Record<string, TrustedMcpTool["argumentPolicy"]>;
};
