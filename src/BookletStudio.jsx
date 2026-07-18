import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Files,
  Gauge,
  LoaderCircle,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { bookletStudioApi, encodeFile } from "./bookletStudioApi";
import { phaseDefinitions } from "./bookletStudioData";
import "./bookletStudio.css";

const pipelineStageCount = 14;
const phaseTabLabels = {
  employer: "Employer",
  documents: "Plans",
  rates: "Rates",
  census: "Census",
  instructions: "Notes",
};
const phasePrompts = {
  employer: "Employer setup",
  documents: "Add the official plan documents.",
  rates: "Add the rates and contributions.",
  census: "Add the employee census.",
  instructions: "Anything else the guide should know?",
};

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

const planBenefitGroups = [
  { id: "medical", label: "Medical", types: ["medical"] },
  { id: "dental", label: "Dental", types: ["dental"] },
  { id: "vision", label: "Vision", types: ["vision"] },
  { id: "life", label: "Life & AD&D", types: ["life"] },
  { id: "disability", label: "Disability", types: ["std", "ltd"] },
  { id: "voluntary", label: "Voluntary / PBO", types: ["voluntary"] },
  { id: "other", label: "Other benefits", types: ["eap", "telemedicine", "hsa", "hra", "fsa"] },
];

function persistedCompanyId() {
  const queryId = new URLSearchParams(window.location.search).get("companyId");
  if (queryId) return queryId;
  const stored = window.localStorage.getItem("ansa.bookletStudio.companyId");
  if (stored) return stored;
  const created = `studio-${crypto.randomUUID()}`;
  window.localStorage.setItem("ansa.bookletStudio.companyId", created);
  return created;
}

function updateRecoveryUrl(threadId, runId) {
  const url = new URL(window.location.href);
  if (threadId) url.searchParams.set("threadId", threadId);
  else if (threadId === null) url.searchParams.delete("threadId");
  if (runId) url.searchParams.set("runId", runId);
  else if (runId === null) url.searchParams.delete("runId");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function filePhase(file, classifications) {
  if (file.intakeCategory)
    return file.intakeCategory === "template" ? "instructions" : file.intakeCategory;
  const classification = classifications.find((item) => item.fileId === file.id);
  return phaseForDocumentType[classification?.documentType] || "instructions";
}

function phaseForQuestion(question) {
  const path = question.fieldPath;
  if (/^(?:employer|planYear|eligibility)\./.test(path)) return "employer";
  if (path === "plans.selected") return "documents";
  if (/^(?:plans\.[^.]+\.ratePlanId|contributions\.)/.test(path)) return "rates";
  return "instructions";
}

function eventMerge(events, event) {
  return [...events.filter((item) => item.id !== event.id), event].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function readableValue(value) {
  if (value === null || value === undefined || value === "") return "Not found";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(readableValue).join(", ");
  return JSON.stringify(value);
}

const factGroupLabels = {
  employer: "Employer",
  planYear: "Plan year",
  eligibility: "Eligibility",
  offeredBenefits: "Offered benefits",
  selectedPlans: "Selected plans",
  contacts: "Contacts",
  contributions: "Contributions",
  accounts: "Accounts",
  plan: "Plan details",
};

function humanizeField(value) {
  return String(value)
    .replace(/\[(\d+)\]/g, " $1")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function factTitle(path) {
  const indexed = path.match(/^([^.[\]]+)\[(\d+)\]/);
  if (indexed) {
    const singular = {
      contacts: "Contact",
      contributions: "Contribution",
      selectedPlans: "Selected plan",
      offeredBenefits: "Offered benefit",
      accounts: "Account",
    }[indexed[1]] || humanizeField(indexed[1]);
    return `${singular} ${Number(indexed[2]) + 1}`;
  }
  return humanizeField(path.split(".").at(-1));
}

function flattenedFields(value, prefix = [], result = []) {
  if (value === null || value === undefined || value === "") return result;
  if (Array.isArray(value)) {
    if (value.every((item) => !item || typeof item !== "object"))
      result.push([prefix.join(" "), value.map(readableValue).join(", ")]);
    else
      value.forEach((item, index) =>
        flattenedFields(item, [...prefix, String(index + 1)], result),
      );
    return result;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, fieldValue]) =>
      flattenedFields(fieldValue, [...prefix, key], result),
    );
    return result;
  }
  result.push([prefix.join(" "), readableValue(value)]);
  return result;
}

function FactFields({ value }) {
  if (!value || typeof value !== "object")
    return <p className="bs-extracted-scalar">{readableValue(value)}</p>;
  const fields = flattenedFields(value);
  return <dl className="bs-extracted-fields">{fields.map(([key, fieldValue], index) => <div key={`${key}-${index}`}><dt>{humanizeField(key)}</dt><dd>{fieldValue}</dd></div>)}</dl>;
}

