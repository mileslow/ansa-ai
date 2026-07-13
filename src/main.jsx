import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2,
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
  LayoutGrid,
  Settings,
  PanelLeft,
} from "lucide-react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import AddCompany from "./AddCompany";
import "./styles.css";
import "./inline.css";
import "./add-company.css";
import "./generation.css";
import "./design-system.css";
import "./clean-pass.css";
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
    getDocs(
      query(collection(db, "benefitsCompanies"), orderBy("renewalDate", "asc")),
    )
      .then((s) => setCompanies(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .finally(() => setLoading(false));
    return () => removeEventListener("popstate", f);
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
      <Sidebar
        company={company}
        directoryActive={route.length === 0}
        onHome={() => go("/", setRoute)}
      />
      <div className="appContent">
        <div className="mobileBar">
          <PanelLeft />
          <b>ansa</b>
        </div>
        {route.length === 0 ? (
          <Directory
            companies={ordered}
            add={add}
            open={(id) => go(`/companies/${id}`, setRoute)}
          />
        ) : company ? (
          <Company
            company={company}
            onUpdate={update}
            back={() => go("/", setRoute)}
          />
        ) : (
          <Directory
            companies={ordered}
            add={add}
            open={(id) => go(`/companies/${id}`, setRoute)}
          />
        )}
      </div>
    </div>
  );
}
function Sidebar({ onHome, company, directoryActive }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={onHome} aria-label="ansa home">
        <b>ansa</b>
      </button>
      <nav className="sidebarNav" aria-label="Main navigation">
        <small>Workspace</small>
        <button className={directoryActive ? "active" : ""} onClick={onHome}>
          <LayoutGrid />
          Companies
        </button>
        {company && (
          <div className="sidebarCompany">
            <span>{company.name.slice(0, 1)}</span>
            <div>
              <b>{company.name}</b>
              <small>{company.renewalLabel}</small>
            </div>
          </div>
        )}
      </nav>
      <div className="sidebarFoot">
        <button><Settings />Settings</button>
        <span>Benefits workspace</span>
      </div>
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
        "Medical coverage and contribution comparison",
      ],
      [
        "dental",
        "Dental",
        Smile,
        "Dental coverage and contribution comparison",
      ],
      ["vision", "Vision", Eye, "Vision coverage and contribution comparison"],
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
          eyebrow="Company workspace"
          title={details.employer.short || company.name}
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
          ["booklet", "Booklet"],
          ["people", "People"],
          ["carriers", "Carriers"],
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
        <>
          <div className="benefitStack">
            {cards.map(([key, name, Icon, sub]) => {
              let active = !!company.benefits?.[key],
                open = expanded === key;
              return (
                <button
                  key={key}
                  className={`benefitCard ${active ? "" : "disabled"} ${open ? "selected" : ""}`}
                  onClick={() => active && setExpanded(open ? null : key)}
                >
                  <span className={`benefitIcon ${key}`}>
                    <Icon />
                  </span>
                  <div>
                    <b>{name}</b>
                    <p>{sub}</p>
                    {active ? (
                      <span>
                        {company.benefits[key].years.join(" vs ")} ·{" "}
                        {open ? "Hide comparison" : "View comparison"}
                      </span>
                    ) : (
                      <span>Not offered</span>
                    )}
                  </div>
                  {active && <ChevronRight />}
                </button>
              );
            })}
          </div>
          {expanded && (
            <div className="expandedForm">
              <Plans
                key={expanded}
                company={company}
                type={expanded}
                onUpdate={onUpdate}
              />
            </div>
          )}
        </>
      )}
      {activeTab === "people" && (
        <PeopleTab company={company} details={details} onUpdate={onUpdate} />
      )}
      {activeTab === "carriers" && (
        <CarriersTab company={company} details={details} onUpdate={onUpdate} />
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
        <div className="finalPdfViewer">
          <iframe
            title="Generated benefits booklet"
            src={`${generation.pdfUrl}#view=FitH&toolbar=1&navpanes=0`}
          />
        </div>
      ) : (
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
          {site && (
            <a
              href={site.startsWith("http") ? site : `https://${site}`}
              target="_blank"
              rel="noreferrer"
            >
              <Globe2 />
              {site.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </div>
        {(company.phone || company.email) && (
          <div className="overviewContacts">
            {company.phone && <span><Phone />{company.phone}</span>}
            {company.email && <span><Mail />{company.email}</span>}
          </div>
        )}
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
  let current = useMemo(
    () => data.map((p) => calculate(p, pays)),
    [data, pays],
  );
  let update = (pi, ri, key, v) =>
    setData((ds) =>
      ds.map((p, i) =>
        i !== pi
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
          title={`${type[0].toUpperCase() + type.slice(1)} year-over-year`}
          sub="Edit highlighted fields to compare the current renewal against the prior year."
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
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(plans.length - 1, 0),
  );
  let all = plans.reduce(
    (a, p) => ({
      er: a.er + p.er,
      ee: a.ee + p.ee,
      total: a.total + p.total,
      enrolled: a.enrolled + p.enrolled,
    }),
    { er: 0, ee: 0, total: 0, enrolled: 0 },
  );
  let last = plans[0],
    now = plans[1] || plans[0],
    delta = now.total - last.total,
    selectedPlan = plans[selectedIndex] || now;
  return (
    <>
      <section className="stats">
        <Stat label="Current annual premium" value={fmt(now.total)} />
        <Stat label="Prior annual premium" value={fmt(last.total)} />
        <Stat
          label="Annual difference"
          value={`${delta >= 0 ? "+" : ""}${fmt(delta)}`}
          tone={delta > 0 ? "up" : "down"}
        />
        <Stat
          label="Premium change"
          value={`${last.total ? ((delta / last.total) * 100).toFixed(1) : "0.0"}%`}
          tone={delta > 0 ? "up" : "down"}
        />
      </section>
      <section className="comparisonPanel">
        <div className="yearTabs" role="tablist" aria-label="Plan year">
          {plans.map((plan, index) => (
            <button
              key={`${plan.year}-${index}`}
              role="tab"
              aria-selected={selectedIndex === index}
              className={selectedIndex === index ? "active" : ""}
              onClick={() => setSelectedIndex(index)}
            >
              {plan.year}
            </button>
          ))}
        </div>
        <CostComparisonChart plans={plans} />
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
                      change={(v) => update(selectedIndex, ri, "premium", v)}
                    />
                  </td>
                  <td>{fmt2(r.er)}</td>
                  <td>{fmt2(r.ee)}</td>
                  <td>{fmt2(r.perPay)}</td>
                  <td>
                    <NumberField
                      suffix="%"
                      value={Math.round(r.erPercent * 10000) / 100}
                      change={(v) => update(selectedIndex, ri, "erPercent", v / 100)}
                    />
                  </td>
                  <td>
                    <NumberField
                      value={r.enrolled}
                      change={(v) => update(selectedIndex, ri, "enrolled", v)}
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
function CostComparisonChart({ plans }) {
  const metrics = [
      ["Total premium", "total"],
      ["Employer cost", "er"],
      ["Employee cost", "ee"],
    ],
    max = Math.max(...plans.flatMap((plan) => metrics.map(([, key]) => plan[key] || 0)), 1);
  return (
    <div className="costChart" aria-label="Year-over-year annual cost comparison">
      <div className="costChartHead">
        <div>
          <h2>Annual cost comparison</h2>
          <p>Employer and employee contributions by plan year.</p>
        </div>
        <div className="chartLegend">
          {plans.map((plan, index) => (
            <span key={`${plan.year}-legend`}><i data-series={index} />{plan.year}</span>
          ))}
        </div>
      </div>
      <div className="chartRows">
        {metrics.map(([label, key]) => (
          <div className="chartRow" key={key}>
            <span>{label}</span>
            <div className="chartBars">
              {plans.map((plan, index) => (
                <div className="chartBarLine" key={`${key}-${plan.year}`}>
                  <i data-series={index} style={{ width: `${((plan[key] || 0) / max) * 100}%` }} />
                  <b>{fmt(plan[key])}</b>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
