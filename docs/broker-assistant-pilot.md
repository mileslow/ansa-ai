# Broker email assistant — pilot checklist (iteration 1)

Branch: `feat/broker-email-assistant`  
Flags default **off** — safe for prod until explicitly enabled.

> **TODO before the pilot can run:** create the Gmail pieces in Google Cloud
> Console (project `flux-ebfb0`) — an OAuth web client
> (`GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET`, redirect URI
> `http://127.0.0.1:5175/api/mailbox/oauth/callback`, Gmail API enabled) and a
> Pub/Sub topic (`GMAIL_PUBSUB_TOPIC`) with `gmail-api-push@system.gserviceaccount.com`
> as publisher. Everything else in local `.env` is already filled in.

## Env (non-prod / pilot)

```
BROKER_ASSISTANT_EMAIL=1
BROKER_MAILBOX_OAUTH=1
OPENAI_API_KEY=...
GMAIL_OAUTH_CLIENT_ID=...
GMAIL_OAUTH_CLIENT_SECRET=...
GMAIL_OAUTH_REDIRECT_URI=https://<host>/api/mailbox/oauth/callback
GMAIL_PUBSUB_TOPIC=projects/<project>/topics/<topic>
MAILBOX_TOKEN_SECRET=...   # or AGENTMAIL_WORKER_SECRET
# Optional Cloud Tasks (else worker runs inline):
BROKER_ASSISTANT_TASK_QUEUE=...
BROKER_ASSISTANT_WORKER_URL=https://<host>/api/broker-assistant/worker
BROKER_ASSISTANT_WORKER_SECRET=...
```

Firebase: enable **Google** sign-in provider for the web app.

Gmail Pub/Sub: create topic + push subscription → `POST /api/broker-assistant/gmail-push`.

## How it behaves

- **Confident answer** (company matched, confidence ≥ 0.7): Ansa **sends the reply
  to the client automatically**. The broker does nothing.
- **Not confident**: Ansa
  1. auto-sends the client a short "confirming details, will follow up" ack,
  2. emails the broker (`[Ansa needs your OK] …`) with the question it has, the
     proposed reply, and instructions, and
  3. waits. The broker replies in that thread with **Approve** (send proposed
     reply), **Deny** (do nothing), or just types the answer (Ansa sends that to
     the client instead).
- Pending items also show under **Waiting on you** in Settings → Ansa Assistant,
  with a deep link to the Gmail thread.

## Pilot steps

1. Run app on this branch (not `main`).
2. Open Booklet Studio → **Settings** → **Ansa Assistant**.
3. **Continue with Google** (durable identity).
4. **Connect Gmail** → approve modify/compose scopes → return with `?assistant=connected`.
5. **Turn on** assistant (registers `users.watch`).
6. Ensure 1–2 companies exist in Ansa with plan details / library files.
7. From another account, email the broker a client-style benefits question naming the employer.
8. Confident case: confirm the reply is **auto-sent** in the client thread.
9. Low-confidence case (unknown company / missing facts): confirm the client got
   an ack, the broker got an `[Ansa needs your OK]` email, and reply **Approve**
   / **Deny** / a custom answer to see each path resolve.
10. **Pause** stops new processing; reconnect/disable as needed.

## Not in this pilot

- Outlook
- Desktop file pickup
- Carrier website scraping

## Next iteration hooks

See `lib/broker-assistant/future-connectors.ts` (`desktop`, `carrier_web`).
