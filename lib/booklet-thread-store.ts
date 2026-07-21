import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "./firebase-admin";
import type {
  BookletGenerationRun,
  BookletSectionArtifact,
  ExtractedFact,
  LoadedUploadedFile,
  PipelineEvent,
  UploadedFile,
} from "./booklet-types";

export type BookletThread = {
  id: string;
  companyId: string;
  ownerId: string;
  status: "open" | "processing" | "blocked" | "complete" | "failed";
  uploadedFileIds: string[];
  latestRunId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookletMessage = {
  id: string;
  threadId: string;
  role: "user" | "agent";
  text: string;
  attachmentFileIds: string[];
  kind: "message" | "question" | "answer" | "result" | "error";
  createdAt: string;
};

const safeName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";

export function toFirestoreDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const MAX_INLINE_GENERATION_RUN_BYTES = 750_000;

type PersistedGenerationRun = BookletGenerationRun & {
  snapshotStoragePath?: string | null;
};

function generationRunSnapshotPath(run: BookletGenerationRun) {
  return `benefitsCompanies/${safeName(run.companyId)}/booklet-runs/${safeName(
    run.id,
  )}/run-snapshot.json`;
}

export function compactGenerationRun(
  run: BookletGenerationRun,
  snapshotStoragePath: string,
): PersistedGenerationRun {
  return toFirestoreDocument({
    id: run.id,
    threadId: run.threadId,
    companyId: run.companyId,
    ownerId: run.ownerId,
    status: run.status,
    generationMode: run.generationMode,
    outputMode: run.outputMode,
    uploadedFileIds: run.uploadedFileIds,
    stages: [],
    questions: run.questions,
    answers: run.answers,
    snapshotSchemaVersion: run.snapshotSchemaVersion,
    snapshotStoragePath,
    pdfStoragePath: run.pdfStoragePath,
    pdfUrl: run.pdfUrl,
    contentModel: run.contentModel,
    qualityReport: run.qualityReport,
    extractedFactCount: run.extractedFactCount,
    sectionArtifactCount: run.sectionArtifactCount,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    error: run.error,
  } as PersistedGenerationRun);
}

export async function createBookletThread(companyId: string, ownerId: string) {
  const { db } = getAdminServices();
  const now = new Date().toISOString();
  const thread: BookletThread = {
    id: randomUUID(),
    companyId,
    ownerId,
    status: "open",
    uploadedFileIds: [],
    latestRunId: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("bookletThreads").doc(thread.id).set(thread);
  return thread;
}

export async function getBookletThread(threadId: string) {
  const { db } = getAdminServices();
  const snapshot = await db.collection("bookletThreads").doc(threadId).get();
  return snapshot.exists ? (snapshot.data() as BookletThread) : null;
}

export async function addBookletMessage(
  message: Omit<BookletMessage, "id" | "createdAt">,
) {
  const { db } = getAdminServices();
  const record: BookletMessage = {
    ...message,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.collection("bookletMessages").doc(record.id).set(record);
  await db.collection("bookletThreads").doc(record.threadId).set(
    { updatedAt: record.createdAt },
    { merge: true },
  );
  return record;
}

export async function storeUploadedFiles({
  thread,
  files,
}: {
  thread: BookletThread;
  files: Array<{
    fileName: string;
    mimeType: string;
    data: Buffer;
    sourceKind?: UploadedFile["sourceKind"];
    sourceUrl?: string | null;
    intakeCategory?: UploadedFile["intakeCategory"];
  }>;
}) {
  const { db, bucket } = getAdminServices();
  const existing = await getUploadedFileRecords(thread.uploadedFileIds);
  const canonicalBySha = new Map(
    existing.map((file) => [file.sha256, file] as const),
  );
  const uploaded: UploadedFile[] = [];
  for (const file of files) {
    const sha256 = createHash("sha256").update(file.data).digest("hex");
    const duplicate = canonicalBySha.get(sha256);
    if (duplicate) {
      uploaded.push(duplicate);
      continue;
    }
    const id = randomUUID();
    const storagePath = `benefitsCompanies/${thread.companyId}/booklet-inputs/${id}/${safeName(file.fileName)}`;
    await bucket.file(storagePath).save(file.data, {
      resumable: false,
      contentType: file.mimeType,
      metadata: { metadata: { sha256, threadId: thread.id, companyId: thread.companyId } },
    });
    const record: UploadedFile = {
      id,
      companyId: thread.companyId,
      ownerId: thread.ownerId,
      fileName: file.fileName,
      storagePath,
      mimeType: file.mimeType,
      uploadedAt: new Date().toISOString(),
      sha256,
      processingStatus: "uploaded",
      sourceKind: file.sourceKind || "file_upload",
      sourceUrl: file.sourceUrl || null,
      ...(file.intakeCategory ? { intakeCategory: file.intakeCategory } : {}),
    };
    await db.collection("bookletUploadedFiles").doc(id).set({ ...record, threadId: thread.id });
    canonicalBySha.set(sha256, record);
    uploaded.push(record);
  }
  if (files.length)
    await db.collection("bookletThreads").doc(thread.id).set(
      {
        uploadedFileIds: [...canonicalBySha.values()].map((file) => file.id),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  return [...new Map(uploaded.map((file) => [file.id, file])).values()];
}

export async function attachFileIdsToThread(threadId: string, fileIds: string[]) {
  if (!fileIds.length) return;
  const { db } = getAdminServices();
  await db.collection("bookletThreads").doc(threadId).set(
    {
      uploadedFileIds: FieldValue.arrayUnion(...fileIds),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function deleteUploadedFileFromThread(
  thread: BookletThread,
  file: UploadedFile,
) {
  const { db, bucket } = getAdminServices();
  await bucket.file(file.storagePath).delete({ ignoreNotFound: true });
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.delete(db.collection("bookletUploadedFiles").doc(file.id));
  batch.set(
    db.collection("bookletThreads").doc(thread.id),
    {
      uploadedFileIds: FieldValue.arrayRemove(file.id),
      latestRunId: null,
      status: "open",
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();
  return {
    ...thread,
    uploadedFileIds: thread.uploadedFileIds.filter((id) => id !== file.id),
    latestRunId: null,
    status: "open" as const,
    updatedAt: now,
  };
}

export async function loadUploadedFiles(fileIds: string[]) {
  const { db, bucket } = getAdminServices();
  const files: LoadedUploadedFile[] = [];
  for (const id of fileIds) {
    const snapshot = await db.collection("bookletUploadedFiles").doc(id).get();
    if (!snapshot.exists) throw new Error(`Uploaded file ${id} was not found`);
    const metadata = snapshot.data() as UploadedFile;
    const [data] = await bucket.file(metadata.storagePath).download();
    files.push({
      ...metadata,
      data,
      ...(metadata.mimeType === "text/plain" || metadata.mimeType === "message/rfc822"
        ? { textContent: data.toString("utf8") }
        : {}),
    });
  }
  return files;
}

export async function getUploadedFileRecords(fileIds: string[]) {
  if (!fileIds.length) return [];
  const { db } = getAdminServices();
  const records: UploadedFile[] = [];
  for (const id of fileIds) {
    const snapshot = await db.collection("bookletUploadedFiles").doc(id).get();
    if (!snapshot.exists) throw new Error(`Uploaded file ${id} was not found`);
    records.push(snapshot.data() as UploadedFile);
  }
  return records;
}

export async function saveGenerationRun(run: BookletGenerationRun) {
  const { bucket, db } = getAdminServices();
  const normalized = toFirestoreDocument(run) as PersistedGenerationRun;
  const serialized = JSON.stringify(normalized);
  let persisted: PersistedGenerationRun = normalized;
  if (
    Buffer.byteLength(serialized, "utf8") > MAX_INLINE_GENERATION_RUN_BYTES ||
    normalized.snapshotStoragePath
  ) {
    const snapshotStoragePath =
      normalized.snapshotStoragePath || generationRunSnapshotPath(run);
    await bucket.file(snapshotStoragePath).save(Buffer.from(serialized), {
      resumable: false,
      contentType: "application/json",
      metadata: { metadata: { runId: run.id, threadId: run.threadId } },
    });
    persisted = compactGenerationRun(run, snapshotStoragePath);
  }
  await db
    .collection("bookletGenerationRuns")
    .doc(run.id)
    .set(persisted);
  await db.collection("bookletThreads").doc(run.threadId).set(
    {
      latestRunId: run.id,
      status:
        run.status === "queued"
          ? "processing"
          : run.status === "preview"
            ? "open"
            : run.status,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function getGenerationRun(runId: string) {
  const { bucket, db } = getAdminServices();
  const snapshot = await db.collection("bookletGenerationRuns").doc(runId).get();
  if (!snapshot.exists) return null;
  const persisted = snapshot.data() as PersistedGenerationRun;
  if (!persisted.snapshotStoragePath) return persisted;
  const [data] = await bucket.file(persisted.snapshotStoragePath).download();
  const hydrated = JSON.parse(data.toString("utf8")) as BookletGenerationRun;
  return { ...hydrated, ...persisted };
}

export async function savePipelineEvent(event: PipelineEvent) {
  const { db } = getAdminServices();
  // Firestore rejects `undefined` anywhere in a document. Pipeline events are
  // plain JSON records, so normalize optional/nested detail values at this
  // persistence boundary as a final safeguard for API callers.
  const firestoreEvent = toFirestoreDocument(event);
  const runRef = db.collection("bookletGenerationRuns").doc(event.runId);
  await runRef
    .collection("events")
    .doc(event.id.replace(/\//g, "_"))
    .set(firestoreEvent);
  // The event subcollection is the canonical event stream. Mirroring every
  // detail into `run.stages` can push otherwise-valid runs past Firestore's
  // 1 MiB document limit (for example, a warning containing many blocker
  // IDs). Keep only the current status on the parent run.
  await runRef.set({ status: "processing" }, { merge: true });
}

export async function saveExtractedFacts(runId: string, facts: ExtractedFact[]) {
  const { db } = getAdminServices();
  for (let offset = 0; offset < facts.length; offset += 400) {
    const batch = db.batch();
    for (const fact of facts.slice(offset, offset + 400)) {
      batch.set(db.collection("bookletExtractedFacts").doc(`${runId}_${fact.id}`), {
        ...toFirestoreDocument(fact),
        runId,
      });
    }
    await batch.commit();
  }
}

export async function saveGeneratedPdf({
  run,
  pdf,
  employerName,
}: {
  run: BookletGenerationRun;
  pdf: Buffer;
  employerName: string;
}) {
  const { bucket } = getAdminServices();
  const fileName = `${safeName(employerName).toLowerCase()}-${run.id}-benefits-guide.pdf`;
  const storagePath = `benefitsCompanies/${run.companyId}/booklets/${fileName}`;
  const file = bucket.file(storagePath);
  await file.save(pdf, {
    resumable: false,
    contentType: "application/pdf",
    metadata: { metadata: { runId: run.id, threadId: run.threadId } },
  });
  let url: string | null = null;
  try {
    [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
  } catch (error) {
    if (!/client_email|sign(?:Blob| data)/i.test(error instanceof Error ? error.message : String(error)))
      throw error;
  }
  return { storagePath, url };
}

export async function refreshGeneratedPdfUrl(storagePath: string) {
  const { bucket } = getAdminServices();
  try {
    const [url] = await bucket
      .file(storagePath)
      .getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    return url;
  } catch (error) {
    if (/client_email|sign(?:Blob| data)/i.test(error instanceof Error ? error.message : String(error)))
      return null;
    throw error;
  }
}

export async function getPipelineEvents(runId: string) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("bookletGenerationRuns")
    .doc(runId)
    .collection("events")
    .orderBy("createdAt")
    .get();
  return snapshot.docs
    .map((document) => document.data() as PipelineEvent)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function saveSectionArtifact(artifact: BookletSectionArtifact) {
  const { db } = getAdminServices();
  await db
    .collection("bookletGenerationRuns")
    .doc(artifact.runId)
    .collection("sections")
    .doc(artifact.id.replace(/\//g, "_"))
    .set(toFirestoreDocument(artifact));
}

export async function pruneSectionArtifacts(runId: string, artifactIds: string[]) {
  const { db } = getAdminServices();
  const sections = db
    .collection("bookletGenerationRuns")
    .doc(runId)
    .collection("sections");
  const snapshot = await sections.get();
  const keep = new Set(artifactIds.map((id) => id.replace(/\//g, "_")));
  const obsolete = snapshot.docs.filter((document) => !keep.has(document.id));
  for (let offset = 0; offset < obsolete.length; offset += 400) {
    const batch = db.batch();
    obsolete.slice(offset, offset + 400).forEach((document) =>
      batch.delete(document.ref),
    );
    await batch.commit();
  }
}

export async function getSectionArtifacts(runId: string) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("bookletGenerationRuns")
    .doc(runId)
    .collection("sections")
    .orderBy("pageIndex")
    .get();
  return snapshot.docs.map((document) => document.data() as BookletSectionArtifact);
}

export async function getExtractedFacts(runId: string) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("bookletExtractedFacts")
    .where("runId", "==", runId)
    .get();
  return snapshot.docs
    .map((document) => document.data() as ExtractedFact & { runId: string })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function resetPipelineEvents(runId: string) {
  const { db } = getAdminServices();
  const runRef = db.collection("bookletGenerationRuns").doc(runId);
  const snapshot = await runRef.collection("events").get();
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = db.batch();
    snapshot.docs.slice(offset, offset + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  const sections = await runRef.collection("sections").get();
  for (let offset = 0; offset < sections.docs.length; offset += 400) {
    const batch = db.batch();
    sections.docs.slice(offset, offset + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  const facts = await db
    .collection("bookletExtractedFacts")
    .where("runId", "==", runId)
    .get();
  for (let offset = 0; offset < facts.docs.length; offset += 400) {
    const batch = db.batch();
    facts.docs.slice(offset, offset + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  await runRef.set({ stages: [], sectionArtifactCount: 0 }, { merge: true });
}
