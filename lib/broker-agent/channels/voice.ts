import OpenAI, { toFile } from "openai";
import { isBrokerVoiceBetaEnabled } from "../flags";
import type { AgentTurn } from "../types";
import type { ChannelAdapter, NormalizedInbound, OutboundPayload } from "./types";

function openAIClient() {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function transcribeAudio(audioBase64: string, mimeType = "audio/webm") {
  if (!isBrokerVoiceBetaEnabled())
    throw new Error("Voice beta is disabled (set BROKER_VOICE_BETA=1)");
  const buffer = Buffer.from(audioBase64, "base64");
  if (!buffer.length) throw new Error("Audio payload is empty");
  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mpeg") || mimeType.includes("mp3")
      ? "mp3"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";
  const file = await toFile(buffer, `broker-turn.${ext}`, { type: mimeType });
  const result = await openAIClient().audio.transcriptions.create({
    file,
    model: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
  });
  return String(result.text || "").trim();
}

export async function synthesizeSpeech(text: string) {
  if (!isBrokerVoiceBetaEnabled()) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const response = await openAIClient().audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: (process.env.OPENAI_TTS_VOICE as "alloy") || "alloy",
    input: trimmed.slice(0, 4_000),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType: "audio/mpeg",
    base64: buffer.toString("base64"),
    dataUrl: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
  };
}

export async function normalizeVoiceInbound(raw: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
}): Promise<NormalizedInbound> {
  let text = String(raw.text || "").trim();
  if (!text && raw.audioBase64) {
    text = await transcribeAudio(raw.audioBase64, raw.mimeType);
  }
  if (!text) throw new Error("Voice turn requires text or audio");
  const turn: AgentTurn = {
    kind: "voice_transcript",
    text,
    ...(raw.audioBase64 ? { audioBase64: raw.audioBase64, mimeType: raw.mimeType } : {}),
  };
  return { turn, channel: "voice" };
}

export const voiceChannelAdapter: ChannelAdapter = {
  id: "voice",
  normalizeInbound: (raw) =>
    normalizeVoiceInbound(raw as { text?: string; audioBase64?: string; mimeType?: string }),
  async emitOutbound(_payload: OutboundPayload) {
    // Voice outbound is returned on the turn response (audioUrl), not pushed.
  },
};
