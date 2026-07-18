import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  generateBookletPdf,
  renderBookletPreviewPages,
} from "../lib/booklet";

export const config = {
  includeFiles: "lib/**",
};

function validateBookletCompany(company: any) {
  const missing: string[] = [];
  const requireValue = (label: string, value: any) => {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  let streamStarted = false;
  try {
    const { company, payPeriods = 52 } = req.body || {};
    const missing = validateBookletCompany(company);
    if (missing.length)
      return res.status(422).json({
        error: `Complete the following before generating: ${missing.join(", ")}`,
        missing,
      });
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    const send = (event: unknown) => {
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
      send({ type: "page", ...page, message: `Creating ${page.title}` });
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    send({ type: "rendering", message: "Typesetting the final PDF" });
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
    return res.end();
  } catch (error: any) {
    const message = error?.message || "Could not generate booklet";
    console.error("generate-booklet failed", error);
    if (streamStarted || res.headersSent) {
      res.write(`${JSON.stringify({ type: "error", message })}\n`);
      return res.end();
    }
    return res.status(500).json({ error: message });
  }
}
