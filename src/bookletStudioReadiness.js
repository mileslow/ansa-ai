import { phaseDefinitions } from "./bookletStudioData";

const phaseForDocumentType = {
  company_website: "employer",
  employer_application: "employer",
  email_export: "instructions",
  carrier_rate_sheet: "rates",
  renewal_spreadsheet: "rates",
  sbc: "documents",
  spd: "documents",
  plan_summary: "documents",
  benefit_guide: "instructions",
  prior_booklet: "instructions",
  census: "census",
};

export function bookletStudioPhaseFromUrl(value) {
  return phaseDefinitions.some((phase) => phase.id === value)
    ? value
    : "employer";
}

export function bookletFilePhase(file, classifications = []) {
  if (file.intakeCategory)
    return file.intakeCategory === "template" ? "instructions" : file.intakeCategory;
  const classification = classifications.find((item) => item.fileId === file.id);
  return phaseForDocumentType[classification?.documentType] || "instructions";
}

export function mergeBookletFiles(current = [], incoming = [], replace = false) {
  if (replace) return [...incoming];
  const merged = new Map(current.map((file) => [file.id, file]));
  incoming.forEach((file) => merged.set(file.id, { ...merged.get(file.id), ...file }));
  return [...merged.values()];
}

export function mergeBookletClassifications(current = [], incoming = []) {
  const merged = new Map(current.map((classification) => [
    classification.fileId,
    classification,
  ]));
  for (const classification of incoming) {
    const existing = merged.get(classification.fileId);
    // Every new run sends a filename-level provisional pass for all sources.
    // Never let that lower-fidelity pass erase a classification that was
    // already verified by an earlier run.
    if (classification.provisional && existing && !existing.provisional)
      continue;
    merged.set(classification.fileId, {
      ...existing,
      ...classification,
    });
  }
  return [...merged.values()];
}

export function bookletStudioOutputMode(files = [], classifications = []) {
  const completedPhases = new Set(
    files.map((file) => bookletFilePhase(file, classifications)),
  );
  return phaseDefinitions.every((phase) => completedPhases.has(phase.id))
    ? "final_pdf"
    : "html_preview";
}

const planDocumentLabels = {
  medical: "SBC and medical plan summary or SPD",
  dental: "Dental benefit summary or certificate",
  vision: "Vision benefit summary or certificate",
  life: "Life and AD&D certificate or plan summary",
  std: "Short-term disability certificate or plan summary",
  ltd: "Long-term disability certificate or plan summary",
  hsa: "HSA administrator and employer-contribution materials",
  hra: "HRA plan summary and reimbursement rules",
  fsa: "FSA plan summary and administrator materials",
  eap: "EAP benefit summary and contact materials",
  voluntary: "Voluntary benefit certificates or summaries",
  telemedicine: "Telemedicine benefit summary",
};

const planTypeLabels = {
  medical: "Medical",
  dental: "Dental",
  vision: "Vision",
  life: "Life and AD&D",
  std: "Short-term disability",
  ltd: "Long-term disability",
  hsa: "Health savings account",
  hra: "Health reimbursement arrangement",
  fsa: "Flexible spending account",
  eap: "Employee assistance program",
  voluntary: "Voluntary benefits",
  telemedicine: "Telemedicine",
};

export function requiredPlanUploadsFromFacts(facts = []) {
  const selectedPlans = new Map();
  const offeredBenefits = new Map();
  const contributionTypesByPlan = new Map();
  for (const fact of facts) {
    const selected = fact.path?.match(/^selectedPlans\[(\d+)\]\.planName$/);
    if (selected && typeof fact.value === "string")
      selectedPlans.set(Number(selected[1]), fact);
    const offered = fact.path?.match(/^offeredBenefits\[(\d+)\]\.([^.]+)$/);
    if (offered && fact.value === true)
      offeredBenefits.set(Number(offered[1]), { benefitType: offered[2], fact });
    if (
      fact.path?.startsWith("contributions[") &&
      fact.value?.planName &&
      fact.value?.benefitType
    )
      contributionTypesByPlan.set(
        String(fact.value.planName).trim().toLowerCase(),
        String(fact.value.benefitType).toLowerCase(),
      );
  }
  const requirements = new Map();
  for (const [index, fact] of [...selectedPlans.entries()].sort((a, b) => a[0] - b[0])) {
    const planName = String(fact.value).trim();
    const benefitType =
      contributionTypesByPlan.get(planName.toLowerCase()) ||
      offeredBenefits.get(index)?.benefitType ||
      "plan";
    const id = `${benefitType}:${planName.toLowerCase()}`;
    requirements.set(id, {
      id,
      benefitType,
      benefitLabel: planTypeLabels[benefitType] || "Plan",
      planName,
      documentLabel: planDocumentLabels[benefitType] || "Official plan document or certificate",
      sourceFileId: fact.fileId,
      confidence: fact.confidence,
    });
  }
  for (const { benefitType, fact } of offeredBenefits.values()) {
    if ([...requirements.values()].some((item) => item.benefitType === benefitType))
      continue;
    const id = `${benefitType}:offered`;
    requirements.set(id, {
      id,
      benefitType,
      benefitLabel: planTypeLabels[benefitType] || benefitType,
      planName: null,
      documentLabel: planDocumentLabels[benefitType] || "Official plan document or certificate",
      sourceFileId: fact.fileId,
      confidence: fact.confidence,
    });
  }
  return [...requirements.values()];
}

