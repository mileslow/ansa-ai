import type {
  EffectiveMcpServer,
  McpConnection,
  SenderToolGrant,
  TrustedMcpServer,
} from "./email-agent-types";

function validServerUrl(value: string) {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}

export function trustedMcpRegistry(
  raw = process.env.EMAIL_AGENT_MCP_REGISTRY_JSON || "[]",
) {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("EMAIL_AGENT_MCP_REGISTRY_JSON must be valid JSON");
  }
  if (!Array.isArray(value))
    throw new Error("EMAIL_AGENT_MCP_REGISTRY_JSON must be an array");
  const ids = new Set<string>();
  const labels = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error(`MCP registry entry ${index + 1} is invalid`);
    const input = item as Record<string, unknown>;
    const id = String(input.id || "").trim();
    const label = String(input.label || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
      throw new Error(`MCP registry entry ${index + 1} has an invalid id`);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(label))
      throw new Error(`MCP registry entry ${id} has an invalid label`);
    if (ids.has(id) || labels.has(label))
      throw new Error(`MCP registry id and label must be unique (${id})`);
    ids.add(id);
    labels.add(label);
    const serverUrl = input.serverUrl ? String(input.serverUrl) : undefined;
    const connectorId = input.connectorId ? String(input.connectorId) : undefined;
    if (Boolean(serverUrl) === Boolean(connectorId))
      throw new Error(`MCP registry entry ${id} needs exactly one serverUrl or connectorId`);
    if (serverUrl && !validServerUrl(serverUrl))
      throw new Error(`MCP registry entry ${id} must use a credential-free HTTPS URL`);
    if (connectorId && !/^connector_[a-z0-9_]{1,80}$/.test(connectorId))
      throw new Error(`MCP registry entry ${id} has an invalid connectorId`);
    if (!Array.isArray(input.tools) || !input.tools.length)
      throw new Error(`MCP registry entry ${id} needs a non-empty tool policy`);
    const tools = input.tools.map((tool, toolIndex) => {
      if (!tool || typeof tool !== "object" || Array.isArray(tool))
        throw new Error(`MCP registry entry ${id} tool ${toolIndex + 1} is invalid`);
      const candidate = tool as Record<string, unknown>;
      const name = String(candidate.name || "").trim();
      const risk = String(candidate.risk || "");
      if (!/^[a-zA-Z0-9_.:/-]{1,128}$/.test(name))
        throw new Error(`MCP registry entry ${id} has an invalid tool name`);
      if (![
        "read_only_low",
        "read_only_sensitive",
        "reversible_mutation",
        "prohibited",
      ].includes(risk))
        throw new Error(`MCP registry entry ${id} tool ${name} has an invalid risk`);
      let argumentPolicy: TrustedMcpServer["tools"][number]["argumentPolicy"];
      if (candidate.argumentPolicy !== undefined) {
        if (!candidate.argumentPolicy || typeof candidate.argumentPolicy !== "object" || Array.isArray(candidate.argumentPolicy))
          throw new Error(`MCP registry entry ${id} tool ${name} has an invalid argument policy`);
        const rawPolicy = candidate.argumentPolicy as Record<string, unknown>;
        const stringArray = (key: string) => {
          const item = rawPolicy[key];
          if (item === undefined) return undefined;
          if (!Array.isArray(item) || item.some((value) => typeof value !== "string"))
            throw new Error(`MCP registry entry ${id} tool ${name} policy ${key} must be a string array`);
          return item as string[];
        };
        const recordOfArrays = (key: string, stringsOnly = false) => {
          const item = rawPolicy[key];
          if (item === undefined) return undefined;
          if (!item || typeof item !== "object" || Array.isArray(item))
            throw new Error(`MCP registry entry ${id} tool ${name} policy ${key} must be an object`);
          for (const nested of Object.values(item))
            if (!Array.isArray(nested) || (stringsOnly && nested.some((value) => typeof value !== "string")))
              throw new Error(`MCP registry entry ${id} tool ${name} policy ${key} values must be arrays`);
          return item as Record<string, Array<string | number | boolean>>;
        };
        const maximumBytes = rawPolicy.maximumBytes === undefined
          ? undefined
          : Number(rawPolicy.maximumBytes);
        if (maximumBytes !== undefined && (!Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 32 * 1024))
          throw new Error(`MCP registry entry ${id} tool ${name} has an invalid maximumBytes policy`);
        argumentPolicy = {
          allowedKeys: stringArray("allowedKeys"),
          requiredKeys: stringArray("requiredKeys"),
          allowedValues: recordOfArrays("allowedValues"),
          stringPrefixes: recordOfArrays("stringPrefixes", true) as Record<string, string[]> | undefined,
          maximumBytes,
        };
      }
      return {
        name,
        risk: risk as TrustedMcpServer["tools"][number]["risk"],
        description: candidate.description ? String(candidate.description) : undefined,
        sensitiveArgumentKeys: Array.isArray(candidate.sensitiveArgumentKeys)
          ? candidate.sensitiveArgumentKeys.map(String)
          : undefined,
        argumentPolicy,
      };
    });
    return {
      id,
      label,
      description: input.description ? String(input.description) : undefined,
      serverUrl,
      connectorId,
      tools,
      trustStatus: "reviewed" as const,
      timeoutMs: input.timeoutMs ? Number(input.timeoutMs) : undefined,
      privacyNotes: input.privacyNotes ? String(input.privacyNotes) : undefined,
    } satisfies TrustedMcpServer;
  });
}

