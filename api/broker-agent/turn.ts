import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertOwner, BookletAuthError, requireBookletUser } from "../../lib/booklet-auth";
import {
  createAgentSession,
  getAgentSession,
  handleTurn,
  isBrokerVoiceBetaEnabled,
  listActiveMailboxConnections,
  normalizeChatInbound,
  normalizeVoiceInbound,
} from "../../lib/broker-agent";

export const config = { maxDuration: 300, includeFiles: "lib/**" };

const validId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);

function writeNdjson(res: VercelResponse, event: unknown) {
  res.write(`${JSON.stringify(event)}\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await requireBookletUser(req);
    const body = (req.body || {}) as Record<string, unknown>;
    const companyId = String(body.companyId || "");
    if (!validId(companyId)) {
      res.status(400).json({ error: "companyId is required" });
      return;
    }

    const wantsVoice =
      Boolean(body.audioBase64) || body.channel === "voice" || body.kind === "voice";
    if (wantsVoice && !isBrokerVoiceBetaEnabled()) {
      res.status(403).json({
        error: "Voice beta is disabled. Set BROKER_VOICE_BETA=1 to enable.",
      });
      return;
    }

    let session = body.sessionId ? await getAgentSession(String(body.sessionId)) : null;
    if (session) {
      assertOwner(session.ownerId, user.uid);
      if (session.companyId !== companyId)
        throw new BookletAuthError("Session belongs to another company", 403);
    } else {
      const connections = await listActiveMailboxConnections(user.uid);
      session = await createAgentSession({
        ownerId: user.uid,
        companyId,
        channel: wantsVoice ? "voice" : "chat",
        bookletThreadId: body.bookletThreadId
          ? String(body.bookletThreadId)
          : undefined,
        mailboxConnectionIds: connections.map((c) => c.id),
        preferences: body.companyName
          ? { brandingNotes: String(body.companyName) }
          : {},
      });
    }

    const companyDisplayName = String(
      body.companyName || session.preferences.brandingNotes || "",
    ).trim() || undefined;

    const inbound = wantsVoice
      ? await normalizeVoiceInbound({
          text: body.text ? String(body.text) : undefined,
          audioBase64: body.audioBase64 ? String(body.audioBase64) : undefined,
          mimeType: body.mimeType ? String(body.mimeType) : undefined,
        })
      : normalizeChatInbound({ text: String(body.text || body.message || "") });

    const stream = body.stream === true || body.stream === "true" || body.stream === "1";
    if (stream) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      const result = await handleTurn({
        session,
        turn: inbound.turn,
        channel: inbound.channel,
        companyDisplayName,
        onEvent: async (event) => writeNdjson(res, event),
      });
      writeNdjson(res, {
        type: "result",
        sessionId: result.session.id,
        assistantText: result.assistantText,
        audioUrl: result.audioUrl || null,
        status: result.session.status,
        bookletRunId: result.session.bookletRunId || null,
        pendingEmailSend: result.session.pendingEmailSend || null,
      });
      res.end();
      return;
    }

    const result = await handleTurn({
      session,
      turn: inbound.turn,
      channel: inbound.channel,
      companyDisplayName,
    });
    res.status(200).json({
      sessionId: result.session.id,
      assistantText: result.assistantText,
      audioUrl: result.audioUrl || null,
      events: result.events,
      status: result.session.status,
      bookletRunId: result.session.bookletRunId || null,
      pendingEmailSend: result.session.pendingEmailSend || null,
      preferences: result.session.preferences,
    });
  } catch (error) {
    if (error instanceof BookletAuthError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Broker agent turn failed";
    console.error("broker-agent turn failed", { error });
    res.status(500).json({ error: message });
  }
}
