import type {
  BenefitType,
  BenefitsPackage,
  BookletOutline,
  BookletSection,
} from "./booklet-types";

const TITLES: Record<string, string> = {
  cover: "Cover",
  toc: "Table of contents",
  welcome: "Welcome",
  eligibility: "Eligibility",
  enrollment: "How to enroll",
  medical: "Medical",
  dental: "Dental",
  vision: "Vision",
  life: "Life and AD&D",
  std: "Short-term disability",
  ltd: "Long-term disability",
  hsa: "Health savings account",
  hra: "Health reimbursement account",
  fsa: "Flexible spending account",
  telemedicine: "Telemedicine",
  eap: "Employee assistance program",
  voluntary: "Voluntary benefits",
  contacts: "Contacts",
  legal: "Legal notices",
};

const BASE_ORDER = [
  "cover",
  "toc",
  "welcome",
  "eligibility",
  "enrollment",
  "medical",
  "dental",
  "vision",
  "life",
  "std",
  "ltd",
  "hsa",
  "hra",
  "fsa",
  "telemedicine",
  "eap",
  "voluntary",
  "contacts",
  "legal",
];

const benefitTypes = new Set<BenefitType>([
  "medical",
  "dental",
  "vision",
  "life",
  "std",
  "ltd",
  "hsa",
  "hra",
  "fsa",
  "telemedicine",
  "eap",
  "voluntary",
]);

function sectionId(value: string) {
  const normalized = value.toLowerCase();
  return Object.keys(TITLES).find(
    (key) => normalized === key || normalized.includes(key) || TITLES[key].toLowerCase() === normalized,
  );
}

export function generateBookletOutline(
  benefitsPackage: BenefitsPackage,
): BookletOutline {
  const offered = new Set(
    benefitsPackage.offeredBenefits
      .filter((item) => item.offered)
      .map((item) => item.benefitType),
  );
  const priorOrder = benefitsPackage.bookletStyle.sectionOrder
    .map(sectionId)
    .filter((value): value is string => Boolean(value));
  const order = [...new Set(["cover", ...priorOrder, ...BASE_ORDER])];
  const sections: BookletSection[] = [];
  for (const id of order) {
    if (benefitTypes.has(id as BenefitType) && !offered.has(id as BenefitType))
      continue;
    const benefitType = benefitTypes.has(id as BenefitType)
      ? (id as BenefitType)
      : undefined;
    const sourceRefs = benefitType
      ? benefitsPackage.offeredBenefits.find((item) => item.benefitType === benefitType)
          ?.sourceRefs || []
      : id === "eligibility"
        ? benefitsPackage.sourceMap["eligibility.waitingPeriod"] || []
        : id === "cover"
          ? [
              ...(benefitsPackage.sourceMap["employer.name"] || []),
              ...(benefitsPackage.sourceMap["planYear.start"] || []),
            ]
          : benefitsPackage.bookletStyle.sourceRefs;
    sections.push({ id, title: TITLES[id] || id, benefitType, sourceRefs });
  }
  return { sections };
}
