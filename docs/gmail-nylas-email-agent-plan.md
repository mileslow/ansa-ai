# Gmail Email Agent Through Nylas

## Status

This document records the product and implementation plan agreed in the discussion.

The first version will support **Gmail and Google Workspace accounts only**, connected through the **Nylas Email API**. Support for Outlook, iCloud, Yahoo, Exchange, and generic IMAP is intentionally deferred.

## Product Summary

Build an email-based AI agent that:

1. Lets a user connect an existing Gmail or Google Workspace mailbox through OAuth.
2. Lets that user maintain an allowlist of email addresses.
3. Watches the connected inbox for new messages.
4. Ignores messages whose sender is not on the allowlist.
5. Gives eligible messages and relevant thread context to an OpenAI model.
6. Gives the model access to an explicitly approved set of remote MCP tools.
7. Gives the model no local filesystem, shell, code-execution, or computer-control access.
8. Sends the resulting reply from the same Gmail account that the user connected.
9. Replies in the original Gmail thread.

The experience should feel like emailing a capable, Codex-like assistant, but the assistant exists at the user's existing email address and has no access to the user's computer or filesystem.

## Final Technology Decision

Use the Nylas Email API as the mailbox integration layer.

Nylas will provide:

- Gmail OAuth connection and grant management.
- A normalized API for reading messages and threads.
- Webhooks for new inbox activity.
- Sending through the connected Gmail account.
- Correct provider-side threading and Sent-folder behavior.

Flux remains responsible for:

- Authenticating the Flux user.
- Associating a Nylas grant with that user.
- Managing the sender allowlist.
- Verifying and deduplicating webhook events.
- Deciding whether a message may reach the model.
- Constructing model context and instructions.
- Calling the OpenAI Responses API.
- Connecting trusted MCP servers and managing their credentials.
- Controlling which MCP servers and tools each sender may use.
- Approving, denying, executing, and auditing MCP tool calls.
- Deterministically sending the approved reply to the original sender.
- Audit logging, rate limiting, and operational monitoring.

## MVP Scope

### Included

- One or more Gmail or Google Workspace connections per Flux user, with the data model capable of supporting multiple connections.
- Nylas-hosted Google OAuth.
- Connection, reconnection, and disconnection states.
- Exact-address sender allowlists for each connected mailbox.
- New-message processing through Nylas webhooks.
- Plain-text and HTML email-body ingestion, normalized to safe text for the model.
- Recent thread context.
- Durable facts scoped to each exact allowed sender email address.
- Application function tools for saving, forgetting, and searching sender memory.
- Application function tooling for searching prior one-to-one Gmail conversations
  with the current authorized sender across threads.
- General-purpose email replies generated with the OpenAI Responses API.
- Remote MCP tools selected from a server-side trusted registry.
- Per-sender MCP permissions that are separate from the email reply allowlist.
- Automatic use of explicitly approved low-risk tools.
- An approval path for sensitive or mutating MCP tool calls.
- Replies sent through the user's authenticated Gmail mailbox.
- Idempotency and loop prevention.
- A simple audit record for every ignored, processed, sent, or failed message.

### Deferred

- Outlook, Microsoft 365, Exchange, Yahoo, iCloud, and generic IMAP.
- Domain-wide allowlist rules.
- Local filesystem, shell, code execution, Computer Use, or control of the user's computer.
- Arbitrary MCP servers supplied by an email sender.
- Irreversible or destructive MCP actions in the initial milestone.
- Unapproved autonomous mutations of external systems.
- Direct use of Nylas Calendar or Contacts APIs. Approved MCP integrations may still expose calendar, contact, or other remote-service tools.
- Proactive outbound email initiated by the model.
- Automatic forwarding, deleting, labeling, or archiving.
- Attachment understanding in the initial milestone. It can be added after the text-only path is stable.
- A full email-client interface.

Nylas is still useful for a Gmail-only MVP because it leaves a clean path to other providers later without changing the agent's core mailbox interface.

## User Experience

### Connect Gmail

