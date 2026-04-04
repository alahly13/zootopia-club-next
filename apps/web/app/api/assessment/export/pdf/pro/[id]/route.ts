import { apiError } from "@/lib/server/api";
import { buildAssessmentExportRouteContext } from "@/lib/server/assessment-export-route-context";
import { buildAssessmentProPdfResponse } from "@/lib/server/assessment-pro-pdf-export";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const resolved = await buildAssessmentExportRouteContext(request, id);
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    /* The Pro lane is the premium Puppeteer/Chromium boundary for real downloadable PDFs.
       Future premium rendering work should expand here instead of reaching back into the Fast
       browser-print route or reintroducing mixed lane logic in the legacy alias route. */
    return await buildAssessmentProPdfResponse(resolved);
  } catch (error) {
    console.error("Assessment Pro PDF export failed.", error);
    return apiError(
      "ASSESSMENT_PDF_EXPORT_FAILED",
      "The assessment PDF could not be generated right now.",
      500,
    );
  }
}
