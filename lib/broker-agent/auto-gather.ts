import { getBookletThread } from "../booklet-thread-store";
import { fetchSourceHit, searchAllSources } from "./sources";
import type { SourceHit } from "./sources/types";
import type { AgentSession, BookletPreferences } from "./types";
import { executeBrokerTool } from "./tools/registry";

const BOOKLET_INTENT =
  /\b(?:create|generate|make|build|produce|draft|prepare|put together|need|want)\b[\s\S]{0,80}\b(?:employee\s+)?benefits?\s+(?:booklet|guide|packet)\b|\b(?:employee\s+)?benefits?\s+(?:booklet|guide|packet)\b/i;

const PLAN_YEAR = /\b(20\d{2})\b/;

const TONE =
  /\b(concise|formal|friendly|simple|plain language|professional|brief|detailed)\b/i;

export function looksLikeBookletRequest(text: string) {
  return BOOKLET_INTENT.test(text);
}

export function extractGatherContext(text: string, companyDisplayName?: string) {
  const planYear = text.match(PLAN_YEAR)?.[1];
  const employerName =
    companyDisplayName ||
    text.match(/\bfor\s+([A-Z][A-Za-z0-9&.'-]{1,48})\b/)?.[1] ||
    text.match(/\b([A-Z][A-Za-z0-9&.'-]{2,48})(?:'s)?\s+(?:20\d{2}\s+)?benefits?\b/)?.[1];

  const keywords = [
    ...(employerName ? [employerName] : []),
    ...(planYear ? [planYear] : []),
    "rate",
    "SBC",
    "SPD",
    "renewal",
    "booklet",
    "benefits",
  ].filter(Boolean);

  return { employerName, planYear, keywords };
}

export function extractPreferencesFromSpeech(text: string): BookletPreferences {
  const prefs: BookletPreferences = { extraInstructions: text.trim() };
  const tone = text.match(TONE)?.[1];
  if (tone) prefs.tone = tone.toLowerCase();

  const omitMatch = text.match(
    /\b(?:skip|omit|exclude|leave out|without)\s+(?:the\s+)?([a-z][a-z\s-]{2,40})/i,
  );
  if (omitMatch?.[1]) {
    prefs.omitSections = [omitMatch[1].trim().toLowerCase()];
  }

  if (/\bappendix\b/i.test(text) && /\b(no|skip|omit|without)\b/i.test(text)) {
    prefs.appendix = false;
  } else if (/\bappendix\b/i.test(text)) {
    prefs.appendix = true;
  }

  return prefs;
}

function scoreHit(hit: SourceHit) {
  const haystack = `${hit.title} ${hit.snippet || ""} ${hit.fileName || ""}`.toLowerCase();
  let score = 0;
  if (/booklet|benefits guide|prior/.test(haystack)) score += 5;
  if (/rate|renewal|spreadsheet|xlsx|csv/.test(haystack)) score += 4;
  if (/sbc|spd|summary|plan/.test(haystack)) score += 3;
  if (hit.mimeType === "application/pdf") score += 2;
  if (hit.connectorId === "ansa_library") score += 1;
  if (hit.connectorId === "gmail" || hit.connectorId === "outlook") score += 1;
  return score;
}

function pickHits(hits: SourceHit[], limit = 8) {
  return [...hits]
    .sort((a, b) => scoreHit(b) - scoreHit(a))
    .slice(0, limit);
}

export async function autoGatherSources({
  session,
  message,
  companyDisplayName,
}: {
  session: AgentSession;
  message: string;
  companyDisplayName?: string;
}) {
  const thread = await getBookletThread(session.bookletThreadId);
  if (!thread) throw new Error("Booklet thread was not found");

  const context = extractGatherContext(message, companyDisplayName);
  const hits = await searchAllSources({
    ownerId: session.ownerId,
    companyId: session.companyId,
    employerName: context.employerName,
    planYear: context.planYear,
    keywords: context.keywords,
    limit: 20,
    connectionIds: session.mailboxConnectionIds,
  });

  const selected = pickHits(hits);
  if (!selected.length) {
    return {
      session,
      gathered: [] as Array<{ id: string; fileName: string; sourceKind?: string }>,
      searched: hits.length,
    };
  }

  const attached = await executeBrokerTool(
    "attach_sources",
    { hitIds: selected.map((hit) => hit.id) },
    {
      session,
      assertOwner: () => {
        if (!session.ownerId) throw new Error("Session has no owner");
      },
    },
  );

  const gathered =
    attached.toolResult.ok &&
    attached.toolResult.result &&
    typeof attached.toolResult.result === "object" &&
    "attached" in (attached.toolResult.result as object)
      ? ((attached.toolResult.result as { attached: Array<{ id: string; fileName: string; sourceKind?: string }> })
          .attached || [])
      : [];

  return {
    session: attached.session,
    gathered,
    searched: hits.length,
    selectedTitles: selected.map((hit) => hit.title),
  };
}

export async function applySpeechPreferences(session: AgentSession, message: string) {
  const prefs = extractPreferencesFromSpeech(message);
  const hasStructured =
    Boolean(prefs.tone) ||
    Boolean(prefs.omitSections?.length) ||
    typeof prefs.appendix === "boolean";
  if (!hasStructured && !looksLikeBookletRequest(message)) return session;

  const executed = await executeBrokerTool(
    "set_booklet_preferences",
    {
      ...(prefs.tone ? { tone: prefs.tone } : {}),
      ...(prefs.omitSections?.length ? { omitSections: prefs.omitSections } : {}),
      ...(typeof prefs.appendix === "boolean" ? { appendix: prefs.appendix } : {}),
      ...(message.trim() ? { extraInstructions: message.trim() } : {}),
    },
    {
      session,
      assertOwner: () => {
        if (!session.ownerId) throw new Error("Session has no owner");
      },
    },
  );
  return executed.session;
}

export async function maybePrepareBookletSession({
  session,
  message,
  companyDisplayName,
}: {
  session: AgentSession;
  message: string;
  companyDisplayName?: string;
}) {
  const thread = await getBookletThread(session.bookletThreadId);
  const needsSources = !thread?.uploadedFileIds.length;
  const bookletAsk = looksLikeBookletRequest(message);

  let current = session;
  const speechPrefs = extractPreferencesFromSpeech(message);
  const hasStructured =
    Boolean(speechPrefs.tone) ||
    Boolean(speechPrefs.omitSections?.length) ||
    typeof speechPrefs.appendix === "boolean";
  if (bookletAsk || hasStructured) {
    current = await applySpeechPreferences(current, message);
  }

  if (!needsSources && !bookletAsk) {
    return { session: current, autoGather: null as null | Awaited<ReturnType<typeof autoGatherSources>> };
  }

  const autoGather = await autoGatherSources({
    session: current,
    message,
    companyDisplayName,
  });
  return { session: autoGather.session, autoGather };
}
