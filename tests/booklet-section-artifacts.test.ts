import { describe, expect, it } from "vitest";
import {
  artifactsFromPreviewPages,
  composeBookletHtml,
  sectionIdFromPageId,
} from "../lib/booklet-section-artifacts";

const html = (id: string, copy: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>.page{color:#111}</style></head><body><section class="page" data-page-id="${id}">${copy}</section></body></html>`;

describe("modular booklet HTML artifacts", () => {
  it("maps rendered pages to source-backed sections and composes them in page order", () => {
    const outline = {
      sections: [
        { id: "cover", title: "Cover", sourceRefs: [] },
        { id: "enrollment", title: "How to enroll", sourceRefs: [] },
        { id: "medical", title: "Medical", benefitType: "medical" as const, sourceRefs: [] },
      ],
    };
    const artifacts = artifactsFromPreviewPages({
      runId: "run-1",
      outline,
      pages: [
        { index: 2, title: "Medical", text: "Medical", html: html("medical-1", "Medical") },
        { index: 0, title: "Cover", text: "Cover", html: html("cover", "Cover") },
        { index: 1, title: "Enrollment", text: "Enroll", html: html("open-enrollment", "Enroll") },
      ],
    });

    expect(artifacts.map((artifact) => artifact.sectionId)).toEqual([
      "medical",
      "cover",
      "enrollment",
    ]);
    expect(sectionIdFromPageId("medical-3")).toBe("medical");
    const compiled = composeBookletHtml(artifacts);
    expect(compiled.indexOf("Cover")).toBeLessThan(compiled.indexOf("Enroll"));
    expect(compiled.indexOf("Enroll")).toBeLessThan(compiled.indexOf("Medical"));
    expect(compiled.match(/<style>/g)).toHaveLength(1);
    expect(compiled.match(/data-page-id=/g)).toHaveLength(3);
  });
});
