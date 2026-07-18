import type {
  BookletOutline,
  BookletSectionArtifact,
  SourceRef,
} from "./booklet-types";
import type { BookletContentResult } from "./booklet-content-agent";

export type RenderedPreviewPage = {
  index: number;
  title: string;
  text: string;
  html: string;
};

export function pageIdFromHtml(html: string) {
  return html.match(/data-page-id=["']([^"']+)["']/)?.[1] || "page";
}

export function sectionIdFromPageId(pageId: string) {
  if (pageId === "open-enrollment") return "enrollment";
  return pageId.replace(/-\d+$/, "");
}

function refsForSection(outline: BookletOutline, sectionId: string): SourceRef[] {
  if (sectionId === "toc") return outline.sections.flatMap((section) => section.sourceRefs);
  return outline.sections.find(
    (section) => section.id === sectionId || section.benefitType === sectionId,
  )?.sourceRefs || [];
}

export function artifactsFromPreviewPages({
  runId,
  pages,
  outline,
  content,
}: {
  runId: string;
  pages: RenderedPreviewPage[];
  outline: BookletOutline;
  content?: BookletContentResult;
}): BookletSectionArtifact[] {
  const createdAt = new Date().toISOString();
  return pages
    .filter((page) => page.html)
    .map((page) => {
      const id = pageIdFromHtml(page.html);
      const sectionId = sectionIdFromPageId(id);
      const generated = content?.sections.find((section) => section.id === sectionId);
      return {
        id,
        runId,
        sectionId,
        title: page.title,
        pageIndex: page.index,
        status: "ready",
        contentStatus: generated?.status || "ready",
        html: page.html,
        sourceRefs: refsForSection(outline, sectionId),
        sourcePaths: generated?.sourcePaths || [],
        createdAt,
      };
    });
}

export function composeBookletHtml(artifacts: BookletSectionArtifact[]) {
  const ready = [...artifacts]
    .filter((artifact) => artifact.status === "ready" && artifact.html)
    .sort((left, right) => left.pageIndex - right.pageIndex);
  if (!ready.length) throw new Error("No generated HTML sections are ready to compile");
  const head = ready[0].html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ||
    '<meta charset="utf-8">';
  const bodies = ready.map((artifact) => {
    const body = artifact.html.match(/<body>([\s\S]*?)<\/body>/i)?.[1];
    if (!body) throw new Error(`Section artifact ${artifact.id} has no HTML body`);
    return body;
  });
  return `<!doctype html><html><head>${head}</head><body>${bodies.join("")}</body></html>`;
}
