import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

const root = process.cwd();
const outputRoot = path.join(root, "test-info", "document-scenarios");

type RateRow = {
  plan: string;
  benefit: string;
  carrier: string;
  tier: string;
  premium: number;
  employer: number;
};

type PdfDoc = {
  fileName: string;
  title: string;
  lines: string[];
};

type WorkbookDoc = {
  fileName: string;
  rows: RateRow[];
};

type SourceDoc = {
  sourcePath: string;
  fileName: string;
};

type FollowupPack = {
  id: string;
  title: string;
  instructions: string[];
  pdfs?: PdfDoc[];
  sourceDocs?: SourceDoc[];
  workbook?: WorkbookDoc;
};

type Scenario = {
  id: string;
  title: string;
  expected: string[];
  pdfs: PdfDoc[];
  sourceDocs?: SourceDoc[];
  workbook?: WorkbookDoc;
  followups?: FollowupPack[];
};

export const documentScenarios: Scenario[] = [
  {
    id: "00_complete-medical-dental",
    title: "Complete medical and dental package",
    expected: [
      "Builder should produce an employee_booklet preview without blockers.",
      "Email generator should reply with a completed booklet PDF.",
    ],
    pdfs: [
      application({
        employer: "Scenario Complete Manufacturing LLC",
        offered: ["medical", "dental"],
        selectedPlans: [
          "Medical: University of Rochester Your PPO Option - Excellus BlueCross BlueShield",
          "Dental: Delta Dental Basic Family PPO Plan I - Delta Dental",
        ],
        extra: [
          "HSA, HRA, FSA, vision, life, disability, voluntary, telemedicine, and EAP are not offered.",
        ],
      }),
    ],
    sourceDocs: [
      {
        sourcePath:
          "source-docs/03_benefit-source-documents/medical-insurance/university-of-rochester-2026-medical-plans/your-ppo-option-sbc.pdf",
        fileName: "01_rochester-your-ppo-option-sbc.pdf",
      },
      {
        sourcePath:
          "source-docs/03_benefit-source-documents/dental/delta-dental-nj-family-ehb/basic-family-ppo-plan-i/policy.pdf",
        fileName: "02_delta-dental-basic-family-ppo-plan-i-policy.pdf",
      },
    ],
    workbook: rates("03_rates-and-contributions.xlsx", [
      rate("University of Rochester Your PPO Option", "medical", "Excellus BlueCross BlueShield", 612, 250),
      rate("Delta Dental Basic Family PPO Plan I", "dental", "Delta Dental", 42, 21),
    ]),
  },
  {
    id: "01_hsa-selected-no-hsa-form",
    title: "HSA selected in application but no HSA form attached",
    expected: [
      "Builder should ask for HSA source materials or account administrator details.",
      "Email generator should ask the same HSA follow-up instead of omitting the selected HSA.",
    ],
    pdfs: [
      application({
        employer: "Scenario HSA Missing LLC",
        offered: ["medical", "hsa"],
        selectedPlans: ["Medical: University of Rochester Your HSA-Eligible Option - Excellus BlueCross BlueShield"],
        extra: [
          "The medical plan is HSA-compatible.",
          "The employer checked HSA on the application.",
          "The HSA custodian, account-opening process, payroll election rules, and employer contribution schedule are in a separate HSA form that is not included in this scenario.",
        ],
      }),
    ],
    sourceDocs: [
      {
        sourcePath:
          "source-docs/03_benefit-source-documents/medical-insurance/university-of-rochester-2026-medical-plans/your-hsa-eligible-option-sbc.pdf",
        fileName: "01_rochester-your-hsa-eligible-option-sbc.pdf",
      },
    ],
    workbook: rates("02_rates-and-contributions.xlsx", [
      rate("University of Rochester Your HSA-Eligible Option", "medical", "Excellus BlueCross BlueShield", 590, 225),
    ]),
    followups: [
      {
        id: "01_hsa-account-source-details",
        title: "Follow-up HSA account source details",
        instructions: [
          "Reply with the attached HSA account source details. Include the HSA in the booklet.",
          "HSA administrator/custodian: Optum Bank.",
          "Employer HSA contribution: $500 annually for employee-only HDHP coverage and $1,000 annually for family HDHP coverage, funded in equal quarterly installments.",
        ],
        pdfs: [
          planSummary(
            "01_scenario-hsa-account-source-details.pdf",
            "hsa",
            "Scenario HSA Account Program",
            "Optum Bank",
            [
              "Benefit type: Health Savings Account (HSA).",
              "Employer selection: HSA is offered with the HSA-compatible medical plan.",
              "Account administrator/custodian: Optum Bank.",
              "Employer contribution: $500 annually for employee-only HDHP coverage and $1,000 annually for family HDHP coverage.",
              "Funding schedule: equal quarterly installments deposited after account opening.",
              "Eligibility: employees enrolled in the employer's HSA-compatible medical plan and otherwise eligible under IRS HSA rules.",
              "Employee action: open an Optum Bank HSA before employer contributions can be deposited.",
            ],
          ),
        ],
      },
    ],
  },
  {
    id: "02_extra-vision-plan-not-in-application",
    title: "Extra vision plan file not selected in application",
    expected: [
      "Builder should ask whether the uploaded vision benefit should be included.",
      "Email generator should ask for the same employer-selection confirmation.",
    ],
    pdfs: [
      application({
        employer: "Scenario Extra Vision LLC",
        offered: ["medical"],
        selectedPlans: ["Medical: Kaiser Permanente Silver 70 HMO 2500/55 - Kaiser Permanente"],
        extra: ["Vision is not checked on the employer application."],
      }),
    ],
    sourceDocs: [
      {
        sourcePath:
          "source-docs/03_benefit-source-documents/medical-insurance/kaiser-permanente-ca-small-group-2025-hmo/silver-70-hmo-2500-55-pcp.pdf",
        fileName: "01_kaiser-silver-70-hmo-2500-55-pcp.pdf",
      },
      {
        sourcePath:
          "source-docs/03_benefit-source-documents/vision/eyemed-individual-family/bright-bold-healthy-options/summary-of-benefits.pdf",
        fileName: "02_unselected-eyemed-bright-bold-healthy-options-summary.pdf",
      },
    ],
    workbook: rates("03_rates-and-contributions.xlsx", [
      rate("Kaiser Permanente Silver 70 HMO 2500/55", "medical", "Kaiser Permanente", 735, 300),
    ]),
    followups: [
      {
        id: "01_confirm-vision-not-offered",
        title: "Follow-up confirmation to omit accidental vision file",
        instructions: [
          "Reply: No, do not include the vision benefit. The EyeMed file was attached accidentally and the employer only offers medical.",
          "planYear.start: 2026-01-01",
          "planYear.end: 2026-12-31",
        ],
      },
    ],
  },
  {
    id: "03_application-only-progressive-intake",
    title: "Application only progressive intake",
    expected: [
      "Builder should ask for selected current plans.",
      "After a selected-plan answer, builder should continue and ask for any remaining source-backed details instead of failing.",
    ],
    pdfs: [
      application({
        employer: "Scenario Application Only LLC",
        offered: [],
        selectedPlans: [],
        extra: [
          "The employer has not provided plan summaries or rate files yet.",
          "The agent should ask for the missing plan selections and supporting documents.",
        ],
      }),
    ],
    followups: [
      {
        id: "01_selected-medical-plan-source-pack",
        title: "Follow-up selected medical plan source pack",
        instructions: [
          "Reply with the selected current plan: Medical: Healthfirst Essential Plan 2 - Healthfirst.",
          "Attach the plan document and rates from this folder so the agent can continue the booklet intake.",
        ],
        sourceDocs: [
          {
            sourcePath:
              "source-docs/03_benefit-source-documents/medical-insurance/healthfirst-ny-essential-plan-2026/essential-plan-2.pdf",
            fileName: "01_healthfirst-essential-plan-2.pdf",
          },
        ],
        workbook: rates("02_rates-and-contributions.xlsx", [
          rate("Healthfirst Essential Plan 2", "medical", "Healthfirst", 875, 275),
        ]),
      },
    ],
  },
  {
    id: "04_rate-sheet-plan-mismatch",
    title: "Application and spreadsheet plan mismatch",
    expected: [
      "Builder should ask which uploaded rate row matches the selected medical plan.",
      "Email generator should ask the rate-row mismatch question instead of using the wrong rate.",
    ],
    pdfs: [
      application({
        employer: "Scenario Rate Mismatch LLC",
        offered: ["medical"],
        selectedPlans: ["Medical: Healthfirst Essential Plan 1 - Healthfirst"],
        extra: ["The selected medical plan is Healthfirst Essential Plan 1."],
      }),
    ],
    sourceDocs: [
      {
        sourcePath:
          "source-docs/03_benefit-source-documents/medical-insurance/healthfirst-ny-essential-plan-2026/essential-plan-1.pdf",
        fileName: "01_healthfirst-essential-plan-1.pdf",
      },
    ],
    workbook: rates("02_mismatched-rates.xlsx", [
      rate("Healthfirst Essential Plan 3", "medical", "Healthfirst", 910, 300),
      rate("Kaiser Permanente Bronze 60 HMO 5800/60", "medical", "Kaiser Permanente", 520, 200),
    ]),
    followups: [
      {
        id: "01_corrected-rate-workbook",
        title: "Follow-up corrected rate workbook",
        instructions: [
          "Reply with the corrected rate workbook attached. Use the Healthfirst Essential Plan 1 rate row for the selected medical plan.",
        ],
        workbook: rates("03_corrected-rates-and-contributions.xlsx", [
          rate("Healthfirst Essential Plan 1", "medical", "Healthfirst", 845, 285),
        ]),
      },
    ],
  },
];

