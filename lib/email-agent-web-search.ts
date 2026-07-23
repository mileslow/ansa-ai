type OpenAIResponseLike = {
  output?: Array<Record<string, unknown>>;
  output_text?: string;
};

export type EmailAgentWebSource = {
  title: string;
  url: string;
};

type WebSearchConfiguration = {
  enabled?: string;
  contextSize?: string;
};

function enabledByConfiguration(value: string | undefined) {
  return !["0", "false", "no", "off", "disabled"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function normalizedContextSize(value: string | undefined) {
  const normalized = String(value || "medium").trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalized)
    ? normalized as "low" | "medium" | "high"
    : "medium";
}

export function openAiWebSearchTools(
  configuration: WebSearchConfiguration = {
    enabled: process.env.EMAIL_AGENT_WEB_SEARCH_ENABLED,
    contextSize: process.env.EMAIL_AGENT_WEB_SEARCH_CONTEXT_SIZE,
  },
) {
  if (!enabledByConfiguration(configuration.enabled)) return [];
  return [{
    type: "web_search" as const,
    search_context_size: normalizedContextSize(configuration.contextSize),
  }];
}

function safeSource(value: unknown): EmailAgentWebSource | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const url = String(source.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const title = String(source.title || "Source")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 240) || "Source";
  return { title, url };
}

export function emailAgentWebSearchMetadata(response: OpenAIResponseLike) {
  const sources = new Map<string, EmailAgentWebSource>();
  let used = false;
  for (const item of Array.isArray(response.output) ? response.output : []) {
    if (item.type === "web_search_call") {
      used = true;
    }
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      for (const raw of Array.isArray(content.annotations) ? content.annotations : []) {
        const annotation = raw && typeof raw === "object"
          ? raw as Record<string, unknown>
          : {};
        if (annotation.type !== "url_citation") continue;
        const source = safeSource(annotation);
        if (source) sources.set(source.url, source);
      }
    }
  }
  return { used, sources: [...sources.values()].slice(0, 12) };
}

export function emailReplyTextWithWebSources(response: OpenAIResponseLike) {
  const text = String(response.output_text || "").trim();
  const metadata = emailAgentWebSearchMetadata(response);
  const missing = metadata.sources.filter((source) => !text.includes(source.url));
  if (!missing.length) return text;
  return [
    text,
    "",
    missing.length === 1 ? "Source:" : "Sources:",
    ...missing.map((source) => `${source.title}: ${source.url}`),
  ].join("\n").trim();
}