1. The signed-in user opens the email-agent settings page.
2. The user selects **Connect Gmail**.
3. Flux creates a short-lived OAuth state value tied to the signed-in user and intended callback.
4. Flux redirects the user into Nylas Hosted Auth, restricted to the Google provider.
5. Nylas redirects to Google's OAuth consent screen.
6. After consent, Nylas redirects back to the Flux callback.
7. The backend exchanges the authorization code and receives a Nylas grant representing the connected mailbox.
8. Flux verifies the grant and reads the authenticated mailbox address.
9. Flux stores the grant ID and mailbox metadata against the current Flux user.
10. The UI displays the mailbox as connected.

The Nylas API key and OAuth code exchange must stay on the backend. The browser must never receive the Nylas API key.

### Manage the Allowlist

For each connected Gmail account, the owner can:

- View allowed sender addresses.
- Add an exact email address.
- Disable or remove an address.
- See when an address was added and whether it is enabled.

Addresses should be parsed, trimmed, and compared case-insensitively. Do not automatically remove Gmail dots or plus-address suffixes; authorization should remain an explicit exact-address decision.

### Receive and Reply

1. An allowed person emails the connected Gmail account.
2. Nylas emits a new-message webhook.
3. Flux verifies the webhook signature and records the event.
4. Flux queues the message for asynchronous processing and quickly acknowledges the webhook.
5. The worker retrieves the canonical message and thread from Nylas.
6. The worker applies all eligibility and safety checks.
7. The worker calls the model only if the sender is allowed.
8. The model returns only a proposed email body.
9. The server rechecks the connection and allowlist.
10. The server replies through the same Nylas grant and original message/thread.
11. The reply is sent from the user's authenticated Gmail address and appears in Gmail's Sent mail.

Messages from senders who are not allowed receive no reply and must not be sent to OpenAI.

## System Architecture

```text
Flux user
    |
    | Connect Gmail
    v
Flux backend ----> Nylas Hosted Auth ----> Google OAuth
    |                                        |
    |<----------- Nylas grant ---------------|
    |
    v
Connection + allowlist records

Gmail inbox
    |
    v
Nylas message.created webhook
    |
    v
Verified webhook endpoint
    |
    v
Task queue / asynchronous worker
    |
    +--> fetch canonical message and thread from Nylas
    +--> enforce exact sender allowlist
    +--> reject loops, bulk mail, and stale/duplicate events
    +--> resolve sender-specific MCP permissions
    +--> call OpenAI Responses API with approved MCP tools
    +--> approve/deny and audit MCP tool calls
    +--> recheck authorization
    +--> reply through the original Nylas grant
    v
User's Gmail Sent folder and original email thread
```

## Google Cloud and OAuth Setup

The Gmail connection needs a Google OAuth application in the **Flux GCP project** unless Flux intentionally chooses a qualifying Nylas shared-Google-application offering.

The expected setup is:

1. Confirm the Flux GCP project and the team members who can administer it.
2. Configure the OAuth consent screen and application branding.
3. Configure the user type appropriate to the product's audience.
4. Create the OAuth client required by the Nylas Google connector.
5. Add Nylas's required redirect URI exactly as shown in the Nylas dashboard.
6. Enable the Gmail permissions required to read incoming mail and send replies.
7. Add the Google client credentials to the Nylas Google connector, not to frontend code.
8. Add test users while the Google application remains in testing mode.
9. Complete Google's production verification requirements before connecting arbitrary external Gmail users.
10. Plan for any restricted-scope verification or security assessment Google requires for the final scopes.

Development should begin with a Nylas test grant and explicitly listed Google test users. Production OAuth approval is a release dependency and should not block the local integration spike.

## Nylas Configuration

Create a Nylas application for the Flux environment and configure:

- The Google provider connector.
- The Flux OAuth callback URL.
- A webhook destination for the deployed Flux API.
- The `message.created` event.
- Grant lifecycle events needed to identify expired, invalid, or deleted grants.
- A webhook signing secret.
- Separate development and production credentials.

Each connected mailbox becomes a Nylas grant. Flux should store the grant ID, but not copy Google refresh tokens into the application database.

