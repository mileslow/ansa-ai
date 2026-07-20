import type { BenefitsPackage, BookletOutline } from "./booklet-types";
import type { BookletContentResult } from "./booklet-content-agent";
import {
  generateBookletPdf,
  generateBookletPdfFromHtml,
  renderBookletHtml,
  renderBookletPreviewPages,
} from "./booklet";
import {
  benefitsPackageToLegacyCompany,
  packagePayPeriods,
} from "./booklet-package-adapter";

export function renderBenefitsPackageHtml(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  content?: BookletContentResult,
  options: { allowUnpricedPlans?: boolean } = {},
) {
  const company = benefitsPackageToLegacyCompany(
    benefitsPackage,
    outline,
    content,
    options,
  );
  return renderBookletHtml(company, packagePayPeriods(benefitsPackage));
}

export function renderBenefitsPackagePreviewPages(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  content?: BookletContentResult,
  options: { allowUnpricedPlans?: boolean } = {},
) {
  const company = benefitsPackageToLegacyCompany(
    benefitsPackage,
    outline,
    content,
    options,
  );
  return renderBookletPreviewPages(company, packagePayPeriods(benefitsPackage));
}

export async function generateBenefitsPackagePdf(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  content?: BookletContentResult,
  options: { allowUnpricedPlans?: boolean } = {},
) {
  const company = benefitsPackageToLegacyCompany(
    benefitsPackage,
    outline,
    content,
    options,
  );
  return generateBookletPdf(company, packagePayPeriods(benefitsPackage));
}

export function generateBenefitsPackagePdfFromHtml(html: string) {
  return generateBookletPdfFromHtml(html);
}
