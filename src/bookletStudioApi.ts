import type {
  BookletGenerationRun,
  BookletSectionArtifact,
  ExtractedFact,
  PipelineEvent,
  UploadedFile,
} from "../lib/booklet-types";
import { getBookletAuthToken } from "./firebase";

export type IntakeCategory =
  | "employer"
  | "rates"
  | "documents"
  | "template"
  | "census"
  | "instructions";

export type EncodedUpload = {
  fileName: string;
  mimeType: string;
  base64: string;
  intakeCategory?: IntakeCategory;
};

export type BookletThreadRecord = {
  id: string;
  companyId: string;
  ownerId: string;
  uploadedFileIds: string[];
  latestRunId?: string | null;
};

export type StatusPayload = {
  thread?: BookletThreadRecord;
  files?: UploadedFile[];
  run: BookletGenerationRun | null;
  events: PipelineEvent[];
  facts: ExtractedFact[];
  sections: BookletSectionArtifact[];
};

export type StreamMessage =
  | { type: "run"; run: BookletGenerationRun }
  | { type: "event"; event: PipelineEvent }
  | { type: "section"; section: BookletSectionArtifact }
  | { type: "result"; run: BookletGenerationRun }
  | { type: "error"; error: string };

type CreateThreadInput = {
  companyId: string;
  message?: string;
  messageAsEvidence?: boolean;
  websiteUrl?: string;
  files?: EncodedUpload[];
  fileIds?: string[];
};

type AddMessageInput = Omit<CreateThreadInput, "companyId"> & { threadId: string };
type JsonRecord = Record<string, unknown>;

const supportedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "message/rfc822",
  "text/plain",
]);

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  eml: "message/rfc822",
  txt: "text/plain",
};

function uploadMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return supportedMimeTypes.has(file.type) ? file.type : mimeByExtension[extension];
}

export async function encodeFile(file: File): Promise<EncodedUpload> {
  const mimeType = uploadMimeType(file);
  if (!mimeType) throw new Error(`${file.name} is not a supported source file`);
  if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} exceeds 50 MiB`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return { fileName: file.name, mimeType, base64: btoa(binary) };
}

async function headers() {
  if (import.meta.env.DEV)
    return { "Content-Type": "application/json" };
  return {
    Authorization: `Bearer ${await getBookletAuthToken()}`,
    "Content-Type": "application/json",
  };
}

async function apiRequest<T>(body: JsonRecord): Promise<T> {
  const response = await fetch("/api/booklet-pipeline", {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok && response.status !== 202)
    throw new Error(payload.error || `Booklet Studio request failed (${response.status})`);
  return payload;
}

async function streamRequest(
  body: JsonRecord,
  onMessage?: (message: StreamMessage) => void,
): Promise<BookletGenerationRun> {
  const response = await fetch("/api/booklet-pipeline", {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!response.ok && response.status !== 202) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `Booklet generation failed (${response.status})`);
  }
  if (!response.body) throw new Error("The booklet event stream is unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: BookletGenerationRun | null = null;
  const consume = (line: string) => {
    const message = JSON.parse(line) as StreamMessage;
    onMessage?.(message);
    if (message.type === "error")
      throw new Error(message.error || "Booklet generation failed");
    if (message.type === "result") result = message.run;
  };
  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop() || "";
    for (const line of lines) if (line.trim()) consume(line);
    if (done) break;
  }
  if (pending.trim()) consume(pending);
  if (!result) throw new Error("The booklet run ended without a result");
  return result;
}

export const bookletStudioApi = {
  createThread: (input: CreateThreadInput) =>
    apiRequest<{
      thread: BookletThreadRecord;
      files: UploadedFile[];
      websiteProfile?: Record<string, unknown> | null;
    }>({ action: "create_thread", ...input }),
  addMessage: (input: AddMessageInput) =>
    apiRequest<{
      files: UploadedFile[];
      websiteProfile?: Record<string, unknown> | null;
    }>({ action: "add_message", ...input }),
  deleteFile: (input: { threadId: string; fileId: string }) =>
    apiRequest<{
      thread: BookletThreadRecord;
      files: UploadedFile[];
      deletedFileId: string;
    }>({ action: "delete_file", ...input }),
  start: (
    input: { threadId: string; fileIds?: string[] },
    onMessage?: (message: StreamMessage) => void,
  ) => streamRequest({ action: "start", ...input }, onMessage),
  answer: (
    input: {
      runId: string;
      questionId?: string;
      fieldPath?: string;
      answer?: unknown;
      answers?: Record<string, unknown>;
    },
    onMessage?: (message: StreamMessage) => void,
  ) => streamRequest({ action: "answer", ...input }, onMessage),
  status: (runId: string) =>
    apiRequest<StatusPayload>({ action: "status", runId }),
  threadStatus: (threadId: string) =>
    apiRequest<StatusPayload>({ action: "thread_status", threadId }),
};
