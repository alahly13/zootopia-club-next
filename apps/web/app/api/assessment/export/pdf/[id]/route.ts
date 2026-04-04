import { isProfileCompletionRequired } from "@/lib/return-to";
import { resolveAssessmentFileThemeMode } from "@/lib/assessment-file-branding";
import { apiError } from "@/lib/server/api";
import {
  getAssessmentArtifactRecordKey,
  loadAssessmentArtifact,
  persistAssessmentExportArtifact,
} from "@/lib/server/assessment-artifact-storage";
import { buildAssessmentPreview } from "@/lib/server/assessment-preview";
import { buildAssessmentFileQrDataUrl } from "@/lib/server/assessment-file-qr";
import {
  ASSESSMENT_PRINT_LAYOUT_VERSION,
  buildAssessmentPrintHtml,
} from "@/lib/server/assessment-print-renderer";
import {
  appendAdminLog,
  getAssessmentGenerationForOwner,
  saveAssessmentGeneration,
} from "@/lib/server/repository";
import { getRequestUiContext } from "@/lib/server/request-context";
import { getAuthenticatedSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedSessionUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in is required for assessments.", 401);
  }
  if (isProfileCompletionRequired(user)) {
    return apiError(
      "PROFILE_INCOMPLETE",
      "Complete your profile in Settings before accessing assessment output.",
      403,
    );
  }

  const { id } = await context.params;
  const generation = await getAssessmentGenerationForOwner(id, user.uid, {
    includeExpired: true,
  });

  if (!generation) {
    return apiError("ASSESSMENT_NOT_FOUND", "Assessment generation not found.", 404);
  }

  if (generation.status === "expired") {
    return apiError(
      "ASSESSMENT_EXPIRED",
      "Assessment generation has expired and is no longer available.",
      410,
    );
  }

  const uiContext = await getRequestUiContext();
  const preview = buildAssessmentPreview({
    generation,
    locale: uiContext.locale,
    messages: uiContext.messages,
  });
  const themeMode = resolveAssessmentFileThemeMode(
    new URL(request.url).searchParams.get("theme"),
    uiContext.themeMode === "light" ? "light" : "dark",
  );
  const artifactKey = getAssessmentArtifactRecordKey({
    kind: "export-print-html",
    locale: uiContext.locale,
    themeMode,
  });
  const existingArtifact = generation.artifacts?.[artifactKey];
  const existingBuffer = existingArtifact
    ? await loadAssessmentArtifact(existingArtifact, user.uid)
    : null;
  const expectedFileName = `${preview.id}-${themeMode}-${ASSESSMENT_PRINT_LAYOUT_VERSION}.html`;
  const canReuseExistingArtifact =
    existingArtifact?.fileName === expectedFileName && Boolean(existingBuffer);

  if (!canReuseExistingArtifact) {
    const qrCodeDataUrl = await buildAssessmentFileQrDataUrl();
    const html = buildAssessmentPrintHtml({ preview, themeMode, qrCodeDataUrl });
    const storedArtifact = await persistAssessmentExportArtifact({
      ownerUid: user.uid,
      generationId: generation.id,
      kind: "export-print-html",
      locale: uiContext.locale,
      themeMode,
      /* Print HTML is artifact-cached, so keep the renderer version in the file name.
         That lets the route invalidate older cached layouts without inventing a new export route
         or changing the owner-scoped artifact model used by existing assessment downloads. */
      fileName: expectedFileName,
      fileExtension: "html",
      contentType: "text/html; charset=utf-8",
      body: html,
      createdAt: new Date().toISOString(),
      expiresAt: generation.expiresAt,
    });

    if (storedArtifact) {
      await saveAssessmentGeneration({
        ...generation,
        artifacts: {
          ...(generation.artifacts ?? {}),
          [storedArtifact.key]: storedArtifact,
        },
        updatedAt: new Date().toISOString(),
      });
    }

    await appendAdminLog({
      actorUid: user.uid,
      actorRole: user.role,
      ownerUid: user.uid,
      ownerRole: user.role,
      action: "assessment-export-print-html",
      resourceType: "assessment-export",
      resourceId: generation.id,
      route: "/api/assessment/export/pdf/[id]",
      metadata: {
        themeMode,
        layoutVersion: ASSESSMENT_PRINT_LAYOUT_VERSION,
      },
    });

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  await appendAdminLog({
    actorUid: user.uid,
    actorRole: user.role,
    ownerUid: user.uid,
    ownerRole: user.role,
    action: "assessment-export-print-html",
    resourceType: "assessment-export",
    resourceId: generation.id,
    route: "/api/assessment/export/pdf/[id]",
    metadata: {
      themeMode,
      layoutVersion: ASSESSMENT_PRINT_LAYOUT_VERSION,
    },
  });

  const reusableBuffer = existingBuffer as Uint8Array;

  return new Response(new TextDecoder().decode(reusableBuffer), {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
