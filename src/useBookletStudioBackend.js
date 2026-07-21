import { useEffect, useMemo, useRef, useState } from "react";
import { bookletStudioApi, encodeFile } from "./bookletStudioApi";
import { phaseDefinitions } from "./bookletStudioData";

const pipelineStageCount = 14;

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

function filePhase(file, classifications) {
  if (file.intakeCategory)
    return file.intakeCategory === "template" ? "instructions" : file.intakeCategory;
  const classification = classifications.find((item) => item.fileId === file.id);
  return phaseForDocumentType[classification?.documentType] || "instructions";
}

function updateRecoveryUrl(threadId, runId) {
  const url = new URL(window.location.href);
  if (threadId) url.searchParams.set("threadId", threadId);
  else if (threadId === null) url.searchParams.delete("threadId");
  if (runId) url.searchParams.set("runId", runId);
  else if (runId === null) url.searchParams.delete("runId");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function mergeEvent(events, event) {
  return [...events.filter((item) => item.id !== event.id), event].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export function phaseForQuestion(question) {
  const path = question.fieldPath;
  if (/^(?:employer|planYear|eligibility)\./.test(path)) return "employer";
  if (path === "plans.selected") return "documents";
  if (/^(?:plans\.[^.]+\.ratePlanId|contributions\.)/.test(path)) return "rates";
  return "instructions";
}

export function useBookletStudioBackend(companyId) {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [threadId, setThreadId] = useState(query.get("threadId") || "");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [liveClassifications, setLiveClassifications] = useState([]);
  const [facts, setFacts] = useState([]);
  const [sections, setSections] = useState([]);
  const [files, setFiles] = useState([]);
  const [busyPhase, setBusyPhase] = useState("");
  const [generating, setGenerating] = useState(false);
  const [textStreaming, setTextStreaming] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(threadId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);
  const textStreamingTimer = useRef(null);
  const activeRunId = useRef(query.get("runId") || "");
  const generationInFlight = useRef(false);
  const queuedGenerationThreadId = useRef("");

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
  const completedStages = useMemo(
    () => new Set(events.filter((event) => event.status === "complete").map((event) => event.stage)),
    [events],
  );
  const completion = run?.status === "complete"
    ? 100
    : Math.min(96, Math.round((completedStages.size / pipelineStageCount) * 100));
  const processing = generating || ["queued", "processing"].includes(run?.status);
  const pages = useMemo(() => {
    if (sections.length)
      return [...sections]
        .sort((left, right) => left.pageIndex - right.pageIndex)
        .map((section) => ({ ...section, number: section.pageIndex + 1, kind: section.sectionId }));
    return (run?.bookletOutline?.sections || []).map((section, index) => ({
      ...section,
      number: index + 1,
      kind: section.id,
    }));
  }, [sections, run?.bookletOutline]);

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
      .then((payload) => { if (!cancelled) applyStatus(payload); })
      .catch((restoreError) => { if (!cancelled) setError(`Could not restore this booklet thread: ${restoreError.message}`); })
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, []);

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
    void poll();
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [generating, run?.id, run?.status]);

  const onStreamMessage = (message) => {
    if (message.type === "run") {
      activeRunId.current = message.run.id;
      setRun(message.run);
      updateRecoveryUrl(threadId || message.run.threadId, message.run.id);
    }
    if (message.type === "event") {
      setEvents((current) => mergeEvent(current, message.event));
      if (
        message.event.stage === "Classifying documents" &&
        message.event.status === "complete" &&
        Array.isArray(message.event.details?.documents)
      )
        setLiveClassifications((current) => {
          const next = new Map(current.map((item) => [item.fileId, item]));
          message.event.details.documents.forEach((item) => next.set(item.fileId, { ...next.get(item.fileId), ...item }));
          return [...next.values()];
        });
    }
    if (message.type === "section") {
      setSections((current) => [
        ...current.filter((section) => section.id !== message.section.id),
        message.section,
      ].sort((left, right) => left.pageIndex - right.pageIndex));
      setTextStreaming(true);
      window.clearTimeout(textStreamingTimer.current);
      textStreamingTimer.current = window.setTimeout(() => setTextStreaming(false), 1600);
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
          const result = await bookletStudioApi.start({
            threadId: nextThreadId,
            generationMode: "employee_booklet",
          }, onStreamMessage);
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

  const uploadSources = async (phaseId, selectedFiles) => {
    const sourceFiles = [...selectedFiles];
    if (!sourceFiles.length) return;
    setBusyPhase(phaseId);
    setError("");
    try {
      const encoded = await Promise.all(sourceFiles.map(async (file) => ({
        ...(await encodeFile(file)),
        intakeCategory: phaseId,
      })));
      const payload = threadId
        ? await bookletStudioApi.addMessage({ threadId, message: `Added ${sourceFiles.length} source file(s) for ${phaseId}.`, files: encoded })
        : await bookletStudioApi.createThread({ companyId, message: "Started a Booklet Studio source collection.", files: encoded });
      const nextThreadId = payload.thread?.id || threadId;
      if (nextThreadId) {
        setThreadId(nextThreadId);
        updateRecoveryUrl(nextThreadId, run?.id);
      }
      setFiles(payload.files || []);
      showNotice(`${sourceFiles.length} ${sourceFiles.length === 1 ? "source" : "sources"} persisted`);
      void generate(nextThreadId);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusyPhase("");
    }
  };

  const addNote = async (note) => {
    if (!note.trim()) return;
    setBusyPhase("instructions");
    setError("");
    try {
      const payload = threadId
        ? await bookletStudioApi.addMessage({ threadId, message: note.trim(), messageAsEvidence: true })
        : await bookletStudioApi.createThread({ companyId, message: note.trim(), messageAsEvidence: true });
      const nextThreadId = payload.thread?.id || threadId;
      if (nextThreadId) setThreadId(nextThreadId);
      setFiles(payload.files || []);
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
      setRun(null);
      setEvents([]);
      setLiveClassifications([]);
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

  const answerQuestion = async (question, answer) => {
    setGenerating(true);
    setEvents([]);
    setError("");
    try {
      const result = await bookletStudioApi.answer({ runId: run.id, questionId: question.id, answer }, onStreamMessage);
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

  return {
    threadId, run, events, facts, files, filesByPhase, classifications, pages,
    busyPhase, processing, textStreaming, restoring, error, setError, notice,
    completion, questions: run?.questions || [], uploadSources,
    addNote, deleteSource, answerQuestion, downloadPdf,
  };
}
