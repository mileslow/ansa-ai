import { getAdminServices } from "../lib/firebase-admin";
import { trustedMcpRegistry } from "../lib/email-agent-mcp";
import { stableEmailAgentId } from "../lib/email-agent-security";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const ownerId = argument("owner");
const registryServerId = argument("server");
const secretEnv = argument("secret-env");

if (!ownerId || !registryServerId || !secretEnv) {
  throw new Error(
    "Usage: npx tsx scripts/provision-email-agent-mcp-connection.ts --owner <firebase-uid> --server <registry-id> --secret-env <ENV_NAME>",
  );
}
if (!/^[A-Z][A-Z0-9_]{2,100}$/.test(secretEnv))
  throw new Error("--secret-env must be an uppercase environment variable name");
if (!process.env[secretEnv])
  throw new Error(`${secretEnv} is not present in the server environment`);

const server = trustedMcpRegistry().find((item) => item.id === registryServerId);
if (!server) throw new Error(`${registryServerId} is not in EMAIL_AGENT_MCP_REGISTRY_JSON`);

const id = stableEmailAgentId(`${ownerId}:${server.id}`, 48);
const now = new Date().toISOString();
const ref = getAdminServices().db.collection("mcpConnections").doc(id);
const current = await ref.get();
await ref.set({
  id,
  ownerId,
  registryServerId: server.id,
  serverLabel: server.label,
  status: "connected",
  secretRef: `env:${secretEnv}`,
  connectedAt: current.data()?.connectedAt || now,
  updatedAt: now,
}, { merge: true });

console.log(`Provisioned reviewed MCP server ${server.id} for owner ${ownerId}.`);
