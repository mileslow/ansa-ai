import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractMedicalPlan, type PlanPatch } from "../lib/plan-extractor";

const live = process.env.RUN_LIVE_PLAN_TESTS === "1" && !!process.env.OPENAI_API_KEY;
const fixtures = [
  { file: "uhc-bronze-2026.pdf", carrier: /United|UHC/i, plan: /METRO|BRONZE/i, planId: /NY_SB_2026/i },
  { file: "cigna-silver-2026.pdf", carrier: /Cigna/i, plan: /Silver|Partnered/i },
  { file: "aetna-silver-2025.pdf", carrier: /Aetna/i, plan: /Silver/i },
];

describe.skipIf(!live)("live medical plan extraction", () => {
  for (const fixture of fixtures) {
    it(`extracts the complete schema from ${fixture.file}`, async () => {
      const patches: PlanPatch[] = [], pages: Array<{ pageNumber: number; text: string }> = [];
      const file = await fs.readFile(path.join(process.cwd(), "tests/fixtures/plans", fixture.file));
      const attributes = await extractMedicalPlan({
        apiKey: process.env.OPENAI_API_KEY, file, fileName: fixture.file, progressIntervalMs: 0,
        store: { updatePlan: async (patch) => void patches.push(patch), writeTextPage: async (page) => void pages.push(page) },
      });
      expect(attributes.identity.carrier || "").toMatch(fixture.carrier);
      expect(attributes.identity.planName).toMatch(fixture.plan);
      if (fixture.planId) expect(attributes.identity.planId || "").toMatch(fixture.planId);
      expect(attributes.services.length).toBeGreaterThanOrEqual(20);
      expect(attributes.financial.deductible.raw.length).toBeGreaterThan(0);
      expect(attributes.coverageExamples.length).toBeGreaterThanOrEqual(3);
      expect(pages.length).toBeGreaterThanOrEqual(6);
      expect(patches.at(-1)).toMatchObject({ status: "complete", parsingPct: 100 });
      if (process.env.LIVE_PLAN_OUTPUT_DIR) {
        const outputDirectory = path.resolve(process.env.LIVE_PLAN_OUTPUT_DIR);
        await fs.mkdir(outputDirectory, { recursive: true });
        await fs.writeFile(
          path.join(outputDirectory, fixture.file.replace(/\.pdf$/i, ".json")),
          `${JSON.stringify({ attributes, textPages: pages }, null, 2)}\n`,
        );
      }
    }, 300_000);
  }
});
