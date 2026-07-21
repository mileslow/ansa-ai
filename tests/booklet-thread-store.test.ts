import { describe, expect, it } from "vitest";
import {
  compactGenerationRun,
  toFirestoreDocument,
} from "../lib/booklet-thread-store";
import type { BookletGenerationRun } from "../lib/booklet-types";

describe("booklet thread Firestore persistence", () => {
  it("removes undefined values from nested run and event data", () => {
    const clean = toFirestoreDocument({
      id: "run-1",
      details: undefined,
      questions: [
        {
          fieldPath: "eligibility.waitingPeriod",
          options: undefined,
          metadata: { required: true, note: undefined },
        },
      ],
    });

    expect(clean).toEqual({
      id: "run-1",
      questions: [
        {
          fieldPath: "eligibility.waitingPeriod",
          metadata: { required: true },
        },
      ],
    });
    expect(JSON.stringify(clean)).not.toContain("undefined");
  });
});

describe("compactGenerationRun", () => {
  it("keeps resumable state while omitting oversized generated snapshots", () => {
    const run = {
      id: "run-1",
      threadId: "thread-1",
      companyId: "company-1",
      ownerId: "owner-1",
      status: "blocked",
      outputMode: "html_preview",
      uploadedFileIds: ["file-1"],
      stages: [],
      questions: [
        {
          id: "q-1",
          fieldPath: "employer.name",
          question: "What is the employer name?",
          whyItMatters: "Required for the cover.",
          expectedAnswerType: "text",
          blocking: true,
        },
      ],
      answers: { "employer.name": "Big Tows Inc." },
      benefitsPackageSnapshot: { oversized: "x".repeat(1_100_000) },
      createdAt: "2026-07-19T00:00:00.000Z",
    } as unknown as BookletGenerationRun;

    const compact = compactGenerationRun(run, "runs/run-1.json");

    expect(compact.snapshotStoragePath).toBe("runs/run-1.json");
    expect(compact.questions).toEqual(run.questions);
    expect(compact.answers).toEqual(run.answers);
    expect(compact.outputMode).toBe("html_preview");
    expect(compact).not.toHaveProperty("benefitsPackageSnapshot");
    expect(Buffer.byteLength(JSON.stringify(compact), "utf8")).toBeLessThan(
      750_000,
    );
  });
});