function rate(
  plan: string,
  benefit: string,
  carrier: string,
  premium: number,
  employer: number,
): RateRow {
  return { plan, benefit, carrier, tier: "Employee", premium, employer };
}

function rates(fileName: string, rows: RateRow[]): WorkbookDoc {
  return { fileName, rows };
}

function application({
  employer,
  offered,
  selectedPlans,
  extra,
}: {
  employer: string;
  offered: string[];
  selectedPlans: string[];
  extra: string[];
}): PdfDoc {
  return {
    fileName: "00_completed-employer-application.pdf",
    title: `${employer} completed employer benefits application`,
    lines: [
      "Completed employer benefits application",
      `Employer name: ${employer}`,
      "Plan-year start date: 2026-01-01",
      "Plan-year end date: 2026-12-31",
      "Open enrollment: November 3, 2025 through November 14, 2025",
      "Eligibility waiting period: first day of the month after 30 days of employment.",
      "Eligible employees: regular full-time employees scheduled for at least 30 hours per week.",
      "Eligible dependents: spouse, domestic partner, and children through the end of the month they turn age 26.",
      "Payroll frequency: biweekly with 26 deductions per year.",
      `Benefit lines checked on application: ${offered.length ? offered.join(", ") : "none provided"}.`,
      selectedPlans.length
        ? `Selected current plans: ${selectedPlans.join("; ")}.`
        : "Selected current plans: not provided.",
      "Benefits contact: Riley Stone, Benefits Manager, benefits@scenario-employer.test, 208-555-0140.",
      ...extra,
      "Synthetic fixture: this document is fictional and for Ansa testing only.",
    ],
  };
}

