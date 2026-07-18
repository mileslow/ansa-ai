import { describe, expect, it } from "vitest";
import { toFirestoreDocument } from "../lib/booklet-thread-store";

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
