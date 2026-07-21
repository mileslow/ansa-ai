import { useEffect, useMemo, useRef, useState } from "react";
import { bookletStudioApi, encodeFile } from "./bookletStudioApi";
import { phaseDefinitions } from "./bookletStudioData";
import {
  bookletFilePhase,
  mergeBookletClassifications,
  bookletStudioSetupComplete,
  mergeBookletFiles,
} from "./bookletStudioReadiness";
import {
  bookletTextStreamChangedWordCount,
  bookletTextStreamDuration,
  bookletTextStreamShouldAnimate,
} from "./bookletTextStream";

const pipelineStageCount = 14;

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
  const [latestStreamedSectionId, setLatestStreamedSectionId] = useState("");
  const [processingFileIds, setProcessingFileIds] = useState(() => new Set());
  const [restoring, setRestoring] = useState(Boolean(threadId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);
  const textStreamingTimer = useRef(null);
  const textStreamQueue = useRef([]);
  const activeTextStream = useRef(null);
  const sectionHtmlById = useRef(new Map());
  const sectionRevisionById = useRef(new Map());
  const activeRunId = useRef(query.get("runId") || "");
  const generationInFlight = useRef(false);
  const queuedGenerationRequest = useRef(null);
  const autoFinalizedPreviewRun = useRef("");

  const classifications = run?.classifications?.length
    ? run.classifications
    : liveClassifications;
  const filesByPhase = useMemo(
    () => Object.fromEntries(
      phaseDefinitions.map((phase) => [
        phase.id,
        files.filter((file) => bookletFilePhase(file, classifications) === phase.id),
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
  const setupComplete = bookletStudioSetupComplete(
    files,
    classifications,
    facts,
    run?.questions || [],
  );
  const pdfReady =
    setupComplete &&
    !processing &&
    run?.status === "complete" &&
    !run.questions?.length &&
    Boolean(run.pdfUrl);
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

  const stopTextStream = () => {
    window.clearTimeout(textStreamingTimer.current);
    textStreamQueue.current = [];
    activeTextStream.current = null;
    setTextStreaming(false);
  };

  const showNextTextStream = () => {
    window.clearTimeout(textStreamingTimer.current);
    while (textStreamQueue.current.length) {
      const next = textStreamQueue.current.shift();
      setSections((current) => [
        ...current.filter((section) => section.id !== next.section.id),
        next.section,
      ].sort((left, right) => left.pageIndex - right.pageIndex));
      if (!next.changedWordCount) continue;
      activeTextStream.current = next;
      setLatestStreamedSectionId(next.section.id);
      setTextStreaming(true);
      const streamDuration = bookletTextStreamDuration(next.changedWordCount);
      textStreamingTimer.current = window.setTimeout(() => {
        activeTextStream.current = null;
        showNextTextStream();
      }, streamDuration);
      return;
    }
    activeTextStream.current = null;
    setTextStreaming(false);
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
    if (
      payload.sections &&
      !activeTextStream.current &&
      !textStreamQueue.current.length
    ) {
      sectionHtmlById.current = new Map(
        payload.sections.map((section) => [section.id, section.html]),
      );
      setSections(payload.sections);
    }
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
        Array.isArray(message.event.details?.documents)
      )
        setLiveClassifications((current) =>
          mergeBookletClassifications(
            current,
            message.event.details.documents,
          ),
        );
      if (
        message.event.stage === "Parsing plan documents" &&
        message.event.details?.fileId &&
        message.event.details?.parseStatus === "complete"
      ) setProcessingFileIds((current) => {
        const next = new Set(current);
        next.delete(message.event.details.fileId);
        return next;
      });
    }
    if (message.type === "section") {
      const previousHtml = sectionHtmlById.current.get(message.section.id) || "";
      const streamRevision = (sectionRevisionById.current.get(message.section.id) || 0) + 1;
      sectionHtmlById.current.set(message.section.id, message.section.html);
      sectionRevisionById.current.set(message.section.id, streamRevision);
      const nextSection = {
        ...message.section,
        previousHtml,
        streamRevision,
      };
      const changedWordCount = bookletTextStreamChangedWordCount(
        message.section.html,
        previousHtml,
      );
      textStreamQueue.current.push({
        section: nextSection,
        changedWordCount: bookletTextStreamShouldAnimate(
          changedWordCount,
          Boolean(previousHtml),
        ) ? changedWordCount : 0,
      });
      if (!activeTextStream.current) showNextTextStream();
    }
    if (message.type === "result") {
      setProcessingFileIds(new Set());
      setRun(message.run);
    }
  };

  const refreshStatus = async (runId) => {
    const payload = await bookletStudioApi.status(runId);
    applyStatus(payload);
    return payload.run;
  };

  const generate = async (targetThreadId = threadId, targetFiles = files, outputMode = "html_preview") => {
    if (!targetThreadId) return;
    queuedGenerationRequest.current = {
      threadId: targetThreadId,
      outputMode,
    };
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    setGenerating(true);
    if (!activeTextStream.current) setTextStreaming(false);
    try {
      while (queuedGenerationRequest.current) {
        const nextRequest = queuedGenerationRequest.current;
        queuedGenerationRequest.current = null;
        setEvents([]);
        setLatestStreamedSectionId("");
        setError("");
        try {
          const result = await bookletStudioApi.start({
            threadId: nextRequest.threadId,
            generationMode: "employee_booklet",
            outputMode: nextRequest.outputMode,
          }, onStreamMessage);
          const current = await refreshStatus(result.id);
          showNotice(
            current.status === "complete"
              ? "Booklet generation complete"
              : "HTML preview updated · finish the remaining setup details",
          );
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

  useEffect(() => {
    if (
      !setupComplete ||
      processing ||
      !threadId ||
      run?.status !== "preview" ||
      run.outputMode === "final_pdf" ||
      autoFinalizedPreviewRun.current === run.id
    ) return;
    autoFinalizedPreviewRun.current = run.id;
    void generate(threadId, files, "final_pdf");
  }, [setupComplete, processing, threadId, run?.id, run?.status, run?.outputMode, files]);

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
      const creatingThread = !threadId;
      const payload = threadId
        ? await bookletStudioApi.addMessage({ threadId, message: `Added ${sourceFiles.length} source file(s) for ${phaseId}.`, files: encoded })
        : await bookletStudioApi.createThread({ companyId, message: "Started a Booklet Studio source collection.", files: encoded });
      const nextThreadId = payload.thread?.id || threadId;
      const nextFiles = mergeBookletFiles(files, payload.files || [], creatingThread);
      const existingFileIds = new Set(files.map((file) => file.id));
      const addedFileIds = (payload.files || [])
        .filter((file) => !existingFileIds.has(file.id))
        .map((file) => file.id);
      if (nextThreadId) {
        setThreadId(nextThreadId);
        updateRecoveryUrl(nextThreadId, run?.id);
      }
      setFiles(nextFiles);
      if (addedFileIds.length)
        setProcessingFileIds((current) => new Set([...current, ...addedFileIds]));
      showNotice(`${sourceFiles.length} ${sourceFiles.length === 1 ? "source" : "sources"} persisted`);
      void generate(nextThreadId, nextFiles);
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
      const creatingThread = !threadId;
      const payload = threadId
        ? await bookletStudioApi.addMessage({ threadId, message: note.trim(), messageAsEvidence: true })
        : await bookletStudioApi.createThread({ companyId, message: note.trim(), messageAsEvidence: true });
      const nextThreadId = payload.thread?.id || threadId;
      const nextFiles = mergeBookletFiles(files, payload.files || [], creatingThread);
      if (nextThreadId) setThreadId(nextThreadId);
      setFiles(nextFiles);
      showNotice("Instructions saved to the booklet thread");
      void generate(nextThreadId, nextFiles);
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
      stopTextStream();
      sectionHtmlById.current.clear();
      sectionRevisionById.current.clear();
      setProcessingFileIds((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
      activeRunId.current = "";
      updateRecoveryUrl(threadId, null);
      showNotice(`${file.fileName} deleted`);
      if (payload.files.length) void generate(threadId, payload.files);
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
    setRun((current) => current ? {
      ...current,
      questions: (current.questions || []).filter((item) => item.id !== question.id),
    } : current);
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
    if (!pdfReady) return;
    const anchor = document.createElement("a");
    anchor.href = run.pdfUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.click();
  };

  return {
    threadId, run, events, facts, files, filesByPhase, classifications, pages,
    busyPhase, processing, processingFileIds, textStreaming, latestStreamedSectionId, restoring, error, setError, notice,
    completion, pdfReady, questions: run?.questions || [], uploadSources,
    addNote, deleteSource, answerQuestion, downloadPdf,
  };
}
