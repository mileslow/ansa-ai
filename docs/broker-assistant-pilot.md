# Broker email assistant — pilot checklist (iteration 1)

Branch: `feat/broker-email-assistant`  
Flags default **off** — safe for prod until explicitly enabled.

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

## Pilot steps

1. Run app on this branch (not `main`).
2. Open Booklet Studio → **Settings** → **Ansa Assistant**.
3. **Continue with Google** (durable identity).
4. **Connect Gmail** → approve modify/compose scopes → return with `?assistant=connected`.
5. **Turn on** assistant (registers `users.watch`).
6. Ensure 1–2 companies exist in Ansa with plan details / library files.
7. From another account, email the broker a client-style benefits question naming the employer.
8. Confirm Ansa creates a **draft** reply (not sent).
9. If company unknown / low confidence: draft is a researching ack + item under **Needs research**.
10. **Pause** stops new drafts; reconnect/disable as needed.

## Not in this pilot

- Auto-send
- Outlook
- Desktop file pickup
- Carrier website scraping

## Next iteration hooks

See `lib/broker-assistant/future-connectors.ts` (`desktop`, `carrier_web`).
