import { describe, expect, it } from "vitest";
import {
  emailAgentWebSearchMetadata,
  emailReplyTextWithWebSources,
  openAiWebSearchTools,
} from "../lib/email-agent-web-search";

describe("email-agent web search", () => {
  it("enables current Responses web search with a bounded context size", () => {
    expect(openAiWebSearchTools({})).toEqual([
      { type: "web_search", search_context_size: "medium" },
    ]);
    expect(openAiWebSearchTools({ enabled: "false" })).toEqual([]);
    expect(openAiWebSearchTools({ contextSize: "high" })).toEqual([
      { type: "web_search", search_context_size: "high" },
    ]);
    expect(openAiWebSearchTools({ contextSize: "unexpected" })).toEqual([
      { type: "web_search", search_context_size: "medium" },
    ]);
  });

  it("makes cited sources visible in plain email replies and records usage", () => {
    const response = {
      output_text: "The current answer is 42.",
      output: [
        {
          type: "web_search_call",
          action: { type: "search" },
        },
        {
          type: "message",
          content: [{
            type: "output_text",
            text: "The current answer is 42.",
            annotations: [
              { type: "url_citation", title: "Cited source", url: "https://example.com/cited" },
              { type: "url_citation", title: "Duplicate", url: "https://example.com/cited" },
              { type: "url_citation", title: "Unsafe", url: "javascript:alert(1)" },
            ],
          }],
        },
      ],
    };
    expect(emailAgentWebSearchMetadata(response)).toEqual({
      used: true,
      sources: [
        { title: "Duplicate", url: "https://example.com/cited" },
      ],
    });
    expect(emailReplyTextWithWebSources(response)).toContain(
      "Duplicate: https://example.com/cited",
    );
    expect(emailReplyTextWithWebSources(response)).not.toContain("- Duplicate:");
    expect(emailReplyTextWithWebSources(response)).not.toContain("javascript:");
  });

  it("does not duplicate URLs already rendered by the model", () => {
    const url = "https://example.com/already-linked";
    const text = `Answer with [source](${url})`;
    const rendered = emailReplyTextWithWebSources({
      output_text: text,
      output: [{
        type: "message",
        content: [{
          annotations: [{ type: "url_citation", title: "Source", url }],
        }],
      }],
    });
    expect(rendered).toBe(text);
  });
});
