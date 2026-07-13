import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  HeartPulse,
  Smile,
  Eye,
  BookOpen,
  Save,
  Check,
  CalendarDays,
  LoaderCircle,
  Settings2,
  X,
  Phone,
  Mail,
  Globe2,
  Users,
  Plus,
  Trash2,
  Upload,
  FileText,
  FileSearch,
  Pencil,
  LayoutGrid,
  Settings,
  PanelLeft,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "./firebase";
import AddCompany from "./AddCompany";
import "./styles.css";
import "./inline.css";
import "./add-company.css";
import "./generation.css";
import "./design-system.css";
import "./clean-pass.css";
import "./plan-parsing.css";
const tiers = ["EE", "EE + Spouse", "EE + Children", "EE + Family"];
const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
const fmt2 = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n || 0);
function path() {
  return location.pathname.split("/").filter(Boolean);
}
function go(to, setRoute) {
  history.pushState({}, "", to);
  setRoute(path());
}
function calculate(plan, pays = 52) {
  let rows = plan.tiers.map((r, i) => {
    let er = r.premium * r.erPercent,
      ee = r.premium - er;
    return {
      ...r,
      tier: r.tier || tiers[i],
      er,
      ee,
      perPay: (ee * 12) / pays,
      erAnnual: er * r.enrolled * 12,
      eeAnnual: ee * r.enrolled * 12,
      total: r.premium * r.enrolled * 12,
    };
  });
  return {
    ...plan,
    rows,
    enrolled: rows.reduce((a, r) => a + r.enrolled, 0),
    er: rows.reduce((a, r) => a + r.erAnnual, 0),
    ee: rows.reduce((a, r) => a + r.eeAnnual, 0),
    total: rows.reduce((a, r) => a + r.total, 0),
  };
}
function App() {
  const [route, setRoute] = useState(path()),
    [companies, setCompanies] = useState([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let f = () => setRoute(path());
    addEventListener("popstate", f);
    const unsubscribe = onSnapshot(
      query(collection(db, "benefitsCompanies"), orderBy("renewalDate", "asc")),
      (snapshot) => {
        setCompanies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => {
      removeEventListener("popstate", f);
      unsubscribe();
    };
  }, []);
  if (loading) return <Loading />;
  let ordered = [...companies].sort((a, b) =>
      a.renewalDate.localeCompare(b.renewalDate),
    ),
    company = companies.find((c) => c.id === route[1]);
  let update = async (updated) => {
      await setDoc(doc(db, "benefitsCompanies", updated.id), updated);
      setCompanies((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    },
    add = async (company) => {
      await setDoc(doc(db, "benefitsCompanies", company.id), company);
      setCompanies((cs) => [...cs.filter((c) => c.id !== company.id), company]);
    };
  return (
    <div className="appShell">
      <Sidebar company={company} directoryActive={route.length === 0} onHome={() => go("/", setRoute)} />
      <div className="appContent">
        <div className="mobileBar"><PanelLeft /><b>ansa</b></div>
        {route.length === 0 ? (
          <Directory companies={ordered} add={add} open={(id) => go(`/companies/${id}`, setRoute)} />
        ) : company ? (
          <Company company={company} onUpdate={update} back={() => go("/", setRoute)} />
        ) : (
          <Directory companies={ordered} add={add} open={(id) => go(`/companies/${id}`, setRoute)} />
        )}
      </div>
    </div>
  );
}
function Sidebar({ onHome, company, directoryActive }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={onHome} aria-label="ansa home"><b>ansa</b></button>
      <nav className="sidebarNav" aria-label="Main navigation">
        <small>Workspace</small>
        <button className={directoryActive ? "active" : ""} onClick={onHome}><LayoutGrid />Companies</button>
        {company && <div className="sidebarCompany"><span>{company.name.slice(0, 1)}</span><div><b>{company.name}</b><small>{company.renewalLabel}</small></div></div>}
      </nav>
      <div className="sidebarFoot"><button><Settings />Settings</button><span>Benefits workspace</span></div>
    </aside>
  );
}
function Loading() {
  return (
    <div className="loading">
      <LoaderCircle />
      <span>Loading benefit companies…</span>
    </div>
  );
}
function Directory({ companies, open, add }) {
  const [adding, setAdding] = useState(false);
  return (
    <main>
      <div className="directoryHead">
        <Title
          eyebrow="Client directory"
          title="Companies"
          sub="Benefit plans ordered by upcoming renewal period."
        />
        <button className="primary" onClick={() => setAdding(true)}>
          + Add company
        </button>
      </div>
      <div className="companyList">
        {companies.map((c, i) => (
          <button className="companyRow" key={c.id} onClick={() => open(c.id)}>
            <div className="companyIcon">
              <Building2 />
            </div>
            <div className="companyName">
              <b>{c.name}</b>
              <span>
                {c.description ||
                  `${c.employeeCount || 0} enrolled employees · ${Object.keys(c.benefits || {}).length} benefit types`}
              </span>
            </div>
            <div className="renewal">
              <small>Renewal period</small>
              <b>
                <CalendarDays />
                {c.renewalLabel}
              </b>
            </div>
            <span className={i === 0 ? "status soon" : "status"}>
              {i === 0 ? "Next renewal" : "Upcoming"}
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>
      {adding && <AddCompany close={() => setAdding(false)} add={add} />}
    </main>
  );
}
const emptyDetails = {
  employer: { cover: "", legal: "", short: "" },
  planYear: { start: "", end: "" },
  enrollment: { start: "", end: "", meeting: "", whatsNew: [] },
  contacts: {
    enrollment: { name: "", phone: "", email: "" },
    hr: { name: "", phone: "", email: "" },
    voluntary: { offered: false, name: "", phone: "", email: "" },
  },
  carriers: {
    medicalDental: { name: "", phone: "", website: "" },
    vision: { name: "", phone: "", website: "" },
    lifeLtd: { name: "", phone: "", website: "" },
    eap: { name: "", phone: "", website: "" },
  },
  telemedicine: { app: "", phone: "", text: "", website: "" },
  accounts: { administrator: "", type: "", hraContributions: [] },
  planDocuments: { health: null, dental: null, vision: null, documents: [] },
};
const mergeDetails = (d) => ({
  ...emptyDetails,
  ...d,
  employer: { ...emptyDetails.employer, ...d?.employer },
  planYear: { ...emptyDetails.planYear, ...d?.planYear },
  enrollment: {
    ...emptyDetails.enrollment,
    ...d?.enrollment,
    whatsNew: d?.enrollment?.whatsNew || [],
  },
  contacts: {
    ...emptyDetails.contacts,
    ...d?.contacts,
    enrollment: {
      ...emptyDetails.contacts.enrollment,
      ...d?.contacts?.enrollment,
    },
    hr: { ...emptyDetails.contacts.hr, ...d?.contacts?.hr },
    voluntary: {
      ...emptyDetails.contacts.voluntary,
      ...d?.contacts?.voluntary,
    },
  },
  carriers: {
    ...emptyDetails.carriers,
    ...d?.carriers,
    ...Object.fromEntries(
      Object.keys(emptyDetails.carriers).map((k) => [
        k,
        { ...emptyDetails.carriers[k], ...d?.carriers?.[k] },
      ]),
    ),
  },
  telemedicine: { ...emptyDetails.telemedicine, ...d?.telemedicine },
  accounts: {
    ...emptyDetails.accounts,
    ...d?.accounts,
    hraContributions: d?.accounts?.hraContributions || [],
  },
  planDocuments: {
    ...emptyDetails.planDocuments,
    ...d?.planDocuments,
  },
});
const dateLabel = (v) =>
  v
    ? new Date(`${v}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";
function Company({ company, onUpdate, back }) {
  const [expanded, setExpanded] = useState(() =>
      company.benefits?.health ? "health" : null,
    ),
    [generating, setGenerating] = useState(false),
    [activeTab, setActiveTab] = useState("plans"),
    [generation, setGeneration] = useState({
      status: "idle",
      message: "",
      pageCount: 0,
      pages: [],
      pdfUrl: "",
      filename: "",
      error: "",
      draftCopy: null,
    });
  let details = mergeDetails(company.planDetails),
    cards = [
      [
        "health",
        "Medical",
        HeartPulse,
        "Premiums, employer share, and employee deductions",
      ],
      [
        "dental",
        "Dental",
        Smile,
        "Premiums, employer share, and employee deductions",
      ],
      ["vision", "Vision", Eye, "Premiums, employer share, and employee deductions"],
    ];
  let planYear =
    details.planYear.start || details.planYear.end
      ? `${dateLabel(details.planYear.start)} – ${dateLabel(details.planYear.end)}`
      : company.renewalLabel;
  let generateBooklet = async () => {
    setActiveTab("booklet");
    setGenerating(true);
    if (generation.pdfUrl) URL.revokeObjectURL(generation.pdfUrl);
    setGeneration({
      status: "starting",
      message: "Connecting to the booklet generator…",
      pageCount: 0,
      pages: [],
      pdfUrl: "",
      filename: "",
      error: "",
      draftCopy: null,
    });
    try {
      let response = await fetch("/api/generate-booklet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, payPeriods: 52 }),
      });
      if (!response.ok) {
        let error = await response.json().catch(() => ({}));
        throw Error(error.error || "Could not generate booklet");
      }
      if (!response.body) throw Error("Streaming is not available");
      let reader = response.body.getReader(),
        decoder = new TextDecoder(),
        buffer = "";
      while (true) {
        let { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (let line of lines) {
          if (!line.trim()) continue;
          let event = JSON.parse(line);
          if (event.type === "copy_start")
            setGeneration((g) => ({
              ...g,
              status: "writing",
              message: `Writing ${event.title}`,
              draftCopy: {
                section: event.section,
                title: event.title,
                text: "",
              },
            }));
          if (event.type === "copy_delta")
            setGeneration((g) => ({
              ...g,
              draftCopy: {
                section: event.section,
                title: event.title,
                text: `${g.draftCopy?.text || ""}${event.delta}`,
              },
            }));
          if (event.type === "copy_done")
            setGeneration((g) => ({
              ...g,
              draftCopy: {
                section: event.section,
                title: event.title,
                text: event.text,
              },
            }));
          if (event.type === "start")
            setGeneration((g) => ({
              ...g,
              status: "writing",
              pageCount: event.pageCount,
              message: event.message,
              draftCopy: null,
            }));
          if (event.type === "page")
            setGeneration((g) => ({
              ...g,
              status: "writing",
              message: event.message,
              pages: [...g.pages, event],
            }));
          if (event.type === "rendering")
            setGeneration((g) => ({
              ...g,
              status: "rendering",
              message: event.message,
            }));
          if (event.type === "complete") {
            let bytes = Uint8Array.from(atob(event.pdf), (c) =>
                c.charCodeAt(0),
              ),
              href = URL.createObjectURL(
                new Blob([bytes], { type: "application/pdf" }),
              );
            setGeneration((g) => ({
              ...g,
              status: "complete",
              message: event.message,
              pdfUrl: href,
              filename: event.filename,
            }));
          }
        }
        if (done) break;
      }
    } catch (error) {
      setGeneration((g) => ({
        ...g,
        status: "error",
        error: error.message || "Could not generate booklet",
        message: "Generation stopped",
      }));
    } finally {
      setGenerating(false);
    }
  };
  return (
    <main>
      <Back onClick={back} />
      <div className="companyTop">
        <Title
          eyebrow={details.employer.short || company.name}
          title="Benefit plans"
          sub={`Renewal period ${company.renewalLabel}`}
        />
        <div className="companyQuick">
          <div>
            <CalendarDays />
            <span>
              <small>Plan year</small>
              <b>{planYear}</b>
            </span>
          </div>
        </div>
      </div>
      <CompanyOverview
        company={company}
        details={details}
        onUpdate={onUpdate}
      />
      <nav className="workspaceTabs" aria-label="Company workspace">
        {[
          ["plans", "Plans"],
          ["costs", "Costs"],
          ["booklet", "Booklet"],
          ["people", "People"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={activeTab === key ? "active" : ""}
            onClick={() => setActiveTab(key)}
          >
            {label}
            {key === "booklet" && generation.pages.length > 0 && (
              <span>{generation.pages.length}</span>
            )}
          </button>
        ))}
      </nav>
      {activeTab === "plans" && (
        <PlanDocumentsSection
          company={company}
          details={details}
          onUpdate={onUpdate}
        />
      )}
      {activeTab === "costs" && (
        <>
          <CoverageSelector
            cards={cards}
            selected={expanded}
            onSelect={(key) => setExpanded(expanded === key ? null : key)}
            company={company}
            mode="costs"
          />
          {expanded && (
            <div className="expandedForm">
              {company.benefits?.[expanded] ? (
                <Plans
                  key={expanded}
                  company={company}
                  type={expanded}
                  onUpdate={onUpdate}
                />
              ) : (
                <div className="emptyCoverageCosts">
                  <b>No employee cost table</b>
                  <span>
                    Upload a source document now. Employee premium and
                    contribution rows can be added after the plan is parsed.
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {activeTab === "people" && (
        <PeopleTab company={company} details={details} onUpdate={onUpdate} />
      )}
      {activeTab === "booklet" && (
        <BookletTab
          generation={generation}
          generating={generating}
          generate={generateBooklet}
        />
      )}
    </main>
  );
}

function CoverageSelector({ cards, selected, onSelect, company, mode }) {
  return (
    <div className="benefitStack">
      {cards.map(([key, name, Icon, sub]) => {
        let hasCosts = !!company.benefits?.[key],
          isSelected = selected === key,
          planYears = (company.benefits?.[key]?.plans || [])
            .map((plan) => Number(plan.year))
            .filter(Number.isFinite),
          currentYear = planYears.length ? Math.max(...planYears) : null;
        return (
          <button
            key={key}
            className={`benefitCard ${isSelected ? "selected" : ""}`}
            onClick={() => onSelect(key)}
          >
            <span className={`benefitIcon ${key}`}>
              <Icon />
            </span>
            <div>
              <b>{name}</b>
              <p>{sub}</p>
              {hasCosts ? (
                <span>
                  {currentYear || "Current year"} ·{" "}
                  {isSelected ? "Hide costs" : "Edit costs"}
                </span>
              ) : (
                <span>Not offered</span>
              )}
            </div>
            <ChevronRight />
          </button>
        );
      })}
    </div>
  );
}

const fileSize = (size = 0) => {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const normalizePlanDocuments = (store = {}) => {
  let existing = Array.isArray(store.documents) ? store.documents : [],
    typed = ["health", "dental", "vision"]
      .map((key) => store[key] && { ...store[key], id: store[key].id || key })
      .filter(Boolean);
  return [...typed, ...existing].filter(
    (doc, index, docs) => docs.findIndex((item) => item.id === doc.id) === index,
  );
};
function PlanDocumentsSection({ company, details, onUpdate }) {
  const [documents, setDocuments] = useState(() =>
      normalizePlanDocuments(details.planDocuments),
    ),
    [modalOpen, setModalOpen] = useState(false),
    [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    const plans = collection(db, "benefitsCompanies", company.id, "plans");
    return onSnapshot(plans, (snapshot) => {
      const live = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
      const legacy = normalizePlanDocuments(details.planDocuments).filter(
        (item) => !live.some((plan) => plan.id === item.id),
      );
      setDocuments([...live, ...legacy]);
    });
  }, [company.id, details.planDocuments]);
  const selected = documents.find((plan) => plan.id === selectedId);
  let startParser = (planId) => {
      fetch("/api/parse-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, planId }),
      })
        .then(async (response) => {
          if (response.ok) return;
          const body = await response.json().catch(() => ({}));
          throw Error(body.error || "Could not start plan parser");
        })
        .catch((error) =>
          setDoc(
            doc(db, "benefitsCompanies", company.id, "plans", planId),
            {
              status: "failed",
              parsingState: "failed",
              error: error.message,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          ),
        );
    },
    addPlan = async (uploaded) => {
      const uploadedAt = new Date().toISOString();
      await setDoc(doc(db, "benefitsCompanies", company.id, "plans", uploaded.id), {
        ...uploaded,
        uploadedAt,
        status: "queued",
        parsingState: "queued",
        parsingPct: 0,
        attributes: {},
        error: null,
      });
      setModalOpen(false);
      startParser(uploaded.id);
    };
  if (selected)
    return (
      <PlanDetail
        companyId={company.id}
        plan={selected}
        close={() => setSelectedId(null)}
        retry={() => startParser(selected.id)}
      />
    );
  return (
    <section className="planDocumentsSection">
      {documents.length === 0 ? (
        <div className="plansEmptyState">
          <div>
            <FileText />
            <h2>No plans yet</h2>
            <p>
              Looks like there are no plans for this company. Upload one here.
            </p>
          </div>
          <button className="companyAction planUploadButton" onClick={() => setModalOpen(true)}>
            <Upload />
            Upload plan
          </button>
        </div>
      ) : (
        <div className="planDocumentGrid">
          {documents.map((plan) => (
            <button
              className={`planDocumentCard ${plan.status === "parsing" || plan.status === "queued" ? "parsing" : ""}`}
              key={plan.id}
              onClick={() => setSelectedId(plan.id)}
            >
              <div className="planDocumentPreview">
                {plan.status === "complete" ? <FileSearch /> : <FileText />}
              </div>
              <div className="planDocumentSummary">
                <b>{plan.attributes?.identity?.planName || plan.name}</b>
                <span>
                  {new Date(plan.uploadedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <small>
                  {[plan.fileName, fileSize(plan.size)].filter(Boolean).join(" · ")}
                </small>
                {(plan.status === "parsing" || plan.status === "queued") && (
                  <PlanProgress plan={plan} compact />
                )}
                {plan.status === "failed" && <small className="planFailed">Parsing failed</small>}
              </div>
              <ChevronRight />
            </button>
          ))}
          <button className="addPlanCard" onClick={() => setModalOpen(true)}>
            <Plus />
            <b>Add new plan</b>
          </button>
        </div>
      )}
      {modalOpen && (
        <PlanUploadModal
          companyId={company.id}
          close={() => setModalOpen(false)}
          submit={addPlan}
        />
      )}
    </section>
  );
}

function PlanProgress({ plan, compact = false }) {
  const pct = Math.max(0, Math.min(100, Number(plan.parsingPct) || 0));
  return (
    <div className={`planParseProgress ${compact ? "compact" : ""}`}>
      <div>
        {plan.status === "complete" ? <Check /> : <LoaderCircle />}
        <span>{plan.parsingState || "queued"}</span>
        <b>{pct}%</b>
      </div>
      <i><span style={{ width: `${pct}%` }} /></i>
    </div>
  );
}

function PlanUploadModal({ companyId, close, submit }) {
  const [name, setName] = useState(""),
    [file, setFile] = useState(null),
    [dragging, setDragging] = useState(false),
    [uploadPct, setUploadPct] = useState(0),
    [uploaded, setUploaded] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const planId = useMemo(() => crypto.randomUUID(), []);
  let chooseFile = (selected) => {
      if (!selected) return;
      if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
        setError("Medical plan source must be a PDF");
        return;
      }
      setFile(selected);
      setUploaded(null);
      setUploadPct(0);
      setError("");
      const safeName = selected.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `benefitsCompanies/${companyId}/plans/${planId}/${safeName}`;
      const task = uploadBytesResumable(ref(storage, storagePath), selected, {
        contentType: selected.type || "application/pdf",
      });
      task.on(
        "state_changed",
        (snapshot) => setUploadPct(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        (uploadError) => setError(uploadError.message || "Upload failed"),
        async () => {
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          setUploadPct(100);
          setUploaded({
            id: planId,
            name: name.trim() || selected.name.replace(/\.pdf$/i, ""),
            fileName: selected.name,
            size: selected.size,
            type: selected.type || "application/pdf",
            storagePath,
            downloadURL,
          });
        },
      );
    },
    onSubmit = async (event) => {
      event.preventDefault();
      if (!name.trim() || !uploaded || saving) return;
      setSaving(true);
      try {
        await submit({ ...uploaded, name: name.trim() });
      } catch (submitError) {
        setError(submitError.message || "Could not create plan");
        setSaving(false);
      }
    };
  return (
    <div className="modalBackdrop">
      <form className="addModal planUploadModal" onSubmit={onSubmit}>
        <button type="button" className="modalClose" onClick={close}>
          <X />
        </button>
        <div className="modalHeading">
          <span>
            <Upload />
          </span>
          <div>
            <h2>Upload plan</h2>
            <p>Name the plan and upload the source document.</p>
          </div>
        </div>
        <label className="field">
          Plan name
          <input
            autoFocus
            placeholder="UHC Bronze 2026"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label
          className={`planUploadDropzone ${dragging ? "dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload />
          <b>{file ? file.name : "Drop plan document here"}</b>
          <span>{file ? fileSize(file.size) : "PDF up to 50 MB"}</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </label>
        {file && uploadPct < 100 && (
          <div className="bucketUploadProgress">
            <span>Uploading document</span><b>{uploadPct}%</b>
            <i><span style={{ width: `${uploadPct}%` }} /></i>
          </div>
        )}
        {uploaded && <small className="bucketUploadReady"><Check /> Document uploaded</small>}
        {error && <p className="formError">{error}</p>}
        <div className="modalActions">
          <button type="button" className="outline" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={!name.trim() || !uploaded || saving}>
            {saving ? <LoaderCircle /> : <Upload />}
            {saving ? "Starting parser" : "Upload plan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlanDetail({ companyId, plan, close, retry }) {
  const [tab, setTab] = useState("pdf");
  return (
    <section className="planDetail">
      <div className="planDetailHead">
        <button className="back" onClick={close}><ArrowLeft /> Plans</button>
        <div>
          <span>{plan.attributes?.identity?.carrier || "Medical plan"}</span>
          <h2>{plan.attributes?.identity?.planName || plan.name}</h2>
          <small>{plan.fileName}</small>
        </div>
        {plan.status === "failed" && <button className="outline" onClick={retry}>Retry parsing</button>}
      </div>
      {plan.status !== "complete" && plan.status !== "failed" && <PlanProgress plan={plan} />}
      {plan.error && <p className="planDetailError"><AlertTriangle />{plan.error}</p>}
      <nav className="planDetailTabs" aria-label="Plan document">
        <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}><FileText />PDF</button>
        <button className={tab === "attributes" ? "active" : ""} onClick={() => setTab("attributes")}><Pencil />Attributes</button>
      </nav>
      {tab === "attributes" ? (
        <PlanAttributeEditor companyId={companyId} plan={plan} />
      ) : (
        <div className="sourcePdfViewer">
          {plan.downloadURL ? <iframe title={plan.name} src={`${plan.downloadURL}#view=FitH&toolbar=1&navpanes=0`} /> : <p>Source PDF is unavailable.</p>}
        </div>
      )}
    </section>
  );
}

const attributeLabel = (value) => value
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/^./, (letter) => letter.toUpperCase())
  .replace(/\bId\b/g, "ID")
  .replace(/\bHsa\b/g, "HSA")
  .replace(/\bUrl\b/g, "URL");
const attributeOrder = ["identity", "financial", "network", "contacts", "services", "prescriptions", "exclusions", "otherCoveredServices", "legal", "languageAccess", "coverageExamples", "notices", "extractionWarnings"];
const attributeFieldOrder = [
  "documentType", "carrier", "planName", "planId", "groupName", "coverageStart", "coverageEnd", "coverageFor", "planType", "networkName", "market", "state", "fundingType", "metalTier", "hsaEligible",
  "deductible", "familyDeductibleRule", "servicesBeforeDeductible", "servicesBeforeDeductibleNotes", "specificDeductibles", "outOfPocketLimit", "familyOutOfPocketRule", "excludedFromOutOfPocket",
  "usesProviderNetwork", "outOfNetworkCoverage", "referralRequired", "referralNotes", "balanceBillingWarning", "emergencyCoverageNotes", "providerDirectoryUrl",
  "medicalEvent", "service", "inNetwork", "outOfNetwork", "networkTier", "cost", "deductibleApplies", "limitations", "preauthorization", "visitOrUnitLimit", "ageLimit", "rawNotes",
  "name", "description", "drugListUrl", "pharmacyNetworkNotes", "retailSupply", "mailOrderSupply", "retailCost", "mailOrderCost", "outOfNetworkCost", "priorAuthorizationNotes", "stepTherapyNotes", "specialtyDrugNotes", "tiers",
  "label", "organization", "phone", "email", "url", "purpose", "notes", "continuationRights", "grievanceAndAppealsRights", "minimumEssentialCoverage", "minimumValueStandard", "marketplaceNotes", "contacts",
  "language", "message", "scenario", "assumptions", "includedServices", "totalExampleCost", "memberPays", "deductibles", "copayments", "coinsurance", "limitsOrExclusions", "total", "heading", "text", "sourcePage", "sourcePages", "period", "individual", "family", "embeddedIndividual", "raw",
];
const orderedAttributeEntries = (value) => Object.entries(value).sort(([left], [right]) => {
  const leftIndex = attributeFieldOrder.indexOf(left), rightIndex = attributeFieldOrder.indexOf(right);
  if (leftIndex < 0 && rightIndex < 0) return left.localeCompare(right);
  if (leftIndex < 0) return 1;
  if (rightIndex < 0) return -1;
  return leftIndex - rightIndex;
});
const emptyArrayItems = {
  sourcePages: 1,
  servicesBeforeDeductible: "",
  excludedFromOutOfPocket: "",
  extractionWarnings: "",
  includedServices: "",
  specificDeductibles: { service: "", individual: null, family: null, notes: null },
  contacts: { label: "", organization: null, phone: null, email: null, url: null, purpose: null },
  inNetwork: { networkTier: "", cost: "", deductibleApplies: null, notes: null },
  outOfNetwork: { networkTier: "", cost: "", deductibleApplies: null, notes: null },
  tiers: { name: "", description: null, retailCost: null, mailOrderCost: null, outOfNetworkCost: null, deductibleApplies: null, limitations: null, sourcePage: 1 },
  exclusions: { service: "", notes: null, sourcePages: [] },
  otherCoveredServices: { service: "", limitations: null, sourcePages: [] },
  languageAccess: { language: "", message: "", phone: null, sourcePage: 1 },
  assumptions: { label: "", value: "" },
  coverageExamples: { name: "", scenario: "", assumptions: [], includedServices: [], totalExampleCost: null, memberPays: { deductibles: null, copayments: null, coinsurance: null, limitsOrExclusions: null, total: null }, sourcePage: 1 },
  notices: { heading: "", text: "", sourcePages: [] },
  services: { medicalEvent: "", service: "", inNetwork: [], outOfNetwork: [], limitations: null, preauthorization: null, visitOrUnitLimit: null, ageLimit: null, rawNotes: null, sourcePage: 1 },
};
const blankLike = (value) => {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankLike(item)]));
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return value === null ? null : "";
};
const replaceAtPath = (source, path, value) => {
  if (!path.length) return value;
  const next = structuredClone(source), parent = path.slice(0, -1).reduce((at, key) => at[key], next);
  parent[path.at(-1)] = value;
  return next;
};
const itemTitle = (item, index) =>
  item && typeof item === "object"
    ? item.service || item.name || item.label || item.language || item.heading || `Item ${index + 1}`
    : `Item ${index + 1}`;
function AttributeValueEditor({ label, value, path = [], change, templateKey }) {
  if (Array.isArray(value)) {
    const add = () => {
      const sample = value[0] !== undefined
        ? blankLike(value[0])
        : structuredClone(emptyArrayItems[templateKey || path.at(-1)] ?? "");
      change(path, [...value, sample]);
    };
    return (
      <div className="attributeArray">
        <div className="attributeArrayHead"><span>{label}</span><button type="button" className="outline attributeAdd" onClick={add}><Plus />Add</button></div>
        {value.length === 0 ? <small className="attributeEmpty">None</small> : value.map((item, index) => {
          const itemPath = [...path, index];
          if (item && typeof item === "object")
            return (
              <details className="attributeArrayItem" key={index}>
                <summary>{itemTitle(item, index)}<button type="button" aria-label={`Remove ${itemTitle(item, index)}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); change(path, value.filter((_, itemIndex) => itemIndex !== index)); }}><Trash2 /></button></summary>
                <AttributeValueEditor label="" value={item} path={itemPath} change={change} />
              </details>
            );
          return (
            <div className="attributePrimitiveRow" key={index}>
              <input value={item ?? ""} type={typeof item === "number" ? "number" : "text"} onChange={(event) => change(itemPath, typeof item === "number" ? Number(event.target.value) : event.target.value)} />
              <button type="button" aria-label={`Remove ${label} item`} onClick={() => change(path, value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button>
            </div>
          );
        })}
      </div>
    );
  }
  if (value && typeof value === "object")
    return (
      <div className={`attributeObject ${label ? "nested" : ""}`}>
        {label && <h4>{label}</h4>}
        <div className="attributeFields">
          {orderedAttributeEntries(value).map(([key, item]) => <AttributeValueEditor key={key} label={attributeLabel(key)} value={item} path={[...path, key]} change={change} />)}
        </div>
      </div>
    );
  if (typeof value === "boolean")
    return <label className="attributeBoolean"><input type="checkbox" checked={value} onChange={(event) => change(path, event.target.checked)} /><span>{label}</span></label>;
  const fieldKey = String(path.at(-1) || ""),
    nullableBoolean = value === null && /(?:eligible|required|applies|standard|participation|coverage|network)$/i.test(fieldKey),
    inputType = /email/i.test(fieldKey) ? "email" : /url|website/i.test(fieldKey) ? "url" : /phone/i.test(fieldKey) ? "tel" : "text";
  if (nullableBoolean)
    return (
      <label className="attributeField">
        <span>{label}</span>
        <select value="" onChange={(event) => change(path, event.target.value === "" ? null : event.target.value === "true")}>
          <option value="">Not specified</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  const long = typeof value === "string" && (value.length > 100 || /notes|rights|warning|text|message|limitations|rule/i.test(label));
  return (
    <label className={`attributeField ${long ? "long" : ""}`}>
      <span>{label}</span>
      {long
        ? <textarea value={value ?? ""} onChange={(event) => change(path, typeof value === "string" ? event.target.value : event.target.value || null)} />
        : <input type={typeof value === "number" ? "number" : inputType} value={value ?? ""} onChange={(event) => change(path, typeof value === "number" ? Number(event.target.value) : typeof value === "string" ? event.target.value : event.target.value || null)} />}
    </label>
  );
}
function PlanAttributeEditor({ companyId, plan }) {
  const [draft, setDraft] = useState({}),
    [dirty, setDirty] = useState({}),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(plan.attributes || {}))
        if (!dirty[key]) next[key] = structuredClone(value);
      return next;
    });
  }, [plan.attributes, dirty]);
  const keys = Object.keys(draft).sort((a, b) => attributeOrder.indexOf(a) - attributeOrder.indexOf(b));
  const changeGroup = (group, path, value) => {
    setDraft((current) => ({ ...current, [group]: replaceAtPath(current[group], path, value) }));
    setDirty((current) => ({ ...current, [group]: true }));
  };
  let save = async () => {
    try {
      await setDoc(
        doc(db, "benefitsCompanies", companyId, "plans", plan.id),
        { attributes: draft, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setDirty({});
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch (saveError) {
      setError(saveError.message || "Could not save attributes");
    }
  };
  return (
    <div className="attributeEditor">
      <div className="attributeEditorBar">
        <span>Live from Firestore · {keys.length} groups</span>
        <button className="companyAction compact" onClick={save} disabled={!Object.keys(dirty).length}>
          {saved ? <Check /> : <Save />}{saved ? "Saved" : "Save attributes"}
        </button>
      </div>
      {keys.length ? keys.map((key) => (
        <section className="attributeGroup" key={key}>
          <h3>{attributeLabel(key)}</h3>
          <AttributeValueEditor label="" value={draft[key]} templateKey={key} change={(path, value) => changeGroup(key, path, value)} />
        </section>
      )) : <div className="attributeWaiting"><LoaderCircle /><b>Waiting for extracted attributes</b></div>}
      {error && <p className="formError">{error}</p>}
    </div>
  );
}

function PeopleTab({ company, details, onUpdate }) {
  const [people, setPeople] = useState(() => details.people || []),
    [saved, setSaved] = useState(false),
    planOptions = Object.keys(company.benefits || {}).filter(
      (key) => company.benefits[key]?.plans?.length,
    );
  let add = () =>
      setPeople((items) => [
        ...items,
        { id: crypto.randomUUID(), name: "", role: "", plans: [] },
      ]),
    update = (id, key, value) =>
      setPeople((items) =>
        items.map((person) =>
          person.id === id ? { ...person, [key]: value } : person,
        ),
      ),
    save = async () => {
      await onUpdate({
        ...company,
        planDetails: { ...company.planDetails, people },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    };
  return (
    <section className="tabPanel peoplePanel">
      <div className="tabPanelHead">
        <div>
          <span>People in the company</span>
          <h2>Employees and benefit assignments</h2>
          <p>Track each person, their role, and the plans relevant to them.</p>
        </div>
        <div>
          <button className="outline" onClick={add}>
            <Plus /> Add person
          </button>
          <button className="companyAction compact" onClick={save}>
            {saved ? <Check /> : <Save />}
            {saved ? "Saved" : "Save people"}
          </button>
        </div>
      </div>
      {people.length === 0 ? (
        <button className="emptyTab" onClick={add}>
          <Users />
          <b>Add the first person</b>
          <span>People can be assigned to one or more benefit types.</span>
        </button>
      ) : (
        <div className="peopleList">
          {people.map((person) => (
            <article className="personRow" key={person.id}>
              <div className="personAvatar">
                {(person.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <label>
                <span>Name</span>
                <input
                  placeholder="Full name"
                  value={person.name}
                  onChange={(e) => update(person.id, "name", e.target.value)}
                />
              </label>
              <label>
                <span>Role</span>
                <input
                  placeholder="Role or title"
                  value={person.role}
                  onChange={(e) => update(person.id, "role", e.target.value)}
                />
              </label>
              <div className="planChecks">
                <span>Plans</span>
                <div>
                  {planOptions.map((plan) => (
                    <label key={plan}>
                      <input
                        type="checkbox"
                        checked={(person.plans || []).includes(plan)}
                        onChange={(e) =>
                          update(
                            person.id,
                            "plans",
                            e.target.checked
                              ? [...(person.plans || []), plan]
                              : (person.plans || []).filter((x) => x !== plan),
                          )
                        }
                      />
                      {plan[0].toUpperCase() + plan.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <button
                className="removePerson"
                aria-label="Remove person"
                onClick={() =>
                  setPeople((items) => items.filter((p) => p.id !== person.id))
                }
              >
                <Trash2 />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CarriersTab({ company, details, onUpdate }) {
  const [carriers, setCarriers] = useState(() =>
      structuredClone(details.carriers),
    ),
    [saved, setSaved] = useState(false),
    items = [
      ["medicalDental", "Medical / dental"],
      ["vision", "Vision"],
      ["lifeLtd", "Life / LTD"],
      ["eap", "Employee assistance program"],
    ];
  let update = (key, field, value) =>
      setCarriers((data) => ({
        ...data,
        [key]: { ...data[key], [field]: value },
      })),
    save = async () => {
      await onUpdate({
        ...company,
        planDetails: { ...company.planDetails, carriers },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    };
  return (
    <section className="tabPanel">
      <div className="tabPanelHead">
        <div>
          <span>Benefit partners</span>
          <h2>Carriers</h2>
          <p>These details flow directly into the generated booklet.</p>
        </div>
        <button className="companyAction compact" onClick={save}>
          {saved ? <Check /> : <Save />}
          {saved ? "Saved" : "Save carriers"}
        </button>
      </div>
      <div className="carrierGrid">
        {items.map(([key, label]) => (
          <article className="carrierEditor" key={key}>
            <div className="carrierTitle">
              <Globe2 />
              <b>{label}</b>
            </div>
            <Text
              label="Carrier name"
              value={carriers[key].name}
              change={(v) => update(key, "name", v)}
            />
            <Text
              label="Phone"
              value={carriers[key].phone}
              change={(v) => update(key, "phone", v)}
            />
            <Text
              label="Website"
              value={carriers[key].website}
              change={(v) => update(key, "website", v)}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function BookletTab({ generation, generating, generate }) {
  const pagesRef = useRef(null);
  let progress = generation.pageCount
      ? Math.round((generation.pages.length / generation.pageCount) * 86)
      : 0,
    statusLabel =
      generation.status === "rendering"
        ? "Rendering final PDF"
        : generation.status === "complete"
          ? "Booklet ready"
          : generation.status === "error"
            ? "Generation stopped"
            : "Generating booklet";
  if (generation.status === "rendering") progress = 94;
  if (generation.status === "complete") progress = 100;
  useEffect(() => {
    if (!generation.pages.length) return;
    let viewer = pagesRef.current,
      latest = viewer?.lastElementChild;
    requestAnimationFrame(() => {
      if (viewer && latest)
        viewer.scrollTo({
          top: latest.offsetTop - viewer.offsetTop,
          behavior: "smooth",
        });
    });
  }, [generation.pages.length]);
  const status =
    generation.status !== "idle" ? (
      <div
        className={`generationStatus ${generation.status === "complete" ? "complete" : ""} ${generation.status === "error" ? "error" : ""}`}
      >
        <div>
          {generation.status === "complete" ? (
            <Check />
          ) : generation.status === "error" ? (
            <AlertTriangle />
          ) : (
            <LoaderCircle />
          )}
          <span>
            <b>{statusLabel}</b>
            <small>{generation.message || "Preparing pages"}</small>
          </span>
        </div>
        <div className="progressTrack">
          <i style={{ width: `${progress}%` }} />
        </div>
        {generation.pdfUrl ? (
          <a
            className="companyAction"
            href={generation.pdfUrl}
            download={generation.filename || "benefits-guide.pdf"}
          >
            <Save />
            Download
          </a>
        ) : (
          <small className="generationCount">
            {generation.pages.length}/{generation.pageCount || 10}
          </small>
        )}
      </div>
    ) : null;
  return (
    <section className="tabPanel bookletPanel">
      {generation.status === "idle" ? (
        <div className="bookletEmpty">
          <button
            className="companyAction bookletGenerateLarge"
            onClick={generate}
          >
            <BookOpen />
            Generate booklet
          </button>
        </div>
      ) : generation.status === "complete" && generation.pdfUrl ? (
        <>
          {status}
          <div className="finalPdfViewer">
            <iframe
              title="Generated benefits booklet"
              src={`${generation.pdfUrl}#view=FitH&toolbar=1&navpanes=0`}
            />
          </div>
        </>
      ) : (
        <>
          {status}
          <div className="bookletPages" ref={pagesRef}>
            {generation.pages.map((page) => (
              <article className="bookletPage bookletPageOnly" key={page.index}>
                <iframe title={page.title} srcDoc={page.html} />
              </article>
            ))}
            {generating && (
              <article
                className={`bookletPage bookletPageOnly pageSkeleton streamTypingPage ${generation.draftCopy ? "copyDraftPage" : ""}`}
              >
                {generation.draftCopy ? (
                  <div className="copyDraftHtml">
                    <small>Employee benefits guide</small>
                    <h2>{generation.draftCopy.title}</h2>
                    <p>{generation.draftCopy.text}</p>
                    <i />
                  </div>
                ) : (
                  <div
                    className="typesettingShimmer"
                    aria-label="Typesetting page"
                  >
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </article>
            )}
            {generation.error && (
              <article className="bookletPage bookletPageOnly pageSkeleton streamTypingPage error">
                <div>
                  <span>{generation.error}</span>
                </div>
              </article>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function CompanyOverview({ company, details, onUpdate }) {
  const [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false),
    [draft, setDraft] = useState(null);
  let start = () => {
      setDraft({
        description: company.description || "",
        website: company.website || "",
        industry: company.industry || "",
        headquarters: company.headquarters || "",
        employeeCount: company.employeeCount || 0,
        cover: details.employer.cover || company.name,
        legal: details.employer.legal || "",
        short: details.employer.short || "",
        phone: company.phone || "",
        email: company.email || "",
      });
      setEditing(true);
    },
    change = (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    save = async () => {
      setSaving(true);
      let employer = {
        ...details.employer,
        cover: draft.cover,
        legal: draft.legal,
        short: draft.short,
      };
      await onUpdate({
        ...company,
        description: draft.description,
        website: draft.website,
        industry: draft.industry,
        headquarters: draft.headquarters,
        employeeCount: +draft.employeeCount,
        phone: draft.phone,
        email: draft.email,
        planDetails: { ...company.planDetails, employer },
      });
      setSaving(false);
      setEditing(false);
    },
    site = company.website || "",
    description = company.description || "No company description has been added.",
    facts = [
      company.industry || null,
      company.headquarters || null,
      company.employeeCount ? `${company.employeeCount} employees` : null,
    ].filter(Boolean);
  if (editing)
    return (
      <section className="companyOverview overviewEditing">
        <div className="overviewEditHead">
          <div>
            <span>Company overview</span>
            <h2>Edit company information</h2>
          </div>
          <small>Changes save directly to this company.</small>
        </div>
        <div className="overviewForm">
          <Text
            label="Cover name"
            value={draft.cover}
            change={(v) => change("cover", v)}
          />
          <Text
            label="Legal name"
            value={draft.legal}
            change={(v) => change("legal", v)}
          />
          <Text
            label="Short name"
            value={draft.short}
            change={(v) => change("short", v)}
          />
          <Text
            label="Industry"
            value={draft.industry}
            change={(v) => change("industry", v)}
          />
          <Text
            wide
            label="Headquarters / service area"
            value={draft.headquarters}
            change={(v) => change("headquarters", v)}
          />
          <label className="detailField wide">
            <span>Description</span>
            <textarea
              rows="3"
              value={draft.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <Text
            wide
            label="Website"
            value={draft.website}
            change={(v) => change("website", v)}
          />
          <Text
            label="Main phone"
            value={draft.phone}
            change={(v) => change("phone", v)}
          />
          <Text
            label="General email"
            value={draft.email}
            change={(v) => change("email", v)}
          />
          <Text
            type="number"
            label="Employee count"
            value={draft.employeeCount}
            change={(v) => change("employeeCount", v)}
          />
        </div>
        <div className="overviewActions">
          <button className="outline" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button className="primary" disabled={saving} onClick={save}>
            {saving ? <LoaderCircle /> : <Save />}
            {saving ? "Saving" : "Save overview"}
          </button>
        </div>
      </section>
    );
  return (
    <section className="companyOverview">
      <div className="overviewIcon">
        <Building2 />
      </div>
      <div className="overviewCopy">
        <span>Company overview</span>
        <h2>{details.employer.cover || company.name}</h2>
        {details.employer.legal &&
          details.employer.legal !==
            (details.employer.cover || company.name) && (
            <small className="legalName">{details.employer.legal}</small>
          )}
        <p>{description}</p>
        <div className="overviewFacts">
          {facts.map((fact, i) => (
            <b key={`${fact}-${i}`}>{fact}</b>
          ))}
          {site && <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noreferrer"><Globe2 />{site.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
        </div>
        {(company.phone || company.email) && <div className="overviewContacts">
          {company.phone && <span><Phone />{company.phone}</span>}
          {company.email && <span><Mail />{company.email}</span>}
        </div>}
      </div>
      <button className="overviewEdit" onClick={start}>
        <Settings2 />
        Edit
      </button>
    </section>
  );
}

function DetailsDrawer({ company, close, onUpdate }) {
  const [data, setData] = useState(() => mergeDetails(company.planDetails)),
    [overview, setOverview] = useState({
      description: company.description || "",
      website: company.website || "",
      industry: company.industry || "",
      headquarters: company.headquarters || "",
      employeeRange: company.employeeRange || "",
      employeeCount: company.employeeCount || 0,
    }),
    [saved, setSaved] = useState(false);
  let set = (path, value) =>
      setData((d) => {
        let n = structuredClone(d),
          parts = path.split("."),
          at = n;
        parts.slice(0, -1).forEach((k) => (at = at[k]));
        at[parts.at(-1)] = value;
        return n;
      }),
    setOverviewField = (key, value) =>
      setOverview((o) => ({ ...o, [key]: value })),
    save = async () => {
      await onUpdate({ ...company, ...overview, planDetails: data });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    },
    addBullet = () =>
      set("enrollment.whatsNew", [...data.enrollment.whatsNew, ""]),
    addHra = () =>
      set("accounts.hraContributions", [
        ...data.accounts.hraContributions,
        { tier: "", amount: 0 },
      ]);
  return (
    <div
      className="drawerBackdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <aside className="detailsDrawer">
        <div className="drawerHead">
          <div>
            <span>Company profile</span>
            <h2>Benefits guide details</h2>
            <p>Supporting information used alongside the plan tables.</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <div className="drawerBody">
          <DetailSection title="Company overview">
            <div className="formGrid">
              <label className="detailField wide">
                <span>Description</span>
                <textarea
                  rows="3"
                  placeholder="A concise description of the company"
                  value={overview.description}
                  onChange={(e) =>
                    setOverviewField("description", e.target.value)
                  }
                />
              </label>
              <Text
                wide
                label="Website"
                value={overview.website}
                change={(v) => setOverviewField("website", v)}
              />
              <Text
                label="Industry"
                value={overview.industry}
                change={(v) => setOverviewField("industry", v)}
              />
              <Text
                label="Headquarters"
                value={overview.headquarters}
                change={(v) => setOverviewField("headquarters", v)}
              />
              <Text
                label="Employee range"
                value={overview.employeeRange}
                change={(v) => setOverviewField("employeeRange", v)}
              />
              <Text
                type="number"
                label="Employee count"
                value={overview.employeeCount}
                change={(v) => setOverviewField("employeeCount", +v)}
              />
            </div>
          </DetailSection>
          <DetailSection title="Employer & plan year">
            <div className="formGrid">
              <Text
                label="Cover name"
                value={data.employer.cover}
                change={(v) => set("employer.cover", v)}
              />
              <Text
                label="Legal name"
                value={data.employer.legal}
                change={(v) => set("employer.legal", v)}
              />
              <Text
                label="Short name"
                value={data.employer.short}
                change={(v) => set("employer.short", v)}
              />
              <Text
                type="date"
                label="Plan year starts"
                value={data.planYear.start}
                change={(v) => set("planYear.start", v)}
              />
              <Text
                type="date"
                label="Plan year ends"
                value={data.planYear.end}
                change={(v) => set("planYear.end", v)}
              />
            </div>
          </DetailSection>
          <DetailSection title="Open enrollment">
            <div className="formGrid">
              <Text
                type="date"
                label="Enrollment starts"
                value={data.enrollment.start}
                change={(v) => set("enrollment.start", v)}
              />
              <Text
                type="date"
                label="Enrollment ends"
                value={data.enrollment.end}
                change={(v) => set("enrollment.end", v)}
              />
              <Text
                wide
                label="Enrollment meeting"
                placeholder="Date, time, location or link"
                value={data.enrollment.meeting}
                change={(v) => set("enrollment.meeting", v)}
              />
            </div>
            <EditableRows
              title="What's new"
              rows={data.enrollment.whatsNew}
              add={addBullet}
              change={(i, v) =>
                set(
                  "enrollment.whatsNew",
                  data.enrollment.whatsNew.map((x, j) => (j === i ? v : x)),
                )
              }
              remove={(i) =>
                set(
                  "enrollment.whatsNew",
                  data.enrollment.whatsNew.filter((_, j) => j !== i),
                )
              }
            />
          </DetailSection>
          <DetailSection title="People">
            <ContactFields
              title="Enrollment contact"
              data={data.contacts.enrollment}
              base="contacts.enrollment"
              set={set}
            />
            <ContactFields
              title="HR contact"
              data={data.contacts.hr}
              base="contacts.hr"
              set={set}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={data.contacts.voluntary.offered}
                onChange={(e) =>
                  set("contacts.voluntary.offered", e.target.checked)
                }
              />
              Voluntary benefits offered
            </label>
            {data.contacts.voluntary.offered && (
              <ContactFields
                title="Voluntary benefits rep"
                data={data.contacts.voluntary}
                base="contacts.voluntary"
                set={set}
              />
            )}
          </DetailSection>
          <DetailSection title="Carriers">
            <p className="sectionHint">
              EAP contact details are managed once here and reused wherever the
              guide needs them.
            </p>
            {[
              ["medicalDental", "Medical / dental"],
              ["vision", "Vision"],
              ["lifeLtd", "Life / LTD"],
              ["eap", "EAP"],
            ].map(([key, label]) => (
              <VendorFields
                key={key}
                title={label}
                data={data.carriers[key]}
                base={`carriers.${key}`}
                set={set}
              />
            ))}
          </DetailSection>
          <DetailSection title="Telemedicine">
            <div className="formGrid">
              <Text
                label="App"
                value={data.telemedicine.app}
                change={(v) => set("telemedicine.app", v)}
              />
              <Text
                label="Phone"
                value={data.telemedicine.phone}
                change={(v) => set("telemedicine.phone", v)}
              />
              <Text
                label="Text"
                value={data.telemedicine.text}
                change={(v) => set("telemedicine.text", v)}
              />
              <Text
                wide
                label="Website"
                value={data.telemedicine.website}
                change={(v) => set("telemedicine.website", v)}
              />
            </div>
          </DetailSection>
          <DetailSection title="FSA / HRA">
            <div className="formGrid">
              <Text
                label="Administrator"
                value={data.accounts.administrator}
                change={(v) => set("accounts.administrator", v)}
              />
              <label className="detailField">
                <span>Account type</span>
                <select
                  value={data.accounts.type}
                  onChange={(e) => set("accounts.type", e.target.value)}
                >
                  <option value="">Not offered</option>
                  <option>FSA</option>
                  <option>HRA</option>
                  <option>FSA + HRA</option>
                </select>
              </label>
            </div>
            {data.accounts.type.includes("HRA") && (
              <HraRows
                rows={data.accounts.hraContributions}
                add={addHra}
                set={set}
              />
            )}
          </DetailSection>
        </div>
        <div className="drawerFoot">
          <button className="outline" onClick={close}>
            Cancel
          </button>
          <button className="primary" onClick={save}>
            {saved ? <Check /> : <Save />}
            {saved ? "Saved" : "Save details"}
          </button>
        </div>
      </aside>
    </div>
  );
}
function DetailSection({ title, children }) {
  return (
    <section className="detailSection">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Text({ label, value, change, type = "text", wide, placeholder }) {
  return (
    <label className={`detailField ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder || ""}
        value={value || ""}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}
function ContactFields({ title, data, base, set }) {
  return (
    <div className="fieldGroup">
      <b>{title}</b>
      <div className="formGrid">
        <Text
          label="Name"
          value={data.name}
          change={(v) => set(`${base}.name`, v)}
        />
        <Text
          label="Phone"
          value={data.phone}
          change={(v) => set(`${base}.phone`, v)}
        />
        <Text
          wide
          label="Email"
          value={data.email}
          change={(v) => set(`${base}.email`, v)}
        />
      </div>
    </div>
  );
}
function VendorFields({ title, data, base, set }) {
  return (
    <div className="fieldGroup">
      <b>{title}</b>
      <div className="formGrid">
        <Text
          label="Carrier name"
          value={data.name}
          change={(v) => set(`${base}.name`, v)}
        />
        <Text
          label="Phone"
          value={data.phone}
          change={(v) => set(`${base}.phone`, v)}
        />
        <Text
          wide
          label="Website"
          value={data.website}
          change={(v) => set(`${base}.website`, v)}
        />
      </div>
    </div>
  );
}
function EditableRows({ title, rows, add, change, remove }) {
  return (
    <div className="editableRows">
      <div>
        <b>{title}</b>
        <button onClick={add}>
          <Plus />
          Add
        </button>
      </div>
      {rows.map((v, i) => (
        <div key={i}>
          <input
            placeholder="Add a concise change for employees"
            value={v}
            onChange={(e) => change(i, e.target.value)}
          />
          <button aria-label="Remove" onClick={() => remove(i)}>
            <Trash2 />
          </button>
        </div>
      ))}
    </div>
  );
}
function HraRows({ rows, add, set }) {
  return (
    <div className="editableRows hraRows">
      <div>
        <b>HRA contribution table</b>
        <button onClick={add}>
          <Plus />
          Add tier
        </button>
      </div>
      {rows.map((r, i) => (
        <div key={i}>
          <input
            placeholder="Tier (e.g. Employee only)"
            value={r.tier}
            onChange={(e) =>
              set(
                "accounts.hraContributions",
                rows.map((x, j) =>
                  j === i ? { ...x, tier: e.target.value } : x,
                ),
              )
            }
          />
          <label>
            $
            <input
              type="number"
              value={r.amount}
              onChange={(e) =>
                set(
                  "accounts.hraContributions",
                  rows.map((x, j) =>
                    j === i ? { ...x, amount: +e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <button
            aria-label="Remove"
            onClick={() =>
              set(
                "accounts.hraContributions",
                rows.filter((_, j) => j !== i),
              )
            }
          >
            <Trash2 />
          </button>
        </div>
      ))}
    </div>
  );
}
function Plans({ company, type, onUpdate }) {
  let benefit = company.benefits[type],
    [pays, setPays] = useState(52),
    [data, setData] = useState(benefit.plans);
  let currentPlanIndex = data.reduce(
    (latest, plan, index) =>
      latest === -1 || Number(plan.year) > Number(data[latest].year)
        ? index
        : latest,
    -1,
  );
  let current = useMemo(
    () =>
      currentPlanIndex === -1
        ? []
        : [calculate(data[currentPlanIndex], pays)],
    [data, pays, currentPlanIndex],
  );
  let update = (_pi, ri, key, v) =>
    setData((ds) =>
      ds.map((p, i) =>
        i !== currentPlanIndex
          ? p
          : {
              ...p,
              tiers: p.tiers.map((r, j) => (j !== ri ? r : { ...r, [key]: v })),
            },
      ),
    );
  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(benefit.plans)) return;
    let timer = setTimeout(
      () =>
        onUpdate({
          ...company,
          benefits: {
            ...company.benefits,
            [type]: { ...benefit, plans: data },
          },
        }),
      600,
    );
    return () => clearTimeout(timer);
  }, [data]);
  return (
    <div className="inlinePlans">
      <div className="pageHead">
        <Title
          eyebrow={`${company.name} · ${type}`}
          title={`${type[0].toUpperCase() + type.slice(1)} costs`}
          sub={`Edit highlighted fields for the ${current[0]?.year || "current"} plan year.`}
        />
        <div className="controls">
          <label>
            Pay periods
            <select value={pays} onChange={(e) => setPays(+e.target.value)}>
              <option>52</option>
              <option>26</option>
              <option>24</option>
              <option>12</option>
            </select>
          </label>
        </div>
      </div>
      <Comparison plans={current} update={update} />
    </div>
  );
}
function Comparison({ plans, update }) {
  let selectedPlan = plans[0];
  if (!selectedPlan) return null;
  return (
    <>
      <section className="stats">
        <Stat label="Annual premium" value={fmt(selectedPlan.total)} />
        <Stat label="Employer annual cost" value={fmt(selectedPlan.er)} />
        <Stat label="Employee annual cost" value={fmt(selectedPlan.ee)} />
        <Stat label="Total enrolled" value={selectedPlan.enrolled} />
      </section>
      <section className="tableCard">
        <div className="tableTitle">
          <div>
            <h2>{selectedPlan.year} Cost Summary</h2>
            <p>
              Premium, employer percentage, and enrollment fields are editable for this year.
            </p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Tier</th>
              <th>Monthly premium</th>
              <th>ER cost</th>
              <th>EE cost</th>
              <th>EE per pay</th>
              <th>ER %</th>
              <th># enrolled</th>
              <th>ER annual</th>
              <th>EE annual</th>
              <th>Total annual premium</th>
            </tr>
          </thead>
          <tbody>
            {[selectedPlan].flatMap((p) => [
              ...p.rows.map((r, ri) => (
                <tr key={`${p.year}-${r.tier}`}>
                  <td>{ri === 0 ? <b>{p.name}</b> : ""}</td>
                  <td>{r.tier}</td>
                  <td>
                    <NumberField
                      prefix="$"
                      value={r.premium}
                      change={(v) => update(0, ri, "premium", v)}
                    />
                  </td>
                  <td>{fmt2(r.er)}</td>
                  <td>{fmt2(r.ee)}</td>
                  <td>{fmt2(r.perPay)}</td>
                  <td>
                    <NumberField
                      suffix="%"
                      value={Math.round(r.erPercent * 10000) / 100}
                      change={(v) => update(0, ri, "erPercent", v / 100)}
                    />
                  </td>
                  <td>
                    <NumberField
                      value={r.enrolled}
                      change={(v) => update(0, ri, "enrolled", v)}
                    />
                  </td>
                  <td>{fmt(r.erAnnual)}</td>
                  <td>{fmt(r.eeAnnual)}</td>
                  <td>
                    <b>{fmt(r.total)}</b>
                  </td>
                </tr>
              )),
              <tr className="total" key={`${p.year}-total`}>
                <td>{p.year} total</td>
                <td colSpan="6"></td>
                <td>{p.enrolled}</td>
                <td>{fmt(p.er)}</td>
                <td>{fmt(p.ee)}</td>
                <td>{fmt(p.total)}</td>
              </tr>,
            ])}
          </tbody>
        </table>
      </section>
    </>
  );
}
function NumberField({ value, change, prefix, suffix }) {
  return (
    <label className="number">
      {prefix}
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => change(+e.target.value)}
      />
      {suffix}
    </label>
  );
}
function Title({ eyebrow, title, sub }) {
  return (
    <div className="title">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}
function Back({ onClick }) {
  return (
    <button className="back" onClick={onClick}>
      <ArrowLeft />
      Back
    </button>
  );
}
function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b className={tone || ""}>{value}</b>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
