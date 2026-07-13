import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { getApps, initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { generateCompanyProfile } from "./lib/company-profile.js";
import { extractMedicalPlan } from "./lib/plan-extractor.ts";
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
  if (!company?.benefits?.dental?.plans?.length) missing.push("Dental plan rates");
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
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
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
              const {
                generateBigTowsStylePdf,
                renderBigTowsStylePreviewPages,
              } = await server.ssrLoadModule(
                "/scripts/generate-bigtows-2025-style.mjs",
              );
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
              const pages = await renderBigTowsStylePreviewPages(
                company,
                Number(payPeriods),
              );
              send({
                type: "start",
                pageCount: pages.length,
                message: "Building the 2025-style Big Tows benefits guide",
              });
              for (const page of pages) {
                send({
                  type: "page",
                  ...page,
                  message: `Creating ${page.title}`,
                });
                await new Promise((resolve) => setTimeout(resolve, 180));
              }
              send({
                type: "rendering",
                message: "Typesetting the final PDF",
              });
              const pdf = await generateBigTowsStylePdf(company, Number(payPeriods));
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
  ],
}));
