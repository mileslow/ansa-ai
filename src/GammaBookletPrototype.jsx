import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CloudUpload,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Files,
  Gauge,
  LayoutTemplate,
  LoaderCircle,
  MessageSquareText,
  MoreHorizontal,
  PanelTop,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import {
  bookletPages,
  checkDefinitions,
  parsingStages,
  phaseDefinitions,
  sourceDefinitions,
} from "./gammaPrototypeData";
import "./gammaPrototype.css";

const iconMap = {
  building: Building2,
  sheet: FileSpreadsheet,
  document: FileCheck2,
  template: LayoutTemplate,
  users: Users,
  message: MessageSquareText,
};

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

function Logo() {
  return (
    <span className="g-logo" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function GammaBookletPrototype() {
  const [phaseState, setPhaseState] = useState({});
  const [activePhase, setActivePhase] = useState("employer");
  const [selectedPage, setSelectedPage] = useState(null);
  const [previewMode, setPreviewMode] = useState("pages");
  const [sampleRunning, setSampleRunning] = useState(false);
  const [hsaAnswer, setHsaAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const runToken = useRef(0);

  const completed = useMemo(
    () =>
      new Set(
        Object.entries(phaseState)
          .filter(([, state]) => state?.status === "complete")
          .map(([id]) => id),
      ),
    [phaseState],
  );
  const processingPhase = Object.entries(phaseState).find(
    ([, state]) => state?.status === "processing",
  )?.[0];
  const availablePages = useMemo(
    () => bookletPages.filter((page) => completed.has(page.phase)),
    [completed],
  );
  const documentsReady = completed.has("documents");
  const blockerOpen = documentsReady && !hsaAnswer;
  const coreReady = ["employer", "rates", "documents", "template", "census"].every(
    (id) => completed.has(id),
  );
  const bookletReady = coreReady && !blockerOpen;
  const completedChecks = checkDefinitions.filter((check) =>
    completed.has(check.phase),
  ).length;
  const completion = Math.round((completed.size / phaseDefinitions.length) * 100);

  useEffect(() => {
    if (availablePages.length && !availablePages.some((page) => page.id === selectedPage)) {
      setSelectedPage(availablePages[0].id);
    }
  }, [availablePages, selectedPage]);

  useEffect(() => () => {
    runToken.current += 1;
  }, []);

  const updatePhase = (id, patch) =>
    setPhaseState((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));

  const runPhase = async (id, token = ++runToken.current) => {
    if (processingPhase || phaseState[id]?.status === "complete") return false;
    setActivePhase(id);
    updatePhase(id, { status: "processing", stage: 0, factCount: 0 });

    for (let stage = 0; stage < parsingStages.length; stage += 1) {
      if (token !== runToken.current) return false;
      updatePhase(id, { status: "processing", stage });
      await wait(stage === 0 ? 360 : 520);
    }

    if (token !== runToken.current) return false;
    const definition = phaseDefinitions.find((phase) => phase.id === id);
    updatePhase(id, {
      status: "complete",
      stage: parsingStages.length - 1,
      factCount: definition.facts.length,
    });
    const addedPages = bookletPages.filter((page) => page.phase === id);
    if (addedPages.length) {
      setSelectedPage(addedPages[0].id);
      setNotice(`${addedPages.length} ${addedPages.length === 1 ? "page" : "pages"} added to your booklet`);
      window.setTimeout(() => setNotice(""), 2400);
    }
    return true;
  };

  const runSample = async () => {
    if (sampleRunning || processingPhase) return;
    const token = ++runToken.current;
    setSampleRunning(true);
    for (const id of ["employer", "rates", "documents", "template", "census"]) {
      if (token !== runToken.current) break;
      if (phaseState[id]?.status !== "complete") {
        await runPhase(id, token);
        await wait(260);
      }
    }
    if (token === runToken.current) setSampleRunning(false);
  };

  const resetDemo = () => {
    runToken.current += 1;
    setPhaseState({});
    setActivePhase("employer");
    setSelectedPage(null);
    setPreviewMode("pages");
    setSampleRunning(false);
    setHsaAnswer("");
    setNotice("");
  };

  const chooseHsaAnswer = (answer) => {
    setHsaAnswer(answer);
    setNotice("Decision applied · HSA check resolved");
    window.setTimeout(() => setNotice(""), 2400);
  };

  const downloadDraft = () => {
    const draft = {
      employer: "Big Tows, Inc.",
      status: bookletReady ? "ready" : "draft",
      pages: availablePages.map(({ title, number }) => ({ number, title })),
      hsaDecision: hsaAnswer || "pending",
      generatedBy: "Ansa Booklet Studio prototype",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "big-tows-benefits-guide-draft.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="g-studio">
      <header className="g-topbar tw:flex tw:items-center tw:justify-between">
        <div className="g-topbar__left tw:flex tw:items-center">
          <button className="g-brand tw:flex tw:items-center" onClick={() => window.location.assign("/")} aria-label="Back to Ansa workspace">
            <Logo />
            <b>ansa</b>
          </button>
          <span className="g-topbar__divider" />
          <div className="g-breadcrumb tw:flex tw:items-center">
            <span>Benefits</span>
            <ChevronDown />
            <b>Big Tows, Inc.</b>
          </div>
        </div>
        <div className="g-topbar__right tw:flex tw:items-center">
          <span className="g-saved tw:flex tw:items-center"><Check /> Prototype saved locally</span>
          <button className="g-icon-button" aria-label="More options"><MoreHorizontal /></button>
          <button className="g-avatar" aria-label="Account menu">ML</button>
        </div>
      </header>

      <main className="g-main">
        <section className="g-intro tw:flex tw:justify-between">
          <div>
            <span className="g-eyebrow tw:text-ansa-primary"><WandSparkles /> Booklet studio</span>
            <h1>Build the guide by adding<br />what you already have.</h1>
            <p>Ansa reads each source, finds the facts, and shapes the booklet live. You only step in when a decision needs you.</p>
          </div>
          <div className="g-intro__actions tw:flex tw:items-center">
            {(completed.size > 0 || sampleRunning) && (
              <button className="g-button g-button--quiet" onClick={resetDemo}>
                <RotateCcw /> Reset
              </button>
            )}
            <button className="g-button g-button--primary tw:rounded-ansa tw:shadow-ansa-sm" onClick={runSample} disabled={sampleRunning || !!processingPhase}>
              {sampleRunning ? <LoaderCircle className="g-spin" /> : <Sparkles />}
              {sampleRunning ? "Building sample…" : completed.size ? "Continue with sample" : "Try sample benefits files"}
              {!sampleRunning && <ArrowRight />}
            </button>
          </div>
        </section>

        <div className="g-mobile-switcher tw:grid tw:grid-cols-2" role="tablist" aria-label="Booklet studio panels">
          <button className={!mobilePreview ? "active" : ""} onClick={() => setMobilePreview(false)}>Sources</button>
          <button className={mobilePreview ? "active" : ""} onClick={() => setMobilePreview(true)}>
            Preview <span>{availablePages.length}</span>
          </button>
        </div>

        <section className={`g-workspace tw:grid ${mobilePreview ? "show-preview" : ""}`}>
          <div className="g-flow-panel">
            <div className="g-flow-head tw:flex tw:items-center tw:justify-between">
              <div>
                <span>Your information</span>
                <b>{completed.size} of {phaseDefinitions.length} sources ready</b>
              </div>
              <span className="g-flow-progress" aria-label={`${completion}% complete`}><i style={{ width: `${completion}%` }} /></span>
            </div>

            <div className="g-phase-list">
              {phaseDefinitions.map((phase) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  state={phaseState[phase.id] || { status: "idle", stage: -1 }}
                  active={activePhase === phase.id}
                  busy={!!processingPhase}
                  blocker={phase.id === "documents" && blockerOpen}
                  hsaAnswer={hsaAnswer}
                  onActivate={() => setActivePhase(phase.id)}
                  onRun={() => runPhase(phase.id)}
                  onAnswer={chooseHsaAnswer}
                />
              ))}
            </div>
          </div>

          <BookletPreview
            pages={availablePages}
            selectedPage={selectedPage}
            setSelectedPage={setSelectedPage}
            completed={completed}
            completedChecks={completedChecks}
            mode={previewMode}
            setMode={setPreviewMode}
            blockerOpen={blockerOpen}
            bookletReady={bookletReady}
            hsaAnswer={hsaAnswer}
            onDownload={downloadDraft}
            onBack={() => setMobilePreview(false)}
          />
        </section>
      </main>

      {notice && <div className="g-toast tw:rounded-ansa tw:shadow-ansa"><CheckCircle2 /> {notice}</div>}
    </div>
  );
}

function PhaseCard({ phase, state, active, busy, blocker, hsaAnswer, onActivate, onRun, onAnswer }) {
  const Icon = iconMap[phase.icon];
  const complete = state.status === "complete";
  const processing = state.status === "processing";
  const expanded = active || processing || blocker;

  return (
    <article className={`g-phase ${expanded ? "is-expanded" : ""} ${complete ? "is-complete" : ""} ${processing ? "is-processing" : ""}`}>
      <button className="g-phase__summary tw:grid tw:items-center" onClick={onActivate} aria-expanded={expanded}>
        <span className="g-phase__number">{complete ? <Check /> : phase.number}</span>
        <span className="g-phase__icon"><Icon /></span>
        <span className="g-phase__copy">
          <b>{phase.title}</b>
          <small>{complete ? phase.fileName : phase.description}</small>
        </span>
        <span className={`g-phase__status ${complete ? "complete" : processing ? "processing" : ""}`}>
          {complete ? "Ready" : processing ? "Reading" : "Add"}
        </span>
        <ChevronDown className="g-phase__chevron" />
      </button>

      {expanded && (
        <div className="g-phase__body">
          {!complete && !processing && (
            <button
              className="g-dropzone tw:rounded-ansa"
              onClick={onRun}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); onRun(); }}
              disabled={busy}
            >
              <span><CloudUpload /></span>
              <b>Drop files here or add a sample</b>
              <small>{phase.accepted}</small>
              <em><Upload /> Add sample source</em>
            </button>
          )}

          {processing && <ProcessingState phase={phase} stage={state.stage} />}

          {complete && (
            <>
              <div className="g-source-file tw:grid tw:items-center">
                <span><FileText /></span>
                <div><b>{phase.fileName}</b><small>{phase.fileMeta}</small></div>
                <i><ShieldCheck /> Verified source</i>
              </div>
              <div className="g-facts">
                <div className="g-facts__head"><span>Extracted facts</span><b>{phase.facts.length} found</b></div>
                {phase.facts.map(([label, value], index) => (
                  <div className="g-fact" key={label} style={{ "--fact-index": index }}>
                    <span>{label}</span><b>{value}</b><CheckCircle2 />
                  </div>
                ))}
              </div>
            </>
          )}

          {blocker && !hsaAnswer && (
            <div className="g-blocker">
              <div className="g-blocker__head tw:flex tw:items-center"><span><Zap /></span><div><small>One decision needed</small><b>HSA contribution</b></div></div>
              <p>This plan is HSA-qualified, but I didn’t find whether Big Tows contributes to an HSA. What should the booklet say?</p>
              <div className="g-blocker__answers tw:flex tw:flex-wrap">
                {["No employer contribution", "Contributes by tier", "Skip HSA section"].map((answer) => (
                  <button key={answer} onClick={() => onAnswer(answer)}>{answer}<ArrowRight /></button>
                ))}
              </div>
            </div>
          )}
          {phase.id === "documents" && hsaAnswer && (
            <div className="g-resolved"><CheckCircle2 /><span><b>HSA decision applied</b><small>{hsaAnswer}</small></span></div>
          )}
        </div>
      )}
    </article>
  );
}

