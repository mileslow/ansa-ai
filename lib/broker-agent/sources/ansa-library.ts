import type { UploadedFile } from "../../booklet-types";
import { getAdminServices } from "../../firebase-admin";
import type { SourceConnector, SourceFetchResult, SourceHit, SourceQuery } from "./types";

const HIT_PREFIX = "ansa_library:";

export async function listCompanyLibraryFiles({
  ownerId,
  companyId,
  limit = 40,
}: {
  ownerId: string;
  companyId: string;
  limit?: number;
}): Promise<UploadedFile[]> {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("bookletUploadedFiles")
    .where("companyId", "==", companyId)
    .limit(Math.min(Math.max(limit * 3, 20), 200))
    .get();
  const files = snapshot.docs
    .map((doc) => doc.data() as UploadedFile & { threadId?: string })
    .filter((file) => !file.ownerId || file.ownerId === ownerId)
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  return files.slice(0, limit);
}

export async function listCompletedBookletPdfs({
  ownerId,
  companyId,
  limit = 10,
}: {
  ownerId: string;
  companyId: string;
  limit?: number;
}) {
  const { db } = getAdminServices();
  const snapshot = await db
    .collection("bookletGenerationRuns")
    .where("companyId", "==", companyId)
    .where("status", "==", "complete")
    .limit(Math.min(Math.max(limit * 2, 10), 50))
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as {
      id: string;
      ownerId?: string;
      pdfStoragePath?: string | null;
      completedAt?: string | null;
      createdAt?: string;
    })
    .filter(
      (run) =>
        (!run.ownerId || run.ownerId === ownerId) && Boolean(run.pdfStoragePath),
    )
    .sort((a, b) =>
      String(b.completedAt || b.createdAt || "").localeCompare(
        String(a.completedAt || a.createdAt || ""),
      ),
    )
    .slice(0, limit);
}

function matchesKeywords(haystack: string, keywords: string[] | undefined) {
  if (!keywords?.length) return true;
  const lower = haystack.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export const ansaLibraryConnector: SourceConnector = {
  id: "ansa_library",
  async list(query: SourceQuery): Promise<SourceHit[]> {
    const limit = query.limit ?? 25;
    const files = await listCompanyLibraryFiles({
      ownerId: query.ownerId,
      companyId: query.companyId,
      limit,
    });
    const pdfs = await listCompletedBookletPdfs({
      ownerId: query.ownerId,
      companyId: query.companyId,
      limit: Math.min(10, limit),
    });
    const fileHits: SourceHit[] = files
      .filter((file) =>
        matchesKeywords(
          `${file.fileName} ${file.intakeCategory || ""} ${file.sourceKind || ""}`,
          [
            ...(query.keywords || []),
            ...(query.employerName ? [query.employerName] : []),
            ...(query.planYear ? [query.planYear] : []),
          ].filter(Boolean),
        ),
      )
      .map((file) => ({
        id: `${HIT_PREFIX}file:${file.id}`,
        connectorId: "ansa_library" as const,
        title: file.fileName,
        snippet: `${file.sourceKind || "file"} · ${file.mimeType}`,
        mimeType: file.mimeType,
        fileName: file.fileName,
        sourceUrl: file.sourceUrl || null,
        receivedAt: file.uploadedAt,
        meta: { uploadedFileId: file.id, kind: "uploaded_file" },
      }));

    const pdfHits: SourceHit[] = pdfs.map((run) => ({
      id: `${HIT_PREFIX}pdf:${run.id}`,
      connectorId: "ansa_library" as const,
      title: `Prior booklet PDF (${run.id.slice(0, 8)})`,
      snippet: "Completed booklet run",
      mimeType: "application/pdf",
      fileName: `prior-booklet-${run.id.slice(0, 8)}.pdf`,
      receivedAt: run.completedAt || run.createdAt || null,
      meta: {
        runId: run.id,
        pdfStoragePath: run.pdfStoragePath,
        kind: "completed_pdf",
      },
    }));

    return [...fileHits, ...pdfHits].slice(0, limit);
  },

  async fetch(hitId: string, query: SourceQuery): Promise<SourceFetchResult> {
    const { db, bucket } = getAdminServices();
    if (hitId.startsWith(`${HIT_PREFIX}file:`)) {
      const fileId = hitId.slice(`${HIT_PREFIX}file:`.length);
      const snapshot = await db.collection("bookletUploadedFiles").doc(fileId).get();
      if (!snapshot.exists) throw new Error(`Library file ${fileId} was not found`);
      const file = snapshot.data() as UploadedFile;
      if (file.companyId !== query.companyId)
        throw new Error("Library file belongs to another company");
      if (file.ownerId && file.ownerId !== query.ownerId)
        throw new Error("Library file belongs to another user");
      const [data] = await bucket.file(file.storagePath).download();
      return {
        hit: {
          id: hitId,
          connectorId: "ansa_library",
          title: file.fileName,
          mimeType: file.mimeType,
          fileName: file.fileName,
          sourceUrl: file.sourceUrl || null,
          meta: { uploadedFileId: file.id },
        },
        fileName: file.fileName,
        mimeType: file.mimeType,
        data,
        sourceKind: "company_library",
        sourceUrl: file.sourceUrl || null,
        intakeCategory: file.intakeCategory,
      };
    }
    if (hitId.startsWith(`${HIT_PREFIX}pdf:`)) {
      const runId = hitId.slice(`${HIT_PREFIX}pdf:`.length);
      const snapshot = await db.collection("bookletGenerationRuns").doc(runId).get();
      if (!snapshot.exists) throw new Error(`Booklet run ${runId} was not found`);
      const run = snapshot.data() as {
        companyId?: string;
        ownerId?: string;
        pdfStoragePath?: string | null;
      };
      if (run.companyId !== query.companyId)
        throw new Error("Booklet PDF belongs to another company");
      if (run.ownerId && run.ownerId !== query.ownerId)
        throw new Error("Booklet PDF belongs to another user");
      if (!run.pdfStoragePath) throw new Error("Booklet run has no PDF");
      const [data] = await bucket.file(run.pdfStoragePath).download();
      const fileName = `prior-booklet-${runId.slice(0, 8)}.pdf`;
      return {
        hit: {
          id: hitId,
          connectorId: "ansa_library",
          title: fileName,
          mimeType: "application/pdf",
          fileName,
          meta: { runId, pdfStoragePath: run.pdfStoragePath },
        },
        fileName,
        mimeType: "application/pdf",
        data,
        sourceKind: "company_library",
        intakeCategory: "documents",
      };
    }
    throw new Error(`Unknown Ansa library hit id: ${hitId}`);
  },
};
