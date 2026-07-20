import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  LoaderCircle,
  Mic,
  MicOff,
  Send,
  Sparkles,
} from "lucide-react";
import { getBookletAuthToken } from "./firebase";
import "./brokerAgentDemo.css";

const PREVIEW_SCRIPT = [
  {
    role: "assistant",
    text: "Hi — I’m Ansa. Tell me which employer booklet you want and how to customize it. I’ll find the sources myself — no uploads, no “check my email.”",
  },
  {
    role: "user",
    text: "Build Acme’s 2026 benefits booklet.",
  },
  {
    role: "assistant",
    text: "On it — pulling Acme sources from your company library and mailboxes automatically…",
    tools: [
      { name: "auto_gather_sources", detail: "library + Gmail · rates · SBC · prior booklet" },
      { name: "attach_sources", detail: "3 files attached" },
    ],
  },
  {
    role: "assistant",
    text: "I found last year’s booklet, the May Anthem rate sheet, and an SBC. Want any tweaks before I generate?",
  },
  {
    role: "user",
    text: "Keep it concise, skip voluntary life, and email the PDF to hr@acme.com when it’s ready.",
  },
  {
    role: "assistant",
    text: "Preferences saved. Starting the booklet run…",
    tools: [
      { name: "set_booklet_preferences", detail: "concise · omit voluntary life" },
      { name: "start_booklet_run", detail: "run queued" },
    ],
  },
  {
    role: "assistant",
    text: "Your source-backed booklet is ready. I can send it to hr@acme.com — confirm and I’ll deliver the PDF.",
    pdfReady: true,
    awaitingConfirm: true,
  },
];

function PreviewBubble({ message }) {
  return (
    <div className={`baMsg baMsg--${message.role}`}>
      {message.role === "assistant" ? <Bot size={16} /> : null}
      <div className="baMsgBody">
        <p>{message.text}</p>
        {message.tools?.length ? (
          <ul className="baTools">
            {message.tools.map((tool) => (
              <li key={`${tool.name}-${tool.detail}`}>
                <Sparkles size={12} />
                <span>{tool.name}</span>
                <small>{tool.detail}</small>
              </li>
            ))}
          </ul>
        ) : null}
        {message.pdfReady ? (
          <div className="baPdf">
            <CheckCircle2 size={16} />
            <span>benefits-booklet.pdf ready</span>
          </div>
        ) : null}
        {message.awaitingConfirm ? (
          <div className="baConfirm">Awaiting confirm before send</div>
        ) : null}
      </div>
    </div>
  );
}

