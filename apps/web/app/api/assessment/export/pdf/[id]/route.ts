import {
  buildAssessmentFastPdfExportRoute,
  buildAssessmentProPdfExportRoute,
} from "@/lib/assessment-routes";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requestUrl = new URL(request.url);
  const surface = requestUrl.searchParams.get("surface");
  const targetPath =
    surface === "print"
      ? buildAssessmentFastPdfExportRoute(id)
      : buildAssessmentProPdfExportRoute(id);

  /* This route is now compatibility-only. Keep it as a thin redirect so older links still work
     while all real generation logic lives in the explicit Pro and Fast lane routes above. */
  requestUrl.searchParams.delete("surface");
  const redirectUrl = new URL(targetPath, requestUrl.origin);
  redirectUrl.search = requestUrl.searchParams.toString();

  return Response.redirect(redirectUrl, 307);
}
