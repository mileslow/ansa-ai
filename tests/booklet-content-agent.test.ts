import { describe, expect, it, vi } from "vitest";
import {
  BOOKLET_CONTENT_SECTION_IDS,
  generateBookletContent,
  generateBookletContentIncrementally,
} from "../lib/booklet-content-agent";
import type { BenefitsPackage, BookletOutline } from "../lib/booklet-types";

function benefitsPackage(): BenefitsPackage {
  return {
    employer: {
      name: "Acme Inc.",
      legalName: "Acme Incorporated",
      website: "https://acme.example",
    },
    planYear: {
      start: "2026-01-01",
      end: "2026-12-31",
      label: "2026",
    },
    eligibility: {
      waitingPeriod: "First of the month after 30 days",
      description: "Full-time employees are eligible first of the month after 30 days.",
      employeeClasses: ["Full-time employees"],
    },
    offeredBenefits: [
      {
        benefitType: "medical",
        offered: true,
        selectedPlans: ["Acme Gold"],
        contributionRules: [],
        contacts: [],
        sourceRefs: [],
        confidence: 0.98,
      },
    ],
    plans: [
      {
        id: "medical-1",
        benefitType: "medical",
        name: "Acme Gold",
        carrier: "Example Health",
        year: "2026",
        sourceRefs: [],
        confidence: 0.98,
        attributes: null,
      },
    ],
    rates: [],
    contributions: [],
    contacts: [
      {
        role: "Benefits broker",
        name: "Jamie Rivera",
        email: "jamie@acme.example",
        sourceRefs: [],
      },
    ],
    accounts: [],
    bookletStyle: { sectionOrder: [], sourceRefs: [] },
    sourceMap: {},
    confidenceReport: {
      overall: 0.9,
      fields: {},
      sources: [],
      warnings: [],
      assumptions: [],
      conflicts: [],
      manualAnswers: [],
    },
  };
}

function outline(): BookletOutline {
  return {
    sections: [
      { id: "cover", title: "Cover", sourceRefs: [] },
      { id: "welcome", title: "Welcome", sourceRefs: [] },
      { id: "enrollment", title: "How to enroll", sourceRefs: [] },
      { id: "eligibility", title: "Eligibility", sourceRefs: [] },
      {
        id: "medical",
        title: "Medical",
        benefitType: "medical",
        sourceRefs: [],
      },
      {
        id: "dental",
        title: "Dental",
        benefitType: "dental",
        sourceRefs: [],
      },
      { id: "contacts", title: "Contacts", sourceRefs: [] },
      { id: "legal", title: "Legal", sourceRefs: [] },
    ],
  };
}

function emptyBatch() {
  return BOOKLET_CONTENT_SECTION_IDS.map((id) => ({
    id,
    copy: "",
    sourcePaths: [] as string[],
  }));
}

