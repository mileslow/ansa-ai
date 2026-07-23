import { describe, expect, it } from "vitest";
import { plainTextEmailReply } from "../lib/email-agent-reply-style";

describe("email-agent reply style", () => {
  it("mechanically removes Markdown while preserving the message and URL", () => {
    const rendered = plainTextEmailReply([
      "## Answer",
      "**Friday** works. See [the calendar](https://example.com/calendar).",
      "",
      "- Bring the `draft`.",
      "1. Confirm the time.",
      "",
      "```text",
      "Plain closing",
      "```",
    ].join("\n"));
    expect(rendered).toBe([
      "Answer",
      "Friday works. See the calendar (https://example.com/calendar).",
      "",
      "• Bring the draft.",
      "1) Confirm the time.",
      "",
      "Plain closing",
    ].join("\n"));
    expect(rendered).not.toMatch(/\*\*|```|\]\(|^##|^- /m);
  });

  it("keeps ordinary conversational email text unchanged", () => {
    const text = "Friday works for me. I can send the draft that morning.\n\nTalk then,";
    expect(plainTextEmailReply(text)).toBe(text);
  });

  it("turns AI-like em dashes into ordinary email punctuation", () => {
    expect(plainTextEmailReply("Yes — Friday works for me.")).toBe(
      "Yes, Friday works for me.",
    );
  });
});
