import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "./firebase-admin";
import type {
  BookletGenerationRun,
  ExtractedFact,
  LoadedUploadedFile,
  PipelineEvent,
  UploadedFile,
} from "./booklet-types";

export type BookletThread = {
  id: string;
  companyId: string;
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

export async function createBookletThread(companyId: string) {
  const { db } = getAdminServices();
  const now = new Date().toISOString();
  const thread: BookletThread = {
    id: randomUUID(),
    companyId,
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
  files: Array<{ fileName: string; mimeType: string; data: Buffer }>;
}) {
  const { db, bucket } = getAdminServices();
  const uploaded: UploadedFile[] = [];
  for (const file of files) {
    const id = randomUUID();
    const sha256 = createHash("sha256").update(file.data).digest("hex");
    const storagePath = `benefitsCompanies/${thread.companyId}/booklet-inputs/${id}/${safeName(file.fileName)}`;
    await bucket.file(storagePath).save(file.data, {
      resumable: false,
      contentType: file.mimeType,
      metadata: { metadata: { sha256, threadId: thread.id, companyId: thread.companyId } },
    });
    const record: UploadedFile = {
      id,
      companyId: thread.companyId,
      fileName: file.fileName,
      storagePath,
      mimeType: file.mimeType,
      uploadedAt: new Date().toISOString(),
      sha256,
      processingStatus: "uploaded",
    };
    await db.collection("bookletUploadedFiles").doc(id).set({ ...record, threadId: thread.id });
    uploaded.push(record);
  }
  if (uploaded.length)
    await db.collection("bookletThreads").doc(thread.id).set(
      {
        uploadedFileIds: FieldValue.arrayUnion(...uploaded.map((file) => file.id)),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  return uploaded;
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

export async function loadUploadedFiles(fileIds: string[]) {
  const { db, bucket } = getAdminServices();
  const files: LoadedUploadedFile[] = [];
  for (const id of fileIds) {
    const snapshot = await db.collection("bookletUploadedFiles").doc(id).get();
    if (!snapshot.exists) throw new Error(`Uploaded file ${id} was not found`);
    const metadata = snapshot.data() as UploadedFile;
    const [data] = await bucket.file(metadata.storagePath).download();
    files.push({ ...metadata, data });
  }
  return files;
}

export async function saveGenerationRun(run: BookletGenerationRun) {
  const { db } = getAdminServices();
  await db
    .collection("bookletGenerationRuns")
    .doc(run.id)
    .set(toFirestoreDocument(run), { merge: true });
  await db.collection("bookletThreads").doc(run.threadId).set(
    {
      latestRunId: run.id,
      status: run.status === "queued" ? "processing" : run.status,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function getGenerationRun(runId: string) {
  const { db } = getAdminServices();
  const snapshot = await db.collection("bookletGenerationRuns").doc(runId).get();
  return snapshot.exists ? (snapshot.data() as BookletGenerationRun) : null;
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
  await runRef.set(
    { stages: FieldValue.arrayUnion(firestoreEvent), status: "processing" },
    { merge: true },
  );
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
  const [url] = await file.getSignedUrl({ action: "read", expires: "2035-01-01" });
  return { storagePath, url };
}

export async function getPipelineEvents(runId: string) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("bookletGenerationRuns")
    .doc(runId)
    .collection("events")
    .orderBy("createdAt")
    .get();
  return snapshot.docs.map((document) => document.data() as PipelineEvent);
}