The recommended initial backend dependency is the official `nylas` Node.js SDK.

## Suggested Backend Boundaries

Keep Nylas behind a small mailbox adapter so the agent logic does not depend on provider-specific response objects:

```ts
interface MailboxProvider {
  createGoogleConnectUrl(input: {
    ownerId: string;
    redirectUri: string;
  }): Promise<string>;

  completeConnection(input: {
    code: string;
    ownerId: string;
  }): Promise<ConnectedMailbox>;

  getMessage(grantId: string, messageId: string): Promise<MailboxMessage>;
  getThread(grantId: string, threadId: string): Promise<MailboxThread>;

  reply(input: {
    grantId: string;
    messageId: string;
    body: string;
    idempotencyKey: string;
  }): Promise<SentMessage>;

  disconnect(grantId: string): Promise<void>;
}
```

The model layer should receive application-owned `MailboxMessage` and `MailboxThread` types, not raw Nylas objects.

## Data Model

The exact collection names can follow existing project conventions. A suitable logical model is:

### Email connection

```text
emailConnections/{connectionId}
  ownerId: string
  provider: "google"
  nylasGrantId: string
  emailAddress: string
  status: "connected" | "reauth_required" | "disconnected" | "error"
  connectedAt: timestamp
  updatedAt: timestamp
  disconnectedAt?: timestamp
  lastWebhookAt?: timestamp
  lastErrorCode?: string
```

Create a uniqueness rule preventing the same Nylas grant from being attached to multiple Flux users.

### Sender allowlist

```text
emailConnections/{connectionId}/allowedSenders/{senderId}
  normalizedEmail: string
  displayEmail: string
  enabled: boolean
  createdBy: string
  createdAt: timestamp
  updatedAt: timestamp
```

Use a stable hash of `normalizedEmail` as `senderId` so adds are idempotent.

### Email event lease

```text
emailEvents/{eventId}
  connectionId: string
  nylasEventId: string
  messageId: string
  threadId?: string
  status: "queued" | "processing" | "complete" | "failed"
  outcome?: string
  attempts: number
  leaseUntil?: timestamp
  lastError?: string
  createdAt: timestamp
  updatedAt: timestamp
```

The event identifier must be unique so duplicate webhook deliveries cannot cause duplicate replies.

### Audit record

```text
emailAgentAudit/{auditId}
  connectionId: string
  messageId: string
  senderEmail: string
  decision: "ignored" | "model_called" | "reply_sent" | "failed"
  reason: string
  model?: string
  sentMessageId?: string
  createdAt: timestamp
```

Do not log complete message bodies or generated replies by default. Store identifiers, decisions, error codes, and minimal operational metadata.

## Webhook Processing Rules

The public webhook handler must:

1. Accept only the expected HTTP method.
2. Read the raw request body.
3. Verify the Nylas webhook signature before parsing or trusting the event.
4. Ignore event types outside the configured set.
5. Persist or enqueue the event using a stable idempotency key.
6. Return a successful response quickly.

The asynchronous worker must retrieve the full message from Nylas rather than trusting the webhook payload as the canonical email.

The worker should ignore a message when any of the following is true:

- The connection is missing, disconnected, or requires reauthorization.
- The message arrived before `connectedAt`.
- The event or message has already completed processing.
- The sender is not an enabled exact-address allowlist match.
- The sender is the connected Gmail account itself.
- The message is a delivery failure, vacation response, or other automatic response.
- The message is bulk/list mail not intended as a direct request.
- The message has no usable sender or body.
- The thread already contains the agent reply produced for this event.
- A configured per-sender, per-mailbox, or global rate limit has been exceeded.

At-least-once webhook delivery must be assumed. Processing therefore needs both an event lease and a deterministic send idempotency key.

## Allowlist as an Authorization Boundary

The allowlist is application authorization, not a prompt preference.

Required ordering:

```text
receive event
  -> verify Nylas signature
  -> resolve connected mailbox
  -> retrieve canonical message
  -> parse sender
  -> check allowlist
  -> only then call OpenAI
  -> check allowlist and connection again
  -> send reply
```

