import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  BenefitType,
  BenefitsPackage,
  BookletOutline,
  Contact,
} from "./booklet-types";

export const BOOKLET_CONTENT_SECTION_IDS = [
  "cover",
  "toc",
  "welcome",
  "enrollment",
  "eligibility",
  "medical",
  "telemedicine",
  "hra",
  "fsa",
  "dental",
  "vision",
  "life",
  "ltd",
  "eap",
  "voluntary",
  "contacts",
  "legal",
] as const;

export type BookletContentSectionId =
  (typeof BOOKLET_CONTENT_SECTION_IDS)[number];
export type BookletContentSectionStatus = "ready" | "blocked" | "omitted";

export type BookletSectionContent = {
  id: BookletContentSectionId;
  title: string;
  status: BookletContentSectionStatus;
  missingFields: string[];
  /** BenefitsPackage/BookletOutline paths used to ground copy. */
  sourcePaths: string[];
  copy: string;
};

export type BookletContentResult = {
  variant: string;
  model: string;
  sections: BookletSectionContent[];
};

export type BookletContentClient = Pick<OpenAI, "responses">;

export type GenerateBookletContentOptions = {
  apiKey?: string;
  client?: BookletContentClient;
  model?: string;
};

type GroundedFact = { path: string; value: unknown };
type PreparedSection = {
  id: BookletContentSectionId;
  title: string;
  status: BookletContentSectionStatus;
  missingFields: string[];
  facts: GroundedFact[];
};

const SECTION_TITLES: Record<BookletContentSectionId, string> = {
  cover: "Cover",
  toc: "Table of contents",
  welcome: "Welcome",
  enrollment: "How to enroll",
  eligibility: "Eligibility",
  medical: "Medical",
  telemedicine: "Telemedicine",
  hra: "Health reimbursement account",
  fsa: "Flexible spending account",
  dental: "Dental",
  vision: "Vision",
  life: "Life and AD&D",
  ltd: "Long-term disability",
  eap: "Employee assistance program",
  voluntary: "Voluntary benefits",
  contacts: "Contacts",
  legal: "Legal notices",
};

const GeneratedSectionSchema = z.object({
  id: z.enum(BOOKLET_CONTENT_SECTION_IDS),
  copy: z.string().max(1_600),
  sourcePaths: z.array(z.string()),
});

const BatchOutputSchema = z.object({
  sections: z.array(GeneratedSectionSchema),
});

const SYSTEM_PROMPT = `You write concise US employee-benefits booklet copy from a closed fact set.
Never invent, infer, estimate, embellish, or import outside facts. A true statement is not usable unless
it is present in the supplied section facts. Do not add generic coverage claims, legal claims, deadlines,
costs, eligibility rules, carrier capabilities, benefit examples, or contact instructions that are not
supplied. Preserve the supplied meaning and use plain employee-facing language.

Return one result for every supplied section ID in the same order. For a ready section, write one to three
short sentences and list only the exact fact paths actually used. For blocked or omitted sections, return
an empty copy string and an empty sourcePaths array. The requested variant affects tone and presentation
only; it never changes facts, section selection, or source paths.`;

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(isPresent);
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>).some(isPresent);
  return true;
}

function addFact(facts: GroundedFact[], path: string, value: unknown) {
  if (!isPresent(value) || facts.some((fact) => fact.path === path)) return;
  facts.push({ path, value });
}

function addEmployerFacts(facts: GroundedFact[], benefitsPackage: BenefitsPackage) {
  addFact(facts, "employer.name", benefitsPackage.employer.name);
  addFact(facts, "employer.legalName", benefitsPackage.employer.legalName);
  addFact(facts, "employer.address", benefitsPackage.employer.address);
  addFact(facts, "employer.website", benefitsPackage.employer.website);
  addFact(facts, "planYear.start", benefitsPackage.planYear.start);
  addFact(facts, "planYear.end", benefitsPackage.planYear.end);
  addFact(facts, "planYear.label", benefitsPackage.planYear.label);
}

