import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  evaluateBenefitRequirements,
  evaluatePredicate,
} from "./benefit-requirements";
import { requirementEvidenceId } from "./benefit-resolution-builder";
import type {
  BenefitGateReport,
  BenefitRequirementSubject,
  FieldResolution,
  RequirementGate,
} from "./benefit-requirements/types";
import type {
  BookletRenderManifest,
  RenderField,
} from "./booklet-types";

function evidenceFor(resolution: FieldResolution) {
  if (
    resolution.status === "known" ||
    resolution.status === "explicit_none" ||
    resolution.status === "not_applicable"
  )
    return resolution.evidence;
  return [];
}

function renderValue(resolution: FieldResolution) {
  if (resolution.status === "known") return resolution.value;
  if (
    resolution.status === "explicit_none" ||
    resolution.status === "not_applicable"
  )
    return { state: resolution.status, reasonCode: resolution.reasonCode };
  return undefined;
}

export function evaluateRequirementSubjects(
  subjects: BenefitRequirementSubject[],
  gate: RequirementGate,
  renderedPathsBySubject: Record<string, string[]> = {},
): BenefitGateReport[] {
  return subjects.map((subject) => {
    const report = evaluateBenefitRequirements({
      definition: BENEFIT_REQUIREMENTS_REGISTRY[subject.benefitType],
      gate,
      resolutions: subject.resolutions,
      renderedPaths: renderedPathsBySubject[subject.id] || [],
    });
    return {
      subjectId: subject.id,
      benefitType: subject.benefitType,
      ...report,
    };
  });
}

export function buildBookletRenderManifest(
  subjects: BenefitRequirementSubject[],
): BookletRenderManifest {
  const sections = new Map<
    string,
    { id: string; subjectIds: string[]; fields: RenderField[] }
  >();
  for (const subject of subjects) {
    if (subject.enforcementStatus !== "registry_enforced") continue;
    const definition = BENEFIT_REQUIREMENTS_REGISTRY[subject.benefitType];
    const section = sections.get(subject.benefitType) || {
      id: subject.benefitType,
      subjectIds: [],
      fields: [],
    };
    section.subjectIds.push(subject.id);
    for (const field of definition.fields) {
      const level = field.levels.safe_booklet;
      if (!level || level === "optional" || field.renderPolicy === "never_render")
        continue;
      if (level === "conditional") {
        if (!field.when) continue;
        if (evaluatePredicate(field.when, subject.resolutions) !== true) continue;
      }
      const resolution = subject.resolutions[field.path];
      if (
        !resolution ||
        !["known", "explicit_none", "not_applicable"].includes(
          resolution.status,
        )
      )
        continue;
      section.fields.push({
        subjectId: subject.id,
        requirementId: field.id,
        path: field.path,
        value: renderValue(resolution),
        evidenceIds: evidenceFor(resolution).map(requirementEvidenceId),
      });
    }
    sections.set(subject.benefitType, section);
  }
  return { sections: [...sections.values()] };
}

export function renderedPathsFromManifest(manifest: BookletRenderManifest) {
  const result: Record<string, string[]> = {};
  for (const section of manifest.sections)
    for (const field of section.fields)
      result[field.subjectId] = [
        ...new Set([...(result[field.subjectId] || []), field.path]),
      ];
  return result;
}