export default function BrokerAgentDemo({
  companyId,
  companyName,
  onBack,
}) {
  const [mode, setMode] = useState("preview");
  const [messages, setMessages] = useState([PREVIEW_SCRIPT[0]]);
  const [previewStep, setPreviewStep] = useState(1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState(null);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  const runPreviewNext = () => {
    if (previewStep >= PREVIEW_SCRIPT.length) return;
    const next = PREVIEW_SCRIPT[previewStep];
    setBusy(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, next]);
      setPreviewStep((step) => step + 1);
      setBusy(false);
      if (next.awaitingConfirm) {
        setPendingEmail({
          to: ["hr@acme.com"],
          subject: "Acme 2026 Benefits Booklet",
        });
      }
    }, next.role === "assistant" ? 700 : 200);
  };

  const sendLive = async (text) => {
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", text }]);
    try {
      const token = await getBookletAuthToken();
      const response = await fetch("/api/broker-agent/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: companyId || "demo-company",
          companyName: companyName || undefined,
          sessionId,
          text,
          stream: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Agent turn failed");
      setSessionId(payload.sessionId || null);
      setPendingEmail(payload.pendingEmailSend || null);
      const toolEvents = (payload.events || [])
        .filter((event) => event.type === "tool_start")
        .map((event) => ({
          name: event.name,
          detail: JSON.stringify(event.arguments || {}).slice(0, 80),
        }));
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.assistantText || "Done.",
          tools: toolEvents,
          pdfReady: (payload.events || []).some((event) => event.type === "pdf_ready"),
          awaitingConfirm: Boolean(payload.pendingEmailSend),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Live API isn’t reachable yet. Switch to Preview to walk the flow, or run the API locally with BROKER_VOICE_BETA / mailbox flags as needed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (mode === "preview") {
      setMessages((current) => [...current, { role: "user", text }]);
      runPreviewNext();
      if (previewStep + 1 < PREVIEW_SCRIPT.length) {
        window.setTimeout(runPreviewNext, 900);
      }
      return;
    }
    void sendLive(text);
  };

  const toggleMic = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Browser speech recognition isn’t available here. Type instead, or use live audio via the API.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) setInput((current) => `${current} ${transcript}`.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  };

  const confirmSend = () => {
    if (mode === "preview") {
      setMessages((current) => [
        ...current,
        { role: "user", text: "Yes, send it." },
        {
          role: "assistant",
          text: "Sent to hr@acme.com with the booklet PDF attached. Audit logged.",
          tools: [{ name: "confirm_send_booklet_email", detail: "delivered" }],
        },
      ]);
      setPendingEmail(null);
      return;
    }
    if (!pendingEmail?.id) return;
    void sendLive(`Confirm send for pending email ${pendingEmail.id}. confirmed=true`);
  };

  return (
    <div className="baShell">
      <header className="baHeader">
        <button type="button" className="baBack" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div>
          <p className="baEyebrow">Broker agent · beta infra</p>
          <h1>Speak the booklet into existence</h1>
          <p className="baSub">
            {companyName
              ? `Company context: ${companyName}`
              : "Preview the conversation UI for the voice-ready agent."}
          </p>
        </div>
        <div className="baMode">
          <button
            type="button"
            className={mode === "preview" ? "active" : ""}
            onClick={() => {
              setMode("preview");
              setMessages([PREVIEW_SCRIPT[0]]);
              setPreviewStep(1);
              setPendingEmail(null);
              setError("");
            }}
          >
            Preview
          </button>
          <button
            type="button"
            className={mode === "live" ? "active" : ""}
            onClick={() => {
              setMode("live");
              setMessages([
                {
                  role: "assistant",
                  text: "Live mode talks to /api/broker-agent/turn. Needs auth + backend. Say what booklet you want.",
                },
              ]);
              setPendingEmail(null);
              setError("");
            }}
          >
            Live API
          </button>
        </div>
      </header>

      <div className="baLayout">
        <section className="baTranscript" ref={listRef}>
          {messages.map((message, index) => (
            <PreviewBubble key={`${message.role}-${index}-${message.text.slice(0, 24)}`} message={message} />
          ))}
          {busy ? (
            <div className="baBusy">
              <LoaderCircle className="spin" size={16} />
              Working…
            </div>
          ) : null}
        </section>

        <aside className="baSide">
          <h2>What this demo shows</h2>
          <ul>
            <li>Automatic source pickup (library + mailbox — broker never says “in my email”)</li>
            <li>Customization from natural speech (tone, sections, branding)</li>
            <li>Tool activity + confirm-before-send email</li>
          </ul>
          <p>
            Preview is scripted. Live mode runs auto-gather on each booklet request before the agent replies.
          </p>
          {pendingEmail ? (
            <button type="button" className="baSendConfirm" onClick={confirmSend}>
              Confirm email to {(pendingEmail.to || []).join(", ") || "recipient"}
            </button>
          ) : null}
          {error ? <p className="baError">{error}</p> : null}
          {mode === "preview" && previewStep < PREVIEW_SCRIPT.length ? (
            <button type="button" className="baAdvance" onClick={runPreviewNext} disabled={busy}>
              Advance preview
            </button>
          ) : null}
        </aside>
      </div>

      <form className="baComposer" onSubmit={onSubmit}>
        <button
          type="button"
          className={`baMic ${listening ? "on" : ""}`}
          onClick={toggleMic}
          aria-label={listening ? "Stop listening" : "Start listening"}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            listening
              ? "Listening…"
              : "e.g. Build Acme’s booklet from my Anthem renewal email"
          }
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
