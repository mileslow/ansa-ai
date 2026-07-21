import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/firebase", () => ({
  getBookletAuthToken: vi.fn(async () => "test-token"),
}));

import { bookletStudioApi } from "../src/bookletStudioApi";
import type { BookletGenerationRun } from "../lib/booklet-types";

describe("Booklet Studio API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends employee-booklet HTML preview mode during interactive setup", async () => {
    const run = {
      id: "run-1",
      threadId: "thread-1",
      companyId: "company-1",
      ownerId: "owner-1",
      status: "complete",
      generationMode: "employee_booklet",
      uploadedFileIds: ["file-1"],
      stages: [],
      questions: [],
      answers: {},
    } as BookletGenerationRun;
    const fetchMock = vi.fn(async () =>
      new Response(`${JSON.stringify({ type: "result", run })}\n`, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await bookletStudioApi.start({
      threadId: "thread-1",
      generationMode: "employee_booklet",
      outputMode: "html_preview",
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: "start",
      threadId: "thread-1",
      generationMode: "employee_booklet",
      outputMode: "html_preview",
      stream: true,
    });
  });

  it("loads an owned source document for the frontend document tab", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Blob(["pdf-bytes"], { type: "application/pdf" }), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = await bookletStudioApi.downloadSource({
      threadId: "thread-1",
      fileId: "file-1",
    });

    expect(blob.type).toBe("application/pdf");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      action: "source_download",
      threadId: "thread-1",
      fileId: "file-1",
    });
  });
});
