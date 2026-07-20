import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileText,
  Files,
  Gauge,
  LoaderCircle,
  PanelLeft,
  Plus,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { phaseForQuestion, useBookletStudioBackend } from "./useBookletStudioBackend";
import {
  bookletPages,
  checkDefinitions,
  parsingStages,
  phaseDefinitions,
  sourceDefinitions,
} from "./bookletStudioData";
import "./bookletStudio.css";

const emptyCompanyProfile = {
  companyName: "Your company",
  industry: "",
  headquarters: "",
  employeeCount: "",
  benefitsContact: "",
  planYear: "",
  enrollmentWindow: "",
  website: "",
  about: "",
};

const formatDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

const formatRange = (start, end) =>
  [formatDate(start), formatDate(end)].filter(Boolean).join(" – ");

const companyProfileFromCompany = (company) => {
  if (!company) return emptyCompanyProfile;
  const details = company.planDetails || {};
  const hr = details.contacts?.hr || {};
  return {
    companyName: company.name || "Your company",
    industry: company.industry || "",
    headquarters: company.headquarters || "",
    employeeCount: company.employeeCount
      ? `${company.employeeCount} employees`
      : company.employeeRange || "",
    benefitsContact: [hr.name, hr.email || hr.phone].filter(Boolean).join(" · "),
    planYear:
      formatRange(details.planYear?.start, details.planYear?.end) ||
      company.renewalLabel ||
      "",
    enrollmentWindow: formatRange(
      details.enrollment?.start,
      details.enrollment?.end,
    ),
    website: company.website || "",
    about: company.description || "",
  };
};

const companyInitials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CO";

const getCompanyShortName = (name = "Your company") =>
  name.replace(/,?\s+(inc\.?|llc|ltd\.?|corp\.?|corporation)$/i, "").trim();

function readableValue(value) {
  if (value === null || value === undefined || value === "") return "Not found";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(readableValue).join(", ");
  return JSON.stringify(value);
}

function humanizeField(value) {
  return String(value)
    .replace(/\[(\d+)\]/g, " $1")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function flattenFields(value, prefix = [], result = []) {
  if (value === null || value === undefined || value === "") return result;
  if (Array.isArray(value)) {
    if (value.every((item) => !item || typeof item !== "object"))
      result.push([prefix.join(" "), value.map(readableValue).join(", ")]);
    else value.forEach((item, index) => flattenFields(item, [...prefix, String(index + 1)], result));
  } else if (typeof value === "object") {
    Object.entries(value).forEach(([key, fieldValue]) => flattenFields(fieldValue, [...prefix, key], result));
  } else result.push([prefix.join(" "), readableValue(value)]);
  return result;
}

function ExtractedFacts({ facts }) {
  const groups = new Map();
  facts.forEach((fact) => {
    const key = fact.path.match(/^[^.[\]]+/)?.[0] || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fact);
  });
  return <section className="bs-extracted-facts"><header><b>Extracted information</b><span>{facts.length} source-backed {facts.length === 1 ? "field" : "fields"}</span></header>{[...groups.entries()].map(([group, items]) => <section className="bs-extracted-group" key={group}><div className="bs-extracted-group__head"><b>{humanizeField(group)}</b><span>{items.length}</span></div>{items.map((fact) => { const fields = fact.value && typeof fact.value === "object" ? flattenFields(fact.value) : []; return <article className="bs-extracted-card" key={fact.id}><header><div><b>{humanizeField(fact.path)}</b><small>{fact.source?.fileName}{fact.source?.page ? ` · Page ${fact.source.page}` : ""}</small></div><em>{Math.round(fact.confidence * 100)}%</em></header>{fields.length ? <dl className="bs-extracted-fields">{fields.map(([key, value], index) => <div key={`${key}-${index}`}><dt>{humanizeField(key)}</dt><dd>{value}</dd></div>)}</dl> : <p className="bs-extracted-scalar">{readableValue(fact.value)}</p>}</article>; })}</section>)}</section>;
}