const normalizePlanText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const planNamesMatch = (left, right) => {
  const a = normalizePlanText(left);
  const b = normalizePlanText(right);
  if (!a || !b) return false;
  return a === b || (a.length > 10 && b.includes(a)) || (b.length > 10 && a.includes(b));
};

export function reconcileRequiredPlanUploads(
  requirements = [],
  files = [],
  facts = [],
  classifications = [],
) {
  const evidenceByFile = new Map(files.map((file) => [file.id, {
    file,
    benefitTypes: new Set(),
    planNames: new Set(),
  }]));
  for (const classification of classifications) {
    const evidence = evidenceByFile.get(classification.fileId);
    if (!evidence) continue;
    for (const type of [
      ...(classification.detectedBenefitTypes || []),
      ...(classification.benefitTypes || []),
    ]) evidence.benefitTypes.add(String(type).toLowerCase());
    for (const planName of classification.planOrProgramIds || [])
      evidence.planNames.add(String(planName));
  }
  for (const fact of facts) {
    const evidence = evidenceByFile.get(fact.fileId);
    if (!evidence) continue;
    if (/^selectedPlans\[\d+\]\.planName$/.test(fact.path || "") && typeof fact.value === "string")
      evidence.planNames.add(fact.value);
    if (fact.path === "plan.identity" && fact.value?.planName)
      evidence.planNames.add(String(fact.value.planName));
    const offered = fact.path?.match(/^offeredBenefits\[\d+\]\.([^.]+)$/);
    if (offered && fact.value === true) evidence.benefitTypes.add(offered[1].toLowerCase());
    if (fact.value?.benefitType) evidence.benefitTypes.add(String(fact.value.benefitType).toLowerCase());
    if (fact.value?.planName) evidence.planNames.add(String(fact.value.planName));
  }
  const evidence = [...evidenceByFile.values()];
  const requirementCounts = requirements.reduce((counts, requirement) => {
    counts.set(requirement.benefitType, (counts.get(requirement.benefitType) || 0) + 1);
    return counts;
  }, new Map());
  return requirements.map((requirement) => {
    const nameMatch = requirement.planName
      ? evidence.find((candidate) =>
          [...candidate.planNames].some((planName) => planNamesMatch(requirement.planName, planName)),
        )
      : null;
    const typeMatch = !nameMatch &&
      (!requirement.planName || requirementCounts.get(requirement.benefitType) === 1)
      ? evidence.find((candidate) => candidate.benefitTypes.has(requirement.benefitType))
      : null;
    const fileNameMatch = !nameMatch && requirement.planName
      ? evidence.find((candidate) => planNamesMatch(requirement.planName, candidate.file.fileName))
      : null;
    const match = nameMatch || typeMatch;
    const received = match || fileNameMatch;
    return {
      ...requirement,
      complete: Boolean(match),
      uploaded: Boolean(received),
      matchedFileId: match?.file.id || null,
      matchedFileName: match?.file.fileName || null,
      uploadedFileId: received?.file.id || null,
      uploadedFileName: received?.file.fileName || null,
      matchReason: nameMatch ? "plan_name" : typeMatch ? "benefit_type" : null,
    };
  });
}

export function requiredPlanUploadsComplete(requirements = []) {
  return requirements.length > 0 && requirements.every((requirement) => requirement.complete);
}

export function requiredPlanUploadStatus(requirement, processingFileIds = new Set()) {
  const fileId = requirement.matchedFileId || requirement.uploadedFileId;
  if (fileId && processingFileIds.has(fileId)) return "parsing";
  if (requirement.complete) return "complete";
  if (requirement.uploaded) return "uploaded";
  return "missing";
}

export function bookletStudioSourcePhaseCompletion(
  files = [],
  classifications = [],
  facts = [],
) {
  const filesByPhase = Object.fromEntries(
    phaseDefinitions.map((phase) => [
      phase.id,
      files.filter((file) => bookletFilePhase(file, classifications) === phase.id),
    ]),
  );
  const employerFiles = filesByPhase.employer || [];
  const planFiles = filesByPhase.documents || [];
  const rateFiles = filesByPhase.rates || [];
  const employerFileIds = new Set(employerFiles.map((file) => file.id));
  const rateFileIds = new Set(rateFiles.map((file) => file.id));
  const employer = employerFiles.length > 0 && facts.some((fact) => employerFileIds.has(fact.fileId));
  const requirements = requiredPlanUploadsFromFacts(
    facts.filter((fact) => employerFileIds.has(fact.fileId)),
  );
  const documents = employer && planFiles.length > 0 && (
    !requirements.length ||
    requiredPlanUploadsComplete(
      reconcileRequiredPlanUploads(requirements, planFiles, facts, classifications),
    )
  );
  const rates = documents && rateFiles.length > 0 && facts.some((fact) => rateFileIds.has(fact.fileId));
  return { employer, documents, rates };
}

export function bookletStudioSetupComplete(
  files = [],
  classifications = [],
  facts = [],
  questions = [],
) {
  const phases = bookletStudioSourcePhaseCompletion(files, classifications, facts);
  return phases.employer && phases.documents && phases.rates && questions.length === 0;
}
