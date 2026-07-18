import type { BenefitsPackage, BookletOutline } from "./booklet-types";
import type { BookletContentResult } from "./booklet-content-agent";
import {
  generateBookletPdf,
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
) {
  const company = benefitsPackageToLegacyCompany(benefitsPackage, outline, content);
  return renderBookletHtml(company, packagePayPeriods(benefitsPackage));
}

export function renderBenefitsPackagePreviewPages(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  content?: BookletContentResult,
) {
  const company = benefitsPackageToLegacyCompany(benefitsPackage, outline, content);
  return renderBookletPreviewPages(company, packagePayPeriods(benefitsPackage));
}

export async function generateBenefitsPackagePdf(
  benefitsPackage: BenefitsPackage,
  outline: BookletOutline,
  content?: BookletContentResult,
) {
  const company = benefitsPackageToLegacyCompany(benefitsPackage, outline, content);
  return generateBookletPdf(company, packagePayPeriods(benefitsPackage));
}
