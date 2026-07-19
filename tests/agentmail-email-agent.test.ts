import { describe, expect, it } from "vitest";
import {
  formatBookletQuestions,
  isBenefitsBookletRequest,
  isSupportedAgentAttachment,
} from "../lib/agentmail-email-agent";
import type { BlockerQuestion } from "../lib/booklet-types";

describe("AgentMail email agent", () => {
  it("recognizes explicit benefits booklet requests without hijacking general benefits questions", () => {
    expect(
      isBenefitsBookletRequest(
        "2026 guide",
        "Please generate an employee benefits booklet from the attached files.",
      ),
    ).toBe(true);
    expect(
      isBenefitsBookletRequest(
        "Benefits question",
        "Can you explain what an HSA is? I saw it in our booklet.",
      ),
    ).toBe(false);
  });

  it("accepts source document formats by MIME type or filename", () => {
    expect(isSupportedAgentAttachment("rates.xlsx")).toBe(true);
    expect(isSupportedAgentAttachment("plan.docx", "application/octet-stream")).toBe(true);
    expect(isSupportedAgentAttachment("summary.pdf", "application/pdf")).toBe(true);
    expect(isSupportedAgentAttachment("logo.png", "image/png")).toBe(false);
  });

  it("asks clear, replyable follow-up questions", () => {
    const question: BlockerQuestion = {
      id: "q1",
      fieldPath: "planYear.start",
      question: "When does the plan year start?",
      reason: "The source documents do not specify it.",
      options: ["January 1, 2027", "Other"],
      sourceRefs: [],
      blocking: true,
    };
    const message = formatBookletQuestions([question], ["logo.png"]);
    expect(message).toContain("When does the plan year start?");
    expect(message).toContain("January 1, 2027");
    expect(message).toContain("logo.png");
    expect(message).toContain("Reply in plain language");
  });
});
