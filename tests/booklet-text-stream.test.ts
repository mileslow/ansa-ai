import { describe, expect, it } from "vitest";
import {
  bookletTextStreamChangedWordCount,
  bookletTextStreamDuration,
  bookletTextStreamShouldAnimate,
  createBookletTextStreamHtml,
} from "../src/bookletTextStream";

describe("Booklet HTML text streaming", () => {
  it("reveals visible page words progressively without altering styles or scripts", () => {
    const html = `<!doctype html><html><head><style>.page { color: red; }</style></head><body><main><h1>Employee Benefits</h1><p>Your medical plan is ready.</p></main><script>window.copy = "do not wrap";</script></body></html>`;
    const streamed = createBookletTextStreamHtml(html);

    expect(streamed.match(/data-ansa-stream-word=/g)).toHaveLength(7);
    expect(streamed).toContain("data-ansa-text-stream");
    expect(streamed).toContain("<style>.page { color: red; }</style>");
    expect(streamed).toContain('<script>window.copy = "do not wrap";</script>');
    expect(streamed).toContain("ansa-stream-word--last");
    expect(streamed).toContain("--ansa-stream-delay:1220ms");
  });

  it("keeps short and long page animations within a readable duration", () => {
    expect(bookletTextStreamDuration(5)).toBe(1400);
    expect(bookletTextStreamDuration(100)).toBe(2800);
    expect(bookletTextStreamDuration(1000)).toBe(5200);
  });

  it("does not trigger streaming for tiny section updates", () => {
    expect(bookletTextStreamShouldAnimate(2, true)).toBe(false);
    expect(bookletTextStreamShouldAnimate(4, true)).toBe(true);
    expect(bookletTextStreamShouldAnimate(7, false)).toBe(false);
    expect(bookletTextStreamShouldAnimate(8, false)).toBe(true);
  });

  it("streams only the words added to an existing section", () => {
    const previous = `<html><head></head><body><h1>Medical benefits</h1><p>Review your plan.</p><footer>Northstar</footer></body></html>`;
    const current = `<html><head></head><body><h1>Medical benefits</h1><p>Review your updated medical plan.</p><footer>Northstar</footer></body></html>`;
    const streamed = createBookletTextStreamHtml(current, previous);

    expect(bookletTextStreamChangedWordCount(current, previous)).toBe(2);
    expect(streamed.match(/data-ansa-stream-word=/g)).toHaveLength(2);
    expect(streamed).toContain("<h1>Medical benefits</h1>");
    expect(streamed).toContain("<footer>Northstar</footer>");
    expect(streamed).toContain('data-ansa-source-word="5"');
    expect(streamed).toContain('data-ansa-source-word="6"');
  });

  it("keeps concurrent section diffs independent", () => {
    const medicalBefore = `<p>Primary care is covered.</p>`;
    const medicalAfter = `<p>Primary care is covered after deductible.</p>`;
    const dentalBefore = `<p>Preventive dental is covered.</p>`;
    const dentalAfter = `<p>Preventive dental is covered in full.</p>`;

    expect(bookletTextStreamChangedWordCount(medicalAfter, medicalBefore)).toBe(2);
    expect(bookletTextStreamChangedWordCount(dentalAfter, dentalBefore)).toBe(2);
    expect(createBookletTextStreamHtml(medicalAfter, medicalBefore)).not.toContain("dental");
    expect(createBookletTextStreamHtml(dentalAfter, dentalBefore)).not.toContain("deductible");
  });
});
