import type { BenefitsPackage, BookletOutline } from "./booklet-types";
import type { BookletContentResult } from "./booklet-content-agent";
import { calculateContribution, findContributionRule } from "./contribution-engine";

export function benefitsPackageToLegacyCompany(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  content?: BookletContentResult,
) {
  const benefits: Record<string, { uploadedPlanCount: number; plans: unknown[] }> = {};
  for (const benefitType of ["medical", "dental", "vision"] as const) {
    const plans = benefitsPackage.plans
      .filter((plan) => plan.benefitType === benefitType)
      .flatMap((plan) => {
        const rate = benefitsPackage.rates.find((item) => item.id === plan.ratePlanId);
        if (!rate) return [];
        return [
          {
            name: plan.name,
            year: plan.year || benefitsPackage.planYear.label,
            carrier: plan.carrier,
            attributes: plan.attributes,
            tiers: rate.tiers.map((tier) => {
              const rule = findContributionRule(
                benefitsPackage.contributions,
                benefitType,
                rate.id,
                rate.planName,
                tier.tier,
              );
              const amounts = rule
                ? calculateContribution(tier.monthlyPremium, rule)
                : {
                    employerMonthly: tier.employerMonthly || 0,
                    employeeMonthly:
                      tier.employeeMonthly ??
                      tier.monthlyPremium - (tier.employerMonthly || 0),
                  };
              return {
                tier: tier.tier.replace(/_/g, " "),
                premium: tier.monthlyPremium,
                employerMonthly: amounts.employerMonthly,
                employeeMonthly: amounts.employeeMonthly,
                erPercent: tier.monthlyPremium
                  ? amounts.employerMonthly / tier.monthlyPremium
                  : 0,
                enrolled: tier.enrolled || 0,
              };
            }),
          },
        ];
      });
    const key = benefitType === "medical" ? "health" : benefitType;
    benefits[key] = { uploadedPlanCount: plans.length, plans };
  }

  const offered = new Set(
    benefitsPackage.offeredBenefits
      .filter((item) => item.offered)
      .map((item) => item.benefitType),
  );
  const mappedContacts = Object.fromEntries(
    benefitsPackage.contacts.map((contact) => [
      contact.role.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      contact,
    ]),
  );
  const hrContact = benefitsPackage.contacts.find((contact) =>
    /human resources|\bhr\b/i.test(contact.role),
  );
  const enrollmentContact = benefitsPackage.contacts.find((contact) =>
    /enroll/i.test(contact.role),
  );
  const voluntaryContact = benefitsPackage.contacts.find((contact) =>
    /voluntary|aflac/i.test(contact.role),
  );
  const contacts = {
    ...mappedContacts,
    ...(hrContact ? { hr: hrContact } : {}),
    ...(enrollmentContact || hrContact
      ? { enrollment: enrollmentContact || hrContact }
      : {}),
    ...(voluntaryContact ? { voluntary: voluntaryContact } : {}),
  };
  const carriers: Record<string, any> = Object.fromEntries(
    benefitsPackage.plans
      .filter((plan) => plan.carrier)
      .map((plan) => [
        plan.benefitType === "medical" || plan.benefitType === "dental"
          ? "medicalDental"
          : plan.benefitType,
        { name: plan.carrier },
      ]),
  );
  if (offered.has("eap") && !carriers.eap) carriers.eap = { offered: true };
  const accountTypes = [
    ...new Set([
      ...benefitsPackage.accounts.map((account) => account.type.toUpperCase()),
      ...(["hsa", "hra", "fsa"] as const)
        .filter((type) => offered.has(type))
        .map((type) => type.toUpperCase()),
    ]),
  ];
  return {
    name: benefitsPackage.employer.name,
    description:
      benefitsPackage.employer.publicProfile?.description ||
      benefitsPackage.eligibility.description ||
      "Employee benefits guide",
    website: benefitsPackage.employer.website || "",
    renewalLabel: benefitsPackage.planYear.label,
    benefits,
    planDetails: {
      employer: {
        cover: benefitsPackage.employer.name,
        legal: benefitsPackage.employer.legalName,
      },
      planYear: benefitsPackage.planYear,
      eligibility: {
        initialPeriod:
          benefitsPackage.eligibility.description ||
          benefitsPackage.eligibility.waitingPeriod ||
          "",
      },
      enrollment: {},
      contacts: {
        ...contacts,
        ...(offered.has("voluntary") && !contacts.voluntary
          ? { voluntary: { offered: true } }
          : {}),
      },
      carriers,
      accounts: {
        type: accountTypes.join("/"),
        administrator: benefitsPackage.accounts.find((account) => account.administrator)
          ?.administrator,
      },
      telemedicine: offered.has("telemedicine") ? { offered: true } : {},
      coverageDetails: {
        life: offered.has("life") ? { offered: true } : {},
        shortTermDisability: offered.has("std") ? { offered: true } : {},
        longTermDisability: offered.has("ltd") ? { offered: true } : {},
      },
      bookletOutline: outline.sections.map((section) => section.id),
      generatedContent: content?.sections || [],
    },
  };
}

export function packagePayPeriods(benefitsPackage: BenefitsPackage) {
  const activeRateIds = new Set(
    benefitsPackage.plans.map((plan) => plan.ratePlanId).filter(Boolean),
  );
  const relevant = benefitsPackage.contributions.filter(
    (rule) => !activeRateIds.size || (rule.planId && activeRateIds.has(rule.planId)),
  );
  const spreadsheetRule = [...relevant, ...benefitsPackage.contributions].find(
    (rule) =>
      rule.payPeriods &&
      rule.sourceRefs.some((source) => source.extractionMethod === "spreadsheet"),
  );
  return spreadsheetRule?.payPeriods || relevant.find((rule) => rule.payPeriods)?.payPeriods || 52;
}