The model must never be asked whether a sender is allowed. It must never see messages from disallowed senders.

The server—not the model—owns:

- The authenticated sending mailbox.
- The recipient address.
- The Nylas grant ID.
- The message and thread IDs.
- Whether a reply may be sent.
- Which MCP servers and tools are available to this sender.
- Whether each requested tool call can run automatically or requires approval.
- Rate limits and maximum reply length.

For the MVP, allowlisting proves that the owner explicitly permitted an address to interact with the agent. It should not be described as cryptographic proof of the human sender's identity.

## Agent Behavior

The agent should behave like a capable general assistant over email:

- Answer questions clearly and directly.
- Use relevant context from the current email thread.
- Write in an email-appropriate style.
- Say when the supplied email does not contain enough information.
- Never claim an external action was completed when it was not.
- Treat message bodies, quoted text, signatures, and future attachments as untrusted input.
- Return only the reply body; no recipient, sender, or transport instructions.

It may answer programming or technical questions from the text supplied in the email, but it cannot inspect local repositories, open local files, execute code, control a general-purpose browser, or operate the user's computer. It may interact with remote services only through its approved MCP tools.

It can use approved remote MCP tools to read from or act on connected services. MCP access is part of the product; the security boundary is that the agent has no local filesystem or general-purpose execution environment.

### No-filesystem boundary and MCP access

Use the OpenAI Responses API with only the remote MCP servers and tool names permitted for the connected mailbox and sender. Do not provide:

- Shell or hosted-shell tools.
- Code Interpreter.
- File search or file upload tools in the MVP.
- Browser or Computer Use.
- Local filesystem access through an MCP wrapper.
- Generic HTTP, arbitrary URL-fetching, or command-execution tools.
- MCP servers that are not in Flux's trusted registry.

Set `store: false` and have Flux pass the bounded email-thread context needed for each request. This makes the application, rather than a model-side conversation object, responsible for conversation state.

Illustrative request shape:

```ts
const response = await openai.responses.create({
  model: process.env.OPENAI_EMAIL_MODEL,
  store: false,
  instructions: EMAIL_AGENT_INSTRUCTIONS,
  tools: approvedMcpServers.map((server) => ({
    type: "mcp",
    server_label: server.label,
    server_url: server.url,
    authorization: server.accessToken,
    allowed_tools: server.allowedTools,
    require_approval: server.approvalPolicy,
  })),
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: renderEmailContext({ mailbox, thread, latestMessage }),
        },
      ],
    },
  ],
});
```

`OPENAI_EMAIL_MODEL` should be an environment-controlled model choice so model changes do not require changing the email transport.

Authorization values for remote MCP servers must be loaded server-side for the mailbox owner and supplied only at execution time. They must never be placed in prompts, email replies, logs, or frontend state.

## MCP Tool Architecture

### Trusted registry

Flux should maintain a server-side registry of MCP servers it has reviewed and intentionally supports. Each registry entry should define:

- A stable server label.
- The canonical HTTPS server URL or supported connector ID.
- The service owner and trust status.
- The complete imported tool list.
- An explicit `allowed_tools` subset.
- Whether each tool is read-only, mutating, sensitive, or prohibited.
- The default approval requirement.
- Timeouts, rate limits, and maximum response size.
- The service's data-retention and privacy notes.

Email content must never be able to add a new MCP server, change a server URL, expand `allowed_tools`, or supply an authorization token.

### User-scoped MCP connections

The mailbox owner separately connects the external services they want the agent to use. Each MCP credential belongs to the Flux user, not to the allowlisted email sender.

```text
mcpConnections/{mcpConnectionId}
  ownerId: string
  registryServerId: string
  serverLabel: string
  status: "connected" | "reauth_required" | "disconnected" | "error"
  secretRef: string
  connectedAt: timestamp
  updatedAt: timestamp
```

OAuth access and refresh tokens should live in an approved secret store or encrypted credential service. `secretRef` is a reference, not the token itself.

### Per-sender tool grants

Being allowed to receive an AI email reply does not automatically grant access to the owner's connected services. Tool access needs a second, explicit permission layer:

