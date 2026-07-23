import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertOwner, BookletAuthError, requireBookletUser } from "../lib/booklet-auth";
import {
  createEmailOAuthState,
  disableAllowedSender,
  getEmailConnection,
  getMcpConnection,
  listAllowedSenders,
  listEmailAgentApprovals,
  listEmailConnections,
  listMcpConnections,
  listSenderToolGrants,
  markEmailConnectionDisconnected,
  putAllowedSender,
  putSenderToolGrant,
} from "../lib/email-agent-store";
import { trustedMcpRegistry } from "../lib/email-agent-mcp";
import { NylasMailboxProvider } from "../lib/nylas-mailbox-provider";
import {
  presentEmailAgentApproval,
  resolveEmailAgentApproval,
} from "../lib/nylas-email-agent";

export const config = { maxDuration: 300, includeFiles: "lib/**" };

const validId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);

function callbackUrl() {
  const value = process.env.NYLAS_OAUTH_CALLBACK_URL;
  if (!value) throw new Error("NYLAS_OAUTH_CALLBACK_URL is not configured");
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
  )
    throw new Error("NYLAS_OAUTH_CALLBACK_URL must use HTTPS outside local development");
  return url.href;
}

function safeConnection(connection: Awaited<ReturnType<typeof getEmailConnection>>) {
  if (!connection) return null;
  const { nylasGrantId: _grantId, ...safe } = connection;
  return safe;
}

async function settingsPayload(ownerId: string) {
  const [connections, mcpConnections, approvals] = await Promise.all([
    listEmailConnections(ownerId),
    listMcpConnections(ownerId),
    listEmailAgentApprovals(ownerId),
  ]);
  const connectionRows = await Promise.all(
    connections.map(async (connection) => {
      const senders = await listAllowedSenders(connection.id);
      return {
        ...safeConnection(connection),
        allowedSenders: await Promise.all(
          senders.map(async (sender) => ({
            ...sender,
            toolGrants: await listSenderToolGrants(connection.id, sender.id),
          })),
        ),
      };
    }),
  );
  return {
    connections: connectionRows,
    mcpConnections: mcpConnections.map(({ secretRef: _secretRef, ...connection }) => connection),
    mcpRegistry: trustedMcpRegistry().map((server) => ({
      id: server.id,
      label: server.label,
      description: server.description,
      tools: server.tools,
      trustStatus: server.trustStatus,
      privacyNotes: server.privacyNotes,
    })),
    approvals: approvals.map(presentEmailAgentApproval),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method || ""))
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await requireBookletUser(req);
    const input = (req.method === "GET" ? req.query : req.body || {}) as Record<string, unknown>;
    const action = String(input.action || (req.method === "GET" ? "list" : ""));

    if (action === "list") return res.status(200).json(await settingsPayload(user.uid));

    if (action === "oauth_start") {
      const state = await createEmailOAuthState({
        ownerId: user.uid,
        redirectAfter: typeof input.redirectAfter === "string" ? input.redirectAfter : undefined,
      });
      const url = new NylasMailboxProvider().createGoogleConnectUrl({
        state: state.id,
        redirectUri: callbackUrl(),
        loginHint: typeof input.loginHint === "string" ? input.loginHint : undefined,
      });
      return res.status(200).json({ url });
    }

    if (["approval_approve", "approval_deny"].includes(action)) {
      if (!validId(input.approvalId))
        return res.status(400).json({ error: "A valid approvalId is required" });
      const result = await resolveEmailAgentApproval({
        approvalId: String(input.approvalId),
        ownerId: user.uid,
        approve: action === "approval_approve",
      });
      return res.status(200).json({ result, ...(await settingsPayload(user.uid)) });
    }

    if (!validId(input.connectionId))
      return res.status(400).json({ error: "A valid connectionId is required" });
    const connection = await getEmailConnection(String(input.connectionId));
    if (!connection) return res.status(404).json({ error: "Email connection not found" });
    assertOwner(connection.ownerId, user.uid);

    if (action === "disconnect") {
      if (connection.status !== "disconnected")
        await new NylasMailboxProvider().disconnect(connection.nylasGrantId);
      await markEmailConnectionDisconnected(connection.id);
      return res.status(200).json(await settingsPayload(user.uid));
    }

    if (action === "allowlist_add") {
      if (typeof input.email !== "string")
        return res.status(400).json({ error: "An email address is required" });
      await putAllowedSender({
        connectionId: connection.id,
        email: input.email,
        createdBy: user.uid,
      });
      return res.status(200).json(await settingsPayload(user.uid));
    }

    if (action === "allowlist_remove") {
      if (!validId(input.senderId))
        return res.status(400).json({ error: "A valid senderId is required" });
      const removed = await disableAllowedSender(connection.id, String(input.senderId));
      if (!removed) return res.status(404).json({ error: "Allowed sender not found" });
      return res.status(200).json(await settingsPayload(user.uid));
    }

    if (action === "tool_grant_put") {
      if (!validId(input.senderId) || !validId(input.mcpConnectionId))
        return res.status(400).json({ error: "A valid senderId and mcpConnectionId are required" });
      const sender = (await listAllowedSenders(connection.id)).find(
        (item) => item.id === input.senderId && item.enabled,
      );
      if (!sender) return res.status(404).json({ error: "Allowed sender not found" });
      const mcpConnection = await getMcpConnection(String(input.mcpConnectionId));
      if (!mcpConnection) return res.status(404).json({ error: "MCP connection not found" });
      assertOwner(mcpConnection.ownerId, user.uid);
      const server = trustedMcpRegistry().find(
        (item) => item.id === mcpConnection.registryServerId,
      );
      if (!server) return res.status(400).json({ error: "MCP server is not in the trusted registry" });
      const requested = Array.isArray(input.allowedTools)
        ? [...new Set(input.allowedTools.map(String))]
        : [];
      const policies = new Map(server.tools.map((tool) => [tool.name, tool]));
      if (requested.some((name) => !policies.has(name) || policies.get(name)?.risk === "prohibited"))
        return res.status(400).json({ error: "One or more MCP tools are not permitted" });
      const approvalMode = input.approvalMode === "automatic"
        ? "automatic"
        : "owner_approval";
      if (
        approvalMode === "automatic" &&
        requested.some((name) => policies.get(name)?.risk !== "read_only_low")
      )
        return res.status(400).json({
          error: "Only reviewed low-risk read-only MCP tools can run automatically",
        });
      await putSenderToolGrant({
        connectionId: connection.id,
        senderId: sender.id,
        mcpConnectionId: mcpConnection.id,
        allowedTools: requested,
        approvalMode,
        enabled: input.enabled !== false,
        createdBy: user.uid,
      });
      return res.status(200).json(await settingsPayload(user.uid));
    }

    return res.status(400).json({ error: "Unknown email-agent action" });
  } catch (error) {
    const status = error instanceof BookletAuthError ? error.statusCode : 500;
    console.error("email agent settings request failed", {
      action: (req.body as { action?: unknown } | undefined)?.action,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return res.status(status).json({
      error: error instanceof Error ? error.message : "Email-agent request failed",
    });
  }
}
