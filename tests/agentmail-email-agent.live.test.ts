import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { AgentMailClient, type AgentMail } from "agentmail";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { optimizePdfForEmailAppendix } from "../lib/pdf-email-optimizer";

const runLive = process.env.AGENTMAIL_LIVE_TEST === "1";
const liveSuite = runLive ? describe.sequential : describe.skip;
const agentInbox = process.env.AGENTMAIL_INBOX_ID || "";
const senderInbox = process.env.AGENTMAIL_LIVE_SENDER_INBOX || "";
const sourcePath = resolve(
  process.env.AGENTMAIL_LIVE_FIXTURE ||
    "notion-call-transcripts/Big Tows Benefit Booklet.pdf",
);
const outputPath = resolve(
  process.env.AGENTMAIL_LIVE_OUTPUT ||
    "output/pdf/agentmail-email-agent-live-suite.pdf",
);

let client: AgentMailClient;

const sleep = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function messageText(message: AgentMail.Message) {
  return String(
    message.extractedText || message.text || message.preview || "",
  ).trim();
}

async function waitForAgentReply(
  threadId: string,
  timeoutMilliseconds: number,
) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const page = await client.inboxes.messages.list(senderInbox, { limit: 100 });
    const candidate = page.messages.find(
      (message) =>
        message.threadId === threadId &&
        message.from.toLowerCase().includes(agentInbox.toLowerCase()),
    );
    if (candidate) {
      return client.inboxes.messages.get(senderInbox, candidate.messageId);
    }
    await sleep(5_000);
  }
  throw new Error(`Timed out waiting for the agent reply in thread ${threadId}`);
}

async function downloadAttachment(
  message: AgentMail.Message,
  attachment: NonNullable<AgentMail.Message["attachments"]>[number],
) {
  const metadata = await client.inboxes.messages.getAttachment(
    senderInbox,
    message.messageId,
    attachment.attachmentId,
  );
  const response = await fetch(metadata.downloadUrl);
  if (!response.ok)
    throw new Error(`Attachment download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

liveSuite("AgentMail email agent - live delivery", () => {
  beforeAll(() => {
    const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
    if (!apiKey) throw new Error("AGENTMAIL_API_KEY is required");
    if (!agentInbox) throw new Error("AGENTMAIL_INBOX_ID is required");
    if (!senderInbox)
      throw new Error("AGENTMAIL_LIVE_SENDER_INBOX is required");
    if (senderInbox === agentInbox)
      throw new Error("The live sender must be a separate AgentMail inbox");
    client = new AgentMailClient({
      apiKey,
      timeoutInSeconds: 60,
      maxRetries: 2,
    });
  });

  it(
    "sends a general email and receives an AI reply",
    async () => {
      const token = `general-${Date.now()}`;
      const sent = await client.inboxes.messages.send(senderInbox, {
        to: [agentInbox],
        subject: `Ansa live general reply ${token}`,
        text: `This is an authorized live integration test. Reply briefly and include this token: ${token}`,
      });

      const reply = await waitForAgentReply(sent.threadId, 180_000);
      expect(messageText(reply)).toContain(token);
    },
    240_000,
  );

  it(
    "asks only for the required booklet intake information when it is missing",
    async () => {
      const token = `missing-${Date.now()}`;
      const sent = await client.inboxes.messages.send(senderInbox, {
        to: [agentInbox],
        subject: `Create a benefits booklet ${token}`,
        text: "Please create an employee benefits booklet. I have not provided the employer, plan year, eligibility rule, current plan list, or source documents yet.",
      });

      const reply = await waitForAgentReply(sent.threadId, 180_000);
      const text = messageText(reply).toLowerCase();
      expect(text).toContain("employer name");
      expect(text).toContain("plan-year start");
      expect(text).toContain("plan-year end");
      expect(text).toContain("eligibility waiting period");
      expect(text).toContain("current plans");
    },
    240_000,
  );

  it(
    "sends the repo source and receives a complete source-backed PDF",
    async () => {
      const source = await optimizePdfForEmailAppendix(
        Buffer.from(await readFile(sourcePath)),
      );
      const token = `booklet-${Date.now()}`;
      const sent = await client.inboxes.messages.send(senderInbox, {
        to: [agentInbox],
        subject: `Create the Big Tows benefits booklet ${token}`,
        text: `Please generate and attach the finished employee benefits booklet using only the attached source and these confirmed facts.

Employer name: Big Tows Inc.
Plan-year start: March 1, 2026.
Plan-year end: February 28, 2027.
Eligibility waiting period: The initial eligibility period begins the day an employee becomes benefit eligible and ends 30 days from that date. All benefits begin the first day of the following month after two months of employment.
Current plans:
- Medical: UnitedHealthcare Freedom EPO ZD 25/50/100
- Dental: UnitedHealthcare Dental Options PPO 20
- Vision: UnitedHealthcare Vision Plan SF020

Premiums and employee contributions are provided separately. There are no per-pay amounts in this source. Do not invent costs.`,
        attachments: [
          {
            filename: basename(sourcePath),
            contentType: "application/pdf",
            content: source.toString("base64"),
          },
        ],
      });

      const reply = await waitForAgentReply(sent.threadId, 900_000);
      const attachment = reply.attachments?.find(
        (item) => item.contentType === "application/pdf",
      );
      expect(attachment).toBeDefined();
      const pdfBytes = await downloadAttachment(reply, attachment!);
      expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdfBytes.byteLength).toBeGreaterThan(1_000_000);
      const pdf = await PDFDocument.load(pdfBytes);
      expect(pdf.getPageCount()).toBe(36);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, pdfBytes);
    },
    1_000_000,
  );
});
