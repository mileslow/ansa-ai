import { getAdminServices } from "../firebase-admin";
import { listCompanyLibraryFiles } from "../broker-agent/sources/ansa-library";

export type CompanySummary = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  planDetails?: Record<string, unknown> | null;
  domains: string[];
};

export type ResolveCompanyResult = {
  company: CompanySummary | null;
  confidence: number;
  reason: string;
};

function domainFromEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email
    .slice(at + 1)
    .toLowerCase()
    .trim();
}

function domainsFromWebsite(website?: string | null) {
  if (!website) return [] as string[];
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host ? [host] : [];
  } catch {
    return [];
  }
}

export async function listBenefitsCompanies(limit = 200): Promise<CompanySummary[]> {
  const { db } = getAdminServices();
  const snapshot = await db.collection("benefitsCompanies").limit(limit).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const website = data.website ? String(data.website) : null;
    return {
      id: doc.id,
      name: String(data.name || doc.id),
      website,
      industry: data.industry ? String(data.industry) : null,
      description: data.description ? String(data.description) : null,
      planDetails: (data.planDetails as Record<string, unknown>) || null,
      domains: domainsFromWebsite(website),
    };
  });
}

export async function resolveCompany({
  fromEmail,
  subject,
  body,
  allowedCompanyIds,
}: {
  fromEmail: string;
  subject: string;
  body: string;
  allowedCompanyIds?: string[];
}): Promise<ResolveCompanyResult> {
  const companies = await listBenefitsCompanies();
  const scoped = allowedCompanyIds?.length
    ? companies.filter((c) => allowedCompanyIds.includes(c.id))
    : companies;
  const senderDomain = domainFromEmail(fromEmail);
  const haystack = `${subject}\n${body}`.toLowerCase();

  if (senderDomain) {
    const byDomain = scoped.find((c) => c.domains.some((d) => senderDomain === d || senderDomain.endsWith(`.${d}`)));
    if (byDomain) {
      return {
        company: byDomain,
        confidence: 0.9,
        reason: `Matched sender domain ${senderDomain}`,
      };
    }
  }

  const byName = scoped
    .map((c) => ({
      company: c,
      score: haystack.includes(c.name.toLowerCase()) ? c.name.length : 0,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (byName) {
    return {
      company: byName.company,
      confidence: 0.75,
      reason: `Matched employer name "${byName.company.name}" in message`,
    };
  }

  return {
    company: null,
    confidence: 0,
    reason: "No matching company in Ansa workspace",
  };
}

export type CompanyContextPack = {
  company: CompanySummary;
  libraryFileNames: string[];
  planSummary: string;
};

export async function buildContextPack(
  company: CompanySummary,
  ownerId: string,
): Promise<CompanyContextPack> {
  let libraryFileNames: string[] = [];
  try {
    const files = await listCompanyLibraryFiles({
      ownerId,
      companyId: company.id,
      limit: 15,
    });
    libraryFileNames = files.map((f) => f.fileName);
  } catch (error) {
    console.error("company library list failed", { error, companyId: company.id });
  }

  const planDetails = company.planDetails || {};
  const planSummary = JSON.stringify(planDetails, null, 2).slice(0, 12_000);

  return { company, libraryFileNames, planSummary };
}