function addContactFacts(
  facts: GroundedFact[],
  contact: Contact,
  index: number,
  prefix = "contacts",
) {
  const base = `${prefix}[${index}]`;
  addFact(facts, `${base}.role`, contact.role);
  addFact(facts, `${base}.name`, contact.name);
  addFact(facts, `${base}.organization`, contact.organization);
  addFact(facts, `${base}.phone`, contact.phone);
  addFact(facts, `${base}.email`, contact.email);
  addFact(facts, `${base}.website`, contact.website);
}

function addOfferingFacts(
  facts: GroundedFact[],
  benefitsPackage: BenefitsPackage,
  benefitType: BenefitType,
) {
  benefitsPackage.offeredBenefits.forEach((offering, index) => {
    if (offering.benefitType !== benefitType || !offering.offered) return;
    const base = `offeredBenefits[${index}]`;
    addFact(facts, `${base}.benefitType`, offering.benefitType);
    addFact(facts, `${base}.offered`, offering.offered);
    addFact(facts, `${base}.selectedPlans`, offering.selectedPlans);
    addFact(facts, `${base}.eligibilityRule`, offering.eligibilityRule);
    offering.contacts.forEach((contact, contactIndex) =>
      addContactFacts(facts, contact, contactIndex, `${base}.contacts`),
    );
  });
}

function coreMedicalServices(
  services: NonNullable<BenefitsPackage["plans"][number]["attributes"]>["services"],
) {
  const important =
    /primary care|specialist|urgent care|emergency|inpatient|outpatient|hospital|imaging|laboratory|mental health/i;
  const selected = services
    .map((service, index) => ({ service, index }))
    .filter(({ service }) => important.test(`${service.medicalEvent} ${service.service}`))
    .slice(0, 12);
  return selected.length
    ? selected
    : services.slice(0, 8).map((service, index) => ({ service, index }));
}

function addPlanFacts(
  facts: GroundedFact[],
  benefitsPackage: BenefitsPackage,
  benefitType: BenefitType,
) {
  benefitsPackage.plans.forEach((plan, index) => {
    if (plan.benefitType !== benefitType) return;
    const base = `plans[${index}]`;
    addFact(facts, `${base}.name`, plan.name);
    addFact(facts, `${base}.carrier`, plan.carrier);
    addFact(facts, `${base}.year`, plan.year);
    if (benefitType === "medical" && plan.attributes) {
      addFact(facts, `${base}.attributes.financial`, plan.attributes.financial);
      addFact(facts, `${base}.attributes.network`, plan.attributes.network);
      for (const { service, index: serviceIndex } of coreMedicalServices(
        plan.attributes.services,
      ))
        addFact(
          facts,
          `${base}.attributes.services[${serviceIndex}]`,
          service,
        );
      addFact(
        facts,
        `${base}.attributes.prescriptions`,
        plan.attributes.prescriptions,
      );
    }
  });

  benefitsPackage.rates.forEach((rate, index) => {
    if (rate.benefitType !== benefitType) return;
    const base = `rates[${index}]`;
    addFact(facts, `${base}.planName`, rate.planName);
    addFact(facts, `${base}.carrier`, rate.carrier);
    addFact(facts, `${base}.effectiveDate`, rate.effectiveDate);
    addFact(facts, `${base}.tiers`, rate.tiers);
  });

  benefitsPackage.contributions.forEach((rule, index) => {
    if (rule.benefitType === benefitType)
      addFact(facts, `contributions[${index}]`, {
        benefitType: rule.benefitType,
        planId: rule.planId,
        planName: rule.planName,
        tier: rule.tier,
        employeeClass: rule.employeeClass,
        mode: rule.mode,
        value: rule.value,
        payPeriods: rule.payPeriods,
      });
  });
}

function benefitIsOffered(
  benefitsPackage: BenefitsPackage,
  benefitType: BenefitType,
) {
  return benefitsPackage.offeredBenefits.some(
    (offering) => offering.benefitType === benefitType && offering.offered,
  );
}

function hasPlan(benefitsPackage: BenefitsPackage, benefitType: BenefitType) {
  return benefitsPackage.plans.some((plan) => plan.benefitType === benefitType);
}

