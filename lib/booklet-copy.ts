import OpenAI from "openai";

export type BookletCopy = {
  welcomeLead: string;
  welcomeBody: string;
  enrollmentIntro: string;
  benefitsIntro: string;
  closingNote: string;
};

export async function generateBookletCopy(
  company: any,
  apiKey?: string,
): Promise<BookletCopy | null> {
  if (!apiKey) return null;
  const details = company.planDetails || {};
  const planNames = Object.values(company.benefits || {}).flatMap(
    (benefit: any) => (benefit.plans || []).map((plan: any) => plan.name),
  );
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: `Write concise employee-benefits-guide copy using only the supplied facts. Do not invent coverage, carriers, costs, dates, or legal claims. Return strict JSON only with string keys welcomeLead, welcomeBody, enrollmentIntro, benefitsIntro, closingNote. Each value must contain 1-2 short, warm, plain-language sentences.

Employer: ${company.name || ""}
Description: ${company.description || ""}
Industry: ${company.industry || ""}
Plan year: ${JSON.stringify(details.planYear || {})}
Enrollment: ${JSON.stringify(details.enrollment || {})}
Plan names: ${planNames.join(", ")}`,
    });
    return JSON.parse(
      response.output_text.trim().replace(/^```json\s*|\s*```$/g, ""),
    );
  } catch {
    return null;
  }
}

export async function streamBookletCopy(
  company: any,
  apiKey: string | undefined,
  onEvent: (event: {
    type: "copy_start" | "copy_delta" | "copy_done";
    section: string;
    title: string;
    delta?: string;
    text?: string;
  }) => void,
): Promise<BookletCopy | null> {
  if (!apiKey) return null;
  const details = company.planDetails || {};
  const context = `Employer: ${company.name || ""}\nDescription: ${company.description || ""}\nIndustry: ${company.industry || ""}\nPlan year: ${JSON.stringify(details.planYear || {})}\nEnrollment: ${JSON.stringify(details.enrollment || {})}`;
  const sections = [
    {
      key: "welcomeBody",
      title: "Welcome",
      prompt:
        "Write two short, warm paragraphs welcoming employees to their benefits guide and encouraging careful review.",
    },
    {
      key: "enrollmentIntro",
      title: "Open enrollment",
      prompt:
        "Write one concise paragraph explaining the purpose of open enrollment and encouraging employees to review costs and dependents.",
    },
    {
      key: "closingNote",
      title: "Important information",
      prompt:
        "Write one concise closing paragraph directing employees to HR for questions without adding legal or coverage claims.",
    },
  ];
  const client = new OpenAI({ apiKey }),
    result: any = {};
  try {
    for (const section of sections) {
      onEvent({
        type: "copy_start",
        section: section.key,
        title: section.title,
      });
      const stream = await client.responses.create({
        model: "gpt-5.4-mini",
        stream: true,
        input: `${section.prompt}\nUse only the supplied facts. Do not invent benefits, carriers, coverage, costs, dates, or legal claims. Return only the finished prose with no heading.\n\n${context}`,
      });
      let text = "";
      for await (const event of stream as any) {
        if (event.type !== "response.output_text.delta") continue;
        text += event.delta;
        onEvent({
          type: "copy_delta",
          section: section.key,
          title: section.title,
          delta: event.delta,
        });
      }
      result[section.key] = text.trim();
      onEvent({
        type: "copy_done",
        section: section.key,
        title: section.title,
        text: result[section.key],
      });
    }
    result.welcomeLead = `${company.name || "Your employer"} is pleased to provide this employee benefits guide.`;
    result.benefitsIntro = result.welcomeBody;
    return result as BookletCopy;
  } catch {
    return null;
  }
}
