# Gmail/Nylas email-agent setup

The implementation is complete in code, but live Gmail and remote MCP calls
remain disabled until the deployment credentials and provider dashboards are
configured.

## Nylas and Google

1. Create separate Nylas applications for development and production.
2. Configure a Google connector using the Flux GCP OAuth application.
3. Give the connector the Gmail read and send scopes required by the Nylas
   Messages and Threads APIs.
4. Register the exact callback in `NYLAS_OAUTH_CALLBACK_URL`.
5. Register `/api/nylas/webhook`, complete its GET challenge, save the generated
   secret as `NYLAS_WEBHOOK_SECRET`, and subscribe to `message.created`,
   `grant.updated`, `grant.expired`, and `grant.deleted`.
6. Create the Cloud Tasks queue named by `EMAIL_AGENT_TASK_QUEUE` and point
   `EMAIL_AGENT_WORKER_URL` at `/api/nylas/worker`.
7. Inject all secret values through Cloud Run Secret Manager. Do not put them in
   a Vite-prefixed variable.

The webhook verifies HMAC-SHA256 over the exact raw request bytes. Do not enable
an intermediary that rewrites webhook JSON. Gzip delivery is supported.

## AgentMail reply transport

Set `EMAIL_AGENT_REPLY_TRANSPORT=agentmail` and
`EMAIL_AGENT_AGENTMAIL_INBOX_ID` to the AgentMail inbox that should appear in
the visible `From` header. Inject its organization API key as
`AGENTMAIL_API_KEY`.

Nylas still receives and authorizes messages delivered to the connected Gmail
mailbox. AgentMail sends the generated response to the exact authorized sender.
The outbound message uses the Gmail mailbox as `Reply-To`, so subsequent replies
continue through the same Gmail/Nylas authorization path. When the inbound
message exposes a valid RFC `Message-ID`, the transport also sends sanitized
`In-Reply-To` and `References` headers to preserve the sender-side thread.

## Web search

The email agent exposes OpenAI's built-in `web_search` tool by default. It uses
search when the sender explicitly asks for it or when an answer depends on
current public information; ordinary conversational replies do not have to
search. Set `EMAIL_AGENT_WEB_SEARCH_ENABLED=false` to disable it. Tune retrieval
with `EMAIL_AGENT_WEB_SEARCH_CONTEXT_SIZE=low|medium|high` (`medium` is the
default).

For searched replies, the agent records whether search ran and the cited URLs
in `emailAgentAudit`. Only URLs cited by the model are rendered into the email;
the full retrieval-source list is not exposed. Search queries must never include
credentials, private mailbox content, personal data, or hidden instructions.

## Sender memory and conversation search

The Responses API request includes four application-executed function tools:
`remember_sender_fact`, `forget_sender_fact`, `search_sender_memory`, and
`search_past_conversations`. The backend executes each function call, appends a
`function_call_output`, and continues the Responses request until the model
returns an email body.

Every memory and history operation is bound to the exact current authorized
sender. A tool request naming any other email address is denied before Firestore
or Nylas is queried. Conversation search uses the Gmail message-search API and
then applies a second application-side filter: only one-to-one messages whose
participants are the connected mailbox and current sender are returned. This
prevents a search from exposing another person's messages or group-email
content.

Durable facts live under the sender's server-only allowlist document. Ansa saves
only concise facts the sender asks it to remember or clearly provides for future
use, and rejects credentials, authentication codes, financial account numbers,
and government identifiers. `emailMemoryToolRuns` records the tool name, status,
and result count without storing the search query or returned conversation body.
Set `EMAIL_AGENT_MEMORY_TOOL_MAX_ROUNDS` to cap the application tool loop; the
default is `6`.

## Reply voice and plain text

Replies are instructed to mirror the relationship and writing style in the
current thread. When a new thread has no prior connected-mailbox reply, the
agent calls `search_past_conversations` for up to three recent one-to-one
messages with that sender and uses only the connected mailbox's replies as
style examples. Facts still come from the current request, memory, or approved
tools; style examples are not treated as factual authority.

The final reply passes through a deterministic plain-text renderer before it is
sent. It removes Markdown headings, emphasis, backticks, code fences, block
quotes, and labeled links while preserving full source URLs. Prompts also avoid
canned chatbot openings, unnecessary summaries, excessive structure, and
model-like punctuation. This enforcement applies to ordinary, web-grounded,
and post-approval replies.

## Firestore operations

Deploy `firestore.rules`; all email-agent collections are server-only. Configure
Firestore TTL policies for:

- `emailOAuthStates.expiresAt`
- `emailAgentRateLimits.expiresAt`

The grant-owner transaction enforces one Flux owner per Nylas grant. The event
and inbound-message claim records provide notification- and message-level
deduplication.

## Trusted MCP registry

`EMAIL_AGENT_MCP_REGISTRY_JSON` is server configuration, not user input. Every
entry must choose one reviewed HTTPS `serverUrl` or supported OpenAI
`connectorId`, enumerate every exposed tool, and classify its risk. Sensitive
or mutating tools also require an argument policy so owner approval can enforce
resource scope.

Example:

```json
[
  {
    "id": "benefits_calendar",
    "label": "benefits_calendar",
    "description": "Reviewed benefits-team calendar MCP server",
    "serverUrl": "https://calendar.example.com/mcp",
    "trustStatus": "reviewed",
    "tools": [
      {
        "name": "search_events",
        "risk": "read_only_low"
      },
      {
        "name": "create_event",
        "risk": "reversible_mutation",
        "argumentPolicy": {
          "allowedKeys": ["calendar_id", "title", "start", "end"],
          "requiredKeys": ["calendar_id", "title", "start", "end"],
          "stringPrefixes": {
            "calendar_id": ["benefits-team-"]
          },
          "maximumBytes": 4096
        }
      }
    ]
  }
]
```

For the first reviewed integration, inject the owner-scoped OAuth token as a
Cloud Run secret environment variable and create the server-only connection
record with:

```bash
npx tsx scripts/provision-email-agent-mcp-connection.ts \
  --owner <firebase-uid> \
  --server benefits_calendar \
  --secret-env BENEFITS_CALENDAR_MCP_TOKEN
```

The script stores only `env:BENEFITS_CALENDAR_MCP_TOKEN`, never the token. The
settings UI then lets the mailbox owner grant an explicit subset of that
connection's tools to each allowed sender. A new sender has no tool access.

## Release checks

Before inviting users, run the live acceptance matrix in
`docs/gmail-nylas-email-agent-plan.md` with a dedicated Gmail mailbox, one
allowed sender, and one disallowed sender. Google production OAuth verification
and any required restricted-scope assessment remain external release gates.