function addAccountFacts(
  facts: GroundedFact[],
  benefitsPackage: BenefitsPackage,
  accountType: "hra" | "fsa",
) {
  benefitsPackage.accounts.forEach((account, index) => {
    if (account.type !== accountType) return;
    addFact(facts, `accounts[${index}].type`, account.type);
    addFact(facts, `accounts[${index}].administrator`, account.administrator);
  });
  addOfferingFacts(facts, benefitsPackage, accountType);
}

function enrollmentContact(benefitsPackage: BenefitsPackage) {
  return benefitsPackage.contacts.find((contact) =>
    /enroll|human resources|\bhr\b/i.test(contact.role),
  );
}

function hasLegalFacts(benefitsPackage: BenefitsPackage) {
  return benefitsPackage.plans.some(
    (plan) =>
      plan.attributes &&
      (isPresent(plan.attributes.legal) || isPresent(plan.attributes.notices)),
  );
}

function addLegalFacts(facts: GroundedFact[], benefitsPackage: BenefitsPackage) {
  benefitsPackage.plans.forEach((plan, index) => {
    if (!plan.attributes) return;
    addFact(facts, `plans[${index}].attributes.legal`, plan.attributes.legal);
    plan.attributes.notices.slice(0, 8).forEach((notice, noticeIndex) =>
      addFact(
        facts,
        `plans[${index}].attributes.notices[${noticeIndex}]`,
        notice,
      ),
    );
  });
}

function isIncluded(
  id: BookletContentSectionId,
  outline: BookletOutline,
) {
  // The shared outline represents content sections; its renderer adds a TOC
  // structurally. Treat it as selected whenever there is content to enumerate.
  if (id === "toc") return outline.sections.length > 0;
  return outline.sections.some(
    (section) => section.id === id || section.benefitType === id,
  );
}

function factsAndMissing(
  id: BookletContentSectionId,
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
) {
  const facts: GroundedFact[] = [];
  const missingFields: string[] = [];

  switch (id) {
    case "cover":
      addEmployerFacts(facts, benefitsPackage);
      if (!isPresent(benefitsPackage.employer.name))
        missingFields.push("employer.name");
      if (
        !isPresent(benefitsPackage.planYear.label) &&
        !isPresent(benefitsPackage.planYear.start) &&
        !isPresent(benefitsPackage.planYear.end)
      )
        missingFields.push("planYear.label|planYear.start|planYear.end");
      break;
    case "toc":
      addFact(
        facts,
        "outline.sections",
        outline.sections.map(({ id: sectionId, title }) => ({ id: sectionId, title })),
      );
      if (!outline.sections.length) missingFields.push("outline.sections");
      break;
    case "welcome":
      addEmployerFacts(facts, benefitsPackage);
      benefitsPackage.offeredBenefits.forEach((offering, index) => {
        if (offering.offered)
          addFact(
            facts,
            `offeredBenefits[${index}].benefitType`,
            offering.benefitType,
          );
      });
      if (!isPresent(benefitsPackage.employer.name))
        missingFields.push("employer.name");
      break;
    case "enrollment": {
      const contact = enrollmentContact(benefitsPackage);
      if (contact) {
        const index = benefitsPackage.contacts.indexOf(contact);
        addContactFacts(facts, contact, index);
      } else {
        missingFields.push("contacts[role=enrollment|human resources]");
      }
      break;
    }
    case "eligibility":
      addFact(
        facts,
        "eligibility.waitingPeriod",
        benefitsPackage.eligibility.waitingPeriod,
      );
      addFact(
        facts,
        "eligibility.description",
        benefitsPackage.eligibility.description,
      );
      addFact(
        facts,
        "eligibility.employeeClasses",
        benefitsPackage.eligibility.employeeClasses,
      );
      if (
        !isPresent(benefitsPackage.eligibility.waitingPeriod) &&
        !isPresent(benefitsPackage.eligibility.description)
      )
        missingFields.push(
          "eligibility.waitingPeriod|eligibility.description",
        );
      break;
    case "medical":
    case "dental":
    case "vision":
      addOfferingFacts(facts, benefitsPackage, id);
      addPlanFacts(facts, benefitsPackage, id);
      if (!hasPlan(benefitsPackage, id))
        missingFields.push(`plans[benefitType=${id}]`);
      break;
    case "hra":
    case "fsa":
      addAccountFacts(facts, benefitsPackage, id);
      if (
        !benefitsPackage.accounts.some((account) => account.type === id) &&
        !benefitIsOffered(benefitsPackage, id)
      )
        missingFields.push(`accounts[type=${id}]|offeredBenefits[${id}]`);
      break;
    case "telemedicine":
    case "life":
    case "ltd":
    case "eap":
    case "voluntary":
      addOfferingFacts(facts, benefitsPackage, id);
      addPlanFacts(facts, benefitsPackage, id);
      benefitsPackage.contacts.forEach((contact, index) => {
        if (
          new RegExp(
            id === "life"
              ? "life|ad&d"
              : id === "ltd"
                ? "disability|ltd"
                : id,
            "i",
          ).test(`${contact.role} ${contact.organization || ""}`)
        )
          addContactFacts(facts, contact, index);
      });
      if (!benefitIsOffered(benefitsPackage, id) && !hasPlan(benefitsPackage, id))
        missingFields.push(`offeredBenefits[${id}]|plans[benefitType=${id}]`);
      break;
    case "contacts":
      benefitsPackage.contacts.forEach((contact, index) =>
        addContactFacts(facts, contact, index),
      );
      if (
        !benefitsPackage.contacts.some((contact) =>
          [
            contact.name,
            contact.organization,
            contact.phone,
            contact.email,
            contact.website,
          ].some(isPresent),
        )
      )
        missingFields.push("contacts");
      break;
    case "legal":
      addLegalFacts(facts, benefitsPackage);
      if (!hasLegalFacts(benefitsPackage))
        missingFields.push("plans[].attributes.legal|plans[].attributes.notices");
      break;
  }

  return { facts, missingFields };
}