function planSummary(
  fileName: string,
  benefit: string,
  planName: string,
  carrier: string,
  extra: string[] = [],
): PdfDoc {
  const base =
    benefit === "medical"
      ? [
          "Deductible: $3,000 individual / $6,000 family.",
          "Out-of-pocket maximum: $7,500 individual / $15,000 family.",
          "Primary care: $30 copay after deductible.",
          "Specialist: $60 copay after deductible.",
          "Emergency room: $350 copay after deductible.",
          "Prescription drugs: generic $10 / preferred brand $45 / non-preferred brand $90 after deductible.",
        ]
      : benefit === "dental"
        ? [
            "Preventive services: 100%.",
            "Basic restorative services: 80% after deductible.",
            "Major services: 50% after deductible.",
            "Annual maximum: $1,500 per covered adult.",
          ]
        : [
            "Benefit schedule is summarized for fixture testing.",
            "Carrier material alone does not prove employer selection.",
          ];
  return {
    fileName,
    title: `${planName} ${benefit} plan summary`,
    lines: [
      `${benefit.toUpperCase()} plan summary`,
      `Plan name: ${planName}`,
      `Carrier or administrator: ${carrier}`,
      "Coverage period: 2026-01-01 through 2026-12-31",
      ...base,
      ...extra,
      "Synthetic fixture: this document is fictional and for Ansa testing only.",
    ],
  };
}

