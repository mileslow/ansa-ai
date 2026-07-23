import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import { getApps, initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { generateCompanyProfile } from "./lib/company-profile.js";
import { extractMedicalPlan } from "./lib/plan-extractor.ts";
import { cloudRunApiBasePlugin } from "./cloud-run/vite-api-base-plugin.mjs";
function validateBookletCompany(company) {
  const missing = [];
  const requireValue = (label, value) => {
    if (value === undefined || value === null || value === "") missing.push(label);
  };
  requireValue("Company name", company?.name);
  requireValue("Company description", company?.description);
  requireValue("Company website", company?.website);
  requireValue("Employer cover name", company?.planDetails?.employer?.cover);
  requireValue("Plan year start", company?.planDetails?.planYear?.start);
  requireValue("Plan year end", company?.planDetails?.planYear?.end);
  if (!company?.benefits?.health?.plans?.length) missing.push("Medical plan rates");
  if (
    Number(company?.benefits?.dental?.uploadedPlanCount) > 0 &&
    !company?.benefits?.dental?.plans?.length
  )
    missing.push("Dental plan rates");
  return [...new Set(missing)];
}
function getKey(mode) {
  let env = loadEnv(mode, process.cwd(), "");
  if (env.OPENAI_API_KEY) return env.OPENAI_API_KEY;
  try {
    let source = fs.readFileSync(
        "/Users/miles/Desktop/projects/flux/flux/.env",
        "utf8",
      ),
      match = source.match(/^OPENAI_API_KEY=(.*)$/m);
    return match?.[1]?.replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}
function getLocalDb(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const name = "ansa-local-plan-parser";
  const app =
    getApps().find((candidate) => candidate.name === name) ||
    initializeApp(
      {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
      name,
    );
  return getFirestore(app);
}
export default defineConfig(({ mode, command }) => {
  const localOpenAIKey = getKey(mode);
  if (command === "serve" && !process.env.OPENAI_API_KEY && localOpenAIKey)
    process.env.OPENAI_API_KEY = localOpenAIKey;
  return {
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [
    cloudRunApiBasePlugin({
      baseUrl: loadEnv(mode, process.cwd(), "").VITE_BACKEND_API_URL,
      required: Boolean(process.env.VERCEL),
    }),
    tailwindcss(),
    react(),
    {
      name: "local-booklet-pipeline-api",
      configureServer(server) {
        server.middlewares.use("/api/booklet-pipeline", (req, res) => {
          let body = "";
          let tooLarge = false;
          req.on("data", (chunk) => {
            if (tooLarge) return;
            body += chunk;
            if (Buffer.byteLength(body) > 60 * 1024 * 1024) {
              tooLarge = true;
              res.statusCode = 413;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Request body exceeds 60 MiB" }));
            }
          });
          req.on("end", async () => {
            if (tooLarge) return;
            try {
              req.bookletDevUserId = "local-booklet-studio";
              req.body = body ? JSON.parse(body) : {};
              req.query = {};
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              res.json = (payload) => {
                if (!res.headersSent)
                  res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(payload));
                return res;
              };
              const module = await server.ssrLoadModule("/api/booklet-pipeline.ts");
              await module.default(req, res);
            } catch (error) {
              if (res.writableEnded) return;
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error.message || "Local booklet API failed" }));
            }
          });
        });
      },
    },
    {
      name: "local-company-profile-api",
      configureServer(server) {
        server.middlewares.use("/api/company-profile", (req, res) => {
          res.setHeader("Content-Type", "application/json");
          if (req.method !== "POST") {
            res.statusCode = 405;
            return res.end(JSON.stringify({ error: "Method not allowed" }));
          }
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", async () => {
            try {
              let { url } = JSON.parse(body || "{}");
              res.end(
                JSON.stringify(await generateCompanyProfile(url, getKey(mode))),
              );
            } catch (e) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  error: e.message || "Could not generate company profile",
                }),
              );
            }
          });
        });
      },
    },
    {
      name: "local-plan-parser-api",
      configureServer(server) {
        server.middlewares.use("/api/parse-plan", (req, res) => {
          res.setHeader("Content-Type", "application/json");
          if (req.method !== "POST") {
            res.statusCode = 405;
            return res.end(JSON.stringify({ error: "Method not allowed" }));
          }
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const { companyId, planId } = JSON.parse(body || "{}");
              if (!companyId || !planId) throw Error("companyId and planId are required");
              const db = getLocalDb(mode);
              const planRef = doc(db, "benefitsCompanies", companyId, "plans", planId);
              const snapshot = await getDoc(planRef);
              if (!snapshot.exists()) throw Error("Plan not found");
              const plan = snapshot.data();
              const source = await fetch(plan.downloadURL);
              if (!source.ok) throw Error(`Could not download source PDF (${source.status})`);
              const file = Buffer.from(await source.arrayBuffer());
              const attributes = await extractMedicalPlan({
                apiKey: getKey(mode),
                file,
                fileName: plan.fileName || `${planId}.pdf`,
                store: {
                  updatePlan: (patch) => setDoc(planRef, patch, { merge: true }),
                  writeTextPage: ({ pageNumber, text }) =>
                    setDoc(
                      doc(planRef, "textPages", String(pageNumber).padStart(4, "0")),
                      { pageNumber, text, updatedAt: new Date().toISOString() },
                    ),
                },
              });
              res.end(JSON.stringify({ ok: true, serviceCount: attributes.services.length }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message || "Could not parse plan" }));
            }
          });
        });
      },
    },
    {
      name: "local-booklet-api",
      configureServer(server) {
        server.middlewares.use("/api/generate-booklet", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            return res.end(JSON.stringify({ error: "Method not allowed" }));
          }
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            let streamStarted = false;
            try {
              const { generateBookletPdf, renderBookletPreviewPages } =
                await server.ssrLoadModule("/lib/booklet.ts");
              const { company, payPeriods = 52 } = JSON.parse(body || "{}");
              const missing = validateBookletCompany(company);
              if (missing.length) {
                res.statusCode = 422;
                res.setHeader("Content-Type", "application/json");
                return res.end(
                  JSON.stringify({
                    error: `Complete the following before generating: ${missing.join(", ")}`,
                    missing,
                  }),
                );
              }
              res.statusCode = 200;
              res.setHeader(
                "Content-Type",
                "application/x-ndjson; charset=utf-8",
              );
              res.setHeader("Cache-Control", "no-cache, no-transform");
              const send = (event) => {
                streamStarted = true;
                res.write(`${JSON.stringify(event)}\n`);
              };
              const pages = renderBookletPreviewPages(
                company,
                Number(payPeriods),
              );
              send({
                type: "start",
                pageCount: pages.length,
                message: `Building ${company.name}'s benefits guide`,
              });
              for (const page of pages) {
                send({
                  type: "page",
                  ...page,
                  message: `Creating ${page.title}`,
                });
                await new Promise((resolve) => setTimeout(resolve, 650));
              }
              send({
                type: "rendering",
                message: "Typesetting the final PDF",
              });
              const pdf = await generateBookletPdf(company, Number(payPeriods));
              const filename = `${String(company.name || "benefits")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "")}-benefits-guide.pdf`;
              send({
                type: "complete",
                filename,
                pdf: pdf.toString("base64"),
                message: "Booklet ready",
              });
              res.end();
            } catch (error) {
              if (streamStarted) {
                res.write(
                  `${JSON.stringify({
                    type: "error",
                    message: error?.message || "Could not generate booklet",
                  })}\n`,
                );
                return res.end();
              }
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: error?.message || "Could not generate booklet",
                }),
              );
            }
          });
        });
      },
    },
    {
      name: "local-broker-agent-api",
      configureServer(server) {
        server.middlewares.use("/api/broker-agent/turn", (req, res) => {
          let body = "";
          let tooLarge = false;
          req.on("data", (chunk) => {
            if (tooLarge) return;
            body += chunk;
            if (Buffer.byteLength(body) > 20 * 1024 * 1024) {
              tooLarge = true;
              res.statusCode = 413;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Request body exceeds 20 MiB" }));
            }
          });
          req.on("end", async () => {
            if (tooLarge) return;
            try {
              req.bookletDevUserId = "local-booklet-studio";
              req.body = body ? JSON.parse(body) : {};
              req.query = {};
              req.headers = req.headers || {};
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              res.json = (payload) => {
                if (!res.headersSent)
                  res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(payload));
                return res;
              };
              const module = await server.ssrLoadModule("/api/broker-agent/turn.ts");
              await module.default(req, res);
            } catch (error) {
              if (res.writableEnded) return;
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: error.message || "Local broker agent API failed",
                }),
              );
            }
          });
        });
      },
    },
    {
      name: "local-mailbox-oauth-and-assistant-api",
      configureServer(server) {
        const mount = (routePath, modulePath) => {
          server.middlewares.use(routePath, (req, res) => {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", async () => {
              try {
                req.bookletDevUserId = "local-booklet-studio";
                req.body = body ? JSON.parse(body) : {};
                const url = new URL(req.url || "", "http://127.0.0.1");
                req.query = Object.fromEntries(url.searchParams.entries());
                req.headers = req.headers || {};
                res.status = (code) => {
                  res.statusCode = code;
                  return res;
                };
                res.json = (payload) => {
                  if (!res.headersSent)
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
                  res.end(JSON.stringify(payload));
                  return res;
                };
                const module = await server.ssrLoadModule(modulePath);
                await module.default(req, res);
              } catch (error) {
                if (res.writableEnded) return;
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: error.message || "Local assistant API failed",
                  }),
                );
              }
            });
          });
        };
        mount("/api/mailbox/oauth/start", "/api/mailbox/oauth/start.ts");
        mount("/api/mailbox/oauth/callback", "/api/mailbox/oauth/callback.ts");
        mount("/api/mailbox/oauth/status", "/api/mailbox/oauth/status.ts");
        mount("/api/mailbox/oauth/disconnect", "/api/mailbox/oauth/disconnect.ts");
        mount("/api/broker-assistant/settings", "/api/broker-assistant/settings.ts");
        mount("/api/broker-assistant/research", "/api/broker-assistant/research.ts");
        mount("/api/broker-assistant/gmail-push", "/api/broker-assistant/gmail-push.ts");
        mount("/api/broker-assistant/worker", "/api/broker-assistant/worker.ts");
      },
    },
  ],
  };
});