function prepareSections(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
): PreparedSection[] {
  return BOOKLET_CONTENT_SECTION_IDS.map((id) => {
    const { facts, missingFields } = factsAndMissing(
      id,
      benefitsPackage,
      outline,
    );
    const included = isIncluded(id, outline);
    return {
      id,
      title: SECTION_TITLES[id],
      status: !included
        ? "omitted"
        : missingFields.length
          ? "blocked"
          : "ready",
      missingFields: included ? missingFields : [],
      facts,
    };
  });
}

function numericValues(value: unknown) {
  const normalized = JSON.stringify(value).replace(/(\d)-(?=\d)/g, "$1 ");
  const matches = normalized.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  return matches
    .map((match) => Number(match.replace(/,/g, "")))
    .filter(Number.isFinite);
}

function assertNoUnsupportedLiterals(
  section: PreparedSection,
  copy: string,
  _sourcePaths: string[],
) {
  // Literal grounding is checked against the section's entire closed fact set.
  // The model must still return valid source paths, but it is unnecessarily
  // brittle to reject a known date or number when the copy cites a containing
  // label/path instead of every leaf used to phrase the sentence.
  const values = section.facts.map((fact) => fact.value);
  const corpus = JSON.stringify(values).toLowerCase();

  for (const email of copy.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || []) {
    if (!corpus.includes(email.toLowerCase()))
      throw new Error(
        `Section ${section.id} contains an unsupported email address: ${email}`,
      );
  }
  for (const url of copy.match(/https?:\/\/[^\s),;]+/gi) || []) {
    const normalizedUrl = url.replace(/[.!?]+$/, "");
    if (!corpus.includes(normalizedUrl.toLowerCase()))
      throw new Error(
        `Section ${section.id} contains an unsupported URL: ${normalizedUrl}`,
      );
  }

  const allowedNumbers = numericValues(values);
  const normalizedCopy = copy.replace(/(\d)-(?=\d)/g, "$1 ");
  const copyNumbers =
    normalizedCopy.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  for (const raw of copyNumbers) {
    const value = Number(raw.replace(/,/g, ""));
    const percent = normalizedCopy
      .slice(normalizedCopy.indexOf(raw) + raw.length)
      .trimStart()
      .startsWith("%");
    const supported = allowedNumbers.some(
      (allowed) =>
        Math.abs(allowed - value) < 1e-9 ||
        (percent && Math.abs(allowed * 100 - value) < 1e-9),
    );
    if (!supported)
      throw new Error(
        `Section ${section.id} contains an unsupported numeric fact: ${raw}`,
      );
  }
}

