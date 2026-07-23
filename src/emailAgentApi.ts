import { getBookletAuthToken } from "./firebase";

export type EmailAgentTool = {
  name: string;
  description?: string;
  risk: "read_only_low" | "read_only_sensitive" | "reversible_mutation" | "prohibited";
};

export type EmailAgentSettingsPayload = {
  connections: Array<{
    id: string;
    emailAddress: string;
    status: "connected" | "reauth_required" | "disconnected" | "error";
    connectedAt: string;
    updatedAt: string;
    allowedSenders: Array<{
      id: string;
      normalizedEmail: string;
      displayEmail: string;
      enabled: boolean;
      createdAt: string;
      toolGrants: Array<{
        id: string;
        mcpConnectionId: string;
        allowedTools: string[];
        approvalMode: "automatic" | "owner_approval";
        enabled: boolean;
      }>;
    }>;
  }>;
  mcpConnections: Array<{
    id: string;
    registryServerId: string;
    serverLabel: string;
    status: string;
  }>;
  mcpRegistry: Array<{
    id: string;
    label: string;
    description?: string;
    tools: EmailAgentTool[];
  }>;
  approvals: Array<{
    id: string;
    connectionId: string;
    senderEmail: string;
    status: string;
    createdAt: string;
    toolRequests: Array<{
      approvalRequestId: string;
      serverLabel: string;
      toolName: string;
      arguments: unknown;
    }>;
  }>;
};

async function headers() {
  if (import.meta.env.DEV) return { "Content-Type": "application/json" };
  return {
    Authorization: `Bearer ${await getBookletAuthToken()}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(input: Record<string, unknown>, method = "POST") {
  const response = await fetch("/api/email-agent", {
    method,
    headers: await headers(),
    body: method === "GET" ? undefined : JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error || `Email-agent request failed (${response.status})`);
  return payload;
}

export const emailAgentApi = {
  list: () => request<EmailAgentSettingsPayload>({ action: "list" }),
  startGoogle: () =>
    request<{ url: string }>({ action: "oauth_start", redirectAfter: "/email-agent" }),
  disconnect: (connectionId: string) =>
    request<EmailAgentSettingsPayload>({ action: "disconnect", connectionId }, "DELETE"),
  addSender: (connectionId: string, email: string) =>
    request<EmailAgentSettingsPayload>({ action: "allowlist_add", connectionId, email }),
  removeSender: (connectionId: string, senderId: string) =>
    request<EmailAgentSettingsPayload>({ action: "allowlist_remove", connectionId, senderId }, "DELETE"),
  putToolGrant: (input: {
    connectionId: string;
    senderId: string;
    mcpConnectionId: string;
    allowedTools: string[];
    approvalMode: "automatic" | "owner_approval";
    enabled: boolean;
  }) => request<EmailAgentSettingsPayload>({ action: "tool_grant_put", ...input }, "PUT"),
  resolveApproval: (approvalId: string, approve: boolean) =>
    request<EmailAgentSettingsPayload & { result: unknown }>({
      action: approve ? "approval_approve" : "approval_deny",
      approvalId,
    }),
};