function ExtractedFacts({ facts }) {
  const groups = new Map();
  facts.forEach((fact) => {
    const key = fact.path.match(/^[^.[\]]+/)?.[0] || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fact);
  });
  return <section className="bs-extracted-facts"><header><b>Extracted information</b><span>{facts.length} source-backed {facts.length === 1 ? "field" : "fields"}</span></header>{[...groups.entries()].map(([key, items]) => <section className="bs-extracted-group" key={key}><div className="bs-extracted-group__head"><b>{factGroupLabels[key] || humanizeField(key)}</b><span>{items.length}</span></div>{items.map((fact) => <article className="bs-extracted-card" key={fact.id}><header><div><b>{factTitle(fact.path)}</b><small>{fact.source?.fileName}{fact.source?.page ? ` · Page ${fact.source.page}` : ""}</small></div><em>{Math.round(fact.confidence * 100)}%</em></header><FactFields value={fact.value} /></article>)}</section>)}</section>;
}

function Logo() {
  return <span className="bs-logo" aria-hidden="true"><i /><i /><i /></span>;
}

export default function BookletStudio() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const companyId = useMemo(persistedCompanyId, []);
  const [threadId, setThreadId] = useState(query.get("threadId") || "");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [liveClassifications, setLiveClassifications] = useState([]);
  const [facts, setFacts] = useState([]);
  const [sections, setSections] = useState([]);
  const [files, setFiles] = useState([]);
  const [activePhase, setActivePhase] = useState("employer");
  const [selectedPage, setSelectedPage] = useState(null);
  const [previewMode, setPreviewMode] = useState("pages");
  const [note, setNote] = useState("");
  const [busyPhase, setBusyPhase] = useState("");
  const [generating, setGenerating] = useState(false);
  const [textStreaming, setTextStreaming] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(threadId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [expandedFileId, setExpandedFileId] = useState("");
  const noticeTimer = useRef(null);
  const textStreamingTimer = useRef(null);
  const activeRunId = useRef(query.get("runId") || "");
  const generationInFlight = useRef(false);
  const queuedGenerationThreadId = useRef("");
  const failedRunRecoveryAttempted = useRef(false);
  const provisionalCoverRecoveryAttempted = useRef(false);

  const classifications = run?.classifications?.length
    ? run.classifications
    : liveClassifications;
  const filesByPhase = useMemo(
    () => Object.fromEntries(
      phaseDefinitions.map((phase) => [
        phase.id,
        files.filter((file) => filePhase(file, classifications) === phase.id),
      ]),
    ),
    [files, classifications],
  );
  const planBenefitCounts = useMemo(
    () => Object.fromEntries(planBenefitGroups.map((group) => [
      group.id,
      filesByPhase.documents.filter((file) => {
        const classification = classifications.find((item) => item.fileId === file.id);
        return classification?.detectedBenefitTypes?.some((type) => group.types.includes(type));
      }).length,
    ])),
    [filesByPhase.documents, classifications],
  );
  const completedStages = useMemo(
    () => new Set(events.filter((event) => event.status === "complete").map((event) => event.stage)),
    [events],
  );
  const completion = run?.status === "complete"
    ? 100
    : Math.min(96, Math.round((completedStages.size / pipelineStageCount) * 100));
  const processing = generating || ["queued", "processing"].includes(run?.status);
  const questions = run?.questions || [];
  const outlinePages = useMemo(() => {
    if (sections.length)
      return [...sections]
        .sort((left, right) => left.pageIndex - right.pageIndex)
        .map((section) => ({
          ...section,
          number: section.pageIndex + 1,
          kind: section.sectionId,
        }));
    return (run?.bookletOutline?.sections || []).map((section, index) => ({
      ...section,
      number: index + 1,
      kind: section.id,
    }));
  }, [sections, run?.bookletOutline]);
  const activePhaseIndex = Math.max(0, phaseDefinitions.findIndex((phase) => phase.id === activePhase));
  const currentPhase = phaseDefinitions[activePhaseIndex];
  const readyPhaseCount = phaseDefinitions.filter((phase) => filesByPhase[phase.id]?.length).length;
  const selectedOutlinePage = outlinePages.find((page) => page.id === selectedPage) || outlinePages[0];
  const company = run?.benefitsPackageSnapshot?.employer || {};
  const companyName = company.name || "Benefits booklet";
  const warnings = run?.confidenceReport?.warnings || [];
  const conflicts = run?.confidenceReport?.conflicts || [];

  const showNotice = (message) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };

  const applyStatus = (payload) => {
    if (payload.thread?.id) setThreadId(payload.thread.id);
    if (payload.files) setFiles(payload.files);
    if (payload.run) {
      activeRunId.current = payload.run.id;
      setRun(payload.run);
      updateRecoveryUrl(payload.run.threadId || payload.thread?.id, payload.run.id);
      if (payload.run.classifications?.length)
        setLiveClassifications(payload.run.classifications);
    }
    if (payload.events) setEvents(payload.events);
    if (payload.facts) setFacts(payload.facts);
    if (payload.sections) setSections(payload.sections);
  };

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    setRestoring(true);
    bookletStudioApi.threadStatus(threadId)
      .then((payload) => {
        if (!cancelled) applyStatus(payload);
      })
      .catch((restoreError) => {
        if (!cancelled) setError(`Could not restore this booklet thread: ${restoreError.message}`);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!outlinePages.length) setSelectedPage(null);
    else if (!outlinePages.some((page) => page.id === selectedPage)) setSelectedPage(outlinePages[0].id);
  }, [outlinePages, selectedPage]);

  useEffect(() => () => {
    window.clearTimeout(noticeTimer.current);
    window.clearTimeout(textStreamingTimer.current);
  }, []);

  useEffect(() => {
    if (generating || !run?.id || !["queued", "processing"].includes(run.status)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const payload = await bookletStudioApi.status(run.id);
        if (!cancelled) applyStatus(payload);
      } catch (pollError) {
        if (!cancelled) setError(`Could not refresh the active run: ${pollError.message}`);
      }
    };
    const interval = window.setInterval(poll, 1800);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [generating, run?.id, run?.status]);

  useEffect(() => {
    if (
      restoring ||
      generating ||
      run?.status !== "failed" ||
      !threadId ||
      !files.length ||
      failedRunRecoveryAttempted.current
    ) return;
    failedRunRecoveryAttempted.current = true;
    void generate(threadId);
  }, [restoring, generating, run?.status, threadId, files.length]);

  useEffect(() => {
    if (
      restoring ||
      generating ||
      run?.status !== "blocked" ||
      !threadId ||
      !files.some((file) => file.sourceKind === "company_website") ||
      sections.some((section) => section.sectionId === "cover") ||
      provisionalCoverRecoveryAttempted.current
    ) return;
    provisionalCoverRecoveryAttempted.current = true;
    void generate(threadId);
  }, [restoring, generating, run?.status, threadId, files, sections]);

  const uploadSources = async (phaseId, selectedFiles) => {
    const sourceFiles = [...selectedFiles];
    if (!sourceFiles.length) return;
    setBusyPhase(phaseId);
    failedRunRecoveryAttempted.current = false;
    setError("");
    try {
      const encoded = await Promise.all(sourceFiles.map(async (file) => ({
        ...(await encodeFile(file)),
        intakeCategory: phaseId,
      })));
      const payload = threadId
        ? await bookletStudioApi.addMessage({
            threadId,
            message: `Added ${sourceFiles.length} source file(s) for ${phaseId}.`,
            files: encoded,
          })
        : await bookletStudioApi.createThread({
            companyId,
            message: "Started a Booklet Studio source collection.",
            files: encoded,
          });
      const nextThreadId = payload.thread?.id || threadId;
      if (nextThreadId) {
        setThreadId(nextThreadId);
        updateRecoveryUrl(nextThreadId, run?.id);
      }
      setFiles((current) => [...current, ...(payload.files || [])]);
      showNotice(`${sourceFiles.length} ${sourceFiles.length === 1 ? "source" : "sources"} persisted`);
      void generate(nextThreadId);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusyPhase("");
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusyPhase("instructions");
    setError("");
    try {
      const payload = threadId
        ? await bookletStudioApi.addMessage({ threadId, message: note.trim(), messageAsEvidence: true })
        : await bookletStudioApi.createThread({ companyId, message: note.trim(), messageAsEvidence: true });
      const nextThreadId = payload.thread?.id || threadId;
      if (nextThreadId) {
        setThreadId(nextThreadId);
        updateRecoveryUrl(nextThreadId, run?.id);
      }
      setFiles((current) => [...current, ...(payload.files || [])]);
      setNote("");
      showNotice("Instructions saved to the booklet thread");
      void generate(nextThreadId);
    } catch (noteError) {
      setError(noteError.message);
    } finally {
      setBusyPhase("");
    }
  };

  const deleteSource = async (file) => {
    if (!threadId || processing) return;
    if (!window.confirm(`Delete ${file.fileName} from this booklet?`)) return;
    setBusyPhase(`delete:${file.id}`);
    setError("");
    try {
      const payload = await bookletStudioApi.deleteFile({ threadId, fileId: file.id });
      setFiles(payload.files);
      setExpandedFileId("");
      setRun(null);
      setEvents([]);
      setLiveClassifications([]);
      provisionalCoverRecoveryAttempted.current = false;
      setFacts([]);
      setSections([]);
      activeRunId.current = "";
      updateRecoveryUrl(threadId, null);
      showNotice(`${file.fileName} deleted`);
      if (payload.files.length) void generate(threadId);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyPhase("");
    }
  };

  const onStreamMessage = (message) => {
    if (message.type === "run") {
      activeRunId.current = message.run.id;
      setRun(message.run);
      updateRecoveryUrl(threadId || message.run.threadId, message.run.id);
    }
    if (message.type === "event") {
      setEvents((current) => eventMerge(current, message.event));
      if (
        message.event.stage === "Classifying documents" &&
        message.event.status === "complete" &&
        Array.isArray(message.event.details?.documents)
      )
        setLiveClassifications((current) => {
          const next = new Map(current.map((item) => [item.fileId, item]));
          message.event.details.documents.forEach((item) =>
            next.set(item.fileId, { ...next.get(item.fileId), ...item }),
          );
          return [...next.values()];
        });
    }
    if (message.type === "section") {
      setSections((current) => [
        ...current.filter((section) => section.id !== message.section.id),
        message.section,
      ].sort((left, right) => left.pageIndex - right.pageIndex));
      setSelectedPage(message.section.id);
      setPreviewMode("pages");
      setTextStreaming(true);
      window.clearTimeout(textStreamingTimer.current);
      textStreamingTimer.current = window.setTimeout(
        () => setTextStreaming(false),
        1_600,
      );
    }
    if (message.type === "result") {
      window.clearTimeout(textStreamingTimer.current);
      setTextStreaming(false);
      setRun(message.run);
    }
  };

  const refreshStatus = async (runId) => {
    const payload = await bookletStudioApi.status(runId);
    applyStatus(payload);
    return payload.run;
  };

  const generate = async (targetThreadId = threadId) => {
    if (!targetThreadId) return;
    queuedGenerationThreadId.current = targetThreadId;
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    setGenerating(true);
    setTextStreaming(false);
    try {
      while (queuedGenerationThreadId.current) {
        const nextThreadId = queuedGenerationThreadId.current;
        queuedGenerationThreadId.current = "";
        setEvents([]);
        setError("");
        try {
          const result = await bookletStudioApi.start({ threadId: nextThreadId }, onStreamMessage);
          const current = await refreshStatus(result.id);
          showNotice(current.status === "blocked" ? "Draft updated · finish remaining setup details when available" : "Booklet generation complete");
        } catch (generationError) {
          setError(generationError.message);
          if (activeRunId.current) await refreshStatus(activeRunId.current).catch(() => {});
        }
      }
    } finally {
      generationInFlight.current = false;
      setGenerating(false);
    }
  };

  const answerQuestion = async (question, answer) => {
    setGenerating(true);
    setEvents([]);
    setSections([]);
    setError("");
    try {
      const result = await bookletStudioApi.answer(
        { runId: run.id, questionId: question.id, answer },
        onStreamMessage,
      );
      const current = await refreshStatus(result.id);
      showNotice(current.status === "complete" ? "Booklet generation complete" : "Detail saved · draft updated");
    } catch (answerError) {
      setError(answerError.message);
      await refreshStatus(activeRunId.current || run.id).catch(() => {});
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!run?.pdfUrl) return;
    const anchor = document.createElement("a");
    anchor.href = run.pdfUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.click();
  };

  if (restoring) return (
    <div className="bs-studio bs-restoring"><LoaderCircle className="bs-spin" /><b>Restoring Booklet Studio</b><span>Loading the persisted thread, sources, run, and result…</span></div>
  );

  return (
    <div className="bs-studio">
      <header className="bs-topbar tw:flex tw:items-center tw:justify-between">
        <div className="bs-topbar__left tw:flex tw:items-center">
          <button className="bs-brand" onClick={() => window.location.assign("/")} aria-label="Back to Ansa workspace"><b>ansa</b></button>
          <span className="bs-topbar__divider" />
          <div className="bs-breadcrumb tw:flex tw:items-center"><span>Benefits</span><ChevronDown /><b>{companyName}</b></div>
        </div>
        <div className="bs-topbar__right tw:flex tw:items-center">
          <span className="bs-saved tw:flex tw:items-center"><ShieldCheck /> {threadId ? "Saved to secure thread" : "New booklet"}</span>
          <button className="bs-icon-button" aria-label="More options"><MoreHorizontal /></button>
        </div>
      </header>

      <main className="bs-main">
        {error && <div className="bs-api-error"><AlertCircle /><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        <div className="bs-mobile-switcher tw:grid tw:grid-cols-2" role="tablist" aria-label="Booklet studio panels">
          <button className={!mobilePreview ? "active" : ""} onClick={() => setMobilePreview(false)}>Sources</button>
          <button className={mobilePreview ? "active" : ""} onClick={() => setMobilePreview(true)}>Preview <span>{outlinePages.length}</span></button>
        </div>

        <section className={`bs-workspace tw:grid ${mobilePreview ? "show-preview" : ""}`}>
          <div className="bs-flow-panel">
            <div className="bs-step-header">
              <div className="bs-panel-heading bs-step-header__meta"><span>Your information</span><b>{readyPhaseCount} of {phaseDefinitions.length} ready</b></div>
              <span className="bs-flow-progress" aria-label={`${completion}% complete`}><i style={{ width: `${completion}%` }} /></span>
            </div>
            <div className="bs-flow-body">
              <PhaseTabs
                activeIndex={activePhaseIndex}
                filesByPhase={filesByPhase}
                busyPhase={busyPhase}
                onSelect={(index) => setActivePhase(phaseDefinitions[index].id)}
              />
              <FocusedPhase
                phase={currentPhase}
                files={filesByPhase[currentPhase.id] || []}
                classifications={classifications}
                facts={facts}
                planBenefitCounts={planBenefitCounts}
                expandedFileId={expandedFileId}
                setExpandedFileId={setExpandedFileId}
                note={note}
                setNote={setNote}
                busy={Boolean(busyPhase)}
                processing={processing}
                questions={questions}
                phaseBusy={busyPhase === currentPhase.id}
                onNote={addNote}
                onFiles={(selectedFiles) => uploadSources(currentPhase.id, selectedFiles)}
                onDeleteFile={deleteSource}
                onAnswer={answerQuestion}
                onBack={() => setActivePhase(phaseDefinitions[activePhaseIndex - 1]?.id)}
                onNext={() => setActivePhase(phaseDefinitions[activePhaseIndex + 1]?.id)}
                canBack={activePhaseIndex > 0}
                canNext={activePhaseIndex < phaseDefinitions.length - 1}
              />
            </div>
          </div>

          <BookletPreview
            pages={outlinePages}
            selectedPage={selectedOutlinePage}
            setSelectedPage={setSelectedPage}
            completion={completion}
            mode={previewMode}
            setMode={setPreviewMode}
            run={run}
            events={events}
            files={files}
            facts={facts}
            warnings={warnings}
            conflicts={conflicts}
            processing={processing}
            textStreaming={textStreaming}
            onDownload={downloadPdf}
            onBack={() => setMobilePreview(false)}
          />
        </section>
      </main>
      {notice && <div className="bs-toast tw:rounded-ansa tw:shadow-ansa"><CheckCircle2 /> {notice}</div>}
    </div>
  );
}

function PhaseTabs({ activeIndex, filesByPhase, busyPhase, onSelect }) {
  return (
    <nav className="bs-step-tabs" aria-label="Information phases">
      {phaseDefinitions.map((phase, index) => {
        const count = filesByPhase[phase.id]?.length || 0;
        const busy = busyPhase === phase.id;
        return (
          <button key={phase.id} className={`${activeIndex === index ? "active" : ""} ${count ? "complete" : ""} ${busy ? "processing" : ""}`} onClick={() => onSelect(index)}>
            <span>{busy ? <LoaderCircle className="bs-spin" /> : count ? <Check /> : String(index + 1).padStart(2, "0")}</span>
            <b>{phaseTabLabels[phase.id]}</b>
            {count > 1 && <small>{count}</small>}
          </button>
        );
      })}
    </nav>
  );
}

function FocusedPhase({ phase, files, classifications, facts, planBenefitCounts, expandedFileId, setExpandedFileId, note, setNote, busy, processing, questions, phaseBusy, onNote, onFiles, onDeleteFile, onAnswer, onBack, onNext, canBack, canNext }) {
  const inputRef = useRef(null);
  const contentRef = useRef(null);
  const dragDepth = useRef(0);
  const [phasePanel, setPhasePanel] = useState("sources");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const phaseFileIds = new Set(files.map((file) => file.id));
  const phaseFacts = facts.filter((fact) => phaseFileIds.has(fact.fileId));
  const phaseQuestions = questions.filter((question) => phaseForQuestion(question) === phase.id);
  useEffect(() => {
    setPhasePanel("sources");
    dragDepth.current = 0;
    setDraggingFiles(false);
  }, [phase.id]);
  useEffect(() => {
    if (!phaseQuestions.length && phasePanel === "details") setPhasePanel("sources");
    if (!phaseFacts.length && phasePanel === "extracted") setPhasePanel("sources");
  }, [phaseQuestions.length, phaseFacts.length, phasePanel]);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [phase.id, phasePanel]);
  return (
    <article className={`bs-focused-phase phase-${phase.id} ${files.length ? "is-complete" : ""} ${phaseQuestions.length || phaseFacts.length ? "has-details" : ""} ${phaseBusy ? "is-processing" : ""}`}>
      <div className="bs-focused-phase__content" ref={contentRef}>
        <header className="bs-focused-phase__intro"><div className="bs-question-copy"><h2>{phasePrompts[phase.id]}</h2><p>{phase.description}</p></div></header>
        <div className={`bs-focused-phase__answer is-${phasePanel}`}>
          {(phaseQuestions.length > 0 || phaseFacts.length > 0) && <nav className="bs-phase-subtabs" aria-label={`${phaseTabLabels[phase.id]} setup views`}><button className={phasePanel === "sources" ? "active" : ""} onClick={() => setPhasePanel("sources")}>Sources</button>{phaseFacts.length > 0 && <button className={phasePanel === "extracted" ? "active" : ""} onClick={() => setPhasePanel("extracted")}>Extracted <span>{phaseFacts.length}</span></button>}{phaseQuestions.length > 0 && <button className={phasePanel === "details" ? "active" : ""} onClick={() => setPhasePanel("details")}>Details <span>{phaseQuestions.length}</span></button>}</nav>}
          {phase.id === "instructions" && (
            <section className="bs-note-input"><label><span>Broker or client instructions</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add final decisions, corrections, or language instructions…" rows="5" disabled={busy} /></label><button onClick={onNote} disabled={busy || !note.trim()}>{phaseBusy ? <LoaderCircle className="bs-spin" /> : <Check />} Save instructions</button></section>
          )}
          <button className={`bs-dropzone bs-dropzone--focused tw:rounded-ansa ${draggingFiles ? "is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDraggingFiles(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDraggingFiles(false); }} onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDraggingFiles(false); onFiles(event.dataTransfer.files); }} disabled={busy}>
            <b>{phaseBusy ? <LoaderCircle className="bs-spin" /> : <Upload />} {phaseBusy ? "Saving sources…" : draggingFiles ? "Drop files" : "Choose files"}</b>
            <span>{draggingFiles ? "Release to add them" : "or drop them here"}</span>
            <small>{phase.accepted}</small>
          </button>
          {phase.id === "documents" && (
            <section className="bs-benefit-inventory" aria-label="Benefit document inventory">
              <div className="bs-benefit-inventory__head"><b>Benefit coverage</b><span>Automatically sorted from your documents</span></div>
              <div className="bs-benefit-inventory__groups">
                {planBenefitGroups.map((group) => {
                  const count = planBenefitCounts[group.id] || 0;
                  return <span className={count ? "found" : ""} key={group.id}>{count ? <Check /> : <Circle />}<b>{group.label}</b>{count > 0 && <small>{count}</small>}</span>;
                })}
              </div>
            </section>
          )}
          <input ref={inputRef} className="bs-hidden-input" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.eml,.txt" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
          {files.map((file) => {
            const classification = classifications.find((item) => item.fileId === file.id);
            const benefitLabel = classification?.detectedBenefitTypes?.length ? ` · ${classification.detectedBenefitTypes.join(", ")}` : "";
            const sourceStatus = classification
              ? `${classification.documentType.replaceAll("_", " ")}${benefitLabel} · ${Math.round(classification.confidence * 100)}%`
              : file.sourceKind === "company_website"
                ? "Employer identity found · preparing cover"
                : "Persisted · awaiting pipeline classification";
            const expanded = expandedFileId === file.id;
            return (
              <div className={`bs-source-record ${expanded ? "is-expanded" : ""}`} key={file.id}>
                <div className="bs-source-file bs-source-file--interactive tw:grid tw:items-center" role="button" tabIndex="0" aria-expanded={expanded} onClick={() => setExpandedFileId(expanded ? "" : file.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedFileId(expanded ? "" : file.id); } }}>
                  <span><FileText /></span>
                  <div><b>{file.fileName}</b><small>{sourceStatus}</small></div>
                  <i><ShieldCheck /> {file.sourceKind === "company_website" ? "Website" : "Stored"}</i>
                  <button className="bs-source-file__delete" onClick={(event) => { event.stopPropagation(); onDeleteFile(file); }} onKeyDown={(event) => event.stopPropagation()} disabled={busy || processing} aria-label={`Delete ${file.fileName}`}><Trash2 /></button>
                </div>
                {expanded && (
                  <div className="bs-source-details">
                    <dl>
                      <div><dt>Classification</dt><dd>{classification?.documentType?.replaceAll("_", " ") || "Pending"}</dd></div>
                      <div><dt>Benefit types</dt><dd>{classification?.detectedBenefitTypes?.length ? classification.detectedBenefitTypes.join(", ") : "Not identified yet"}</dd></div>
                      <div><dt>Confidence</dt><dd>{classification ? `${Math.round(classification.confidence * 100)}%` : "Pending"}</dd></div>
                      <div><dt>Carrier</dt><dd>{classification?.detectedCarrier || "Not identified"}</dd></div>
                      <div><dt>Plan year</dt><dd>{classification?.detectedPlanYear || "Not identified"}</dd></div>
                      <div><dt>File type</dt><dd>{file.mimeType}</dd></div>
                    </dl>
                    {classification?.reasoningSummary && <p>{classification.reasoningSummary}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {phaseFacts.length > 0 && <ExtractedFacts facts={phaseFacts} />}
          {phaseQuestions.length > 0 && <section className="bs-setup-questions"><header><b>{phase.id === "employer" ? "Finish the employer details" : phase.id === "documents" ? "Confirm the offered plans" : phase.id === "rates" ? "Finish the rate matching" : "A few details to confirm"}</b><span>{phase.id === "employer" ? "These fields are normally found on the New Group Application or, at renewal, the Annual Group Information Form. Uploading that form can fill them automatically." : "Add these when the source documents do not resolve them automatically."}</span></header>{phaseQuestions.map((question) => <QuestionCard key={question.id} question={question} disabled={processing} placement="setup" onAnswer={(answer) => onAnswer(question, answer)} />)}</section>}
        </div>
      </div>
      <footer className="bs-focused-phase__nav">
        <span>{phasePanel === "details" && phaseQuestions.length ? `${phaseQuestions.length} setup ${phaseQuestions.length === 1 ? "detail" : "details"} remaining.` : phasePanel === "extracted" ? `${phaseFacts.length} source-backed ${phaseFacts.length === 1 ? "field" : "fields"}.` : phaseBusy ? "Ansa is processing this source." : files.length ? "This source is ready." : "Add a source to unlock the next step."}</span>
        <div className="bs-step-arrows" aria-label="Move between steps">
          <button onClick={onBack} disabled={!canBack} aria-label="Previous step"><ArrowUp /></button>
          <button className="next" onClick={onNext} disabled={!canNext} aria-label="Next step"><ArrowDown /></button>
        </div>
      </footer>
    </article>
  );
}

function BookletPreview({ pages, selectedPage, setSelectedPage, completion, mode, setMode, run, events, files, facts, warnings, conflicts, processing, textStreaming, onDownload, onBack }) {
  const checksCount = warnings.length + conflicts.length + (run?.qualityReport?.issues?.length || 0);
  return (
    <aside className={`bs-preview-panel ${textStreaming ? "is-streaming" : ""}`}>
      <div className="bs-preview-top tw:flex tw:items-center tw:justify-between">
        <button className="bs-preview-back" onClick={onBack}><ArrowLeft /> Sources</button>
        <div className="bs-panel-heading"><span className="bs-guide-title">Generated benefits guide</span><b>{processing ? pages.length ? `${pages.length} HTML page(s) ready · ${events.at(-1)?.stage || "Processing"}` : events.at(-1)?.stage || "Processing" : run?.status === "complete" ? `${pages.length} compiled pages · PDF ready` : run?.status === "blocked" ? `${pages.length} draft page(s) ready · continue setup on the left` : "Waiting for a generation run"}</b></div>
        <div className="bs-preview-actions tw:flex tw:items-center"><button className="bs-icon-button bs-icon-button--light" onClick={() => run?.pdfUrl && window.open(run.pdfUrl, "_blank", "noopener")} disabled={!run?.pdfUrl} aria-label="Open generated PDF"><ExternalLink /></button><button className="bs-button bs-button--light" onClick={onDownload} disabled={!run?.pdfUrl}><Download /> PDF</button></div>
      </div>
      <nav className="bs-preview-tabs tw:flex" aria-label="Preview sections">
        {[["pages", "Pages", pages.length], ["checks", "Checks", checksCount], ["sources", "Sources", files.length]].map(([key, label, count]) => <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>{label}<span>{count}</span></button>)}
      </nav>
      {mode === "pages" && <PagesView pages={pages} page={selectedPage} setSelectedPage={setSelectedPage} run={run} completion={completion} processing={processing} textStreaming={textStreaming} />}
      {mode === "checks" && <ChecksView run={run} warnings={warnings} conflicts={conflicts} processing={processing} />}
      {mode === "sources" && <SourcesView files={files} facts={facts} classifications={run?.classifications || []} />}
    </aside>
  );
}

function PagesView({ pages, page, setSelectedPage, run, completion, processing, textStreaming }) {
  const thumbnailsRef = useRef(null);
  useEffect(() => {
    thumbnailsRef.current?.querySelector("button.active")?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [page?.id]);
  if (!pages.length) return <div className="bs-preview-empty"><div className="bs-empty-booklet"><i /><i /><span>{processing ? <LoaderCircle className="bs-spin" /> : <BookOpen />}</span></div><span className="bs-preview-kicker">Backend-owned outline</span><h2>{processing ? "Building from your evidence" : run?.status === "blocked" ? "Keep completing the setup" : "No generated booklet yet"}</h2><p>{processing ? "Classification, extraction, matching, and conflict resolution are running now." : run?.status === "blocked" ? "Missing source details now appear in their relevant steps on the left." : "Collect one or more sources and start the global generation run."}</p></div>;
  return <div className="bs-pages-view"><div className="bs-thumbnails" ref={thumbnailsRef} aria-label="Generated booklet outline">{pages.map((item) => <button key={item.id} className={item.id === page?.id ? "active" : ""} onClick={() => setSelectedPage(item.id)}><span><div className="bs-mini-page"><Logo /><b>{item.title}</b><i /></div></span><small>{String(item.number).padStart(2, "0")}</small></button>)}</div><div className="bs-canvas-wrap"><div className="bs-canvas-meta"><div><span>Page {page?.number} · {pages.length} currently ready</span><b>{page?.title}{page?.contentStatus === "provisional" && <em className="bs-provisional-label">Draft · awaiting plan year</em>}</b></div>{textStreaming && <span className="bs-completion-status"><i><span style={{ width: `${completion}%` }} /></i><b>Writing page</b></span>}</div><div className="bs-canvas-stage bs-pdf-stage">{run?.pdfUrl ? <iframe key={`${run.pdfUrl}-${page?.number}`} title={`Generated PDF: ${page?.title}`} src={`${run.pdfUrl}#page=${page?.number}&view=FitH`} /> : page?.html ? <HtmlPagePreview key={`${page.id}-${page.createdAt}`} page={page} /> : <div className="bs-outline-sheet"><Logo /><small>Generated outline section</small><h2>{page?.title}</h2><p>This section and its source references were selected by the backend package.</p></div>}</div>{run?.status === "complete" && <div className="bs-ready-bar"><span><CheckCircle2 /></span><div><b>Booklet ready</b><small>{pages.length} source-backed pages · quality checks passed</small></div></div>}</div></div>;
}

function HtmlPagePreview({ page }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.65);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const fit = () => {
      const width = Math.max(0, container.clientWidth - 28);
      const height = Math.max(0, container.clientHeight - 28);
      if (width < 100 || height < 100) return;
      setScale(Math.min(1, width / 816, height / 1056));
    };
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return <div className="bs-html-preview" ref={containerRef}><div className="bs-html-preview__sizer" style={{ width: `${816 * scale}px`, height: `${1056 * scale}px` }}><div className="bs-html-preview__page" style={{ transform: `scale(${scale})` }}><iframe title={`Generated HTML: ${page.title}`} srcDoc={page.html} sandbox="" scrolling="no" /></div></div></div>;
}

function ChecksView({ run, warnings, conflicts, processing }) {
  return <div className="bs-inspection-view"><div className="bs-inspection-head"><span><Gauge /></span><div><small>Backend QA</small><h3>Booklet checks</h3><p>Confidence warnings, source conflicts, and final render quality appear here. Missing setup fields stay with their source steps on the left.</p></div></div>{processing && <div className="bs-check-alert"><LoaderCircle className="bs-spin" /><span><b>Checks are running</b><small>The latest status will appear as pipeline events complete.</small></span></div>}{warnings.map((warning) => <div className="bs-warning-note" key={warning}><AlertCircle /><span><b>Confidence warning</b><small>{warning}</small></span></div>)}{conflicts.map((conflict) => <div className="bs-warning-note" key={conflict.fieldPath}><Zap /><span><b>{conflict.fieldPath}</b><small>{conflict.resolution || conflict.description}</small></span></div>)}{run?.qualityReport && <section className="bs-check-group"><h4>Final PDF quality</h4><div className={run.qualityReport.passed ? "done" : "pending"}><span>{run.qualityReport.passed ? <Check /> : <AlertCircle />}</span><b>{run.qualityReport.passed ? "Preflight and post-render checks passed" : "Quality checks failed"}</b><small>{run.qualityReport.pageCount ? `${run.qualityReport.pageCount} pages` : "No final page count"}</small></div>{run.qualityReport.issues.map((issue) => <div className="pending" key={`${issue.code}-${issue.message}`}><span><AlertCircle /></span><b>{issue.message}</b><small>{issue.blocking ? "Blocking" : "Warning"}</small></div>)}</section>}{!processing && !warnings.length && !conflicts.length && !run?.qualityReport && <div className="bs-check-empty"><CheckCircle2 /><span><b>No QA issues</b><small>Setup questions, if any, are shown in their relevant steps on the left.</small></span></div>}</div>;
}

function QuestionCard({ question, disabled, onAnswer, placement = "checks" }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(question.options?.[0] || "flat_monthly");
  const [payPeriods, setPayPeriods] = useState("26");
  const contribution = question.fieldPath.startsWith("contributions.");
  const planSelection = question.fieldPath === "plans.selected";
  const date = question.fieldPath.startsWith("planYear.");
  const submit = () => {
    if (contribution) {
      const numericValue = Number(value);
      onAnswer({
        mode,
        value: mode === "percent" && numericValue > 1 ? numericValue / 100 : numericValue,
        payPeriods: Number(payPeriods),
      });
    }
    else if (planSelection) {
      const plans = value.split("\n").map((line) => line.split("|").map((item) => item.trim())).filter((parts) => parts[0] && parts[1]).map(([benefitType, planName, carrier]) => ({ benefitType: benefitType.toLowerCase(), planName, carrier: carrier || null }));
      onAnswer(plans);
    } else onAnswer(value);
  };
  return <article className={`bs-question-card ${placement === "setup" ? "bs-question-card--setup" : ""}`}><div className="bs-blocker__head"><span>{placement === "setup" ? <Circle /> : <Zap />}</span><div><small>{placement === "setup" ? "Complete when available" : "Decision required"} · {question.fieldPath}</small><b>{question.question}</b></div></div><p>{question.reason}</p>{contribution ? <div className="bs-question-fields"><label><span>Contribution method</span><select value={mode} onChange={(event) => setMode(event.target.value)} disabled={disabled}>{question.options?.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label><label><span>{mode === "percent" ? "Percent (decimal or whole)" : "Amount ($)"}</span><input type="number" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} /></label><label><span>Pay periods</span><input type="number" value={payPeriods} onChange={(event) => setValue(event.target.value)} disabled={disabled} /></label></div> : question.options?.length ? <div className="bs-blocker__answers tw:flex tw:flex-wrap">{question.options.map((option) => <button key={option} onClick={() => onAnswer(option)} disabled={disabled}>{option}<ArrowRight /></button>)}</div> : <div className="bs-question-fields"><label className="wide"><span>{planSelection ? "One plan per line: benefit type | plan name | carrier" : "Your answer"}</span>{planSelection ? <textarea rows="4" value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} placeholder="medical | Plan name | Carrier" /> : <input type={date ? "date" : "text"} value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} />}</label></div>}{(!question.options?.length || contribution) && <button className="bs-answer-submit" onClick={submit} disabled={disabled || !value.trim()}>Save detail and continue <ArrowRight /></button>}<div className="bs-question-sources">{question.sourceRefs?.length ? `${question.sourceRefs.length} related source reference(s)` : placement === "setup" ? "Upload the group paperwork to fill this automatically, or enter it here." : "No reliable source reference was found"}</div></article>;
}

function SourcesView({ files, facts, classifications }) {
  return <div className="bs-inspection-view"><div className="bs-inspection-head"><span><Files /></span><div><small>Persisted source of truth</small><h3>Connected evidence</h3><p>Uploaded sources and their processing status appear here. Review extracted fields in the corresponding left-side step.</p></div></div><div className="bs-sources-list">{files.map((file) => { const classification = classifications.find((item) => item.fileId === file.id); const count = facts.filter((fact) => fact.fileId === file.id).length; return <div key={file.id} className="ready"><span><FileCheck2 /></span><div><b>{file.fileName}</b><small>{classification ? classification.documentType.replaceAll("_", " ") : file.sourceKind === "company_website" ? "company website" : "Uploaded source"} · {count} extracted fields</small></div><em>{classification ? `${Math.round(classification.confidence * 100)}%` : "Stored"}</em></div>; })}</div>{!files.length && <div className="bs-check-empty"><FileText /><span><b>No evidence connected</b><small>Choose or drop a supported source file in any input category.</small></span></div>}</div>;
}