function ProcessingState({ phase, stage }) {
  const progress = ((stage + 1) / parsingStages.length) * 100;
  return (
    <div className="g-processing-card">
            <div className="g-processing-file tw:grid tw:items-center">
        <span><ScanLine /></span>
        <div><b>{phase.fileName}</b><small>{phase.steps[stage] || "Preparing source…"}</small></div>
        <LoaderCircle className="g-spin" />
      </div>
      <div className="g-processing-track"><i style={{ width: `${progress}%` }} /></div>
      <ol>
        {parsingStages.map((label, index) => (
          <li key={label} className={index < stage ? "done" : index === stage ? "active" : ""}>
            <span>{index < stage ? <Check /> : index === stage ? <LoaderCircle className="g-spin" /> : <Circle />}</span>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BookletPreview({ pages, selectedPage, setSelectedPage, completed, completedChecks, mode, setMode, blockerOpen, bookletReady, hsaAnswer, onDownload, onBack }) {
  const page = pages.find((item) => item.id === selectedPage) || pages[0];
  const warnings = completed.has("rates") ? 2 : 0;

  return (
    <aside className="g-preview-panel">
      <div className="g-preview-top tw:flex tw:items-center tw:justify-between">
        <button className="g-preview-back" onClick={onBack}><ArrowLeft /> Sources</button>
        <div>
          <span className="g-live-dot"><i /> Live booklet</span>
          <b>{pages.length ? `${pages.length} pages` : "Waiting for a source"}</b>
        </div>
        <div className="g-preview-actions tw:flex tw:items-center">
          <button className="g-icon-button g-icon-button--light" aria-label="Open preview"><Eye /></button>
          <button className="g-button g-button--light" onClick={onDownload} disabled={!pages.length}><Download /> Draft</button>
        </div>
      </div>

      <nav className="g-preview-tabs tw:flex" aria-label="Preview sections">
        {[
          ["pages", "Pages", pages.length],
          ["checks", "Checks", completedChecks],
          ["sources", "Sources", completed.size],
        ].map(([key, label, count]) => (
          <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>{label}<span>{count}</span></button>
        ))}
      </nav>

      {mode === "pages" && (
        <div className="g-pages-view">
          {!pages.length ? (
            <EmptyPreview />
          ) : (
            <>
              <div className="g-thumbnails" aria-label="Booklet pages">
                {pages.map((item, index) => (
                  <button
                    key={item.id}
                    className={item.id === page?.id ? "active" : ""}
                    onClick={() => setSelectedPage(item.id)}
                    style={{ "--page-index": index }}
                  >
                    <span><MiniPage page={item} /></span>
                    <small>{String(item.number).padStart(2, "0")}</small>
                  </button>
                ))}
              </div>
              <div className="g-canvas-wrap">
                <div className="g-canvas-meta">
                  <div><span>Page {page.number} of 14</span><b>{page.title}</b></div>
                  <span className="g-confidence"><ShieldCheck /> 98% source confidence</span>
                </div>
                <div className="g-canvas-stage">
                  <PageCanvas page={page} completed={completed} hsaAnswer={hsaAnswer} />
                </div>
                {bookletReady && (
                  <div className="g-ready-bar">
                    <span><CheckCircle2 /></span>
                    <div><b>Booklet ready</b><small>14 pages · {warnings} warnings · 0 blockers</small></div>
                    <button onClick={onDownload}>Download draft <ArrowRight /></button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {mode === "checks" && <ChecksView completed={completed} blockerOpen={blockerOpen} />}
      {mode === "sources" && <SourcesView completed={completed} />}
    </aside>
  );
}

function EmptyPreview() {
  return (
    <div className="g-preview-empty">
      <div className="g-empty-orbit"><span><BookOpen /></span><i /><i /></div>
      <span className="g-eyebrow"><Sparkles /> Your guide will build itself</span>
      <h2>No booklet yet</h2>
      <p>Add employer setup or a prior template. Pages, checks, and source links will appear here as Ansa works.</p>
      <div><span><Files /></span><span><ArrowRight /></span><span><PanelTop /></span></div>
    </div>
  );
}

function MiniPage({ page }) {
  return (
    <div className={`g-mini-page is-${page.kind}`}>
      <i />
      <b>{page.kind === "cover" ? "BIG\nTOWS" : page.title}</b>
      <span /><span /><span />
    </div>
  );
}

function PageCanvas({ page, completed, hsaAnswer }) {
  if (page.kind === "cover") {
    return (
      <article className="g-page g-page--cover" key={page.id}>
        <div className="g-page__mesh" />
        <div className="g-page__brand"><Logo /><span>BIG TOWS, INC.</span></div>
        <div className="g-page__cover-copy">
          <small>2026–2027</small>
          <h2>Employee<br />benefits guide</h2>
          <p>Benefits built to keep life moving.</p>
        </div>
        <div className="g-page__cover-card"><span>Plan year</span><b>March 1, 2026</b><small>through February 28, 2027</small></div>
        <footer><span>BIG TOWS</span><b>01</b></footer>
      </article>
    );
  }

  if (page.kind === "medical" || page.kind === "costs") {
    return (
      <article className="g-page g-page--content" key={page.id}>
        <PageHeader eyebrow="Medical coverage" title={page.kind === "medical" ? "Meet your medical plan" : "What you’ll pay"} number={page.number} />
        <div className="g-page__plan-head">
          <div><span>EXCELLUS BCBS</span><h3>Bronze HSA 6900</h3><p>HSA-qualified · In-network benefits</p></div>
          <i>HSA</i>
        </div>
        {page.kind === "medical" ? (
          <div className="g-benefit-grid">
            {[
              ["Deductible", "$6,900", "Individual"],
              ["Out-of-pocket max", "$7,500", "Individual"],
              ["Primary care", "20%", "After deductible"],
              ["Generic Rx", "$15", "After deductible"],
            ].map(([label, value, detail]) => <div key={label}><span>{label}</span><b>{value}</b><small>{detail}</small></div>)}
          </div>
        ) : (
          <div className="g-cost-table">
            <div className="head"><span>Coverage</span><span>Monthly rate</span><span>You pay</span></div>
            {[
              ["Employee only", "$719.68", "$359.84"],
              ["Employee + spouse", "$1,439.36", "$1,079.52"],
              ["Employee + child(ren)", "$1,223.45", "$863.61"],
              ["Employee + family", "$2,051.09", "$1,691.25"],
            ].map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
          </div>
        )}
        <div className="g-page__callout"><Sparkles /><span><b>Good to know</b>{hsaAnswer || "This plan lets you save pre-tax dollars in an HSA."}</span></div>
        <PageFooter number={page.number} />
      </article>
    );
  }

  return (
    <article className="g-page g-page--content" key={page.id}>
      <PageHeader eyebrow="Your 2026 benefits" title={page.title} number={page.number} />
      <div className="g-page__hero-block">
        <span><Sparkles /></span>
        <div><small>Designed around you</small><h3>{page.kind === "welcome" ? "Benefits for work—and everything after." : `A clearer way to understand ${page.title.toLowerCase()}.`}</h3></div>
      </div>
      <div className="g-page__columns">
        <div><span>01</span><b>Know what’s included</b><p>Your guide brings the details that matter into one clear place.</p></div>
        <div><span>02</span><b>Choose with confidence</b><p>Compare coverage, cost, and support before you enroll.</p></div>
      </div>
      <div className="g-page__body-lines"><i /><i /><i /><i /></div>
      {completed.has("template") && <div className="g-page__source-note"><ShieldCheck /> Structured from your approved master template</div>}
      <PageFooter number={page.number} />
    </article>
  );
}

function PageHeader({ eyebrow, title, number }) {
  return (
    <header className="g-page__header">
      <div><small>{eyebrow}</small><h2>{title}</h2></div>
      <span>{String(number).padStart(2, "0")}</span>
    </header>
  );
}

function PageFooter({ number }) {
  return <footer className="g-page__footer"><span>BIG TOWS · 2026 BENEFITS</span><b>{String(number).padStart(2, "0")}</b></footer>;
}

function ChecksView({ completed, blockerOpen }) {
  const groups = [...new Set(checkDefinitions.map((check) => check.group))];
  return (
    <div className="g-inspection-view">
      <div className="g-inspection-head"><span><Gauge /></span><div><small>Quality signals</small><h3>Booklet checks</h3><p>Every claim stays attached to its source.</p></div></div>
      {blockerOpen && <div className="g-check-alert"><AlertCircle /><span><b>1 decision needs you</b><small>Confirm the employer’s HSA contribution.</small></span></div>}
      {groups.map((group) => (
        <section className="g-check-group" key={group}>
          <h4>{group}</h4>
          {checkDefinitions.filter((check) => check.group === group).map((check) => {
            const done = completed.has(check.phase);
            return <div key={check.id} className={done ? "done" : "pending"}><span>{done ? <Check /> : <Circle />}</span><b>{check.label}</b><small>{done ? "Verified" : "Waiting"}</small></div>;
          })}
        </section>
      ))}
      {completed.has("template") && <div className="g-warning-note"><ShieldCheck /><span><b>Template facts protected</b><small>Flower City was used for structure only. Employer-specific facts were ignored.</small></span></div>}
    </div>
  );
}

function SourcesView({ completed }) {
  return (
    <div className="g-inspection-view">
      <div className="g-inspection-head"><span><Files /></span><div><small>Source of truth</small><h3>Connected evidence</h3><p>Review exactly where each booklet fact came from.</p></div></div>
      <div className="g-sources-list">
        {sourceDefinitions.map((source) => {
          const ready = completed.has(source.phase);
          return (
            <div key={source.phase} className={ready ? "ready" : ""}>
              <span>{ready ? <FileCheck2 /> : <FileText />}</span>
              <div><b>{source.label}</b><small>{ready ? source.detail : "Not added yet"}</small></div>
              {ready ? <em>{source.confidence}%</em> : <i>Pending</i>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
