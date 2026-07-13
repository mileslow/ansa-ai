import fs from "node:fs/promises";
import { generateBookletPdf, validateBookletCompany } from "../lib/booklet.ts";

function decode(value) {
  if (value == null) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if (value.mapValue)
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]),
    );
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  return null;
}

const source = JSON.parse(await fs.readFile("tmp/pdfs/big-tows-firestore.json", "utf8"));
const company = decode({ mapValue: { fields: source.fields } });
company.id = "big-tows";
const missing = validateBookletCompany(company);
if (missing.length) throw new Error(`Record is incomplete: ${missing.join(", ")}`);
const pdf = await generateBookletPdf(company, 52);
await fs.mkdir("output/pdf", { recursive: true });
await fs.writeFile("output/pdf/big-tows-generated-current.pdf", pdf);
console.log(`Generated ${pdf.length} bytes from ${company.name}`);