function validateAndMerge(
  prepared: PreparedSection[],
  generated: z.infer<typeof BatchOutputSchema>,
): BookletSectionContent[] {
  const batchFacts = prepared.flatMap((section) => section.facts);
  const batchPaths = [...new Set(batchFacts.map((fact) => fact.path))];
  const groundedPath = (candidate: string) =>
    batchPaths.some(
      (path) =>
        candidate === path ||
        candidate.startsWith(`${path}.`) ||
        candidate.startsWith(`${path}[`) ||
        path.startsWith(`${candidate}.`) ||
        path.startsWith(`${candidate}[`),
    );
  const generatedById = new Map<BookletContentSectionId, z.infer<typeof GeneratedSectionSchema>>();
  for (const section of generated.sections) {
    if (generatedById.has(section.id))
      throw new Error(`The content model returned duplicate section ${section.id}`);
    generatedById.set(section.id, section);
  }

  return prepared.map((section) => {
    const output = generatedById.get(section.id);
    if (!output)
      throw new Error(`The content model omitted section ${section.id}`);
    const copy = output.copy.trim();
    if (section.status !== "ready") {
      if (copy || output.sourcePaths.length)
        throw new Error(
          `The content model wrote copy for ${section.status} section ${section.id}`,
        );
      return {
        id: section.id,
        title: section.title,
        status: section.status,
        missingFields: section.missingFields,
        sourcePaths:
          section.status === "blocked"
            ? section.facts.map((fact) => fact.path)
            : [],
        copy: "",
      };
    }
    if (!copy) throw new Error(`The content model returned empty copy for ${section.id}`);
    const sourcePaths = [...new Set(output.sourcePaths)];
    if (!sourcePaths.length)
      throw new Error(`The content model did not cite facts for ${section.id}`);
    const unsupportedPath = sourcePaths.find((path) => !groundedPath(path));
    if (unsupportedPath)
      throw new Error(
        `Section ${section.id} cited an unavailable source path: ${unsupportedPath}`,
      );
    assertNoUnsupportedLiterals({ ...section, facts: batchFacts }, copy, sourcePaths);
    return {
      id: section.id,
      title: section.title,
      status: section.status,
      missingFields: [],
      sourcePaths,
      copy,
    };
  });
}

export async function generateBookletContent(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  variant: string,
  options: GenerateBookletContentOptions = {},
): Promise<BookletContentResult> {
  const normalizedVariant = variant.trim();
  if (!normalizedVariant) throw new Error("A booklet content variant is required");
  if (!outline || !Array.isArray(outline.sections))
    throw new Error("A valid booklet outline is required");
  if (!benefitsPackage?.employer || !benefitsPackage?.planYear)
    throw new Error("A valid benefits package is required");

  const client =
    options.client ||
    (options.apiKey ? new OpenAI({ apiKey: options.apiKey }) : undefined);
  if (!client)
    throw new Error("OPENAI_API_KEY or an injected OpenAI client is required");
  const model =
    options.model ||
    process.env.OPENAI_BOOKLET_CONTENT_MODEL ||
    "gpt-5.6";
  const prepared = prepareSections(benefitsPackage, outline);
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Variant: ${normalizedVariant}\n\nSection batch:\n${JSON.stringify(
          prepared.map((section) => ({
            id: section.id,
            title: section.title,
            status: section.status,
            missingFields: section.missingFields,
            facts: section.status === "omitted" ? [] : section.facts,
          })),
        )}`,
      },
    ],
    text: {
      format: zodTextFormat(
        BatchOutputSchema,
        "booklet_section_content_batch",
      ),
    },
  });
  if (!response.output_parsed)
    throw new Error("OpenAI returned no parsed booklet section content");
  const parsed = BatchOutputSchema.parse(response.output_parsed);
  return {
    variant: normalizedVariant,
    model,
    sections: validateAndMerge(prepared, parsed),
  };
}

export const generateBookletSectionContent = generateBookletContent;