```text
emailConnections/{connectionId}/allowedSenders/{senderId}/toolGrants/{grantId}
  mcpConnectionId: string
  allowedTools: string[]
  approvalMode: "automatic" | "owner_approval"
  enabled: boolean
  createdBy: string
  createdAt: timestamp
  updatedAt: timestamp
```

Default behavior for a newly allowlisted sender is **no MCP tools** until the mailbox owner grants them.

### Tool-call policy

Classify each supported MCP tool before exposing it:

- **Read-only, low sensitivity:** may run automatically when the owner explicitly grants it to that sender.
- **Read-only, sensitive:** requires owner approval or a narrower resource scope.
- **Reversible mutation:** requires owner approval in the MVP.
- **Irreversible, destructive, financial, security, or permission-changing:** prohibited in the MVP.

Before each Responses request, the policy engine must construct the effective MCP server and `allowed_tools` list from the owner, mailbox, and sender grants. Only preclassified low-risk read-only tools may use automatic approval. Sensitive or mutating tools must return an approval request so Flux can validate the arguments and resource scope before execution. Do not rely on the model's judgment or the MCP tool's annotations alone.

If an MCP service cannot enforce the required user and resource scopes itself, route it through a Flux-owned MCP gateway. The gateway can validate the sender-derived policy and arguments before forwarding a call to the upstream service. Email senders must never receive direct access to this gateway or its credentials.

### Approval flow

When the Responses API returns an MCP approval request:

1. Do not send a final email claiming the action occurred.
2. Persist a minimal pending-action record for the mailbox owner.
3. Show the tool name, normalized arguments, requesting sender, and expected effect in the Flux UI.
4. Let the owner approve or deny it.
5. On approval, revalidate the sender grant, tool policy, connection, and arguments.
6. Continue the Responses workflow with the approval result and the required context.
7. Audit the tool result and then generate the email reply.

Because model responses use `store: false`, Flux must preserve and replay the minimum Responses items necessary to continue an approved workflow. MCP authorization values must be supplied again for each Responses API request.

### Tool-call audit

```text
mcpToolRuns/{toolRunId}
  ownerId: string
  emailConnectionId: string
  inboundMessageId: string
  senderEmail: string
  mcpConnectionId: string
  serverLabel: string
  toolName: string
  normalizedArguments: object
  approvalMode: "automatic" | "owner_approval"
  approvalStatus: "not_required" | "pending" | "approved" | "denied"
  executionStatus: "pending" | "complete" | "failed" | "blocked"
  resultSummary?: string
  createdAt: timestamp
  completedAt?: timestamp
```

Sensitive arguments and raw tool output should be redacted or omitted from durable logs.

### Thread context

Fetch the thread through Nylas and build a bounded transcript containing:

- The subject.
- The latest incoming message.
- A limited number of recent prior messages.
- Clear role labels distinguishing the connected mailbox from the external sender.

Strip unnecessary repeated quotations and cap total context by characters or tokens. The newest message must remain intact within the configured limit.

## Safe Reply Construction

The model output is only the body text. The backend constructs the actual reply using:

- The connection's stored Nylas grant ID.
- The canonical incoming Nylas message ID.
- The original thread relationship.
- A deterministic idempotency key derived from the inbound event.

The model must not be allowed to add arbitrary recipients, CC/BCC addresses, a different From address, or provider headers.

Before sending, the worker must:

1. Confirm the connection remains active and belongs to the same Flux user.
2. Confirm the sender remains allowlisted.
3. Confirm no successful reply is already recorded for the event.
4. Enforce reply length and rate limits.
5. Send through Nylas as a reply to the canonical message.
6. Record the Nylas sent-message identifier.

## Required API Surface

Suggested Flux endpoints:

```text
POST   /api/email-connections/google/start
GET    /api/email-connections/google/callback
GET    /api/email-connections
DELETE /api/email-connections/:connectionId

GET    /api/email-connections/:connectionId/allowlist
POST   /api/email-connections/:connectionId/allowlist
DELETE /api/email-connections/:connectionId/allowlist/:senderId

GET    /api/mcp-connections
POST   /api/mcp-connections/:registryServerId/start
GET    /api/mcp-connections/:registryServerId/callback
DELETE /api/mcp-connections/:mcpConnectionId

PUT    /api/email-connections/:connectionId/allowlist/:senderId/tool-grants
GET    /api/mcp-approvals
POST   /api/mcp-approvals/:approvalId/approve
POST   /api/mcp-approvals/:approvalId/deny

POST   /api/nylas/webhook
POST   /api/nylas/worker
```

Every connection and allowlist endpoint must authenticate the Flux user and enforce ownership on the server.

## Environment and Secrets

Expected configuration:

```text
NYLAS_API_KEY
NYLAS_API_URI
NYLAS_CLIENT_ID
NYLAS_WEBHOOK_SECRET
NYLAS_OAUTH_CALLBACK_URL

OPENAI_API_KEY
OPENAI_EMAIL_MODEL

EMAIL_AGENT_TASK_QUEUE
EMAIL_AGENT_TASK_LOCATION
EMAIL_AGENT_WORKER_URL
EMAIL_AGENT_WORKER_SECRET

MCP_CREDENTIAL_ENCRYPTION_KEY
MCP_GATEWAY_URL
MCP_GATEWAY_AUTH_SECRET

GOOGLE_CLOUD_PROJECT
```

Google OAuth client credentials used by the Nylas connector should be configured in Nylas and in an approved secret store where required, never committed to the repository.

Use separate Nylas applications, OAuth callbacks, webhooks, and secrets for development and production.

## Error Handling

Expected failure classes include:

- OAuth state mismatch or expired login attempt.
- User denies Google consent.
- Nylas code exchange fails.
- Grant expires or is revoked.
- Webhook signature is invalid.
- Nylas message retrieval is temporarily unavailable.
- OpenAI generation fails or returns an empty response.
- Nylas send fails or times out.
- An MCP server is unavailable or returns an invalid response.
- An MCP credential expires or is revoked.
- A tool is requested without a sender grant.
- A tool call is waiting for owner approval.
- A retry arrives after a reply was already sent.

Transient failures should be retried by the task worker with bounded exponential backoff. Permanent failures should be recorded without repeatedly emailing the sender.

If the Google grant becomes invalid, mark the connection `reauth_required`, stop processing its messages, and show the owner a reconnect action.

Do not send an automatically generated error email unless the system can prove that doing so will not create a loop or duplicate response. For the first version, recording the failure and notifying the mailbox owner in the Flux UI is safer.

## Security and Privacy Requirements

- Keep the Nylas API key and OpenAI API key server-side.
- Validate OAuth `state` and bind it to the authenticated Flux user.
- Use HTTPS for OAuth callbacks and webhooks.
- Verify Nylas webhook signatures against the raw body.
- Authorize mailbox ownership on every connection and allowlist operation.
- Never send a disallowed message body to OpenAI.
- Set `store: false` on Responses API calls.
- Avoid storing full email bodies unless a later product requirement explicitly needs them.
- Redact message bodies and tokens from logs.
- Apply per-sender and per-mailbox rate limits.
- Cap email body size, thread context, model output length, and processing time.
- Treat all email text as untrusted prompt input.
- Use only reviewed MCP servers and explicit `allowed_tools` lists.
- Keep MCP credentials server-side and scoped to the mailbox owner.
- Maintain separate per-sender permissions for MCP tool access.
- Require owner approval for sensitive or mutating actions.
- Revalidate policy before exposing automatic tools and before approving every sensitive MCP call.
- Treat MCP tool definitions and outputs as untrusted data.
- Never allow email content to choose the MCP server URL or authorization token.
- Provide a disconnect path and remove or revoke the associated Nylas grant as appropriate.
- Maintain minimal audit metadata sufficient to investigate duplicate sends and authorization decisions.

## Implementation Phases

### Phase 1: Nylas Gmail spike