function wrappedLines(text: string, maxCharacters = 92) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function writePdf(filePath: string, doc: PdfDoc) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 744;
  page.drawText(doc.title, {
    x: 54,
    y,
    size: 15,
    font: bold,
    color: rgb(0.06, 0.18, 0.29),
  });
  y -= 28;
  for (const sourceLine of doc.lines) {
    for (const line of wrappedLines(sourceLine)) {
      if (y < 54) {
        page = pdf.addPage([612, 792]);
        y = 744;
      }
      page.drawText(line, {
        x: 54,
        y,
        size: 10,
        font: regular,
        color: rgb(0.1, 0.13, 0.18),
      });
      y -= 16;
    }
    y -= 5;
  }
  await fs.writeFile(filePath, await pdf.save());
}

async function writeWorkbook(filePath: string, workbook: WorkbookDoc) {
  const book = XLSX.utils.book_new();
  const rows = [
    ["Scenario synthetic rate workbook"],
    ["Plan", "Tier", "Monthly Premium", "ER Cost", "EE Cost", "Carrier", "Benefit"],
    ...workbook.rows.map((row) => [
      row.plan,
      row.tier,
      row.premium,
      row.employer,
      Math.max(0, row.premium - row.employer),
      row.carrier,
      row.benefit,
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 34 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(book, sheet, "Rates - 26 Pay Periods");
  await fs.writeFile(
    filePath,
    Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" })),
  );
}

function scenarioReadme(scenario: Scenario) {
  const generatedFiles = [
    ...scenario.pdfs.map((doc) => `- \`${doc.fileName}\``),
    ...(scenario.sourceDocs ?? []).map(
      (doc) => `- \`${doc.fileName}\` copied from \`${doc.sourcePath}\``,
    ),
    ...(scenario.workbook ? [`- \`${scenario.workbook.fileName}\``] : []),
  ];
  return `# ${scenario.title}

Synthetic source package for Ansa document-scenario testing. Nothing in this
folder is valid for enrollment, insurance administration, or legal use. Plan
documents are copied from the repository source-document reservoir and renamed
for scenario readability.

## Expected behavior

${scenario.expected.map((item) => `- ${item}`).join("\n")}

## Files

${generatedFiles.join("\n")}

${scenario.followups?.length ? `## Staged follow-ups

${scenario.followups
  .map(
    (followup) =>
      `### ${followup.title}

${followup.instructions.map((item) => `- ${item}`).join("\n")}

Files live in \`${followup.id}/\`.`,
  )
  .join("\n\n")}
` : ""}
`;
}

function followupReadme(followup: FollowupPack) {
  const files = [
    ...(followup.pdfs ?? []).map((doc) => `- \`${doc.fileName}\``),
    ...(followup.sourceDocs ?? []).map(
      (doc) => `- \`${doc.fileName}\` copied from \`${doc.sourcePath}\``,
    ),
    ...(followup.workbook ? [`- \`${followup.workbook.fileName}\``] : []),
  ];
  return `# ${followup.title}

${followup.instructions.map((item) => `- ${item}`).join("\n")}

## Files

${files.join("\n")}
`;
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });
  const catalog: Array<Record<string, unknown>> = [];
  for (const scenario of documentScenarios) {
    const directory = path.join(outputRoot, scenario.id);
    await fs.rm(directory, { recursive: true, force: true });
    await fs.mkdir(directory, { recursive: true });
    for (const pdf of scenario.pdfs)
      await writePdf(path.join(directory, pdf.fileName), pdf);
    for (const doc of scenario.sourceDocs ?? []) {
      await fs.copyFile(
        path.join(root, doc.sourcePath),
        path.join(directory, doc.fileName),
      );
    }
    if (scenario.workbook)
      await writeWorkbook(path.join(directory, scenario.workbook.fileName), scenario.workbook);
    for (const followup of scenario.followups ?? []) {
      const followupDirectory = path.join(directory, followup.id);
      await fs.mkdir(followupDirectory, { recursive: true });
      for (const pdf of followup.pdfs ?? [])
        await writePdf(path.join(followupDirectory, pdf.fileName), pdf);
      for (const doc of followup.sourceDocs ?? []) {
        await fs.copyFile(
          path.join(root, doc.sourcePath),
          path.join(followupDirectory, doc.fileName),
        );
      }
      if (followup.workbook)
        await writeWorkbook(
          path.join(followupDirectory, followup.workbook.fileName),
          followup.workbook,
        );
      await fs.writeFile(
        path.join(followupDirectory, "README.md"),
        followupReadme(followup),
      );
    }
    await fs.writeFile(path.join(directory, "README.md"), scenarioReadme(scenario));
    catalog.push({
      id: scenario.id,
      title: scenario.title,
      sha: createHash("sha1")
        .update(JSON.stringify(scenario))
        .digest("hex")
        .slice(0, 12),
      files: [
        ...scenario.pdfs.map((doc) => doc.fileName),
        ...(scenario.sourceDocs ?? []).map((doc) => doc.fileName),
        ...(scenario.workbook ? [scenario.workbook.fileName] : []),
      ],
      followups: (scenario.followups ?? []).map((followup) => ({
        id: followup.id,
        title: followup.title,
        files: [
          ...(followup.pdfs ?? []).map((doc) => `${followup.id}/${doc.fileName}`),
          ...(followup.sourceDocs ?? []).map((doc) => `${followup.id}/${doc.fileName}`),
          ...(followup.workbook ? [`${followup.id}/${followup.workbook.fileName}`] : []),
        ],
      })),
      expected: scenario.expected,
    });
  }
  await fs.writeFile(
    path.join(outputRoot, "README.md"),
    `# Booklet document scenarios

Generated by \`npx tsx scripts/generate-booklet-document-scenarios.ts\`.

These folders intentionally exercise missing information, extra source
documents, application-only intake, and rate mismatch behavior in the
\`employee_booklet\` builder and email generator. Each scenario uses distinct
reservoir plan documents when plan evidence is required.

${catalog.map((item) => `- \`${item.id}\`: ${item.title}`).join("\n")}
`,
  );
  await fs.writeFile(path.join(outputRoot, "scenario-catalog.json"), JSON.stringify(catalog, null, 2));
  return { outputRoot, count: documentScenarios.length };
}

export async function writeBookletDocumentScenarios() {
  return main();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
    .then((result) => {
      console.log(
        `Wrote ${result.count} scenario folder(s) to ${path.relative(root, result.outputRoot)}`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