function Logo() {
  return (
    <span className="bs-logo" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function BookletStudio({
  company,
  companies = [],
  onSelectCompany,
  onOpenCompanies,
  onOpenBrokerAgent,
  onUpdateCompany,
  onCreateCompany,
}) {
  const [activePhase, setActivePhase] = useState("employer");
  const [selectedPage, setSelectedPage] = useState(null);
  const [previewMode, setPreviewMode] = useState("pages");
  const [hsaAnswer, setHsaAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(() =>
    companyProfileFromCompany(company),
  );
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const colorPickerEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("color") === "true";
  const [accentColor, setAccentColor] = useState(() => {
    if (typeof window === "undefined") return "#1414d2";
    const savedColor = window.localStorage.getItem("ansa-studio-accent-color");
    return /^#[0-9a-f]{6}$/i.test(savedColor || "") ? savedColor : "#1414d2";
  });
  const [companyProfileDirty, setCompanyProfileDirty] = useState(false);
  const [savingCompanyProfile, setSavingCompanyProfile] = useState(false);
  const backend = useBookletStudioBackend(company?.id || "");

  const phaseState = useMemo(() => Object.fromEntries(phaseDefinitions.map((phase) => {
    const fileCount = backend.filesByPhase[phase.id]?.length || 0;
    const phaseBusy = backend.busyPhase === phase.id || (backend.processing && activePhase === phase.id);
    return [phase.id, {
      status: phaseBusy ? "processing" : fileCount ? "complete" : "idle",
      stage: phaseBusy ? Math.min(4, Math.max(0, backend.events.length % 5)) : fileCount ? 4 : -1,
      factCount: backend.facts.filter((fact) => backend.filesByPhase[phase.id]?.some((file) => file.id === fact.fileId)).length,
    }];
  })), [backend.filesByPhase, backend.busyPhase, backend.processing, backend.events.length, backend.facts, activePhase]);
  const processed = useMemo(() => new Set(phaseDefinitions.filter((phase) => backend.filesByPhase[phase.id]?.length).map((phase) => phase.id)), [backend.filesByPhase]);
  const blockerOpen = backend.questions.length > 0;
  const completed = processed;
  const processingPhase = backend.busyPhase || (backend.processing ? activePhase : "");
  const availablePages = backend.pages;
  const bookletReady = backend.run?.status === "complete";
  const completedChecks = backend.run?.qualityReport?.issues?.length
    ? Math.max(0, checkDefinitions.length - backend.run.qualityReport.issues.length)
    : backend.run?.status === "complete" ? checkDefinitions.length : 0;
  const completion = backend.completion;
  const activePhaseIndex = Math.max(
    0,
    phaseDefinitions.findIndex((phase) => phase.id === activePhase),
  );
  const currentPhase = phaseDefinitions[activePhaseIndex];
  const currentPhaseState = phaseState[currentPhase.id] || {
    status: "idle",
    stage: -1,
  };
  const phaseIsUnlocked = () => true;

  useEffect(() => {
    if (availablePages.length && !availablePages.some((page) => page.id === selectedPage)) {
      setSelectedPage(availablePages[0].id);
    }
  }, [availablePages, selectedPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ansa-studio-accent-color", accentColor);
  }, [accentColor]);

  useEffect(() => {
    const snapshot = backend.run?.benefitsPackageSnapshot;
    if (!snapshot || companyProfileDirty) return;
    const employer = snapshot.employer || {};
    const publicProfile = employer.publicProfile || {};
    const primaryContact = snapshot.contacts?.find((contact) => /primary|benefits|administrator/i.test(contact.role || ""));
    setCompanyProfile((current) => ({
      ...current,
      companyName: employer.name || current.companyName,
      website: employer.website || current.website,
      about: publicProfile.description || current.about,
      industry: publicProfile.industry || current.industry,
      headquarters: publicProfile.headquarters || employer.address || current.headquarters,
      employeeCount: publicProfile.employeeRange || current.employeeCount,
      benefitsContact: primaryContact ? [primaryContact.name, primaryContact.email || primaryContact.phone].filter(Boolean).join(" · ") : current.benefitsContact,
      planYear: snapshot.planYear?.label || formatRange(snapshot.planYear?.start, snapshot.planYear?.end) || current.planYear,
    }));
  }, [backend.run?.id, backend.run?.status, companyProfileDirty]);

  const updateCompanyProfile = (updater) => {
    setCompanyProfile((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
    setCompanyProfileDirty(true);
  };

  const saveCompanyProfile = async () => {
    if (!company || !onUpdateCompany || !companyProfileDirty) return;
    setSavingCompanyProfile(true);
    try {
      const employeeCount = Number(
        String(companyProfile.employeeCount).match(/[\d,]+/)?.[0]?.replace(/,/g, ""),
      );
      const existingDetails = company.planDetails || {};
      const [contactName = "", contactDetail = ""] = companyProfile.benefitsContact
        .split("·")
        .map((value) => value.trim());
      const existingContacts = existingDetails.contacts || {};
      const existingHr = existingContacts.hr || {};
      await onUpdateCompany({
        ...company,
        name: companyProfile.companyName.trim() || company.name,
        website: companyProfile.website.trim(),
        description: companyProfile.about.trim(),
        industry: companyProfile.industry.trim(),
        headquarters: companyProfile.headquarters.trim(),
        employeeCount: Number.isFinite(employeeCount)
          ? employeeCount
          : company.employeeCount || 0,
        planDetails: {
          ...existingDetails,
          employer: {
            ...(existingDetails.employer || {}),
            cover: companyProfile.companyName.trim() || company.name,
          },
          contacts: {
            ...existingContacts,
            hr: {
              ...existingHr,
              name: contactName,
              ...(contactDetail.includes("@")
                ? { email: contactDetail }
                : contactDetail
                  ? { phone: contactDetail }
                  : {}),
            },
          },
        },
      });
      setCompanyProfileDirty(false);
      setNotice("Company profile saved");
    } catch (error) {
      setNotice(error.message || "Could not save the company profile");
    } finally {
      setSavingCompanyProfile(false);
      window.setTimeout(() => setNotice(""), 2400);
    }
  };

  const selectCompany = (companyId) => {
    if (companyId === company?.id) {
      setSidebarOpen(false);
      return;
    }
    if (companyProfileDirty && !window.confirm("Switch companies and discard unsaved company profile edits?")) return;
    onSelectCompany(companyId);
    setSidebarOpen(false);
  };

  return (
    <div
      className={`bs-studio ${sidebarOpen ? "is-sidebar-open" : ""}`}
      style={{
        "--bs-primary": accentColor,
        "--bs-primary-deep": `color-mix(in srgb, ${accentColor} 80%, black)`,
        "--bs-primary-soft": `color-mix(in srgb, ${accentColor} 5%, white)`,
      }}
    >
      <CompanySidebar
        companies={companies}
        selectedCompanyId={company?.id}
        onSelect={selectCompany}
        onCreate={() => {
          setSidebarOpen(false);
          setNewCompanyOpen(true);
        }}
        onHome={onOpenCompanies}
        onOpenBrokerAgent={() => onOpenBrokerAgent?.(company?.id)}
        colorPickerEnabled={colorPickerEnabled}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
      />
      <button className="bs-sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close company sidebar" />

      <div className="bs-studio__content">
      <main className="bs-main">
        <button className="bs-sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open company sidebar">
          <PanelLeft />
        </button>
        {backend.error && <div className="bs-api-error"><AlertCircle /><span>{backend.error}</span><button onClick={() => backend.setError("")}>Dismiss</button></div>}
        {!company ? (
          <CompanySelectionGate onChoose={() => setSidebarOpen(true)} onCreate={() => setNewCompanyOpen(true)} />
        ) : (
          <>
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
                <span>Packet setup</span>
                <b>{completed.size} of {phaseDefinitions.length} ready</b>
              </div>
              <span className="bs-flow-progress" aria-label={`${completion}% complete`}><i style={{ width: `${completion}%` }} /></span>
            </div>
            <div className="bs-flow-body">
              <PhaseTabs
                activeIndex={activePhaseIndex}
                phaseState={phaseState}
                completed={completed}
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
                onCompanyProfileChange={updateCompanyProfile}
                onSaveCompanyProfile={saveCompanyProfile}
                companyProfileDirty={companyProfileDirty}
                savingCompanyProfile={savingCompanyProfile}
                connectedCompany={company}
                files={backend.filesByPhase[currentPhase.id] || []}
                classifications={backend.classifications}
                facts={backend.facts}
                questions={backend.questions.filter((question) => phaseForQuestion(question) === currentPhase.id)}
                processing={backend.processing}
                phaseBusy={backend.busyPhase === currentPhase.id}
                onFiles={(selectedFiles) => backend.uploadSources(currentPhase.id, selectedFiles)}
                onDeleteFile={backend.deleteSource}
                onAnswer={backend.answerQuestion}
                onBack={() => setActivePhase(phaseDefinitions[activePhaseIndex - 1]?.id)}
                onNext={() => setActivePhase(phaseDefinitions[activePhaseIndex + 1]?.id)}
                canBack={activePhaseIndex > 0}
                canNext={
                  activePhaseIndex < phaseDefinitions.length - 1 &&
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
            processed={processed}
            completion={completion}
            completedChecks={completedChecks}
            mode={previewMode}
            setMode={setPreviewMode}
            blockerOpen={blockerOpen}
            bookletReady={bookletReady}
            hsaAnswer={hsaAnswer}
            processingPhase={processingPhase}
            companyProfile={companyProfile}
            run={backend.run}
            events={backend.events}
            files={backend.files}
            facts={backend.facts}
            classifications={backend.classifications}
            questions={backend.questions}
            processing={backend.processing}
            textStreaming={backend.textStreaming}
            onDownload={backend.downloadPdf}
            onBack={() => setMobilePreview(false)}
          />
        </section>
          </>
        )}
      </main>
      </div>

      {newCompanyOpen && (
        <NewCompanyFlow
          companies={companies}
          onClose={() => setNewCompanyOpen(false)}
          onCreate={onCreateCompany}
        />
      )}

      {(notice || backend.notice) && <div className="bs-toast tw:rounded-ansa tw:shadow-ansa"><CheckCircle2 /> {notice || backend.notice}</div>}
    </div>
  );
}

function CompanySidebar({ companies, selectedCompanyId, onSelect, onCreate, onHome, onOpenBrokerAgent, colorPickerEnabled, accentColor, onAccentColorChange }) {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCompanies = companies.filter((item) =>
    [item.name, item.industry, item.headquarters]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
  );

  return (
    <aside className="bs-company-sidebar">
      <div className="bs-company-sidebar__head">
        <button className="bs-company-sidebar__brand" onClick={onHome} aria-label="Ansa home"><b>ansa</b></button>
        <label className="bs-company-sidebar__search">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies" />
        </label>
      </div>
      <div className="bs-company-sidebar__label"><span>Companies</span><b>{filteredCompanies.length}</b></div>
      <nav className="bs-company-sidebar__list" aria-label="Companies">
        <button className="bs-company-sidebar__new" onClick={onCreate}><Plus /> New company</button>
        {filteredCompanies.map((item) => (
          <button
            key={item.id}
            className={item.id === selectedCompanyId ? "active" : ""}
            onClick={() => onSelect(item.id)}
            aria-current={item.id === selectedCompanyId ? "page" : undefined}
          >
            <span className="bs-company-sidebar__copy"><b>{item.name}</b><small>{item.renewalLabel || item.industry || "Company"}</small></span>
          </button>
        ))}
        {!filteredCompanies.length && <p>No companies found</p>}
      </nav>
      <div className="bs-company-sidebar__foot">
        <button type="button" onClick={onOpenBrokerAgent}>
          <Sparkles /><span><b>Broker agent</b><small>Voice-ready booklet chat demo</small></span>
        </button>
        <button className={settingsOpen ? "active" : ""} onClick={() => colorPickerEnabled && setSettingsOpen((open) => !open)} aria-expanded={colorPickerEnabled ? settingsOpen : undefined}>
          <Settings /><span><b>Settings</b><small>Workspace and appearance</small></span>
        </button>
        {colorPickerEnabled && settingsOpen && (
          <div className="bs-accent-control">
            <label htmlFor="studio-accent-color">
              <span>Accent color<small>{accentColor.toUpperCase()}</small></span>
              <input
                id="studio-accent-color"
                type="color"
                value={accentColor}
                onChange={(event) => onAccentColorChange(event.target.value)}
                aria-label="Choose accent color"
              />
            </label>
          </div>
        )}
        <span className="bs-company-sidebar__account"><i>ML</i><span><b>Miles</b><small>Account</small></span></span>
      </div>
    </aside>
  );
}

function CompanySelectionGate({ onChoose, onCreate }) {
  return (
    <section className="bs-company-gate">
      <span><Building2 /></span>
      <small>Broker packet studio</small>
      <h1>Choose a company to begin</h1>
      <p>Select a company from the sidebar to connect its plans, rates, profile, and renewal context.</p>
      <div><button onClick={onChoose}><Search /> Browse companies</button><button className="secondary" onClick={onCreate}><Plus /> New company</button></div>
    </section>
  );
}

const companySlug = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function NewCompanyFlow({ companies, onClose, onCreate }) {
  const [seed, setSeed] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    website: "",
    description: "",
    industry: "",
    headquarters: "",
    employeeRange: "",
    renewalDate: "",
  });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastRequestedWebsite = useRef("");
  const seedIsWebsite = /^(https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(seed.trim());
  const hasDetails = generating || Boolean(profile.name || profile.website);

  const update = (key) => (event) =>
    setProfile((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    const value = seed.trim();
    setError("");
    if (!value) {
      setGenerating(false);
      setProfile((current) => ({ ...current, name: "", website: "" }));
      return undefined;
    }
    if (!seedIsWebsite) {
      setGenerating(false);
      setProfile((current) => ({ ...current, name: value, website: "" }));
      return undefined;
    }
    if (lastRequestedWebsite.current === value) return undefined;

    const timer = window.setTimeout(async () => {
      lastRequestedWebsite.current = value;
      setGenerating(true);
      setProfile((current) => ({ ...current, website: value }));
      try {
        const response = await fetch("/api/company-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: value }),
        });
        const generated = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(generated.error || "Could not read this website");
        setProfile((current) => ({
          ...current,
          name: generated.name || current.name,
          website: generated.website || value,
          description: generated.description || "",
          industry: generated.industry || "",
          headquarters: generated.headquarters || "",
          employeeRange: generated.employeeRange || "",
        }));
      } catch {
        const host = value.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0];
        const fallbackName = host
          .split(/[-_]/)
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(" ");
        setProfile((current) => ({
          ...current,
          name: current.name || fallbackName,
          website: value,
        }));
        setError("We couldn’t read the site, but you can finish the details below.");
      } finally {
        setGenerating(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [seed, seedIsWebsite]);

  const submit = async (event) => {
    event.preventDefault();
    if (!profile.name.trim()) {
      setError("Add a company name before continuing");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const baseId = companySlug(profile.name) || "company";
      const existingIds = new Set(companies.map((item) => item.id));
      let id = baseId;
      let suffix = 2;
      while (existingIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      const renewalLabel = profile.renewalDate
        ? new Date(`${profile.renewalDate}T12:00:00`).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "Not set";
      await onCreate({
        id,
        name: profile.name.trim(),
        website: profile.website.trim(),
        description: profile.description.trim(),
        industry: profile.industry.trim(),
        headquarters: profile.headquarters.trim(),
        employeeRange: profile.employeeRange.trim(),
        employeeCount: 0,
        renewalDate: profile.renewalDate || "2099-12-31",
        renewalLabel,
        benefits: {},
        planDetails: {
          employer: {
            cover: profile.name.trim(),
            short: profile.name.trim(),
            legal: "",
          },
        },
      });
    } catch (saveError) {
      setError(saveError.message || "Could not create the company");
      setSaving(false);
    }
  };

  return (
    <div className="bs-new-company-backdrop">
      <form className="bs-new-company" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-company-title">
        <header>
          <div><h2 id="new-company-title">New company</h2><p>Paste a website or type a company name.</p></div>
          <button type="button" onClick={onClose} aria-label="Close new company flow"><X /></button>
        </header>
        <div className="bs-new-company__body">
          <label className="bs-new-company__seed">
            <Search />
            <input value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="company.com or Company name" autoFocus />
            {generating ? <LoaderCircle className="bs-spin" /> : seed ? <Check /> : null}
          </label>
          {generating && <div className="bs-new-company__filling"><Sparkles /> Filling in company details…</div>}
          {hasDetails && (
            <div className="bs-new-company__details">
              <span>Company details</span>
            <div className="bs-new-company__grid">
              <label className="wide"><span>Company name</span><input value={profile.name} onChange={update("name")} required /></label>
              <label><span>Industry</span><input value={profile.industry} onChange={update("industry")} /></label>
              <label><span>Headquarters</span><input value={profile.headquarters} onChange={update("headquarters")} /></label>
              <label><span>Team size</span><input value={profile.employeeRange} onChange={update("employeeRange")} placeholder="e.g. 51–200 employees" /></label>
              <label><span>Renewal date</span><input type="date" value={profile.renewalDate} onChange={update("renewalDate")} /></label>
              {profile.website && <label className="wide"><span>Website</span><input type="url" value={profile.website} onChange={update("website")} /></label>}
              <label className="wide"><span>Description</span><textarea value={profile.description} onChange={update("description")} rows="2" /></label>
            </div>
            </div>
          )}
            {error && <p className="bs-new-company__error"><AlertCircle />{error}</p>}
            <div className="bs-new-company__footer">
              <button type="button" className="quiet" onClick={onClose}>Cancel</button>
              <button className="primary" disabled={saving || generating || !profile.name.trim()}>{saving ? <LoaderCircle className="bs-spin" /> : <Plus />}{saving ? "Creating…" : "Create company"}</button>
            </div>
        </div>
      </form>
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

function PhaseTabs({ activeIndex, phaseState, completed, isUnlocked, onSelect }) {
  const activeTabRef = useRef(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <nav className="bs-step-tabs" aria-label="Information phases">
      {phaseDefinitions.map((phase, index) => {
        const state = phaseState[phase.id]?.status || "idle";
        const complete = completed.has(phase.id);
        const unlocked = isUnlocked(index);
        return (
          <button
            key={phase.id}
            ref={activeIndex === index ? activeTabRef : null}
            className={`${activeIndex === index ? "active" : ""} ${complete ? "complete" : ""} ${state === "processing" ? "processing" : ""}`}
            onClick={() => onSelect(index)}
            disabled={!unlocked}
            aria-current={activeIndex === index ? "step" : undefined}
          >
            <span>{complete ? <Check /> : String(index + 1).padStart(2, "0")}</span>
            <b>{phaseTabLabels[index]}</b>
          </button>
        );
      })}
    </nav>
  );
}

function FocusedPhase({ phase, state, busy, companyProfile, onCompanyProfileChange, onSaveCompanyProfile, companyProfileDirty, savingCompanyProfile, connectedCompany, files, classifications, facts, questions, processing, phaseBusy, onFiles, onDeleteFile, onAnswer, onBack, onNext, canBack, canNext }) {
  const inputRef = useRef(null);
  const contentRef = useRef(null);
  const dragDepth = useRef(0);
  const [panel, setPanel] = useState("sources");
  const [dragging, setDragging] = useState(false);
  const phaseFileIds = new Set(files.map((file) => file.id));
  const phaseFacts = facts.filter((fact) => phaseFileIds.has(fact.fileId));
  useEffect(() => { setPanel("sources"); }, [phase.id]);
  useEffect(() => {
    if (!phaseFacts.length && panel === "extracted") setPanel("sources");
    if (!questions.length && panel === "details") setPanel("sources");
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [phase.id, panel, phaseFacts.length, questions.length]);
  const dropHandlers = {
    onDragEnter: (event) => { event.preventDefault(); dragDepth.current += 1; setDragging(true); },
    onDragOver: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; },
    onDragLeave: (event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
    onDrop: (event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files); },
  };
  return (
    <article className={`bs-focused-phase phase-${phase.id} ${files.length ? "is-complete" : ""} ${questions.length || phaseFacts.length ? "has-details" : ""} ${phaseBusy ? "is-processing" : ""}`}>
      <div className="bs-focused-phase__content" ref={contentRef}>
        <header className="bs-focused-phase__intro"><div className="bs-question-copy"><h2>{phase.title}</h2><p>{phase.description}</p></div></header>
        <div className={`bs-focused-phase__answer is-${panel}`}>
          {(questions.length > 0 || phaseFacts.length > 0) && <nav className="bs-phase-subtabs" aria-label={`${phase.title} views`}><button className={panel === "sources" ? "active" : ""} onClick={() => setPanel("sources")}>Sources</button>{phaseFacts.length > 0 && <button className={panel === "extracted" ? "active" : ""} onClick={() => setPanel("extracted")}>Extracted <span>{phaseFacts.length}</span></button>}{questions.length > 0 && <button className={panel === "details" ? "active" : ""} onClick={() => setPanel("details")}>Details <span>{questions.length}</span></button>}</nav>}
          {phase.id === "employer" && files.length > 0 && <CompanyProfileFields profile={companyProfile} onChange={onCompanyProfileChange} onSave={onSaveCompanyProfile} dirty={companyProfileDirty} saving={savingCompanyProfile} disabled={processing} />}
          {(phase.id !== "employer" || !files.length) && <button className={`bs-dropzone bs-dropzone--focused tw:rounded-ansa ${dragging ? "is-dragging" : ""}`} onClick={() => inputRef.current?.click()} {...dropHandlers} disabled={busy}><b>{phaseBusy ? <LoaderCircle className="bs-spin" /> : <Upload />} {phaseBusy ? "Saving sources…" : dragging ? "Drop files" : "Choose files"}</b><span>{dragging ? "Release to add them" : "or drop them here"}</span><small>{phase.accepted}</small></button>}
          {phase.id === "employer" && files.length > 0 && <button className={`bs-add-source-row ${dragging ? "is-dragging" : ""}`} onClick={() => inputRef.current?.click()} {...dropHandlers} disabled={busy}><Upload />{dragging ? "Drop employer files" : "Add another employer source"}</button>}
          <input ref={inputRef} className="bs-hidden-input" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.eml,.txt" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
          {files.map((file) => {
            const classification = classifications.find((item) => item.fileId === file.id);
            return <div className="bs-source-record" key={file.id}><div className="bs-source-file tw:grid tw:items-center"><span><FileText /></span><div><b>{file.fileName}</b><small>{classification ? `${classification.documentType.replaceAll("_", " ")} · ${Math.round(classification.confidence * 100)}%` : file.sourceKind === "company_website" ? "Company website · Stored" : "Persisted · awaiting classification"}</small></div><i><ShieldCheck /> Stored</i><button className="bs-source-file__delete" onClick={() => onDeleteFile(file)} disabled={busy || processing} aria-label={`Delete ${file.fileName}`}><Trash2 /></button></div></div>;
          })}
          {phaseFacts.length > 0 && <ExtractedFacts facts={phaseFacts} />}
          {questions.length > 0 && <section className="bs-setup-questions"><header><b>{phase.id === "employer" ? "Finish the employer details" : phase.id === "documents" ? "Confirm the offered plans" : phase.id === "rates" ? "Finish the rate matching" : "A few details to confirm"}</b><span>Add these only when the source documents do not resolve them automatically.</span></header>{questions.map((question) => <QuestionCard key={question.id} question={question} disabled={processing} onAnswer={(answer) => onAnswer(question, answer)} />)}</section>}
        </div>
      </div>
      <footer className="bs-focused-phase__nav"><span>{panel === "details" ? `${questions.length} setup ${questions.length === 1 ? "detail" : "details"} remaining.` : panel === "extracted" ? `${phaseFacts.length} source-backed fields.` : phaseBusy ? "Ansa is processing this source." : files.length ? "This source is ready." : "Add a source to unlock the next step."}</span><div className="bs-step-arrows"><button onClick={onBack} disabled={!canBack} aria-label="Previous step"><ArrowUp /></button><button className="next" onClick={onNext} disabled={!canNext} aria-label="Next step"><ArrowDown /></button></div></footer>
    </article>
  );
}

function LegacyFocusedPhase({ phase, state, busy, blocker, hsaAnswer, companyProfile, onCompanyProfileChange, onSaveCompanyProfile, companyProfileDirty, savingCompanyProfile, connectedCompany, onRun, onAnswer, onBack, onNext, canBack, canNext }) {
  const processed = state.status === "complete";
  const complete = processed && !blocker;
  const processing = state.status === "processing";
  const sourceFileName = phase.id === "employer"
    ? `${getCompanyShortName(companyProfile.companyName)} company profile`
    : phase.fileName;
  const sourceFileMeta = phase.id === "employer"
    ? "Company profile · Connected"
    : phase.fileMeta;

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
          {phase.id === "employer" && processed && (
            <CompanyProfileFields
              profile={companyProfile}
              onChange={onCompanyProfileChange}
              onSave={onSaveCompanyProfile}
              dirty={companyProfileDirty}
              saving={savingCompanyProfile}
              disabled={processing}
            />
          )}
          {phase.id === "employer" && !processed && !processing && (
            <CompanySourceInput
              website={companyProfile.website}
              onWebsiteChange={(website) => onCompanyProfileChange((current) => ({ ...current, website }))}
              onRun={onRun}
              busy={busy}
              accepted={phase.accepted}
              connectedCompany={connectedCompany}
            />
          )}
          {phase.id !== "employer" && !processed && !processing && (
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

          {processed && (
            <>
              <div className="bs-source-file tw:grid tw:items-center">
                <span><FileText /></span>
                <div><b>{sourceFileName}</b><small>{sourceFileMeta}</small></div>
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
              <p>This plan is HSA-qualified, but I didn’t find whether {getCompanyShortName(companyProfile.companyName)} contributes to an HSA. What should the booklet say?</p>
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
        <span>{processing ? "You can review the next step while Ansa works." : blocker ? "Resolve the decision to finish this section." : complete ? "This source is ready." : "Add a source to unlock the next step."}</span>
        <div className="bs-step-arrows" aria-label="Move between steps">
          <button onClick={onBack} disabled={!canBack} aria-label="Previous step"><ArrowUp /></button>
          <button className="next" onClick={onNext} disabled={!canNext} aria-label="Next step"><ArrowDown /></button>
        </div>
      </footer>
    </article>
  );
}

function CompanySourceInput({ website, onWebsiteChange, onRun, busy, accepted, connectedCompany }) {
  return (
    <section className="bs-company-source" aria-labelledby="company-source-title">
      <div className="bs-company-source__head">
        <b id="company-source-title">Start with {connectedCompany?.name || "the company"}</b>
        <span>{connectedCompany ? "Connected from the selected company profile." : "Add either source—or both."}</span>
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
        <button className="primary" onClick={onRun} disabled={busy}><Sparkles /> {connectedCompany ? "Use company profile" : "Find company info"} <ArrowRight /></button>
        <button onClick={onRun} disabled={busy}><Upload /><span><b>Import an employer document</b><small>{accepted}</small></span></button>
      </div>
      <p>We’ll combine public company information with the employer facts found in your documents. You can review every field before it reaches the booklet.</p>
    </section>
  );
}

function CompanyProfileFields({ profile, onChange, onSave, dirty, saving, disabled }) {
  const update = (key) => (event) => {
    const nextValue = event.target.value;
    onChange((current) => ({ ...current, [key]: nextValue }));
  };

  return (
    <section className="bs-company-profile" aria-labelledby="company-profile-title">
      <div className="bs-company-profile__head">
        <div><b id="company-profile-title">Company profile</b><span>Synced with the selected company record</span></div>
        <button onClick={onSave} disabled={!dirty || saving}>{saving ? <LoaderCircle className="bs-spin" /> : <Check />}{saving ? "Saving" : dirty ? "Save to company" : "Saved"}</button>
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

function QuestionCard({ question, disabled, onAnswer }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(question.options?.[0] || "flat_monthly");
  const [payPeriods, setPayPeriods] = useState("26");
  const contribution = question.fieldPath.startsWith("contributions.");
  const planSelection = question.fieldPath === "plans.selected";
  const date = question.fieldPath.startsWith("planYear.");
  const submit = () => {
    if (contribution) {
      const numericValue = Number(value);
      onAnswer({ mode, value: mode === "percent" && numericValue > 1 ? numericValue / 100 : numericValue, payPeriods: Number(payPeriods) });
    } else if (planSelection) {
      onAnswer(value.split("\n").map((line) => line.split("|").map((item) => item.trim())).filter((parts) => parts[0] && parts[1]).map(([benefitType, planName, carrier]) => ({ benefitType: benefitType.toLowerCase(), planName, carrier: carrier || null })));
    } else onAnswer(value);
  };
  return <article className="bs-question-card bs-question-card--setup"><div className="bs-blocker__head"><span><Circle /></span><div><small>Complete when available · {question.fieldPath}</small><b>{question.question}</b></div></div><p>{question.reason}</p>{contribution ? <div className="bs-question-fields"><label><span>Contribution method</span><select value={mode} onChange={(event) => setMode(event.target.value)} disabled={disabled}>{question.options?.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label><label><span>{mode === "percent" ? "Percent" : "Amount ($)"}</span><input type="number" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} /></label><label><span>Pay periods</span><input type="number" value={payPeriods} onChange={(event) => setPayPeriods(event.target.value)} disabled={disabled} /></label></div> : question.options?.length ? <div className="bs-blocker__answers tw:flex tw:flex-wrap">{question.options.map((option) => <button key={option} onClick={() => onAnswer(option)} disabled={disabled}>{option}<ArrowRight /></button>)}</div> : <div className="bs-question-fields"><label className="wide"><span>{planSelection ? "One plan per line: benefit type | plan name | carrier" : "Your answer"}</span>{planSelection ? <textarea rows="4" value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} placeholder="medical | Plan name | Carrier" /> : <input type={date ? "date" : "text"} value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} />}</label></div>}{(!question.options?.length || contribution) && <button className="bs-answer-submit" onClick={submit} disabled={disabled || !value.trim()}>Save detail and continue <ArrowRight /></button>}<div className="bs-question-sources">{question.sourceRefs?.length ? `${question.sourceRefs.length} related source reference(s)` : "Upload source paperwork to fill this automatically, or enter it here."}</div></article>;
}

function BookletPreview({ pages, selectedPage, setSelectedPage, completion, mode, setMode, companyProfile, run, events, files, facts, classifications, questions, processing, textStreaming, onDownload, onBack }) {
  const page = pages.find((item) => item.id === selectedPage) || pages[0];
  const warnings = run?.confidenceReport?.warnings || [];
  const conflicts = run?.confidenceReport?.conflicts || [];
  const checkCount = warnings.length + conflicts.length + (run?.qualityReport?.issues?.length || 0);
  const thumbnailsRef = useRef(null);
  useEffect(() => {
    thumbnailsRef.current?.querySelector("button.active")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [page?.id]);
  return (
    <aside className={`bs-preview-panel ${textStreaming ? "is-streaming" : ""}`}>
      <div className="bs-preview-top tw:flex tw:items-center tw:justify-between"><button className="bs-preview-back" onClick={onBack}><ArrowLeft /> Sources</button><div className="bs-panel-heading"><span className="bs-guide-title">{companyProfile.planYear?.match(/\b20\d{2}\b/)?.[0] ? `${companyProfile.planYear.match(/\b20\d{2}\b/)[0]} ` : ""}Employee Benefits Guide</span><b>{processing ? pages.length ? `${pages.length} HTML page(s) ready · ${events.at(-1)?.stage || "Processing"}` : events.at(-1)?.stage || "Processing" : run?.status === "complete" ? `${pages.length} compiled pages · PDF ready` : run?.status === "blocked" ? `${pages.length} draft page(s) ready · continue setup on the left` : "Waiting for a source"}</b></div><div className="bs-preview-actions tw:flex tw:items-center"><button className="bs-icon-button bs-icon-button--light" onClick={() => run?.pdfUrl && window.open(run.pdfUrl, "_blank", "noopener")} disabled={!run?.pdfUrl} aria-label="Open generated PDF"><ExternalLink /></button><button className="bs-button bs-button--light" onClick={onDownload} disabled={!run?.pdfUrl}><Download /> PDF</button></div></div>
      <nav className="bs-preview-tabs tw:flex" aria-label="Preview sections">{[["pages", "Pages", pages.length], ["checks", "Checks", checkCount], ["sources", "Sources", files.length]].map(([key, label, count]) => <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>{label}<span>{count}</span></button>)}</nav>
      {mode === "pages" && (!pages.length ? <div className="bs-preview-empty"><div className="bs-empty-booklet"><i /><i /><span>{processing ? <LoaderCircle className="bs-spin" /> : <BookOpen />}</span></div><span className="bs-preview-kicker">Backend-owned outline</span><h2>{processing ? "Building from your evidence" : run?.status === "blocked" ? "Keep completing the setup" : "No booklet yet"}</h2><p>{processing ? "Classification, extraction, matching, and page generation are running now." : "Add a source on the left. Pages appear here as soon as their evidence is ready."}</p></div> : <div className="bs-pages-view"><div className="bs-thumbnails" ref={thumbnailsRef} aria-label="Generated booklet pages">{pages.map((item, index) => <button key={item.id} className={item.id === page?.id ? "active" : ""} onClick={() => setSelectedPage(item.id)} style={{ "--page-index": index }}><span><MiniPage page={item} companyProfile={companyProfile} /></span><small>{String(item.number).padStart(2, "0")}</small></button>)}</div><div className="bs-canvas-wrap"><div className="bs-canvas-meta"><div><span>Page {page?.number} · {pages.length} currently ready</span><b>{page?.title}</b></div>{textStreaming && <span className="bs-completion-status"><i><span style={{ width: `${completion}%` }} /></i><b>Writing page</b></span>}</div><div className="bs-canvas-stage bs-pdf-stage">{run?.pdfUrl ? <iframe title={`Generated PDF: ${page?.title}`} src={`${run.pdfUrl}#page=${page?.number}&view=FitH`} /> : page?.html ? <HtmlPagePreview page={page} /> : <div className="bs-outline-sheet"><Logo /><small>Generated outline section</small><h2>{page?.title}</h2></div>}</div>{run?.status === "complete" && <div className="bs-ready-bar"><span><CheckCircle2 /></span><div><b>Booklet ready</b><small>{pages.length} source-backed pages · quality checks passed</small></div><button onClick={onDownload}>Download PDF <ArrowRight /></button></div>}</div></div>)}
      {mode === "checks" && <ConnectedChecksView run={run} warnings={warnings} conflicts={conflicts} processing={processing} questions={questions} />}
      {mode === "sources" && <ConnectedSourcesView files={files} facts={facts} classifications={classifications} />}
    </aside>
  );
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
      if (width >= 100 && height >= 100) setScale(Math.min(1, width / 816, height / 1056));
    };
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <div className="bs-html-preview" ref={containerRef}><div className="bs-html-preview__sizer" style={{ width: `${816 * scale}px`, height: `${1056 * scale}px` }}><div className="bs-html-preview__page" style={{ transform: `scale(${scale})` }}><iframe title={`Generated HTML: ${page.title}`} srcDoc={page.html} sandbox="" scrolling="no" /></div></div></div>;
}

function ConnectedChecksView({ run, warnings, conflicts, processing, questions }) {
  return <div className="bs-inspection-view"><div className="bs-inspection-head"><span><Gauge /></span><div><small>Backend QA</small><h3>Booklet checks</h3><p>Confidence warnings, source conflicts, and final render quality appear here. Missing setup fields stay in the relevant step on the left.</p></div></div>{processing && <div className="bs-check-alert"><LoaderCircle className="bs-spin" /><span><b>Checks are running</b><small>The latest status appears as pipeline events complete.</small></span></div>}{warnings.map((warning) => <div className="bs-warning-note" key={warning}><AlertCircle /><span><b>Confidence warning</b><small>{warning}</small></span></div>)}{conflicts.map((conflict) => <div className="bs-warning-note" key={conflict.fieldPath}><Zap /><span><b>{conflict.fieldPath}</b><small>{conflict.resolution || conflict.description}</small></span></div>)}{run?.qualityReport && <section className="bs-check-group"><h4>Final PDF quality</h4><div className={run.qualityReport.passed ? "done" : "pending"}><span>{run.qualityReport.passed ? <Check /> : <AlertCircle />}</span><b>{run.qualityReport.passed ? "Preflight and post-render checks passed" : "Quality checks failed"}</b><small>{run.qualityReport.pageCount ? `${run.qualityReport.pageCount} pages` : "No final page count"}</small></div></section>}{!processing && !warnings.length && !conflicts.length && !run?.qualityReport && <div className="bs-check-empty"><CheckCircle2 /><span><b>{questions.length ? "Setup details remain" : "No QA issues"}</b><small>{questions.length ? "Open the Details tab in the relevant step on the left." : "Checks will appear as the booklet is generated."}</small></span></div>}</div>;
}

function ConnectedSourcesView({ files, facts, classifications }) {
  return <div className="bs-inspection-view"><div className="bs-inspection-head"><span><Files /></span><div><small>Persisted source of truth</small><h3>Connected evidence</h3><p>Review uploaded sources and their processing status.</p></div></div><div className="bs-sources-list">{files.map((file) => { const classification = classifications.find((item) => item.fileId === file.id); const count = facts.filter((fact) => fact.fileId === file.id).length; return <div key={file.id} className="ready"><span><FileCheck2 /></span><div><b>{file.fileName}</b><small>{classification ? classification.documentType.replaceAll("_", " ") : file.sourceKind === "company_website" ? "company website" : "Uploaded source"} · {count} extracted fields</small></div><em>{classification ? `${Math.round(classification.confidence * 100)}%` : "Stored"}</em></div>; })}</div>{!files.length && <div className="bs-check-empty"><FileText /><span><b>No evidence connected</b><small>Choose or drop a supported source in any setup step.</small></span></div>}</div>;
}

function LegacyBookletPreview({ pages, selectedPage, setSelectedPage, completed, processed, completion, completedChecks, mode, setMode, blockerOpen, bookletReady, hsaAnswer, processingPhase, companyProfile, onDownload, onBack }) {
  const page = pages.find((item) => item.id === selectedPage) || pages[0];
  const warnings = completed.has("rates") ? 2 : 0;
  const streamingPhase = phaseDefinitions.find((phase) => phase.id === processingPhase);
  const guideYear = companyProfile.planYear?.match(/\b20\d{2}\b/)?.[0];
  const completionHue = Math.round(217 - completion * 0.62);

  return (
    <aside className={`bs-preview-panel ${processingPhase ? "is-streaming" : ""}`}>
      <div className="bs-preview-top tw:flex tw:items-center tw:justify-between">
        <button className="bs-preview-back" onClick={onBack}><ArrowLeft /> Sources</button>
        <div className="bs-panel-heading">
          <span className="bs-guide-title">{guideYear ? `${guideYear} ` : ""}Employee Benefits Guide</span>
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
          ["sources", "Sources", processed.size],
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
                  <div className="bs-canvas-status">
                    {blockerOpen && <button className="bs-missing-status" onClick={() => setMode("checks")}><AlertCircle /> 1 detail missing</button>}
                    <span
                      className="bs-completion-status"
                      style={{ "--bs-completion": `${completion}%`, "--bs-completion-hue": completionHue }}
                    >
                      <i><span /></i>
                      <b>{completion}% complete</b>
                    </span>
                  </div>
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
      {mode === "sources" && <SourcesView processed={processed} blockerOpen={blockerOpen} companyProfile={companyProfile} />}
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

function SourcesView({ processed, blockerOpen, companyProfile }) {
  return (
    <div className="bs-inspection-view">
      <div className="bs-inspection-head"><span><Files /></span><div><small>Source of truth</small><h3>Connected evidence</h3><p>Review exactly where each booklet fact came from.</p></div></div>
      <div className="bs-sources-list">
        {sourceDefinitions.map((source) => {
          const ready = processed.has(source.phase);
          const missing = ready && blockerOpen && source.phase === "documents";
          const companyName = getCompanyShortName(companyProfile.companyName);
          const label = source.phase === "employer"
            ? `${companyName} company profile`
            : source.phase === "census"
              ? `${companyName} census`
              : source.label;
          return (
            <div key={source.phase} className={`${ready ? "ready" : ""} ${missing ? "missing" : ""}`}>
              <span>{missing ? <AlertCircle /> : ready ? <FileCheck2 /> : <FileText />}</span>
              <div><b>{label}</b><small>{missing ? "Missing employer HSA contribution" : ready ? source.detail : "Not added yet"}</small></div>
              {missing ? <em>Review</em> : ready ? <em>{source.confidence}%</em> : <i>Pending</i>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