- Create a Nylas development application.
- Configure a Google provider connection using Flux's GCP project.
- Connect one explicitly approved Gmail test account.
- Read the five most recent messages through the Nylas SDK.
- Send a manual test message through the grant.
- Reply to a selected message and confirm it appears in the same Gmail thread and Sent folder.

Exit condition: one Gmail account can be connected, read, and used to send/reply entirely through Nylas.

### Phase 2: Product OAuth flow

- Add the authenticated **Connect Gmail** UI.
- Add OAuth start and callback endpoints.
- Validate state and bind the returned grant to the Flux user.
- Add connected, reconnect-required, and disconnected UI states.
- Add a safe disconnect operation.

Exit condition: a Flux user can connect and disconnect their own Gmail account without handling raw credentials.

### Phase 3: Allowlist management

- Add the per-connection allowlist schema.
- Add authenticated list, add, disable, and remove operations.
- Add a minimal management UI.
- Add exact-address normalization and uniqueness tests.

Exit condition: the mailbox owner can explicitly control which sender addresses are eligible.

### Phase 4: Webhook and worker

- Register the Nylas webhook.
- Verify signatures using the raw request body.
- Queue eligible event types.
- Add event leases and idempotency records.
- Retrieve canonical messages and threads in the worker.
- Add all ignore and loop-prevention rules.

Exit condition: new Gmail messages reliably reach the worker once, while duplicates and ineligible messages are safely ignored.

### Phase 5: MCP-enabled, no-filesystem agent

- Add the email-agent system instructions.
- Build bounded thread context from Nylas messages.
- Add the trusted MCP registry.
- Add owner-scoped MCP connection records and secrets.
- Add per-sender MCP tool grants.
- Call the Responses API with `store: false` and only the permitted remote MCP tools.
- Implement `allowed_tools` filtering and approval policies.
- Validate and audit MCP tool calls and results.
- Validate and cap the returned reply body.
- Add model timeouts and failure handling.

Exit condition: an eligible email can use one explicitly granted MCP integration and produce a useful reply, while filesystem and shell access remain unavailable.

### Phase 6: Automatic replies

- Recheck authorization immediately before send.
- Reply through the original Nylas message and grant.
- Add deterministic send idempotency.
- Record the sent-message ID and final outcome.
- Verify Gmail threading and Sent-folder behavior.

Exit condition: allowed senders receive exactly one reply from the connected Gmail account; disallowed senders receive none.

### Phase 7: Production hardening

- Complete Google OAuth production verification requirements.
- Separate development and production Nylas applications.
- Add rate limits, metrics, alerts, and structured error codes.
- Add reauthorization handling and owner notifications.
- Perform privacy, retention, and logging review.
- Run the complete acceptance matrix.

Exit condition: the flow is safe and observable enough for invited production users.

## Testing Plan

### Unit tests

- Address parsing and case-insensitive exact matching.
- No Gmail dot or plus-address rewriting.
- OAuth state generation, validation, expiration, and single use.
- Webhook signature acceptance and rejection.
- Webhook payload validation.
- Event lease acquisition and duplicate suppression.
- Self-message detection.
- Automatic-response and bulk-message filtering.
- Thread rendering and context limits.
- Model output validation and maximum length.
- Authorization recheck before send.
- Effective MCP tool-list construction for each sender.
- Denial of unregistered servers and ungranted tools.
- Read-only versus sensitive/mutating tool classification.
- MCP approval state transitions.
- Redaction of MCP credentials, arguments, and results from logs.

### Integration tests

- Nylas authorization callback creates the correct connection.
- A message from an allowed sender invokes the model.
- A message from a disallowed sender never invokes the model.
- A duplicate event never causes a duplicate model call or send.
- A revoked grant becomes `reauth_required`.
- A model failure does not send a malformed or empty reply.
- A Nylas send retry remains idempotent.
- A permitted MCP call receives only the owner's scoped credential.
- A sender cannot use another sender's MCP grants.
- An unapproved sensitive MCP call is never executed.
- An approved MCP workflow resumes correctly with `store: false`.

### Live Gmail acceptance tests

Use a dedicated Gmail test mailbox and at least two external sender addresses.

