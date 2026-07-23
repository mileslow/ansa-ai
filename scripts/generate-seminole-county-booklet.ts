import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const baseUrl = (
  process.env.BOOKLET_BACKEND_BASE_URL || "http://127.0.0.1:5175"
).replace(/\/$/, "");
const sourcePath = path.resolve(
  "source-docs/04_prior-booklet-or-template/completed-employer-guides/style-references/02_seminole-county_2026_employee-benefits-guide.pdf",
);
const outputDirectory = path.resolve(
  "output/pdf/seminole-county-2026/backend-generation",
);

async function request(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/booklet-pipeline`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = JSON.parse(text);
  if (!response.ok && response.status !== 202) {
    throw new Error(
      `Booklet backend returned ${response.status}: ${JSON.stringify(parsed).slice(0, 2_000)}`,
    );
  }
  return { status: response.status, body: parsed };
}

async function downloadPdf(runId: string, signedUrl?: string | null) {
  const response = await fetch(
    signedUrl || `${baseUrl}/api/booklet-pipeline`,
    signedUrl
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "download", runId }),
        },
  );
  if (!response.ok) throw new Error(`Generated PDF download returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await fs.mkdir(outputDirectory, { recursive: true });
  const source = await fs.readFile(sourcePath);
  const created = await request({
    action: "create_thread",
    companyId: `seminole-county-fl-2026-${Date.now()}`,
    messageAsEvidence: true,
    message: `Create a current 2026 employee benefits booklet for Seminole County Government from the attached official guide.

The attached document is Seminole County Government's current employer selection and rate record for the January 1, 2026 through December 31, 2026 plan year, not a generic template or prior-year guide. It confirms that the plans and programs shown as available in the guide are offered by Seminole County for 2026.

Current selected medical options: Cigna OAP High/Buy-up Plan, Cigna OAP Mid Plan, Cigna OAP Low Plan, and Cigna HSA Plan. Current selected dental options: Reliance Matrix PPO Low Plan, PPO Mid Plan, and PPO High Plan. The current vision option is the EyeMed Vision Plan using the Insight Network. The guide also confirms employer-paid Basic Life and AD&D and Long-Term Disability; voluntary Life and AD&D, Short-Term Disability, Hospital Indemnity, Critical Illness, Cancer Indemnity, Accident, and Legal plans; Cigna HSA and FSA accounts; MDLIVE virtual care; and the Cigna EAP.

Preserve the employee costs, eligibility rules, carriers, contacts, and plan details exactly as supported by the guide. Do not invent missing formal policy terms.`,
    files: [
      {
        fileName: path.basename(sourcePath),
        mimeType: "application/pdf",
        base64: source.toString("base64"),
      },
    ],
  });
  const threadId = created.body.thread?.id;
  const fileIds = (created.body.files || []).map((file: { id: string }) => file.id);
  if (!threadId || fileIds.length < 2) {
    throw new Error("The backend did not persist both the guide and instruction evidence");
  }

  process.stdout.write(
    `${JSON.stringify({ stage: "created", threadId, fileCount: fileIds.length })}\n`,
  );
  const started = await request({
    action: "start",
    threadId,
    fileIds,
    generationMode: "employee_booklet",
    initialAnswers: {
      "plans.selected": [
        { planName: "Cigna OAP High/Buy-up Plan", benefitType: "medical", carrier: "Cigna" },
        { planName: "Cigna OAP Mid Plan", benefitType: "medical", carrier: "Cigna" },
        { planName: "Cigna OAP Low Plan", benefitType: "medical", carrier: "Cigna" },
        { planName: "Cigna HSA Plan", benefitType: "medical", carrier: "Cigna" },
        { planName: "Reliance Matrix PPO Low Plan", benefitType: "dental", carrier: "Reliance Matrix" },
        { planName: "Reliance Matrix PPO Mid Plan", benefitType: "dental", carrier: "Reliance Matrix" },
        { planName: "Reliance Matrix PPO High Plan", benefitType: "dental", carrier: "Reliance Matrix" },
        { planName: "EyeMed Vision Plan - Insight Network", benefitType: "vision", carrier: "EyeMed" },
        { planName: "Basic Life and AD&D", benefitType: "life", carrier: "Reliance Matrix" },
        { planName: "Voluntary Short-Term Disability", benefitType: "std", carrier: "Reliance Matrix" },
        { planName: "Long-Term Disability", benefitType: "ltd", carrier: "Reliance Matrix" },
      ],
      "offeredBenefits.hsa": true,
    },
  });
  const run = started.body.run;
  if (!run?.id) throw new Error("The backend returned no generation run");
  const status = await request({ action: "status", runId: run.id });
  await fs.writeFile(
    path.join(outputDirectory, "backend-run.json"),
    `${JSON.stringify(status.body, null, 2)}\n`,
  );

  if (run.status === "blocked") {
    process.stdout.write(
      `${JSON.stringify({
        stage: "blocked",
        threadId,
        runId: run.id,
        questions: run.questions,
      }, null, 2)}\n`,
    );
    process.exitCode = 2;
    return;
  }
  if (run.status !== "complete" || !run.pdfStoragePath) {
    throw new Error(
      `Backend generation did not complete: ${JSON.stringify({ status: run.status, error: run.error })}`,
    );
  }

  const pdf = await downloadPdf(run.id, run.pdfUrl);
  const parsedPdf = await PDFDocument.load(pdf);
  const pdfPath = path.join(
    outputDirectory,
    "seminole-county-2026-employee-benefits-booklet.pdf",
  );
  await fs.writeFile(pdfPath, pdf);
  process.stdout.write(
    `${JSON.stringify({
      stage: "complete",
      threadId,
      runId: run.id,
      pdfPath,
      pageCount: parsedPdf.getPageCount(),
      confidence: run.confidenceReport?.overall,
    }, null, 2)}\n`,
  );
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