export function resolveMcpAuthorization(secretRef: string) {
  const match = String(secretRef || "").match(/^env:([A-Z][A-Z0-9_]{2,100})$/);
  if (!match)
    throw new Error("MCP credentials must use an env:SECRET_NAME reference");
  const value = process.env[match[1]];
  if (!value) throw new Error(`The MCP credential ${match[1]} is unavailable`);
  return value;
}

export function effectiveMcpServers(input: {
  ownerId: string;
  registry: TrustedMcpServer[];
  connections: McpConnection[];
  grants: SenderToolGrant[];
  resolveAuthorization?: (secretRef: string) => string;
}): EffectiveMcpServer[] {
  const registry = new Map(input.registry.map((server) => [server.id, server]));
  const connections = new Map(
    input.connections
      .filter((connection) =>
        connection.ownerId === input.ownerId && connection.status === "connected")
      .map((connection) => [connection.id, connection]),
  );
  const resolve = input.resolveAuthorization || resolveMcpAuthorization;
  const result: EffectiveMcpServer[] = [];
  for (const grant of input.grants.filter((item) => item.enabled)) {
    const connection = connections.get(grant.mcpConnectionId);
    if (!connection) continue;
    const server = registry.get(connection.registryServerId);
    if (!server || connection.serverLabel !== server.label) continue;
    const policyByName = new Map(server.tools.map((tool) => [tool.name, tool]));
    const permitted = [...new Set(grant.allowedTools)]
      .map((name) => policyByName.get(name))
      .filter((tool): tool is TrustedMcpServer["tools"][number] =>
        Boolean(tool && tool.risk !== "prohibited"));
    if (!permitted.length) continue;
    const automatic =
      grant.approvalMode === "automatic" &&
      permitted.every((tool) => tool.risk === "read_only_low");
    result.push({
      registryServerId: server.id,
      mcpConnectionId: connection.id,
      label: server.label,
      description: server.description,
      serverUrl: server.serverUrl,
      connectorId: server.connectorId,
      authorization: resolve(connection.secretRef),
      allowedTools: permitted.map((tool) => tool.name).sort(),
      requireApproval: automatic ? "never" : "always",
      toolRisks: Object.fromEntries(permitted.map((tool) => [tool.name, tool.risk])),
      sensitiveArgumentKeys: Object.fromEntries(
        permitted.map((tool) => [tool.name, tool.sensitiveArgumentKeys || []]),
      ),
      argumentPolicies: Object.fromEntries(
        permitted.map((tool) => [tool.name, tool.argumentPolicy]),
      ),
    });
  }
  return result.sort((left, right) => left.label.localeCompare(right.label));
}

export function openAiMcpTools(servers: EffectiveMcpServer[]) {
  return servers.map((server) => ({
    type: "mcp" as const,
    server_label: server.label,
    server_description: server.description,
    ...(server.serverUrl
      ? { server_url: server.serverUrl }
      : { connector_id: server.connectorId }),
    authorization: server.authorization,
    allowed_tools: server.allowedTools,
    require_approval: server.requireApproval,
  }));
}

export function validateMcpApprovalRequest(
  request: { serverLabel: string; toolName: string; arguments: unknown },
  servers: EffectiveMcpServer[],
) {
  const server = servers.find((item) => item.label === request.serverLabel);
  if (!server || server.requireApproval !== "always")
    throw new Error("The requested MCP server is not approved for this sender");
  if (!server.allowedTools.includes(request.toolName))
    throw new Error("The requested MCP tool is not approved for this sender");
  const risk = server.toolRisks[request.toolName];
  if (!risk || risk === "prohibited")
    throw new Error("The requested MCP tool is prohibited");
  if (!request.arguments || typeof request.arguments !== "object" || Array.isArray(request.arguments))
    throw new Error("The requested MCP arguments must be an object");
  const argumentsObject = request.arguments as Record<string, unknown>;
  const policy = server.argumentPolicies[request.toolName];
  if (risk !== "read_only_low" && !policy)
    throw new Error("Sensitive MCP tools require a registry argument policy before approval");
  const serialized = JSON.stringify(argumentsObject);
  if (Buffer.byteLength(serialized, "utf8") > Math.min(32 * 1024, policy?.maximumBytes || 32 * 1024))
    throw new Error("The requested MCP arguments exceed the approval limit");
  if (policy?.allowedKeys) {
    const allowed = new Set(policy.allowedKeys);
    if (Object.keys(argumentsObject).some((key) => !allowed.has(key)))
      throw new Error("The requested MCP arguments contain a key outside the trusted policy");
  }
  if (policy?.requiredKeys?.some((key) => !(key in argumentsObject)))
    throw new Error("The requested MCP arguments omit a required policy key");
  for (const [key, allowedValues] of Object.entries(policy?.allowedValues || {})) {
    if (key in argumentsObject && !allowedValues.includes(argumentsObject[key] as never))
      throw new Error(`The requested MCP argument ${key} is outside the trusted policy`);
  }
  for (const [key, prefixes] of Object.entries(policy?.stringPrefixes || {})) {
    const value = argumentsObject[key];
    if (typeof value !== "string" || !prefixes.some((prefix) => value.startsWith(prefix)))
      throw new Error(`The requested MCP resource ${key} is outside the trusted scope`);
  }
  return { server, risk };
}
