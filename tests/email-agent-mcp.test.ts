import { describe, expect, it } from "vitest";
import {
  effectiveMcpServers,
  openAiMcpTools,
  trustedMcpRegistry,
  validateMcpApprovalRequest,
} from "../lib/email-agent-mcp";
import type { McpConnection, SenderToolGrant } from "../lib/email-agent-types";

const registry = trustedMcpRegistry(JSON.stringify([
  {
    id: "calendar",
    label: "calendar",
    description: "Reviewed calendar service",
    serverUrl: "https://calendar.example.com/mcp",
    trustStatus: "reviewed",
    tools: [
      { name: "search_events", risk: "read_only_low" },
      {
        name: "read_private_notes",
        risk: "read_only_sensitive",
        argumentPolicy: { allowedKeys: ["calendar_id"], stringPrefixes: { calendar_id: ["team-"] } },
      },
      {
        name: "create_event",
        risk: "reversible_mutation",
        argumentPolicy: { allowedKeys: ["title", "calendar_id"], requiredKeys: ["title"], maximumBytes: 2048 },
      },
      { name: "delete_calendar", risk: "prohibited" },
    ],
  },
]));

const connection: McpConnection = {
  id: "mcp-1",
  ownerId: "owner-1",
  registryServerId: "calendar",
  serverLabel: "calendar",
  status: "connected",
  secretRef: "env:CALENDAR_MCP_TOKEN",
  connectedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const grant = (patch: Partial<SenderToolGrant> = {}): SenderToolGrant => ({
  id: "grant-1",
  mcpConnectionId: "mcp-1",
  allowedTools: ["search_events"],
  approvalMode: "automatic",
  enabled: true,
  createdBy: "owner-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

describe("email-agent MCP policy", () => {
  it("exposes only explicitly granted, registry-approved low-risk tools automatically", () => {
    const effective = effectiveMcpServers({
      ownerId: "owner-1",
      registry,
      connections: [connection],
      grants: [grant({ allowedTools: ["search_events", "delete_calendar", "unknown"] })],
      resolveAuthorization: () => "owner-scoped-token",
    });
    expect(effective).toHaveLength(1);
    expect(effective[0].allowedTools).toEqual(["search_events"]);
    expect(effective[0].requireApproval).toBe("never");
    expect(openAiMcpTools(effective)[0]).toMatchObject({
      type: "mcp",
      server_label: "calendar",
      server_url: "https://calendar.example.com/mcp",
      authorization: "owner-scoped-token",
      allowed_tools: ["search_events"],
      require_approval: "never",
    });
  });

  it("forces approval when a sensitive or mutating tool is granted", () => {
    const effective = effectiveMcpServers({
      ownerId: "owner-1",
      registry,
      connections: [connection],
      grants: [grant({ allowedTools: ["search_events", "create_event"] })],
      resolveAuthorization: () => "owner-scoped-token",
    });
    expect(effective[0].requireApproval).toBe("always");
    expect(() => validateMcpApprovalRequest({
      serverLabel: "calendar",
      toolName: "create_event",
      arguments: { title: "Review" },
    }, effective)).not.toThrow();
    expect(() => validateMcpApprovalRequest({
      serverLabel: "calendar",
      toolName: "delete_calendar",
      arguments: {},
    }, effective)).toThrow("not approved");
  });

  it("enforces registry-defined argument and resource scopes before approval", () => {
    const effective = effectiveMcpServers({
      ownerId: "owner-1",
      registry,
      connections: [connection],
      grants: [grant({ allowedTools: ["read_private_notes"], approvalMode: "owner_approval" })],
      resolveAuthorization: () => "owner-scoped-token",
    });
    expect(() => validateMcpApprovalRequest({
      serverLabel: "calendar",
      toolName: "read_private_notes",
      arguments: { calendar_id: "team-benefits" },
    }, effective)).not.toThrow();
    expect(() => validateMcpApprovalRequest({
      serverLabel: "calendar",
      toolName: "read_private_notes",
      arguments: { calendar_id: "personal-private" },
    }, effective)).toThrow("outside the trusted scope");
  });

  it("does not let cross-owner connections or disabled grants expose tools", () => {
    expect(effectiveMcpServers({
      ownerId: "owner-2",
      registry,
      connections: [connection],
      grants: [grant()],
      resolveAuthorization: () => "token",
    })).toEqual([]);
    expect(effectiveMcpServers({
      ownerId: "owner-1",
      registry,
      connections: [connection],
      grants: [grant({ enabled: false })],
      resolveAuthorization: () => "token",
    })).toEqual([]);
  });

  it("rejects untrusted transport configuration", () => {
    expect(() => trustedMcpRegistry(JSON.stringify([{
      id: "bad",
      label: "bad",
      serverUrl: "http://localhost:9999/mcp",
      tools: [{ name: "read", risk: "read_only_low" }],
    }]))).toThrow("HTTPS");
  });
});