describe("generateBookletContent", () => {
  it("generates independent section batches concurrently and publishes each completed module", async () => {
    const published: string[] = [];
    const parse = vi.fn(async (request: any) => {
      const prompt = String(request.input[1].content);
      const batch = JSON.parse(prompt.split("Section batch:\n")[1]);
      return {
        output_parsed: {
          sections: batch.map((section: any) => ({
            id: section.id,
            copy: "Benefits information.",
            sourcePaths: [section.facts[0].path],
          })),
        },
      };
    });

    const result = await generateBookletContentIncrementally(
      benefitsPackage(),
      outline(),
      "streamed",
      {
        client: { responses: { parse } } as any,
        model: "test-stream-model",
        batchSize: 2,
        concurrency: 2,
        onSection: (section) => void published.push(section.id),
      },
    );

    expect(parse.mock.calls.length).toBeGreaterThan(1);
    expect(new Set(published)).toEqual(new Set(BOOKLET_CONTENT_SECTION_IDS));
    expect(result.sections.map((section) => section.id)).toEqual(
      BOOKLET_CONTENT_SECTION_IDS,
    );
    expect(result.sections.find((section) => section.id === "medical")).toMatchObject({
      status: "ready",
      copy: "Benefits information.",
    });
    expect(result.sections.find((section) => section.id === "enrollment")).toMatchObject({
      status: "blocked",
      copy: "",
    });
  });

  it("batches every section and returns deterministic ready, blocked, and omitted states", async () => {
    const sections = emptyBatch();
    const write = (
      id: (typeof BOOKLET_CONTENT_SECTION_IDS)[number],
      copy: string,
      sourcePaths: string[],
    ) => Object.assign(sections.find((section) => section.id === id)!, { copy, sourcePaths });
    write(
      "cover",
      "Acme Inc.'s benefits guide covers 2026.",
      ["employer.name", "planYear.label"],
    );
    write(
      "toc",
      "Review the Welcome, Eligibility, Medical, and Contacts sections.",
      ["outline.sections"],
    );
    write(
      "welcome",
      "Welcome to Acme Inc.'s benefits guide.",
      ["employer.name"],
    );
    write(
      "eligibility",
      "Full-time employees are eligible first of the month after 30 days.",
      ["eligibility.description"],
    );
    write(
      "medical",
      "Acme Gold is the medical plan from Example Health.",
      ["plans[0].name", "plans[0].carrier"],
    );
    write(
      "contacts",
      "Benefits questions can be sent to Jamie Rivera at jamie@acme.example.",
      ["contacts[0].name", "contacts[0].email"],
    );
    const parse = vi.fn(async () => ({ output_parsed: { sections } }));

    const result = await generateBookletContent(
      benefitsPackage(),
      outline(),
      "employee-friendly",
      { client: { responses: { parse } } as any, model: "test-model" },
    );

    expect(parse).toHaveBeenCalledTimes(1);
    expect(result.sections.map((section) => section.id)).toEqual(
      BOOKLET_CONTENT_SECTION_IDS,
    );
    expect(result).toMatchObject({
      variant: "employee-friendly",
      model: "test-model",
    });
    expect(result.sections.find((section) => section.id === "medical")).toMatchObject({
      status: "ready",
      missingFields: [],
      sourcePaths: ["plans[0].name", "plans[0].carrier"],
    });
    expect(result.sections.find((section) => section.id === "enrollment")).toMatchObject({
      status: "blocked",
      missingFields: ["contacts[role=enrollment|human resources]"],
      copy: "",
    });
    expect(result.sections.find((section) => section.id === "dental")).toMatchObject({
      status: "blocked",
      missingFields: ["plans[benefitType=dental]"],
      copy: "",
    });
    expect(result.sections.find((section) => section.id === "legal")).toMatchObject({
      status: "blocked",
      missingFields: ["plans[].attributes.legal|plans[].attributes.notices"],
      copy: "",
    });
    expect(
      result.sections.find((section) => section.id === "telemedicine"),
    ).toMatchObject({ status: "omitted", missingFields: [], sourcePaths: [], copy: "" });

    const request = parse.mock.calls[0][0] as any;
    const prompt = JSON.stringify(request.input);
    expect(prompt).toContain("Never invent");
    expect(prompt).toContain("employee-friendly");
    for (const id of BOOKLET_CONTENT_SECTION_IDS)
      expect(prompt).toContain(`\\\"id\\\":\\\"${id}\\\"`);
  });

  it("rejects copy that cites a source path outside the section fact set", async () => {
    const sections = emptyBatch();
    Object.assign(sections.find((section) => section.id === "cover")!, {
      copy: "Acme Inc. benefits guide.",
      sourcePaths: ["employer.madeUpField"],
    });
    Object.assign(sections.find((section) => section.id === "toc")!, {
      copy: "Review the Cover section.",
      sourcePaths: ["outline.sections"],
    });
    const parse = vi.fn(async () => ({ output_parsed: { sections } }));

    await expect(
      generateBookletContent(
        benefitsPackage(),
        { sections: [{ id: "cover", title: "Cover", sourceRefs: [] }] },
        "standard",
        { client: { responses: { parse } } as any },
      ),
    ).rejects.toThrow("cited an unavailable source path");
  });

  it("rejects unsupported numeric facts even when a valid path is cited", async () => {
    const sections = emptyBatch();
    Object.assign(sections.find((section) => section.id === "cover")!, {
      copy: "Acme Inc. contributes $999.",
      sourcePaths: ["employer.name"],
    });
    Object.assign(sections.find((section) => section.id === "toc")!, {
      copy: "Review the Cover section.",
      sourcePaths: ["outline.sections"],
    });
    const parse = vi.fn(async () => ({ output_parsed: { sections } }));

    await expect(
      generateBookletContent(
        benefitsPackage(),
        { sections: [{ id: "cover", title: "Cover", sourceRefs: [] }] },
        "standard",
        { client: { responses: { parse } } as any },
      ),
    ).rejects.toThrow("contains an unsupported numeric fact: 999");
  });

  it("accepts grounded calendar dates and comma-formatted benefit amounts", async () => {
    const input = benefitsPackage();
    input.plans[0].attributes = {
      identity: { planName: "Acme Gold", carrier: "Example Health", sourcePages: [1] },
      financial: { deductible: { raw: "$1,500.25" } },
      services: [],
      notices: [],
    } as any;
    const sections = emptyBatch();
    Object.assign(sections.find((section) => section.id === "cover")!, {
      copy: "Coverage runs from January 1, 2026 through December 31, 2026.",
      sourcePaths: ["planYear.start", "planYear.end"],
    });
    Object.assign(sections.find((section) => section.id === "toc")!, {
      copy: "Review the listed benefit sections.",
      sourcePaths: ["outline.sections"],
    });
    Object.assign(sections.find((section) => section.id === "welcome")!, {
      copy: "Welcome to Acme Inc.'s benefits guide.",
      sourcePaths: ["employer.name"],
    });
    Object.assign(sections.find((section) => section.id === "eligibility")!, {
      copy: "Full-time employees are eligible first of the month after 30 days.",
      sourcePaths: ["eligibility.description"],
    });
    Object.assign(sections.find((section) => section.id === "medical")!, {
      copy: "The medical plan has a $1,500.25 deductible.",
      sourcePaths: ["plans[0].attributes.financial"],
    });
    Object.assign(sections.find((section) => section.id === "contacts")!, {
      copy: "Contact Jamie Rivera at jamie@acme.example.",
      sourcePaths: ["contacts[0].name", "contacts[0].email"],
    });
    const parse = vi.fn(async () => ({ output_parsed: { sections } }));
    await expect(
      generateBookletContent(input, outline(), "standard", {
        client: { responses: { parse } } as any,
      }),
    ).resolves.toMatchObject({ variant: "standard" });
  });
});
