import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "../lib/firebase-admin";
import {
  extractMedicalPlan,
  type PlanExtractionStore,
  type PlanPatch,
} from "../lib/plan-extractor";

export const config = { maxDuration: 300 };

const validId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { companyId, planId } = req.body || {};
  if (!validId(companyId) || !validId(planId))
    return res.status(400).json({ error: "Valid companyId and planId are required" });

  try {
    const { db, bucket } = getAdminServices();
    const planRef = db
      .collection("benefitsCompanies")
      .doc(companyId)
      .collection("plans")
      .doc(planId);
    const snapshot = await planRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: "Plan not found" });
    const plan = snapshot.data() || {};
    if (!plan.storagePath || typeof plan.storagePath !== "string")
      return res.status(422).json({ error: "Plan has no uploaded source document" });

    const [file] = await bucket.file(plan.storagePath).download();
    const store: PlanExtractionStore = {
      updatePlan: async (patch: PlanPatch) => {
        await planRef.set(
          {
            ...patch,
            serverUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      },
      writeTextPage: async ({ pageNumber, text }) => {
        await planRef.collection("textPages").doc(String(pageNumber).padStart(4, "0")).set({
          pageNumber,
          text,
          updatedAt: FieldValue.serverTimestamp(),
        });
      },
    };
    const attributes = await extractMedicalPlan({
      apiKey: process.env.OPENAI_API_KEY,
      file,
      fileName: plan.fileName || `${planId}.pdf`,
      store,
    });
    return res.status(200).json({
      ok: true,
      planId,
      serviceCount: attributes.services.length,
      pageCount: plan.extraction?.pageCount || null,
    });
  } catch (error) {
    console.error("parse-plan failed", { companyId, planId, error });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not parse plan",
    });
  }
}