1. Connect the test Gmail account through the full OAuth flow.
2. Add sender A to the allowlist and leave sender B disallowed.
3. Send a direct plain-text email from sender A.
4. Confirm exactly one reply comes from the connected Gmail address.
5. Confirm the reply is in the original thread and appears in Sent mail.
6. Send from sender B and confirm there is no reply and no OpenAI call.
7. Redeliver the same webhook and confirm no duplicate reply.
8. Send a message from the connected account to itself and confirm it is ignored.
9. Send an automatic-response-shaped message and confirm it is ignored.
10. Remove sender A from the allowlist before the send step and confirm the second authorization check prevents the reply.
11. Revoke Google access and confirm processing stops with `reauth_required`.
12. Reconnect and confirm new eligible messages work again.
13. Ask sender A to use an MCP tool explicitly granted to sender A and confirm the call succeeds and is audited.
14. Ask sender B to use the same MCP tool and confirm no tool definition or private result is exposed.
15. Ask sender A to use a tool outside its `allowedTools` list and confirm it is blocked.
16. Trigger an owner-approval tool and confirm it does not run until the owner approves it.
17. Deny a pending tool call and confirm the email reply accurately says the action was not completed.

## MVP Acceptance Criteria

The Gmail MVP is complete when all of the following are true:

- A signed-in Flux user can connect an existing Gmail or Google Workspace account through Nylas and Google OAuth.
- Flux stores a Nylas grant associated with the correct user without exposing provider tokens to the browser.
- The owner can add and remove exact sender addresses from a per-mailbox allowlist.
- New Gmail messages arrive through a verified Nylas webhook.
- Messages from disallowed senders are ignored before any OpenAI request.
- Messages from allowed senders receive a useful reply with no filesystem or shell access.
- The agent can use an approved remote MCP tool when the mailbox owner has explicitly granted that tool to the sender.
- A sender cannot discover or call MCP tools they were not granted.
- Sensitive and mutating MCP calls cannot run without the configured owner approval.
- The server controls the sending mailbox, recipient, message ID, and thread ID.
- Replies come from the connected Gmail address, appear in Sent mail, and remain in the original thread.
- Duplicate events cannot produce duplicate replies.
- Self-mail, bounces, vacation responders, and bulk/list messages do not create reply loops.
- Revoked connections stop processing and can be reconnected.
- Logs and audit records do not contain raw tokens or full email bodies by default.

## Decisions Recorded

- **Mailbox provider:** Nylas Email API.
- **Initial provider:** Gmail and Google Workspace only.
- **Authentication:** Google OAuth through Nylas Hosted Auth.
- **Google project:** Configure the provider application in the Flux GCP project.
- **Sender authorization:** Exact per-mailbox allowlist enforced on the server.
- **Agent transport:** Reply through the same Nylas grant and original message/thread.
- **Agent capabilities:** Conversational reasoning plus approved remote MCP tools; no local filesystem, shell, code execution, or computer control.
- **MCP authorization:** Trusted server registry, owner-scoped credentials, and explicit per-sender tool grants.
- **MCP approvals:** Sensitive and mutating tools require owner approval; prohibited tools are never exposed.
- **Model API:** OpenAI Responses API with `store: false`.
- **Inbox monitoring:** Nylas webhooks plus an asynchronous idempotent worker.
- **Future providers:** Deferred, but the mailbox adapter should preserve the option.

## Reference Documentation

- [Nylas Email API product](https://www.nylas.com/products/email-api/)
- [Nylas Email API quickstart](https://developer.nylas.com/docs/v3/getting-started/email/)
- [Share an existing email account with an agent](https://developer.nylas.com/docs/v3/getting-started/agent-email/)
- [Nylas authentication](https://developer.nylas.com/docs/v3/auth/)
- [Nylas Google provider guide](https://developer.nylas.com/docs/provider-guides/google/)
- [Nylas webhook guide](https://developer.nylas.com/docs/v3/notifications/?redirect=webhooks)
- [Nylas message sending](https://developer.nylas.com/docs/v3/email/send-email/)
- [OpenAI Responses API migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [OpenAI MCP and connectors guide](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
