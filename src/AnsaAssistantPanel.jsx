import React, { useEffect, useState } from "react";
import { LoaderCircle, Mail, Pause, Play, ShieldCheck } from "lucide-react";
import { auth } from "./firebase";
import {
  authedFetch,
  signInWithGoogle,
  startGmailOAuth,
  watchAuthUser,
} from "./assistantAuth";
import "./assistantSettings.css";

export default function AnsaAssistantPanel({ companies = [], onClose }) {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState(null);
  const [gmailConnections, setGmailConnections] = useState([]);
  const [research, setResearch] = useState([]);
  const [audit, setAudit] = useState([]);
  const [approvals, setApprovals] = useState([]);

  const isGoogleUser = Boolean(user && !user.isAnonymous);

  useEffect(() => watchAuthUser(setUser), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("assistant") === "connected") {
      setNotice("Gmail connected. Ansa now answers client emails for you.");
    }
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const settingsPayload = await authedFetch("/api/broker-assistant/settings");
      setSettings(settingsPayload.settings);
      setGmailConnections(settingsPayload.gmailConnections || []);
      try {
        const researchPayload = await authedFetch(
          "/api/broker-assistant/research?status=open",
        );
        setResearch(researchPayload.research || []);
        setAudit(researchPayload.audit || []);
        setApprovals(researchPayload.approvals || []);
      } catch {
        setResearch([]);
        setAudit([]);
        setApprovals([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load assistant settings (is BROKER_ASSISTANT_EMAIL enabled?)",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [user?.uid]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (() => {
    if (!settings?.enabled) return "Off";
    if (settings.paused) return "Paused";
    if (settings.gmailEmail || gmailConnections.length) return "On · Gmail";
    return "On · connect Gmail";
  })();

  return (
    <div className="aaPanel">
      <header className="aaHeader">
        <div>
          <p className="aaEyebrow">Ansa Assistant</p>
          <h2>Email Q&amp;A for your clients</h2>
          <p className="aaSub">
            Sign in, connect Gmail, and Ansa answers client emails automatically.
            When it isn&apos;t sure, it emails you an approve/deny request instead.
          </p>
        </div>
        <span className={`aaChip ${settings?.enabled && !settings?.paused ? "on" : ""}`}>
          {statusLabel}
        </span>
      </header>

      {notice ? <p className="aaNotice">{notice}</p> : null}
      {error ? <p className="aaError">{error}</p> : null}
      {loading ? (
        <p className="aaBusy">
          <LoaderCircle className="spin" size={16} /> Loading…
        </p>
      ) : (
        <>
          <section className="aaCard">
            <h3>1. Account</h3>
            {isGoogleUser ? (
              <p>
                Signed in as <b>{user.displayName || user.email}</b>
              </p>
            ) : (
              <button
                type="button"
                className="aaPrimary"
                disabled={busy}
                onClick={() => run(async () => signInWithGoogle())}
              >
                <ShieldCheck size={16} /> Continue with Google
              </button>
            )}
          </section>

          <section className="aaCard">
            <h3>2. Connect Gmail</h3>
            <p className="aaMuted">
              One click grants Ansa access to watch your inbox and reply on your
              behalf. Confident answers go out automatically; anything uncertain
              comes to you first as an approve/deny email.
            </p>
            {gmailConnections[0]?.email || settings?.gmailEmail ? (
              <p>
                Connected: <b>{gmailConnections[0]?.email || settings?.gmailEmail}</b>
              </p>
            ) : null}
            <button
              type="button"
              className="aaPrimary"
              disabled={busy || !isGoogleUser}
              onClick={() =>
                run(async () => {
                  await startGmailOAuth(
                    `${window.location.pathname}?settings=assistant`,
                  );
                })
              }
            >
              <Mail size={16} /> {settings?.gmailEmail ? "Reconnect Gmail" : "Connect Gmail"}
            </button>
          </section>

          <section className="aaCard">
            <h3>3. Assistant</h3>
            <div className="aaRow">
              <button
                type="button"
                disabled={busy || (!settings?.gmailEmail && !gmailConnections.length)}
                onClick={() =>
                  run(async () => {
                    await authedFetch("/api/broker-assistant/settings", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "enable_watch",
                        brokerDisplayName: user?.displayName || undefined,
                      }),
                    });
                    setNotice("Assistant watching Gmail for client questions.");
                  })
                }
              >
                <Play size={16} /> Turn on
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await authedFetch("/api/broker-assistant/settings", {
                      method: "POST",
                      body: JSON.stringify({
                        action: settings?.paused ? "resume" : "pause",
                      }),
                    });
                  })
                }
              >
                {settings?.paused ? <Play size={16} /> : <Pause size={16} />}
                {settings?.paused ? "Resume" : "Pause"}
              </button>
            </div>
            <label className="aaCompanies">
              Companies Ansa may answer for
              <select
                multiple
                value={settings?.allowedCompanyIds || []}
                onChange={(event) => {
                  const values = [...event.target.selectedOptions].map((o) => o.value);
                  void run(async () => {
                    await authedFetch("/api/broker-assistant/settings", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "save",
                        allowedCompanyIds: values,
                      }),
                    });
                  });
                }}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <small>Leave empty for all companies. Hold Ctrl/Cmd to multi-select.</small>
            </label>
          </section>

          <section className="aaCard">
            <h3>Waiting on you</h3>
            {!approvals.length ? (
              <p className="aaMuted">
                Nothing pending — Ansa is handling replies on its own.
              </p>
            ) : (
              <ul className="aaList">
                {approvals.map((item) => (
                  <li key={item.id}>
                    <div>
                      <b>{item.companyName || "Unknown company"}</b>
                      <small>{item.clientSubject || "(no subject)"}</small>
                      <p>{item.brokerQuestion}</p>
                    </div>
                    <div className="aaRow">
                      {item.approvalThreadId ? (
                        <a
                          href={`https://mail.google.com/mail/u/0/#inbox/${item.approvalThreadId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Reply in Gmail (Approve / Deny)
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="aaCard">
            <h3>Needs research</h3>
            {!research.length ? (
              <p className="aaMuted">No open research items.</p>
            ) : (
              <ul className="aaList">
                {research.map((item) => (
                  <li key={item.id}>
                    <div>
                      <b>{item.companyName || "Unknown company"}</b>
                      <small>{item.subject}</small>
                      <p>{item.questionSnippet}</p>
                    </div>
                    <div className="aaRow">
                      {item.gmailPermalink ? (
                        <a href={item.gmailPermalink} target="_blank" rel="noreferrer">
                          Open in Gmail
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          run(async () => {
                            await authedFetch("/api/broker-assistant/research", {
                              method: "POST",
                              body: JSON.stringify({ id: item.id, status: "done" }),
                            });
                          })
                        }
                      >
                        Mark done
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="aaCard">
            <h3>Recent activity</h3>
            {!audit.length ? (
              <p className="aaMuted">No activity yet.</p>
            ) : (
              <ul className="aaList aaList--compact">
                {audit.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    <span>
                      {item.action === "auto_sent"
                        ? "Sent automatically"
                        : item.action === "escalated"
                          ? "Asked you first"
                          : item.action === "approval_approved"
                            ? "You approved · sent"
                            : item.action === "approval_denied"
                              ? "You denied · held"
                              : item.action === "approval_answered"
                                ? "Sent your answer"
                                : "Draft"}
                      {" · "}conf {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {onClose ? (
        <button type="button" className="aaClose" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  );
}

export function assistantStatusShort(settings) {
  if (!settings?.enabled) return "Assistant: Off";
  if (settings.paused) return "Assistant: Paused";
  if (settings.gmailEmail) return "Assistant: On · Gmail";
  return "Assistant: Setup";
}
