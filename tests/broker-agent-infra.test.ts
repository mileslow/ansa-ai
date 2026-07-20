import { createHash } from "node:crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isBrokerVoiceBetaEnabled,
  isMailboxOAuthEnabled,
} from "../lib/broker-agent/flags";
import { normalizeChatInbound } from "../lib/broker-agent/channels/chat";
import { normalizeEmailInbound } from "../lib/broker-agent/channels/email";
import { brokerTools, getToolByName } from "../lib/broker-agent/tools/registry";
import {
  buildOAuthState,
  parseOAuthState,
  encryptSecret,
  decryptSecret,
} from "../lib/broker-agent/sources/mailbox-tokens";
import {
  isBenefitsBookletRequest,
  isSupportedAgentAttachment,
  formatBookletQuestions,
} from "../lib/agentmail-email-agent";
import type { BlockerQuestion } from "../lib/booklet-types";

describe("broker agent feature flags", () => {
  const originalVoice = process.env.BROKER_VOICE_BETA;
  const originalMailbox = process.env.BROKER_MAILBOX_OAUTH;

  afterEach(() => {
    if (originalVoice === undefined) delete process.env.BROKER_VOICE_BETA;
    else process.env.BROKER_VOICE_BETA = originalVoice;
    if (originalMailbox === undefined) delete process.env.BROKER_MAILBOX_OAUTH;
    else process.env.BROKER_MAILBOX_OAUTH = originalMailbox;
  });

  it("keeps voice and mailbox OAuth off by default", () => {
    delete process.env.BROKER_VOICE_BETA;
    delete process.env.BROKER_MAILBOX_OAUTH;
    expect(isBrokerVoiceBetaEnabled()).toBe(false);
    expect(isMailboxOAuthEnabled()).toBe(false);
  });

  it("enables flags when set to 1", () => {
    process.env.BROKER_VOICE_BETA = "1";
    process.env.BROKER_MAILBOX_OAUTH = "1";
    expect(isBrokerVoiceBetaEnabled()).toBe(true);
    expect(isMailboxOAuthEnabled()).toBe(true);
  });
});

describe("broker agent channels", () => {
  it("normalizes chat text turns", () => {
    const inbound = normalizeChatInbound({ text: " Build a booklet for Acme " });
    expect(inbound.channel).toBe("chat");
    expect(inbound.turn.kind).toBe("text");
    expect(inbound.turn.text).toBe("Build a booklet for Acme");
  });

  it("normalizes email subject and body", () => {
    const inbound = normalizeEmailInbound({
      subject: "Acme guide",
      body: "Please generate the benefits booklet.",
    });
    expect(inbound.channel).toBe("email");
    expect(inbound.turn.text).toContain("Subject: Acme guide");
    expect(inbound.turn.text).toContain("Please generate the benefits booklet.");
  });
});

describe("broker agent tools registry", () => {
  it("exposes the planned tool surface", () => {
    const names = brokerTools.map((tool) => tool.name).sort();
    expect(names).toEqual(
      [
        "add_spoken_instructions",
        "answer_blockers",
        "attach_library_file_ids",
        "attach_sources",
        "confirm_send_booklet_email",
        "connect_mailbox_status",
        "get_run_status",
        "propose_email",
        "resume_booklet_run",
        "search_sources",
        "set_booklet_preferences",
        "start_booklet_run",
      ].sort(),
    );
  });

  it("resolves tools by name", () => {
    expect(getToolByName("search_sources")?.name).toBe("search_sources");
    expect(getToolByName("missing_tool")).toBeNull();
  });
});

describe("mailbox token helpers", () => {
  beforeEach(() => {
    process.env.MAILBOX_TOKEN_SECRET = "test-mailbox-token-secret-32b";
  });

  it("round-trips encrypted secrets", () => {
    const enc = encryptSecret("refresh-token-value");
    expect(decryptSecret(enc)).toBe("refresh-token-value");
  });

  it("signs and parses OAuth state", () => {
    const state = buildOAuthState({
      ownerId: "user-1",
      provider: "gmail",
      returnTo: "/studio",
    });
    const parsed = parseOAuthState(state);
    expect(parsed.ownerId).toBe("user-1");
    expect(parsed.provider).toBe("gmail");
    expect(parsed.returnTo).toBe("/studio");
  });

  it("rejects tampered OAuth state", () => {
    const state = buildOAuthState({ ownerId: "user-1", provider: "outlook" });
    const [body] = state.split(".");
    expect(() => parseOAuthState(`${body}.tampered`)).toThrow(/signature/i);
  });
});

describe("source hit id conventions", () => {
  it("uses stable prefixes for connectors", () => {
    expect("ansa_library:file:abc".startsWith("ansa_library:")).toBe(true);
    expect("gmail:conn:msg".startsWith("gmail:")).toBe(true);
    expect("outlook:conn:msg".startsWith("outlook:")).toBe(true);
    const digest = createHash("sha256").update("owner:gmail").digest("hex").slice(0, 8);
    expect(digest).toHaveLength(8);
  });
});

describe("auto gather helpers", () => {
  it("detects booklet intent without requiring email mentions", async () => {
    const { looksLikeBookletRequest, extractGatherContext, extractPreferencesFromSpeech } =
      await import("../lib/broker-agent/auto-gather");
    expect(looksLikeBookletRequest("Build Acme's 2026 benefits booklet")).toBe(true);
    expect(looksLikeBookletRequest("What is an HSA?")).toBe(false);
    const ctx = extractGatherContext("Build Acme's 2026 benefits booklet", "Acme Corp");
    expect(ctx.planYear).toBe("2026");
    expect(ctx.employerName).toBe("Acme Corp");
    const prefs = extractPreferencesFromSpeech("Keep it concise and skip voluntary life");
    expect(prefs.tone).toBe("concise");
    expect(prefs.omitSections?.[0]).toContain("voluntary");
  });
});

describe("voice channel gating", () => {
  const originalVoice = process.env.BROKER_VOICE_BETA;

  afterEach(() => {
    if (originalVoice === undefined) delete process.env.BROKER_VOICE_BETA;
    else process.env.BROKER_VOICE_BETA = originalVoice;
  });

  it("rejects audio transcription when voice beta is off", async () => {
    delete process.env.BROKER_VOICE_BETA;
    const { transcribeAudio } = await import("../lib/broker-agent/channels/voice");
    await expect(transcribeAudio("AAAA")).rejects.toThrow(/Voice beta is disabled/i);
  });

  it("normalizes voice transcript text without requiring the flag", async () => {
    const { normalizeVoiceInbound } = await import("../lib/broker-agent/channels/voice");
    const inbound = await normalizeVoiceInbound({
      text: "Use last year's Anthem rates for Acme",
    });
    expect(inbound.channel).toBe("voice");
    expect(inbound.turn.kind).toBe("voice_transcript");
    expect(inbound.turn.text).toContain("Anthem");
  });
});

describe("AgentMail parity helpers still work via shared broker tools", () => {
  it("recognizes booklet requests and attachment types", () => {
    expect(
      isBenefitsBookletRequest(
        "2026 guide",
        "Please generate an employee benefits booklet from the attached files.",
      ),
    ).toBe(true);
    expect(isSupportedAgentAttachment("rates.xlsx")).toBe(true);
  });

  it("formats follow-up questions for email replies", () => {
    const question: BlockerQuestion = {
      id: "q1",
      fieldPath: "planYear.start",
      question: "When does the plan year start?",
      reason: "Missing",
      sourceRefs: [],
      blocking: true,
    };
    expect(formatBookletQuestions([question])).toContain("When does the plan year start?");
  });
});
