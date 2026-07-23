import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { AgentMailClient, type AgentMail } from "agentmail";
import {
  documentScenarios,
  writeBookletDocumentScenarios,
} from "./generate-booklet-document-scenarios";
import { processAgentMailEvent } from "../lib/agentmail-email-agent";

const root = process.cwd();
const scenarioRoot = path.join(root, "test-info", "document-scenarios");
const proofRoot = path.join(scenarioRoot, "email-proof");

type ProofCheck = {
  name: string;
  passed: boolean;
  details?: string;
};

type ScenarioProof = {
  scenarioId: string;
  title: string;
  sent: MailSummary;
  localProcessor?: {
    status: "complete" | "duplicate" | "ignored" | "failed";
    intent?: string;
    error?: string;
  };
  reply: MailSummary;
  checks: ProofCheck[];
  followup?: {
    sent: MailSummary;
    localProcessor?: {
      status: "complete" | "duplicate" | "ignored" | "failed";
      intent?: string;
      error?: string;
    };
    reply: MailSummary;
    checks: ProofCheck[];
  };
};

type MailSummary = {
  inboxId: string;
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  timestamp: string;
  text: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size?: number;
  }>;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function applyEnvFile(filePath: string) {
  let text = "";
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

async function loadLocalEnv() {
  await applyEnvFile(path.join(root, ".env"));
  await applyEnvFile(path.join(root, ".env.local"));
  await applyEnvFile(path.join(root, ".vercel", ".env.production.local"));
}

function readGcloudSecret(secretName: string) {
  const project =
    process.env.AGENTMAIL_GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "flux-ebfb0";
  const account = process.env.AGENTMAIL_GCLOUD_ACCOUNT || "mileslow2@gmail.com";
  const result = spawnSync(
    "gcloud",
    [
      "--account",
      account,
      "secrets",
      "versions",
      "access",
      "latest",
      "--secret",
      secretName,
      "--project",
      project,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function loadAgentMailSecrets() {
  process.env.AGENTMAIL_API_KEY ||=
    process.env.AGENTMAIL_AGENT_API_KEY || readGcloudSecret("AGENTMAIL_API_KEY") || "";
  process.env.AGENTMAIL_LIVE_SENDER_API_KEY ||=
    process.env.AGENTMAIL_SENDER_API_KEY || process.env.AGENTMAIL_API_KEY || "";
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function mimeType(filePath: string) {
  if (filePath.endsWith(".pdf")) return "application/pdf";
  if (filePath.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (filePath.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

async function attachment(filePath: string) {
  const data = await fs.readFile(filePath);
  return {
    filename: path.basename(filePath),
    contentType: mimeType(filePath),
    content: data.toString("base64"),
  };
}

function messageText(message: AgentMail.Message) {
  return String(
    message.extractedText || message.text || message.preview || "",
  ).trim();
}

function timestampOf(message: AgentMail.Message) {
  return new Date(message.timestamp || Date.now()).toISOString();
}

function summarize(inboxId: string, message: AgentMail.Message): MailSummary {
  return {
    inboxId,
    messageId: message.messageId,
    threadId: message.threadId,
    from: message.from,
    to: message.to || [],
    subject: message.subject || "",
    timestamp: timestampOf(message),
    text: messageText(message),
    attachments: (message.attachments || []).map((item) => ({
      filename: item.filename || item.attachmentId,
      contentType: item.contentType || "application/octet-stream",
      size: item.size,
    })),
  };
}

async function waitForMessageInInbox({
  client,
  inboxId,
  threadId,
  subjectIncludes,
  fromIncludes,
  timeoutMilliseconds,
  excludeMessageIds = new Set<string>(),
}: {
  client: AgentMailClient;
  inboxId: string;
  threadId?: string;
  subjectIncludes?: string;
  fromIncludes: string;
  timeoutMilliseconds: number;
  excludeMessageIds?: Set<string>;
}) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const page = await client.inboxes.messages.list(inboxId, { limit: 100 });
    const candidates = page.messages
      .filter(
        (message) =>
          (message.threadId === threadId ||
            (subjectIncludes &&
              (message.subject || "").includes(subjectIncludes))) &&
          !excludeMessageIds.has(message.messageId) &&
          message.from.toLowerCase().includes(fromIncludes.toLowerCase()),
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() -
          new Date(a.timestamp || 0).getTime(),
      );
    if (candidates[0])
      return client.inboxes.messages.get(inboxId, candidates[0].messageId);
    await sleep(5_000);
  }
  throw new Error(
    `Timed out waiting for ${threadId || subjectIncludes || "message"} in ${inboxId}`,
  );
}

async function processReceivedMessage({
  agentClient,
  agentInbox,
  senderInbox,
  sent,
  subject,
  eventPrefix,
  processedMessageIds,
}: {
  agentClient: AgentMailClient;
  agentInbox: string;
  senderInbox: string;
  sent: AgentMail.Message;
  subject: string;
  eventPrefix: string;
  processedMessageIds: Set<string>;
}) {
  try {
    const direct = await agentClient.inboxes.messages.get(
      agentInbox,
      sent.messageId,
    );
    if (direct.from.toLowerCase().includes(senderInbox.toLowerCase())) {
      processedMessageIds.add(direct.messageId);
      return processAgentMailEvent({
        event_type: "message.received",
        event_id: `${eventPrefix}:${direct.messageId}`,
        message: {
          inbox_id: agentInbox,
          thread_id: direct.threadId,
          message_id: direct.messageId,
        },
      });
    }
  } catch {
    // AgentMail may require polling before the recipient inbox can fetch it.
  }
  const received = await waitForMessageInInbox({
    client: agentClient,
    inboxId: agentInbox,
    subjectIncludes: subject,
    fromIncludes: senderInbox,
    timeoutMilliseconds: 90_000,
    excludeMessageIds: processedMessageIds,
  });
  processedMessageIds.add(received.messageId);
  return processAgentMailEvent({
    event_type: "message.received",
    event_id: `${eventPrefix}:${received.messageId}`,
    message: {
      inbox_id: agentInbox,
      thread_id: received.threadId,
      message_id: received.messageId,
    },
  });
}

function primaryAttachmentPaths(scenario: (typeof documentScenarios)[number]) {
  return [
    ...scenario.pdfs.map((doc) => path.join(scenarioRoot, scenario.id, doc.fileName)),
    ...(scenario.sourceDocs || []).map((doc) =>
      path.join(scenarioRoot, scenario.id, doc.fileName),
    ),
    ...(scenario.workbook
      ? [path.join(scenarioRoot, scenario.id, scenario.workbook.fileName)]
      : []),
  ];
}

function followupAttachmentPaths(
  scenario: (typeof documentScenarios)[number],
  followup: NonNullable<(typeof documentScenarios)[number]["followups"]>[number],
) {
  return [
    ...(followup.pdfs || []).map((doc) =>
      path.join(scenarioRoot, scenario.id, followup.id, doc.fileName),
    ),
    ...(followup.sourceDocs || []).map((doc) =>
      path.join(scenarioRoot, scenario.id, followup.id, doc.fileName),
    ),
    ...(followup.workbook
      ? [path.join(scenarioRoot, scenario.id, followup.id, followup.workbook.fileName)]
      : []),
  ];
}

function scenarioBody(scenario: (typeof documentScenarios)[number], token: string) {
  return [
    `Authorized Ansa live email test ${token}.`,
    "",
    "Please generate a source-backed employee benefits booklet from the attached materials.",
    "Use only the attached source documents and explicit facts in this thread.",
    "If any required document, selected plan, rate row, or employer confirmation is missing, ask me for exactly that information instead of guessing.",
    "",
    `Scenario: ${scenario.title}.`,
  ].join("\n");
}

function expectedChecks(
  scenarioId: string,
  reply: MailSummary,
  phase: "initial" | "followup" = "initial",
): ProofCheck[] {
  const text = reply.text.toLowerCase();
  const hasPdf = reply.attachments.some((item) => item.contentType === "application/pdf");
  const followupPdfScenarios = new Set([
    "01_hsa-selected-no-hsa-form",
    "02_extra-vision-plan-not-in-application",
    "03_application-only-progressive-intake",
    "04_rate-sheet-plan-mismatch",
  ]);
  const contains = (name: string, words: string[]) => ({
    name,
    passed: words.every((word) => text.includes(word)),
    details: reply.text.slice(0, 500),
  });

  if (phase === "followup" && followupPdfScenarios.has(scenarioId))
    return [
      {
        name: "generates booklet PDF after resolving follow-up",
        passed: hasPdf,
        details: reply.attachments.map((item) => item.filename).join(", "),
      },
    ];

  if (scenarioId === "00_complete-medical-dental")
    return [
      {
        name: "completed booklet PDF attached",
        passed: hasPdf,
        details: reply.attachments.map((item) => item.filename).join(", "),
      },
    ];
  if (scenarioId === "01_hsa-selected-no-hsa-form")
    return [
      {
        name: "asks for HSA account/source details",
        passed:
          text.includes("hsa") &&
          /account|administrator|custodian|hsa source|source material/.test(text) &&
          !/confirm that no standalone|no standalone hsa/.test(text),
        details: reply.text.slice(0, 500),
      },
    ];
  if (scenarioId === "02_extra-vision-plan-not-in-application")
    return [
      {
        name: "asks whether vision should be included",
        passed: text.includes("vision") && /include|included|offered|application/.test(text),
        details: reply.text.slice(0, 500),
      },
    ];
  if (scenarioId === "03_application-only-progressive-intake" && phase === "initial")
    return [contains("asks for selected current plans", ["current plans"])];
  if (scenarioId === "04_rate-sheet-plan-mismatch")
    return [
      {
        name: "asks for rate-row mismatch resolution",
        passed: text.includes("rate") && /row|match|matches|which/.test(text),
        details: reply.text.slice(0, 500),
      },
    ];
  return [{ name: "reply received", passed: Boolean(reply.messageId) }];
}

function assertChecks(checks: ProofCheck[], scenarioId: string) {
  const failed = checks.filter((check) => !check.passed);
  if (failed.length)
    throw new Error(
      `${scenarioId} failed proof checks: ${failed
        .map((check) => `${check.name}: ${check.details || ""}`)
        .join("; ")}`,
    );
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
}

async function pdfTextCheck({
  client,
  inboxId,
  message,
  scenarioId,
  phase,
  words,
}: {
  client: AgentMailClient;
  inboxId: string;
  message: AgentMail.Message;
  scenarioId: string;
  phase: string;
  words: string[];
}): Promise<ProofCheck> {
  const pdf = (message.attachments || []).find(
    (item) => item.contentType === "application/pdf",
  );
  if (!pdf)
    return {
      name: "resolved PDF contains required text",
      passed: false,
      details: "No PDF attachment found.",
    };
  const info = await client.inboxes.messages.getAttachment(
    inboxId,
    message.messageId,
    pdf.attachmentId,
  );
  const response = await fetch(info.downloadUrl);
  if (!response.ok)
    return {
      name: "resolved PDF contains required text",
      passed: false,
      details: `Attachment download failed: ${response.status} ${response.statusText}`,
    };
  const directory = path.join(proofRoot, "attachments");
  await fs.mkdir(directory, { recursive: true });
  const outputPath = path.join(
    directory,
    `${scenarioId}-${phase}-${safeFileName(info.filename || pdf.filename || "booklet.pdf")}`,
  );
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  const extracted = spawnSync("pdftotext", [outputPath, "-"], {
    encoding: "utf8",
  });
  const text =
    extracted.status === 0
      ? extracted.stdout.toLowerCase()
      : `${extracted.stdout}\n${extracted.stderr}`.toLowerCase();
  return {
    name: "resolved PDF contains required text",
    passed: extracted.status === 0 && words.every((word) => text.includes(word.toLowerCase())),
    details:
      extracted.status === 0
        ? `${path.relative(root, outputPath)} checked for ${words.join(", ")}`
        : `pdftotext failed for ${path.relative(root, outputPath)}: ${extracted.stderr}`,
  };
}

async function waitForCheckedReply({
  client,
  inboxId,
  threadId,
  subject,
  fromIncludes,
  scenarioId,
  phase = "initial",
  timeoutMilliseconds,
  excludeMessageIds = new Set<string>(),
}: {
  client: AgentMailClient;
  inboxId: string;
  threadId?: string;
  subject: string;
  fromIncludes: string;
  scenarioId: string;
  phase?: "initial" | "followup";
  timeoutMilliseconds: number;
  excludeMessageIds?: Set<string>;
}) {
  const deadline = Date.now() + timeoutMilliseconds;
  let latestFailure = "";
  while (Date.now() < deadline) {
    const page = await client.inboxes.messages.list(inboxId, { limit: 100 });
    const candidates = page.messages
      .filter(
        (message) =>
          (message.threadId === threadId ||
            (message.subject || "").includes(subject)) &&
          !excludeMessageIds.has(message.messageId) &&
          message.from.toLowerCase().includes(fromIncludes.toLowerCase()),
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() -
          new Date(a.timestamp || 0).getTime(),
      );
    for (const candidate of candidates) {
      const full = await client.inboxes.messages.get(
        inboxId,
        candidate.messageId,
      );
      const summary = summarize(inboxId, full);
      const checks = expectedChecks(scenarioId, summary, phase);
      if (checks.every((check) => check.passed)) return { message: full, checks };
      latestFailure = checks
        .map((check) => `${check.name}: ${check.passed}`)
        .join(", ");
    }
    await sleep(5_000);
  }
  throw new Error(
    `Timed out waiting for a scenario-valid reply for ${scenarioId}. Latest checks: ${latestFailure || "none"}`,
  );
}

async function writeTranscript(proof: ScenarioProof) {
  const lines = [
    `# ${proof.scenarioId}: ${proof.title}`,
    "",
    "## Initial sent",
    `Message: ${proof.sent.messageId}`,
    `Thread: ${proof.sent.threadId}`,
    proof.sent.text,
    "",
    "## Initial reply",
    `Message: ${proof.reply.messageId}`,
    proof.reply.text,
  ];
  if (proof.followup) {
    lines.push(
      "",
      "## Follow-up sent",
      `Message: ${proof.followup.sent.messageId}`,
      proof.followup.sent.text,
      "",
      "## Follow-up reply",
      `Message: ${proof.followup.reply.messageId}`,
      proof.followup.reply.text,
    );
  }
  await fs.writeFile(
    path.join(proofRoot, `${proof.scenarioId}.txt`),
    `${lines.join("\n")}\n`,
  );
}

async function runScenario({
  agentClient,
  senderClient,
  agentInbox,
  senderInbox,
  scenario,
}: {
  agentClient: AgentMailClient;
  senderClient: AgentMailClient;
  agentInbox: string;
  senderInbox: string;
  scenario: (typeof documentScenarios)[number];
}): Promise<ScenarioProof> {
  const token = `${scenario.id}-${Date.now()}`;
  const subject = `Ansa document scenario ${scenario.id} ${token}`;
  const attachments = await Promise.all(primaryAttachmentPaths(scenario).map(attachment));
  const sent = await senderClient.inboxes.messages.send(senderInbox, {
    to: [agentInbox],
    subject,
    text: scenarioBody(scenario, token),
    attachments,
  });
  const sentMessage = await senderClient.inboxes.messages.get(
    senderInbox,
    sent.messageId,
  );
  const processedMessageIds = new Set<string>();
  const localProcessor = await processReceivedMessage({
    agentClient,
    agentInbox,
    senderInbox,
    sent: sentMessage,
    subject,
    eventPrefix: `document-scenario:${token}`,
    processedMessageIds,
  });
  const checkedReply = await waitForCheckedReply({
    client: senderClient,
    inboxId: senderInbox,
    threadId: sent.threadId,
    subject,
    fromIncludes: agentInbox,
    scenarioId: scenario.id,
    timeoutMilliseconds: 900_000,
  });
  const reply = checkedReply.message;
  const proof: ScenarioProof = {
    scenarioId: scenario.id,
    title: scenario.title,
    sent: summarize(senderInbox, sentMessage),
    localProcessor,
    reply: summarize(senderInbox, reply),
    checks: checkedReply.checks,
  };
  assertChecks(proof.checks, scenario.id);

  const followup = scenario.followups?.[0];
  if (followup) {
    const followupText = [
      `Authorized Ansa live email test follow-up for ${token}.`,
      "",
      ...followup.instructions,
    ].join("\n");
    const followupSent = await senderClient.inboxes.messages.reply(senderInbox, reply.messageId, {
      text: followupText,
      attachments: await Promise.all(
        followupAttachmentPaths(scenario, followup).map(attachment),
      ),
    });
    const followupSentMessage = await senderClient.inboxes.messages.get(
      senderInbox,
      followupSent.messageId,
    );
    const followupProcessor = await processReceivedMessage({
      agentClient,
      agentInbox,
      senderInbox,
      sent: followupSentMessage,
      subject,
      eventPrefix: `document-scenario:${token}:followup`,
      processedMessageIds,
    });
    const checkedFollowupReply = await waitForCheckedReply({
      client: senderClient,
      inboxId: senderInbox,
      threadId: sent.threadId,
      subject,
      fromIncludes: agentInbox,
      scenarioId: scenario.id,
      phase: "followup",
      timeoutMilliseconds: 900_000,
      excludeMessageIds: new Set([reply.messageId]),
    });
    const followupReply = checkedFollowupReply.message;
    proof.followup = {
      sent: summarize(senderInbox, followupSentMessage),
      localProcessor: followupProcessor,
      reply: summarize(senderInbox, followupReply),
      checks: checkedFollowupReply.checks,
    };
    if (scenario.id === "01_hsa-selected-no-hsa-form") {
      proof.followup.checks.push(
        await pdfTextCheck({
          client: senderClient,
          inboxId: senderInbox,
          message: followupReply,
          scenarioId: scenario.id,
          phase: "followup",
          words: ["health savings account", "Optum Bank"],
        }),
      );
    }
    assertChecks(proof.followup.checks, `${scenario.id} follow-up`);
  }

  await writeTranscript(proof);
  return proof;
}

async function main() {
  await loadLocalEnv();
  loadAgentMailSecrets();
  const agentInbox = requireEnv("AGENTMAIL_INBOX_ID");
  const senderInbox = requireEnv("AGENTMAIL_LIVE_SENDER_INBOX");
  if (agentInbox === senderInbox)
    throw new Error("AGENTMAIL_INBOX_ID and AGENTMAIL_LIVE_SENDER_INBOX must differ");
  requireEnv("AGENTMAIL_API_KEY");
  requireEnv("AGENTMAIL_LIVE_SENDER_API_KEY");
  requireEnv("OPENAI_API_KEY");

  await writeBookletDocumentScenarios();
  await fs.mkdir(proofRoot, { recursive: true });

  const selected = new Set(
    (process.env.AGENTMAIL_PROOF_SCENARIOS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const scenarios = selected.size
    ? documentScenarios.filter((scenario) => selected.has(scenario.id))
    : documentScenarios;
  const agentClient = new AgentMailClient({
    apiKey: process.env.AGENTMAIL_API_KEY!,
    timeoutInSeconds: 60,
    maxRetries: 2,
  });
  const senderClient = new AgentMailClient({
    apiKey: process.env.AGENTMAIL_LIVE_SENDER_API_KEY!,
    timeoutInSeconds: 60,
    maxRetries: 2,
  });
  const startedAt = new Date().toISOString();
  const proofs: ScenarioProof[] = [];
  for (const scenario of scenarios) {
    console.log(`Sending ${scenario.id}: ${scenario.title}`);
    const proof = await runScenario({
      agentClient,
      senderClient,
      agentInbox,
      senderInbox,
      scenario,
    });
    proofs.push(proof);
    console.log(`Verified ${scenario.id}: ${proof.reply.messageId}`);
  }
  const result = {
    startedAt,
    completedAt: new Date().toISOString(),
    agentInbox,
    senderInbox,
    scenarioCount: proofs.length,
    proofs,
  };
  const timestamp = startedAt.replace(/[:.]/g, "-");
  const proofPath = path.join(proofRoot, `proof-${timestamp}.json`);
  await fs.writeFile(proofPath, JSON.stringify(result, null, 2));
  await fs.writeFile(
    path.join(proofRoot, "latest.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(`Wrote email proof to ${path.relative(root, proofPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
