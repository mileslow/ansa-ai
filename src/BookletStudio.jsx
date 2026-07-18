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
  Eye,
  FileCheck2,
  FileText,
  Files,
  Gauge,
  LoaderCircle,
  MoreHorizontal,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import {
  bookletPages,
  checkDefinitions,
  parsingStages,
  phaseDefinitions,
  sourceDefinitions,
} from "./bookletStudioData";
import "./bookletStudio.css";

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const initialCompanyProfile = {
  companyName: "Big Tows, Inc.",
  industry: "Transportation & roadside services",
  headquarters: "Rochester, NY",
  employeeCount: "42 employees",
  benefitsContact: "Morgan Lee · People Operations",
  planYear: "Mar 1, 2026 – Feb 28, 2027",
  enrollmentWindow: "Feb 2–13, 2026",
  website: "https://bigtows.com",
  about: "Keeping people and businesses moving across Western New York.",
};

const getCompanyShortName = (name = "Your company") =>
  name.replace(/,?\s+(inc\.?|llc|ltd\.?|corp\.?|corporation)$/i, "").trim();

function Logo() {
  return (
    <span className="bs-logo" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function BookletStudio() {
  const [phaseState, setPhaseState] = useState({});
  const [activePhase, setActivePhase] = useState("employer");
  const [selectedPage, setSelectedPage] = useState(null);
  const [previewMode, setPreviewMode] = useState("pages");
  const [hsaAnswer, setHsaAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(initialCompanyProfile);
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
  const activePhaseIndex = Math.max(
    0,
    phaseDefinitions.findIndex((phase) => phase.id === activePhase),
  );
  const currentPhase = phaseDefinitions[activePhaseIndex];
  const currentPhaseState = phaseState[currentPhase.id] || {
    status: "idle",
    stage: -1,
  };
  const phaseIsUnlocked = (index) =>
    index === 0 ||
    phaseDefinitions
      .slice(0, index)
      .every((phase) => ["processing", "complete"].includes(phaseState[phase.id]?.status));

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
    if (id !== "documents" || hsaAnswer) {
      const currentIndex = phaseDefinitions.findIndex((phase) => phase.id === id);
      const nextPhase = phaseDefinitions[currentIndex + 1];
      if (nextPhase) {
        await wait(620);
        if (token !== runToken.current) return false;
        setActivePhase((current) => (current === id ? nextPhase.id : current));
      }
    }
    return true;
  };

  const chooseHsaAnswer = (answer) => {
    setHsaAnswer(answer);
    setNotice("Decision applied · HSA check resolved");
    window.setTimeout(() => setNotice(""), 2400);
  };

  const downloadDraft = () => {
    const draft = {
      employer: companyProfile.companyName,
      companyProfile,
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
    anchor.download = "bibs-tows-benefits-guide-draft.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bs-studio">
      <header className="bs-topbar tw:flex tw:items-center tw:justify-between">
        <div className="bs-topbar__left tw:flex tw:items-center">
          <button className="bs-brand tw:flex tw:items-center" onClick={() => window.location.assign("/")} aria-label="Back to Ansa workspace">
            <b>ansa</b>
          </button>
          <span className="bs-topbar__divider" />
          <div className="bs-breadcrumb tw:flex tw:items-center">
            <span>Benefits</span>
            <ChevronDown />
            <b>Big Tows, Inc.</b>
          </div>
        </div>
        <div className="bs-topbar__right tw:flex tw:items-center">
          <span className="bs-saved tw:flex tw:items-center"><Check /> Prototype saved locally</span>
          <button className="bs-icon-button" aria-label="More options"><MoreHorizontal /></button>
          <button className="bs-avatar" aria-label="Account menu">ML</button>
        </div>
      </header>

      <main className="bs-main">
        <div className="bs-mobile-switcher tw:grid tw:grid-cols-2" role="tablist" aria-label="Booklet studio panels">
          <button className={!mobilePreview ? "active" : ""} onClick={() => setMobilePreview(false)}>Sources</button>
          <button className={mobilePreview ? "active" : ""} onClick={() => setMobilePreview(true)}>
            Preview <span>{availablePages.length}</span>
          </button>
        </div>

        <section className={`bs-workspace tw:grid ${mobilePreview ? "show-preview" : ""}`}>
          <div className="bs-flow-panel">
            <div className="bs-step-header">
              <div className="bs-panel-heading bs-step-header__meta">
                <span>Your information</span>
                <b>{completed.size} of {phaseDefinitions.length} ready</b>
              </div>
              <span className="bs-flow-progress" aria-label={`${completion}% complete`}><i style={{ width: `${completion}%` }} /></span>
            </div>
            <div className="bs-flow-body">
              <PhaseTabs
                activeIndex={activePhaseIndex}
                phaseState={phaseState}
                isUnlocked={phaseIsUnlocked}
                onSelect={(index) => setActivePhase(phaseDefinitions[index].id)}
              />
              <FocusedPhase
                phase={currentPhase}
                state={currentPhaseState}
                busy={!!processingPhase}
                blocker={currentPhase.id === "documents" && blockerOpen}
                hsaAnswer={hsaAnswer}
                companyProfile={companyProfile}
                onCompanyProfileChange={setCompanyProfile}
                onRun={() => runPhase(currentPhase.id)}
                onAnswer={chooseHsaAnswer}
                onBack={() => setActivePhase(phaseDefinitions[activePhaseIndex - 1]?.id)}
                onNext={() => setActivePhase(phaseDefinitions[activePhaseIndex + 1]?.id)}
                canBack={activePhaseIndex > 0}
                canNext={
                  activePhaseIndex < phaseDefinitions.length - 1 &&
                  currentPhaseState.status !== "idle" &&
                  phaseIsUnlocked(activePhaseIndex + 1)
                }
              />
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
            processingPhase={processingPhase}
            companyProfile={companyProfile}
            onDownload={downloadDraft}
            onBack={() => setMobilePreview(false)}
          />
        </section>
      </main>

      {notice && <div className="bs-toast tw:rounded-ansa tw:shadow-ansa"><CheckCircle2 /> {notice}</div>}
    </div>
  );
}

const phaseTabLabels = ["Employer", "Rates", "Plans", "Template", "Census", "Notes"];
const phasePrompts = {
  employer: "Start with the employer setup.",
  rates: "Add the plans and rates.",
  documents: "Add the official plan documents.",
  template: "Bring in the booklet template.",
  census: "Add the employee census.",
  instructions: "Anything else the guide should know?",
};

function PhaseTabs({ activeIndex, phaseState, isUnlocked, onSelect }) {
  const activeTabRef = useRef(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <nav className="bs-step-tabs" aria-label="Information phases">
      {phaseDefinitions.map((phase, index) => {
        const state = phaseState[phase.id]?.status || "idle";
        const unlocked = isUnlocked(index);
        return (
          <button
            key={phase.id}
            ref={activeIndex === index ? activeTabRef : null}
            className={`${activeIndex === index ? "active" : ""} ${state === "complete" ? "complete" : ""} ${state === "processing" ? "processing" : ""}`}
            onClick={() => onSelect(index)}
            disabled={!unlocked}
            aria-current={activeIndex === index ? "step" : undefined}
          >
            <span>{state === "complete" ? <Check /> : String(index + 1).padStart(2, "0")}</span>
            <b>{phaseTabLabels[index]}</b>
          </button>
        );
      })}
    </nav>
  );
}

function FocusedPhase({ phase, state, busy, blocker, hsaAnswer, companyProfile, onCompanyProfileChange, onRun, onAnswer, onBack, onNext, canBack, canNext }) {
  const complete = state.status === "complete";
  const processing = state.status === "processing";

  return (
    <article className={`bs-focused-phase phase-${phase.id} ${complete ? "is-complete" : ""} ${processing ? "is-processing" : ""}`} key={phase.id}>
      <div className="bs-focused-phase__content">
        <header className="bs-focused-phase__intro">
          <div className="bs-question-copy">
            <h2>{phasePrompts[phase.id]}</h2>
            <p>{phase.description}</p>
          </div>
        </header>
        <div className="bs-focused-phase__answer">
          {phase.id === "employer" && complete && (
            <CompanyProfileFields
              profile={companyProfile}
              onChange={onCompanyProfileChange}
              disabled={processing}
            />
          )}
          {phase.id === "employer" && !complete && !processing && (
            <CompanySourceInput
              website={companyProfile.website}
              onWebsiteChange={(website) => onCompanyProfileChange((current) => ({ ...current, website }))}
              onRun={onRun}
              busy={busy}
              accepted={phase.accepted}
            />
          )}
          {phase.id !== "employer" && !complete && !processing && (
            <button
              className="bs-dropzone bs-dropzone--focused tw:rounded-ansa"
              onClick={onRun}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); onRun(); }}
              disabled={busy}
            >
              <b><Upload /> Choose a file</b>
              <span>or drop it here</span>
              <small>{phase.accepted}</small>
            </button>
          )}

          {processing && <ProcessingState phase={phase} stage={state.stage} />}

          {complete && (
            <>
              <div className="bs-source-file tw:grid tw:items-center">
                <span><FileText /></span>
                <div><b>{phase.fileName}</b><small>{phase.fileMeta}</small></div>
                <i><ShieldCheck /> Verified source</i>
              </div>
              {phase.id !== "employer" && (
                <div className="bs-facts">
                  <div className="bs-facts__head"><span>Extracted facts</span><b>{phase.facts.length} found</b></div>
                  {phase.facts.map(([label, value], index) => (
                    <div className="bs-fact" key={label} style={{ "--fact-index": index }}>
                      <span>{label}</span><b>{value}</b><CheckCircle2 />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {blocker && !hsaAnswer && (
            <div className="bs-blocker">
              <div className="bs-blocker__head tw:flex tw:items-center"><span><Zap /></span><div><small>One decision needed</small><b>HSA contribution</b></div></div>
              <p>This plan is HSA-qualified, but I didn’t find whether Big Tows contributes to an HSA. What should the booklet say?</p>
              <div className="bs-blocker__answers tw:flex tw:flex-wrap">
                {["No employer contribution", "Contributes by tier", "Skip HSA section"].map((answer) => (
                  <button key={answer} onClick={() => onAnswer(answer)}>{answer}<ArrowRight /></button>
                ))}
              </div>
            </div>
          )}
          {phase.id === "documents" && hsaAnswer && (
            <div className="bs-resolved"><CheckCircle2 /><span><b>HSA decision applied</b><small>{hsaAnswer}</small></span></div>
          )}
        </div>
      </div>
      <footer className="bs-focused-phase__nav">
        <span>{processing ? "You can review the next step while Ansa works." : complete ? "This source is ready." : "Add a source to unlock the next step."}</span>
        <div className="bs-step-arrows" aria-label="Move between steps">
          <button onClick={onBack} disabled={!canBack} aria-label="Previous step"><ArrowUp /></button>
          <button className="next" onClick={onNext} disabled={!canNext} aria-label="Next step"><ArrowDown /></button>
        </div>
      </footer>
    </article>
  );
}

function CompanySourceInput({ website, onWebsiteChange, onRun, busy, accepted }) {
  return (
    <section className="bs-company-source" aria-labelledby="company-source-title">
      <div className="bs-company-source__head">
        <b id="company-source-title">Where should Ansa learn about the company?</b>
        <span>Add either source—or both.</span>
      </div>
      <label className="bs-company-source__website">
        <span>Company website</span>
        <input
          type="url"
          value={website}
          onChange={(event) => onWebsiteChange(event.target.value)}
          placeholder="https://company.com"
          disabled={busy}
        />
      </label>
      <div className="bs-company-source__actions">
        <button className="primary" onClick={onRun} disabled={busy}><Sparkles /> Find company info <ArrowRight /></button>
        <button onClick={onRun} disabled={busy}><Upload /><span><b>Import an employer document</b><small>{accepted}</small></span></button>
      </div>
      <p>We’ll combine public company information with the employer facts found in your documents. You can review every field before it reaches the booklet.</p>
    </section>
  );
}

function CompanyProfileFields({ profile, onChange, disabled }) {
  const update = (key) => (event) => {
    const nextValue = event.target.value;
    onChange((current) => ({ ...current, [key]: nextValue }));
  };

  return (
    <section className="bs-company-profile" aria-labelledby="company-profile-title">
      <div className="bs-company-profile__head">
        <b id="company-profile-title">Company profile</b>
        <span>Extracted from employer application + website</span>
      </div>
      <div className="bs-company-profile__grid">
        <label className="wide"><span>Company name</span><input value={profile.companyName} onChange={update("companyName")} disabled={disabled} /></label>
        <label><span>Industry</span><input value={profile.industry} onChange={update("industry")} disabled={disabled} /></label>
        <label><span>Headquarters</span><input value={profile.headquarters} onChange={update("headquarters")} disabled={disabled} /></label>
        <label><span>Team size</span><input value={profile.employeeCount} onChange={update("employeeCount")} disabled={disabled} /></label>
        <label><span>Benefits contact</span><input value={profile.benefitsContact} onChange={update("benefitsContact")} disabled={disabled} /></label>
        <label className="wide"><span>Website</span><input type="url" value={profile.website} onChange={update("website")} disabled={disabled} /></label>
        <label><span>Plan year</span><input value={profile.planYear} onChange={update("planYear")} disabled={disabled} /></label>
        <label><span>Enrollment window</span><input value={profile.enrollmentWindow} onChange={update("enrollmentWindow")} disabled={disabled} /></label>
        <label className="wide"><span>About the company</span><textarea value={profile.about} onChange={update("about")} disabled={disabled} rows="2" /></label>
      </div>
    </section>
  );
}

function ProcessingState({ phase, stage }) {
  const progress = ((stage + 1) / parsingStages.length) * 100;
  return (
    <div className="bs-processing-card">
      <div className="bs-processing-file tw:grid tw:items-center">
        <span><ScanLine /></span>
        <div><b>{phase.fileName}</b><small>{phase.steps[stage] || "Preparing source…"}</small></div>
        <LoaderCircle className="bs-spin" />
      </div>
      <div className="bs-processing-track"><i style={{ width: `${progress}%` }} /></div>
      <ol>
        {parsingStages.map((label, index) => (
          <li key={label} className={index < stage ? "done" : index === stage ? "active" : ""}>
            <span>{index < stage ? <Check /> : index === stage ? <LoaderCircle className="bs-spin" /> : <Circle />}</span>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BookletPreview({ pages, selectedPage, setSelectedPage, completed, completedChecks, mode, setMode, blockerOpen, bookletReady, hsaAnswer, processingPhase, companyProfile, onDownload, onBack }) {
  const page = pages.find((item) => item.id === selectedPage) || pages[0];
  const warnings = completed.has("rates") ? 2 : 0;
  const streamingPhase = phaseDefinitions.find((phase) => phase.id === processingPhase);

  return (
    <aside className={`bs-preview-panel ${processingPhase ? "is-streaming" : ""}`}>
      <div className="bs-preview-top tw:flex tw:items-center tw:justify-between">
        <button className="bs-preview-back" onClick={onBack}><ArrowLeft /> Sources</button>
        <div className="bs-panel-heading">
          <span className="bs-live-dot"><i /> Live booklet</span>
          <b>{processingPhase ? `Creating ${streamingPhase?.title.toLowerCase() || "pages"}…` : pages.length ? `${pages.length} pages` : "Waiting for a source"}</b>
        </div>
        <div className="bs-preview-actions tw:flex tw:items-center">
          <button className="bs-icon-button bs-icon-button--light" aria-label="Open preview"><Eye /></button>
          <button className="bs-button bs-button--light" onClick={onDownload} disabled={!pages.length}><Download /> Draft</button>
        </div>
      </div>

      <nav className="bs-preview-tabs tw:flex" aria-label="Preview sections">
        {[
          ["pages", "Pages", pages.length],
          ["checks", "Checks", completedChecks],
          ["sources", "Sources", completed.size],
        ].map(([key, label, count]) => (
          <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>{label}<span>{count}</span></button>
        ))}
      </nav>

      {mode === "pages" && (
        <div className="bs-pages-view">
          {!pages.length ? (
            processingPhase ? <StreamingPreview phase={streamingPhase} /> : <EmptyPreview />
          ) : (
            <>
              <div className="bs-thumbnails" aria-label="Booklet pages">
                {pages.map((item, index) => (
                  <button
                    key={item.id}
                    className={item.id === page?.id ? "active" : ""}
                    onClick={() => setSelectedPage(item.id)}
                    style={{ "--page-index": index }}
                  >
                    <span><MiniPage page={item} companyProfile={companyProfile} /></span>
                    <small>{String(item.number).padStart(2, "0")}</small>
                  </button>
                ))}
              </div>
              <div className="bs-canvas-wrap">
                <div className="bs-canvas-meta">
                  <div><span>Page {page.number} of 14</span><b>{page.title}</b></div>
                  <span className="bs-confidence"><ShieldCheck /> 98% source confidence</span>
                </div>
                <div className="bs-canvas-stage">
                  <PageCanvas page={page} completed={completed} hsaAnswer={hsaAnswer} companyProfile={companyProfile} />
                  {processingPhase && (
                    <div className="bs-stream-note"><LoaderCircle className="bs-spin" /> Streaming new pages</div>
                  )}
                </div>
                {bookletReady && (
                  <div className="bs-ready-bar">
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

function StreamingPreview({ phase }) {
  return (
    <div className="bs-streaming-preview">
      <div className="bs-streaming-sheet" aria-hidden="true">
        <span />
        {[0, 1, 2, 3, 4].map((line) => <i key={line} style={{ "--stream-line": line }} />)}
      </div>
      <div className="bs-streaming-copy">
        <LoaderCircle className="bs-spin" />
        <div><b>Creating your first pages</b><small>{phase?.title || "Reading source"}</small></div>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="bs-preview-empty">
      <div className="bs-empty-booklet"><i /><i /><span><BookOpen /></span></div>
      <span className="bs-preview-kicker">Your guide will build itself</span>
      <h2>No booklet yet</h2>
      <p>Add employer setup or a prior template. Pages, checks, and source links will appear here as Ansa works.</p>
    </div>
  );
}

function MiniPage({ page, companyProfile }) {
  return (
    <div className={`bs-mini-page is-${page.kind}`}>
      <i />
      <b>{page.kind === "cover" ? getCompanyShortName(companyProfile.companyName).toUpperCase().replace(" ", "\n") : page.title}</b>
      <span /><span /><span />
    </div>
  );
}

function PageCanvas({ page, completed, hsaAnswer, companyProfile }) {
  const companyName = companyProfile.companyName || "Your company";
  const companyShortName = getCompanyShortName(companyName);

  if (page.kind === "cover") {
    return (
      <article className="bs-page bs-page--cover" key={page.id}>
        <div className="bs-page__mesh" />
        <div className="bs-page__brand"><Logo /><span>{companyName.toUpperCase()}</span></div>
        <div className="bs-page__cover-copy">
          <small>2026–2027</small>
          <h2>Employee<br />benefits guide</h2>
          <p>{companyProfile.about}</p>
        </div>
        <div className="bs-page__cover-card"><span>Plan year</span><b>{companyProfile.planYear}</b><small>Enrollment · {companyProfile.enrollmentWindow}</small></div>
        <footer><span>{companyShortName.toUpperCase()}</span><b>01</b></footer>
      </article>
    );
  }

  if (page.kind === "medical" || page.kind === "costs") {
    return (
      <article className="bs-page bs-page--content" key={page.id}>
        <PageHeader eyebrow="Medical coverage" title={page.kind === "medical" ? "Meet your medical plan" : "What you’ll pay"} number={page.number} />
        <div className="bs-page__plan-head">
          <div><span>EXCELLUS BCBS</span><h3>Bronze HSA 6900</h3><p>HSA-qualified · In-network benefits</p></div>
          <i>HSA</i>
        </div>
        {page.kind === "medical" ? (
          <div className="bs-benefit-grid">
            {[
              ["Deductible", "$6,900", "Individual"],
              ["Out-of-pocket max", "$7,500", "Individual"],
              ["Primary care", "20%", "After deductible"],
              ["Generic Rx", "$15", "After deductible"],
            ].map(([label, value, detail]) => <div key={label}><span>{label}</span><b>{value}</b><small>{detail}</small></div>)}
          </div>
        ) : (
          <div className="bs-cost-table">
            <div className="head"><span>Coverage</span><span>Monthly rate</span><span>You pay</span></div>
            {[
              ["Employee only", "$719.68", "$359.84"],
              ["Employee + spouse", "$1,439.36", "$1,079.52"],
              ["Employee + child(ren)", "$1,223.45", "$863.61"],
              ["Employee + family", "$2,051.09", "$1,691.25"],
            ].map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
          </div>
        )}
        <div className="bs-page__callout"><Sparkles /><span><b>Good to know</b>{hsaAnswer || "This plan lets you save pre-tax dollars in an HSA."}</span></div>
        <PageFooter number={page.number} companyName={companyName} />
      </article>
    );
  }

  if (page.kind === "contacts") {
    return (
      <article className="bs-page bs-page--content" key={page.id}>
        <PageHeader eyebrow="Your company" title="People & places" number={page.number} />
        <div className="bs-page__hero-block">
          <span><Users /></span>
          <div><small>Benefits contact</small><h3>{companyProfile.benefitsContact}</h3></div>
        </div>
        <div className="bs-page__columns">
          <div><span>01</span><b>{companyProfile.headquarters}</b><p>{companyProfile.industry}</p></div>
          <div><span>02</span><b>{companyProfile.employeeCount}</b><p>{companyProfile.about}</p></div>
        </div>
        <PageFooter number={page.number} companyName={companyName} />
      </article>
    );
  }

  return (
    <article className="bs-page bs-page--content" key={page.id}>
      <PageHeader eyebrow={page.kind === "welcome" ? companyProfile.industry : "Your 2026 benefits"} title={page.kind === "welcome" ? `Welcome to ${companyShortName}` : page.title} number={page.number} />
      <div className="bs-page__hero-block">
        <span><Sparkles /></span>
        <div><small>{page.kind === "welcome" ? companyProfile.headquarters : "Designed around you"}</small><h3>{page.kind === "welcome" ? companyProfile.about : `A clearer way to understand ${page.title.toLowerCase()}.`}</h3></div>
      </div>
      <div className="bs-page__columns">
        <div><span>01</span><b>Know what’s included</b><p>Your guide brings the details that matter into one clear place.</p></div>
        <div><span>02</span><b>Choose with confidence</b><p>Compare coverage, cost, and support before you enroll.</p></div>
      </div>
      <div className="bs-page__body-lines"><i /><i /><i /><i /></div>
      {completed.has("template") && <div className="bs-page__source-note"><ShieldCheck /> Structured from your approved master template</div>}
      <PageFooter number={page.number} companyName={companyName} />
    </article>
  );
}

function PageHeader({ eyebrow, title, number }) {
  return (
    <header className="bs-page__header">
      <div><small>{eyebrow}</small><h2>{title}</h2></div>
      <span>{String(number).padStart(2, "0")}</span>
    </header>
  );
}

function PageFooter({ number, companyName }) {
  return <footer className="bs-page__footer"><span>{getCompanyShortName(companyName).toUpperCase()} · 2026 BENEFITS</span><b>{String(number).padStart(2, "0")}</b></footer>;
}

function ChecksView({ completed, blockerOpen }) {
  const groups = [...new Set(checkDefinitions.map((check) => check.group))];
  return (
    <div className="bs-inspection-view">
      <div className="bs-inspection-head"><span><Gauge /></span><div><small>Quality signals</small><h3>Booklet checks</h3><p>Every claim stays attached to its source.</p></div></div>
      {blockerOpen && <div className="bs-check-alert"><AlertCircle /><span><b>1 decision needs you</b><small>Confirm the employer’s HSA contribution.</small></span></div>}
      {groups.map((group) => (
        <section className="bs-check-group" key={group}>
          <h4>{group}</h4>
          {checkDefinitions.filter((check) => check.group === group).map((check) => {
            const done = completed.has(check.phase);
            return <div key={check.id} className={done ? "done" : "pending"}><span>{done ? <Check /> : <Circle />}</span><b>{check.label}</b><small>{done ? "Verified" : "Waiting"}</small></div>;
          })}
        </section>
      ))}
      {completed.has("template") && <div className="bs-warning-note"><ShieldCheck /><span><b>Template facts protected</b><small>Flower City was used for structure only. Employer-specific facts were ignored.</small></span></div>}
    </div>
  );
}

function SourcesView({ completed }) {
  return (
    <div className="bs-inspection-view">
      <div className="bs-inspection-head"><span><Files /></span><div><small>Source of truth</small><h3>Connected evidence</h3><p>Review exactly where each booklet fact came from.</p></div></div>
      <div className="bs-sources-list">
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
