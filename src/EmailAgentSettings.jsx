import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  Unplug,
  Wrench,
  XCircle,
} from "lucide-react";
import { emailAgentApi } from "./emailAgentApi";
import "./email-agent.css";

const emptyPayload = {
  connections: [],
  mcpConnections: [],
  mcpRegistry: [],
  approvals: [],
};

function statusLabel(status) {
  return {
    connected: "Connected",
    reauth_required: "Reconnect required",
    disconnected: "Disconnected",
    error: "Needs attention",
  }[status] || status;
}

function readableArguments(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Arguments unavailable";
  }
}

export default function EmailAgentSettings({ onBack }) {
  const [payload, setPayload] = useState(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => {
    const result = new URLSearchParams(window.location.search).get("gmail");
    return result === "connected"
      ? "Gmail connected successfully."
      : result === "error"
        ? "Gmail could not be connected. Try again or check the Nylas configuration."
        : "";
  });

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setPayload(await emailAgentApi.list());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const mutate = async (key, action, success) => {
    setBusy(key);
    setError("");
    try {
      const next = await action();
      setPayload(next);
      setNotice(success || "Settings updated.");
    } catch (mutationError) {
      setError(mutationError.message);
    } finally {
      setBusy("");
    }
  };

  const connect = async () => {
    setBusy("connect");
    setError("");
    try {
      const { url } = await emailAgentApi.startGoogle();
      window.location.assign(url);
    } catch (connectError) {
      setError(connectError.message);
      setBusy("");
    }
  };

  return (
    <div className="email-agent-page">
      <aside className="email-agent-nav">
        <button className="email-agent-brand" onClick={onBack}>ansa</button>
        <nav>
          <small>Workspace settings</small>
          <button className="active"><Mail /> Email agent</button>
        </nav>
        <button className="email-agent-back" onClick={onBack}><ArrowLeft /> Back to booklet studio</button>
      </aside>

      <main className="email-agent-main">
        <header className="email-agent-heading">
          <div>
            <span>Email agent</span>
            <h1>Gmail connections</h1>
            <p>Let explicitly allowed senders email a no-filesystem assistant from your existing Gmail account.</p>
          </div>
          <button className="email-agent-primary" onClick={connect} disabled={busy === "connect"}>
            {busy === "connect" ? <LoaderCircle className="spin" /> : <Mail />}
            Connect Gmail
          </button>
        </header>

        {notice && <div className="email-agent-notice"><CheckCircle2 /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
        {error && <div className="email-agent-error"><XCircle /><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

        {loading ? (
          <div className="email-agent-loading"><LoaderCircle className="spin" /> Loading email-agent settings…</div>
        ) : (
          <>
            {!!payload.approvals.length && (
              <section className="email-agent-section email-agent-approvals">
                <header><div><span>Owner review</span><h2>Pending tool approvals</h2></div><b>{payload.approvals.length}</b></header>
                {payload.approvals.map((approval) => (
                  <article key={approval.id}>
                    <div>
                      <b>{approval.senderEmail}</b>
                      <small>{new Date(approval.createdAt).toLocaleString()}</small>
                    </div>
                    {approval.toolRequests.map((request) => (
                      <div className="email-agent-tool-request" key={request.approvalRequestId}>
                        <span><Wrench /> {request.serverLabel} / {request.toolName}</span>
                        <pre>{readableArguments(request.arguments)}</pre>
                      </div>
                    ))}
                    <footer>
                      <button
                        className="email-agent-secondary"
                        disabled={busy === approval.id}
                        onClick={() => mutate(approval.id, () => emailAgentApi.resolveApproval(approval.id, false), "The action was denied and the sender was notified.")}
                      >Deny</button>
                      <button
                        className="email-agent-primary"
                        disabled={busy === approval.id}
                        onClick={() => mutate(approval.id, () => emailAgentApi.resolveApproval(approval.id, true), "The action was approved and processing continued.")}
                      >Approve</button>
                    </footer>
                  </article>
                ))}
              </section>
            )}

            {!payload.connections.length ? (
              <section className="email-agent-empty">
                <span><Mail /></span>
                <h2>Connect a Gmail mailbox</h2>
                <p>Nylas handles Google OAuth. Flux keeps the grant server-side and replies from the same mailbox and thread.</p>
                <button className="email-agent-primary" onClick={connect}>Connect Gmail</button>
              </section>
            ) : payload.connections.map((connection) => (
              <MailboxConnection
                key={connection.id}
                connection={connection}
                payload={payload}
                busy={busy}
                mutate={mutate}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function MailboxConnection({ connection, payload, busy, mutate }) {
  const [email, setEmail] = useState("");
  const [expanded, setExpanded] = useState("");
  const activeSenders = connection.allowedSenders.filter((sender) => sender.enabled);
  const connectedMcp = payload.mcpConnections.filter((item) => item.status === "connected");

  const addSender = async (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    await mutate(`add:${connection.id}`, () => emailAgentApi.addSender(connection.id, value), `${value} can now email the assistant.`);
    setEmail("");
  };

  return (
    <section className="email-agent-section">
      <header className="email-agent-mailbox-head">
        <div className="email-agent-mailbox-icon"><Mail /></div>
        <div><span>Google mailbox</span><h2>{connection.emailAddress}</h2><small>Connected {new Date(connection.connectedAt).toLocaleDateString()}</small></div>
        <em className={`status-${connection.status}`}>{statusLabel(connection.status)}</em>
        <button
          className="email-agent-danger"
          disabled={busy === `disconnect:${connection.id}` || connection.status === "disconnected"}
          onClick={() => {
            if (!window.confirm(`Disconnect ${connection.emailAddress}? New messages will stop immediately.`)) return;
            void mutate(`disconnect:${connection.id}`, () => emailAgentApi.disconnect(connection.id), `${connection.emailAddress} was disconnected.`);
          }}
        ><Unplug /> Disconnect</button>
      </header>

      <div className="email-agent-subsection">
        <div className="email-agent-subhead">
          <div><ShieldCheck /><span><b>Allowed senders</b><small>Exact addresses only. Gmail dots and plus suffixes are not rewritten.</small></span></div>
          <b>{activeSenders.length}</b>
        </div>
        <form className="email-agent-add" onSubmit={addSender}>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" aria-label="Allowed sender email" />
          <button className="email-agent-primary" disabled={!email.trim() || busy === `add:${connection.id}`}><Plus /> Add sender</button>
        </form>
        <div className="email-agent-senders">
          {!activeSenders.length && <p>No sender can reach the model yet.</p>}
          {activeSenders.map((sender) => (
            <article key={sender.id}>
              <button className="email-agent-sender-main" onClick={() => setExpanded(expanded === sender.id ? "" : sender.id)}>
                <span><i>{sender.normalizedEmail.slice(0, 1).toUpperCase()}</i><span><b>{sender.displayEmail}</b><small>Added {new Date(sender.createdAt).toLocaleDateString()}</small></span></span>
                <span>{sender.toolGrants.filter((grant) => grant.enabled).length} tool grants <ChevronDown /></span>
              </button>
              <button
                className="email-agent-icon-danger"
                aria-label={`Remove ${sender.displayEmail}`}
                disabled={busy === `remove:${sender.id}`}
                onClick={() => mutate(`remove:${sender.id}`, () => emailAgentApi.removeSender(connection.id, sender.id), `${sender.displayEmail} was removed.`)}
              ><Trash2 /></button>
              {expanded === sender.id && (
                <ToolPermissions
                  connection={connection}
                  sender={sender}
                  mcpConnections={connectedMcp}
                  registry={payload.mcpRegistry}
                  busy={busy}
                  mutate={mutate}
                />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolPermissions({ connection, sender, mcpConnections, registry, busy, mutate }) {
  if (!mcpConnections.length)
    return <div className="email-agent-tools-empty"><Wrench /><span><b>No remote services connected</b><small>Newly allowed senders receive email replies but no MCP tools by default.</small></span></div>;
  return (
    <div className="email-agent-tools">
      <header><b>Remote tool access</b><small>Only checked, reviewed tools are exposed to this sender.</small></header>
      {mcpConnections.map((mcp) => {
        const server = registry.find((item) => item.id === mcp.registryServerId);
        if (!server) return null;
        return <ToolServerGrant key={mcp.id} connection={connection} sender={sender} mcp={mcp} server={server} busy={busy} mutate={mutate} />;
      })}
    </div>
  );
}

function ToolServerGrant({ connection, sender, mcp, server, busy, mutate }) {
  const current = sender.toolGrants.find((grant) => grant.mcpConnectionId === mcp.id);
  const allowedPolicies = useMemo(() => server.tools.filter((tool) => tool.risk !== "prohibited"), [server]);
  const [selected, setSelected] = useState(() => new Set(current?.allowedTools || []));
  const [mode, setMode] = useState(current?.approvalMode || "owner_approval");
  const automaticEligible = [...selected].every((name) =>
    allowedPolicies.find((tool) => tool.name === name)?.risk === "read_only_low");
  const save = () => mutate(
    `tools:${sender.id}:${mcp.id}`,
    () => emailAgentApi.putToolGrant({
      connectionId: connection.id,
      senderId: sender.id,
      mcpConnectionId: mcp.id,
      allowedTools: [...selected],
      approvalMode: mode === "automatic" && automaticEligible ? "automatic" : "owner_approval",
      enabled: selected.size > 0,
    }),
    `${server.label} permissions updated for ${sender.displayEmail}.`,
  );
  return (
    <section className="email-agent-tool-server">
      <div><b>{server.label}</b><small>{server.description || "Reviewed remote MCP server"}</small></div>
      <div className="email-agent-tool-checks">
        {allowedPolicies.map((tool) => (
          <label key={tool.name}>
            <input
              type="checkbox"
              checked={selected.has(tool.name)}
              onChange={(event) => setSelected((currentSet) => {
                const next = new Set(currentSet);
                if (event.target.checked) next.add(tool.name); else next.delete(tool.name);
                return next;
              })}
            />
            <span><b>{tool.name}</b><small>{tool.risk.replaceAll("_", " ")}</small></span>
          </label>
        ))}
      </div>
      <footer>
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="owner_approval">Require owner approval</option>
          <option value="automatic" disabled={!automaticEligible}>Automatic (low-risk read only)</option>
        </select>
        <button className="email-agent-secondary" disabled={busy === `tools:${sender.id}:${mcp.id}`} onClick={save}>Save permissions</button>
      </footer>
    </section>
  );
}
