import "server-only";

import type {
  AssessmentPreviewThemeMode,
  AssessmentPreviewQuestionItem,
  NormalizedAssessmentPreview,
} from "@/lib/assessment-preview-model";
import { getProtectedSignatureCopy } from "@/lib/branding/protected-signature";

/* The Fast browser-print lane caches rendered HTML artifacts, and the Pro lane currently reuses
   this shared file-surface foundation before Puppeteer capture. Bump this whenever the shared
   assessment file layout changes materially so both lanes can invalidate stale source surfaces
   without collapsing back into one mixed route or cache contract. */
export const ASSESSMENT_PRINT_LAYOUT_VERSION = "2026-04-04-compact-pdf-v12";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderChoiceItem(input: {
  marker: string | null;
  text: string;
  isCorrect: boolean;
}) {
  const choiceClassName = input.isCorrect ? "choice-item choice-item--correct" : "choice-item";
  const markerClassName = input.isCorrect ? "choice-marker choice-marker--correct" : "choice-marker";

  return `
    <div class="${choiceClassName}">
      <span class="${markerClassName}">${escapeHtml(input.marker ? `${input.marker})` : "•")}</span>
      <span class="choice-text">${escapeHtml(input.text)}</span>
      ${input.isCorrect ? '<span class="choice-correct-badge" aria-hidden="true">&#10003;</span>' : ""}
    </div>
  `.trim();
}

function renderQuestionCard(input: {
  question: AssessmentPreviewQuestionItem;
  answerLabel: string;
  rationaleLabel: string;
  className?: string;
}) {
  const { question, answerLabel, rationaleLabel, className = "" } = input;
  const articleClassName = ["question-card", className].filter(Boolean).join(" ");

  return `
    <article class="${articleClassName}">
      <div class="question-header">
        <span class="question-index">${question.index + 1}</span>
        ${question.typeLabel ? `<span class="question-type">${escapeHtml(question.typeLabel)}</span>` : ""}
      </div>
      <h2 class="question-title">${escapeHtml(question.stem)}</h2>
      ${
        question.choices.length > 0
          ? `
            <div class="choice-list ${question.choiceLayout === "grid-2x2" ? "choice-list--paired" : ""}">
              ${question.choices
                .map((choice) =>
                  renderChoiceItem({
                    marker: choice.marker,
                    text: choice.text,
                    isCorrect: choice.isCorrect,
                  }),
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        question.supplementalLines.length > 0
          ? `
            <div class="supplemental-copy">
              ${question.supplementalLines
                .map((line) => `<p>${escapeHtml(line)}</p>`)
                .join("")}
            </div>
          `
          : ""
      }
      <div class="answer-card">
        <div class="answer-label">${escapeHtml(answerLabel)}</div>
        <p>${escapeHtml(question.answerDisplay)}</p>
      </div>
      ${
        question.rationale
          ? `
            <div class="rationale-card">
              <div class="answer-label">${escapeHtml(rationaleLabel)}</div>
              <p>${escapeHtml(question.rationale)}</p>
            </div>
          `
          : ""
      }
      ${
        question.tags.length > 0
          ? `
            <div class="tag-list">
              ${question.tags
                .map((tag) => `<span class="tag-item">${escapeHtml(tag)}</span>`)
                .join("")}
            </div>
          `
          : ""
      }
    </article>
  `
    .trim();
}

function renderSupportPill(text: string, className = "support-chip") {
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function renderSupportContactCard(input: {
  label: string;
  value: string;
  href: string;
}) {
  return `
    <a class="support-contact-card" href="${escapeHtml(input.href)}">
      <span class="support-contact-label">${escapeHtml(input.label)}</span>
      <span class="support-contact-value">${escapeHtml(input.value)}</span>
    </a>
  `.trim();
}

export function buildAssessmentPrintHtml(input: {
  preview: NormalizedAssessmentPreview;
  themeMode: AssessmentPreviewThemeMode;
  qrCodeDataUrl: string;
  autoPrint?: boolean;
  documentBaseUrl?: string | null;
  pageNumberMode?: "css" | "pdf-template";
}) {
  const {
    preview,
    themeMode,
    qrCodeDataUrl,
    autoPrint = true,
    documentBaseUrl,
    pageNumberMode = "css",
  } = input;
  const dark = themeMode === "dark";
  const signature = getProtectedSignatureCopy(preview.locale);
  const backgroundUrl = dark
    ? preview.fileSurface.backgroundDarkUrl
    : preview.fileSurface.backgroundLightUrl;
  const sealAssetUrl = dark
    ? preview.fileSurface.sealDarkAssetUrl
    : preview.fileSurface.sealLightAssetUrl;
  const answerLabel = preview.locale === "ar" ? "الإجابة" : "Answer";
  const rationaleLabel = preview.locale === "ar" ? "التبرير" : "Rationale";
  const pdfEyebrow = preview.locale === "ar" ? "تصدير PDF" : "PDF export";
  /* Keep the summary chip label literal and shared with the detached preview/result shell so the
     premium file header reads as one consistent SUMMARY surface before and after Pro PDF capture. */
  const summaryLabel = "SUMMARY";
  const printHint = preview.locale === "ar"
    ? "استخدم نافذة الطباعة في المتصفح ثم اختر Save as PDF."
    : "Use your browser print dialog and choose Save as PDF.";
  const printFooterText = preview.fileSurface.footerText;
  /* Chrome paints the page-margin strip from the page box itself, not from fixed print layers.
     Keep these margins aligned with the renderer's safe content area and unified footer bar, but
     let the @page foundation below own the full-bleed edge color future agents must not regress. */
  const pageMarginTop = "8mm";
  const pageMarginRight = "7mm";
  const pageMarginBottom = "16mm";
  const pageMarginLeft = "7mm";
  const pageFrameInset = "4mm";
  const pageBackgroundFoundation = dark ? "#0b1825" : "#f4efe4";
  /* The exported seal is anchored to the physical lower-left page corner on purpose.
     Keep this slightly enlarged footprint clear of the unified footer bar and late-page question
     content so the institutional stamp reads better without becoming a distracting decoration. */
  const pageSealSize = "13.1mm";
  const pageSealInsetLeft = "7.4mm";
  const pageSealInsetBottom = "14.2mm";
  const questionHeaderJustify =
    preview.direction === "rtl" ? "flex-end" : "space-between";
  const qrInsetSide = "right";
  const coverPaddingSide = "padding-right";
  const pageFoldSide = preview.direction === "rtl" ? "left" : "right";
  const pageBadgeMarginAtRule = "bottom-left";
  const firstPageQuestions = preview.questions.slice(0, 2);
  const followingQuestions = preview.questions.slice(2);
  const firstPageQuestionCards = firstPageQuestions
    .map((question) =>
      renderQuestionCard({
        question,
        answerLabel,
        rationaleLabel,
        className: "question-card--first-page",
      }),
    )
    .join("\n");
  const followingQuestionCards = followingQuestions
    .map((question) =>
      renderQuestionCard({
        question,
        answerLabel,
        rationaleLabel,
        className: "question-card--compact",
      }),
    )
    .join("\n");
  const supportPage = preview.fileSurface.supportPage;
  const resolvedDocumentBaseUrl = documentBaseUrl
    ? new URL(documentBaseUrl, "https://example.invalid").toString()
    : null;
  const exportFontStylesheetUrl =
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Alexandria:wght@400;600;700;800&family=Amiri:wght@400;700&display=swap";
  const supportHeroChips = supportPage.heroChips
    .map((chip) => renderSupportPill(chip))
    .join("\n");
  const supportCostItems = supportPage.costItems
    .map((item) => renderSupportPill(item, "support-chip support-chip--cost"))
    .join("\n");
  const supportImpactItems = supportPage.impactItems
    .map(
      (item) => `
        <div class="support-impact-item">
          <span class="support-impact-bullet" aria-hidden="true">✦</span>
          <p>${escapeHtml(item)}</p>
        </div>
      `.trim(),
    )
    .join("\n");
  const supportContactCards = [
    renderSupportContactCard({
      label: supportPage.contactPathLabel,
      value: supportPage.contactPathUrl,
      href: supportPage.contactPathUrl,
    }),
    renderSupportContactCard({
      label: supportPage.directLinkLabel,
      value: supportPage.directLinkUrl.replace(/^https?:\/\//, ""),
      href: supportPage.directLinkUrl,
    }),
  ].join("\n");
  const metadata = preview.metadata
    .map(
      (item) => `
        <div class="meta-item">
          <span class="meta-label">${escapeHtml(item.label)}</span>
          <span class="meta-divider" aria-hidden="true"></span>
          <span class="meta-value">${escapeHtml(item.value)}</span>
        </div>
      `.trim(),
    )
    .join("\n");

  return `<!doctype html>
<html lang="${preview.locale}" dir="${preview.direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${resolvedDocumentBaseUrl ? `<base href="${escapeHtml(resolvedDocumentBaseUrl)}" />` : ""}
    <link href="${exportFontStylesheetUrl}" rel="stylesheet" />
    <title>${escapeHtml(preview.title)}</title>
    <style>
      :root {
        color-scheme: ${dark ? "dark" : "light"};
        /* Dark export colors stay matte and science-leaning on purpose.
           Keep this palette coherent with the protected preview mood without pushing the PDF
           into neon contrast or flat black slabs that fight the file background artwork. */
        --ink: ${dark ? "#f7fbff" : "#0f172a"};
        --muted: ${dark ? "#a4bad0" : "#566375"};
        --line: ${dark ? "rgba(148, 163, 184, 0.1)" : "rgba(15, 23, 42, 0.12)"};
        --line-strong: ${dark ? "rgba(94, 234, 212, 0.16)" : "rgba(15, 118, 110, 0.14)"};
        --accent: ${dark ? "#67e8d8" : "#0f766e"};
        --accent-soft: ${dark ? "rgba(94, 234, 212, 0.14)" : "rgba(15, 118, 110, 0.1)"};
        --surface-strong: ${dark ? "rgba(5, 16, 31, 0.88)" : "rgba(255, 255, 255, 0.72)"};
        --surface-soft: ${dark ? "rgba(7, 18, 34, 0.78)" : "rgba(255, 255, 255, 0.46)"};
        --surface-soft-2: ${dark ? "rgba(4, 12, 24, 0.9)" : "rgba(255, 255, 255, 0.36)"};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        margin: 0;
        padding: 14px;
        background: ${pageBackgroundFoundation};
        color: var(--ink);
        /* Assessment exports can now intentionally include tasteful emojis.
           Preserve emoji-capable font fallbacks here so browser Save-as-PDF keeps those glyphs
           visible instead of dropping them from the printed file surface. */
        font-family: "Plus Jakarta Sans", "Alexandria", "Amiri", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Tahoma, Arial, sans-serif;
      }

      .screen-background,
      .page-background-print {
        position: fixed;
        inset: -4%;
        background-position: center;
        background-size: cover;
        pointer-events: none;
      }

      .screen-background {
        background-image: url("${escapeHtml(backgroundUrl)}");
        z-index: 0;
        opacity: ${dark ? "0.36" : "0.28"};
      }

      .screen-wash {
        position: fixed;
        inset: 0;
        z-index: 0;
        background: ${dark ? "rgba(2, 8, 18, 0.74)" : "rgba(255, 255, 255, 0.68)"};
      }

      .page-background-print {
        background-image: ${dark
          ? `linear-gradient(180deg, rgba(2, 8, 18, 0.2), rgba(3, 10, 23, 0.3)), url("${escapeHtml(backgroundUrl)}")`
          : `url("${escapeHtml(backgroundUrl)}")`};
      }

      .page-background-print,
      .page-chrome-print,
      .print-footer {
        display: none;
      }

      .sheet {
        position: relative;
        z-index: 1;
        max-width: 860px;
        margin: 0 auto;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 18px 18px 16px;
        background:
          linear-gradient(${dark ? "180deg, rgba(2, 8, 20, 0.92), rgba(4, 12, 24, 0.82)" : "180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.56)"}),
          radial-gradient(${dark ? "circle at top right, rgba(94, 234, 212, 0.08), transparent 32%" : "circle at top right, rgba(15, 118, 110, 0.05), transparent 28%"}),
          radial-gradient(${dark ? "circle at bottom left, rgba(56, 189, 248, 0.05), transparent 30%" : "circle at bottom left, rgba(15, 118, 110, 0.04), transparent 26%"});
        box-shadow:
          inset 0 0 0 1px var(--line-strong),
          ${dark ? "0 26px 70px rgba(1, 4, 14, 0.62)" : "0 22px 52px rgba(15, 23, 42, 0.14)"};
      }

      /* The file frame and fold replace the older oversized corner brackets with a quieter
         printed-document treatment. Keep this subtle so the PDF feels premium without stealing
         space from the actual assessment content. */
      .sheet-frame,
      .page-frame {
        position: absolute;
        inset: 12px;
        border: 1px solid var(--line-strong);
        border-radius: 18px;
      }

      .sheet-fold,
      .page-fold {
        position: absolute;
        top: 0;
        ${pageFoldSide}: 0;
        width: 72px;
        height: 72px;
        background: linear-gradient(${dark ? "135deg, rgba(141, 242, 223, 0.22), transparent 64%" : "135deg, rgba(15, 118, 110, 0.12), transparent 62%"});
        clip-path: polygon(100% 0, 0 0, 100% 100%);
        opacity: 0.9;
      }

      /* This repeated seal layer belongs to the shared print chrome, not to any one question card.
         Keep it in this page-level layer so every exported page receives the same slightly larger
         lower-left institutional stamp while theme-aware asset switching stays shared and safe. */
      .page-seal-print {
        position: absolute;
        left: ${pageSealInsetLeft};
        bottom: ${pageSealInsetBottom};
        width: ${pageSealSize};
        height: ${pageSealSize};
        opacity: ${dark ? "0.72" : "0.8"};
      }

      .page-seal-print img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        /* Future agents should preserve the enlarged-but-controlled size and bottom-left clearance.
           The seal must stay legible without colliding with the unified footer bar or competing with
           question content, especially in dark mode where extra contrast makes it read larger. */
        filter: ${dark
          ? "drop-shadow(0 0 10px rgba(2, 8, 18, 0.18))"
          : "drop-shadow(0 2px 8px rgba(15, 23, 42, 0.08))"};
      }

      /* The cover shell is the only block that owns the export QR.
         Keeping the QR inside this first-page header preserves the premium opening layout
         and prevents the branded code from leaking into later PDF pages. */
      .cover-shell {
        position: relative;
        ${coverPaddingSide}: 82px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--line);
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .cover-brand {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        min-width: 0;
      }

      .cover-copy {
        min-width: 0;
      }

      .brand-logo {
        width: 46px;
        height: 46px;
        flex: none;
        border-radius: 14px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
      }

      .brand-eyebrow {
        display: block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .brand-name {
        display: block;
        margin-top: 4px;
        font-size: 17px;
        font-weight: 700;
        line-height: 1.2;
        color: var(--ink);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        margin-top: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      h1 {
        margin: 8px 0 0;
        max-width: 36rem;
        font-size: 24px;
        line-height: 1.14;
      }

      /* This summary panel is the premium cover-level container for the lecture/assessment brief.
         Keep the chip, contrast, and restrained accent together here so the PDF summary reads as an
         intentional file header block instead of falling back to plain body copy under the title. */
      .summary-panel {
        position: relative;
        margin-top: 10px;
        max-width: 38rem;
        padding: 11px 13px 12px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background:
          linear-gradient(${dark
            ? "180deg, rgba(8, 18, 35, 0.82), rgba(4, 11, 24, 0.68)"
            : "180deg, rgba(255, 255, 255, 0.82), rgba(244, 250, 248, 0.7)"}),
          radial-gradient(${dark
            ? "circle at top right, rgba(94, 234, 212, 0.12), transparent 42%"
            : "circle at top right, rgba(15, 118, 110, 0.08), transparent 40%"});
        box-shadow:
          inset 0 0 0 1px var(--line-strong),
          ${dark ? "0 16px 30px rgba(1, 4, 14, 0.18)" : "0 14px 26px rgba(15, 23, 42, 0.06)"};
      }

      .summary-chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border: 1px solid ${dark ? "rgba(94, 234, 212, 0.24)" : "rgba(15, 118, 110, 0.16)"};
        border-radius: 999px;
        background: ${dark ? "rgba(8, 30, 40, 0.84)" : "rgba(241, 249, 247, 0.92)"};
        color: ${dark ? "#dcfff9" : "#0f766e"};
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .summary {
        margin: 8px 0 0;
        max-width: none;
        font-size: 13px;
        line-height: 1.58;
        color: ${dark ? "rgba(232, 244, 248, 0.92)" : "rgba(15, 23, 42, 0.8)"};
      }

      /* The QR is intentionally pinned to the physical top-right corner of page one.
         Keep this export-only anchor independent from RTL/LTR flow so Arabic files do not drift
         left and the QR never steals the same width budget as the assessment title block. */
      .hero-qr {
        position: absolute;
        top: 0;
        ${qrInsetSide}: 0;
        width: 62px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .hero-qr-card {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        padding: 3px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: ${dark
          ? "linear-gradient(180deg, rgba(8, 18, 35, 0.96), rgba(4, 11, 24, 0.86))"
          : "var(--surface-strong)"};
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
      }

      .hero-qr-card img {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        background: white;
        padding: 3px;
      }

      .meta-ribbon {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 10px;
      }

      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 30px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 5px 10px;
        background: ${dark
          ? "linear-gradient(180deg, rgba(8, 18, 35, 0.94), rgba(4, 11, 24, 0.82))"
          : "var(--surface-soft)"};
      }

      .meta-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .meta-divider {
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: var(--accent);
        opacity: 0.82;
      }

      .meta-value {
        font-size: 12px;
        font-weight: 700;
      }

      /* The first-page shell owns the cover plus the first two question cards.
         Keep this split explicit so page one can match the requested cover-plus-two rhythm,
         while later pages stay free to pack denser repeated cards without disturbing question ordering. */
      .first-page-shell {
        display: grid;
        gap: 8px;
      }

      .first-page-questions {
        display: grid;
        gap: 6px;
      }

      .question-stack {
        display: grid;
        gap: 10px;
      }

      /* The question cards stay intentionally translucent so the themed file background can read
         through, but they still keep enough ink density for PDF readability and classroom-safe print.
         Do not turn these back into opaque slabs or the detached export mood will drift away again. */
      .question-card {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px 13px;
        background: ${dark
          ? "linear-gradient(180deg, rgba(8, 18, 35, 0.74), rgba(4, 11, 24, 0.58))"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.34))"};
        box-shadow:
          inset 0 0 0 1px var(--line-strong),
          ${dark ? "0 16px 34px rgba(1, 4, 14, 0.2)" : "0 14px 28px rgba(15, 23, 42, 0.08)"};
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* Page-one and page-two+ question density intentionally differ.
         The first-page cards stay balanced beside the cover, while later cards are tightened so
         normal exports can reach three questions per page without collapsing readability. */
      .question-card--first-page {
        min-height: 41mm;
        border-radius: 13px;
        padding: 10px 11px 9px;
      }

      .question-card--compact {
        border-radius: 12px;
        padding: 10px 11px 9px;
      }

      .question-card--first-page .question-header,
      .question-card--compact .question-header {
        gap: 7px;
        margin-bottom: 5px;
      }

      .question-card--first-page .question-index,
      .question-card--compact .question-index {
        width: 26px;
        height: 26px;
        font-size: 11.2px;
      }

      .question-card--first-page .question-type,
      .question-card--compact .question-type {
        padding: 3px 7px;
        font-size: 10px;
      }

      .question-card--first-page .question-title {
        font-size: 14.7px;
        line-height: 1.43;
      }

      .question-card--compact .question-title {
        font-size: 14.3px;
        line-height: 1.42;
      }

      .question-header {
        display: flex;
        align-items: center;
        justify-content: ${questionHeaderJustify};
        gap: 8px;
        margin-bottom: 7px;
      }

      .question-index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
      }

      .question-type {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: ${dark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.05)"};
        color: var(--muted);
        font-size: 10.5px;
        font-weight: 700;
      }

      .question-title {
        margin: 0;
        font-size: 15.4px;
        line-height: 1.48;
        white-space: pre-wrap;
      }

      .choice-list {
        display: grid;
        gap: 6px;
        margin-top: 8px;
      }

      /* This paired grid is the PDF-specific counterpart to the preview/result layout.
         Keep four-choice MCQ sets in two columns when space allows so export parity stays intact
         without turning the PDF into a tall single-column document. */
      .choice-list--paired {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .choice-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 8px 10px;
        background: ${dark ? "rgba(7, 18, 35, 0.72)" : "rgba(255, 255, 255, 0.56)"};
        box-shadow: inset 0 1px 0 ${dark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.82)"};
        font-size: 12.4px;
        line-height: 1.48;
      }

      .question-card--first-page .choice-list,
      .question-card--compact .choice-list {
        gap: 5px;
        margin-top: 6px;
      }

      .question-card--first-page .choice-item,
      .question-card--compact .choice-item {
        gap: 7px;
        border-radius: 10px;
        padding: 6px 8px;
        font-size: 11.8px;
        line-height: 1.42;
      }

      .choice-marker {
        min-width: 2.2em;
        font-weight: 800;
        color: var(--accent);
      }

      /* Preview/result/PDF all use this stateful option highlight to mark the resolved correct
         answer with one quiet premium accent. Preserve the restrained tint and glow balance here
         so export files stay elegant and readable instead of drifting into neon quiz styling. */
      .choice-item--correct {
        border-color: ${dark ? "rgba(103, 232, 216, 0.34)" : "rgba(16, 185, 129, 0.28)"};
        background: ${dark
          ? "linear-gradient(180deg, rgba(12, 34, 43, 0.78), rgba(7, 24, 36, 0.9))"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(236, 253, 245, 0.9))"};
        box-shadow:
          inset 0 0 0 1px ${dark ? "rgba(103, 232, 216, 0.14)" : "rgba(16, 185, 129, 0.12)"},
          ${dark ? "0 0 22px rgba(45, 212, 191, 0.12)" : "0 12px 24px rgba(16, 185, 129, 0.1)"};
      }

      .choice-marker--correct {
        color: ${dark ? "#e6fffa" : "#0f766e"};
        text-shadow: ${dark ? "0 0 10px rgba(94, 234, 212, 0.18)" : "none"};
      }

      .choice-text {
        min-width: 0;
        flex: 1;
        font-weight: 600;
      }

      .choice-correct-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        flex: none;
        border-radius: 999px;
        border: 1px solid ${dark ? "rgba(167, 243, 208, 0.24)" : "rgba(16, 185, 129, 0.22)"};
        background: ${dark ? "rgba(110, 231, 183, 0.12)" : "rgba(255, 255, 255, 0.88)"};
        color: ${dark ? "#ecfeff" : "#0f766e"};
        font-size: 10px;
        font-weight: 800;
        box-shadow: ${dark ? "0 0 16px rgba(45, 212, 191, 0.14)" : "0 8px 18px rgba(16, 185, 129, 0.1)"};
      }

      .supplemental-copy {
        margin-top: 8px;
      }

      .question-card--first-page .supplemental-copy,
      .question-card--compact .supplemental-copy {
        margin-top: 6px;
      }

      .supplemental-copy p {
        margin: 0 0 6px;
        font-size: 12.4px;
        line-height: 1.52;
        color: var(--muted);
      }

      .question-card--first-page .supplemental-copy p,
      .question-card--compact .supplemental-copy p {
        margin: 0 0 4px;
        font-size: 11.7px;
        line-height: 1.45;
      }

      .answer-card,
      .rationale-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: ${dark
          ? "linear-gradient(180deg, rgba(6, 15, 30, 0.82), rgba(3, 10, 22, 0.64))"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(241, 249, 247, 0.46))"};
        padding: 9px 11px;
        margin-top: 8px;
        box-shadow: inset 0 1px 0 ${dark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.86)"};
      }

      .question-card--first-page .answer-card,
      .question-card--first-page .rationale-card,
      .question-card--compact .answer-card,
      .question-card--compact .rationale-card {
        border-radius: 10px;
        padding: 7px 9px;
        margin-top: 6px;
      }

      .answer-label {
        font-size: 10px;
        font-weight: 800;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .answer-card p,
      .rationale-card p {
        margin: 6px 0 0;
        font-size: 12.4px;
        line-height: 1.52;
        white-space: pre-wrap;
      }

      .question-card--first-page .answer-card p,
      .question-card--first-page .rationale-card p,
      .question-card--compact .answer-card p,
      .question-card--compact .rationale-card p {
        margin: 5px 0 0;
        font-size: 11.8px;
        line-height: 1.44;
      }

      .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .question-card--first-page .tag-list,
      .question-card--compact .tag-list {
        gap: 5px;
        margin-top: 6px;
      }

      .tag-item {
        display: inline-flex;
        padding: 4px 8px;
        border-radius: 999px;
        background: ${dark ? "rgba(45, 212, 191, 0.14)" : "rgba(16, 185, 129, 0.09)"};
        color: ${dark ? "#d7fff6" : "#0f766e"};
        font-size: 10.5px;
        font-weight: 700;
      }

      .question-card--first-page .tag-item,
      .question-card--compact .tag-item {
        padding: 3px 7px;
        font-size: 9.8px;
      }

      .question-stack--following {
        gap: 7px;
      }

      /* This dedicated closing page is always appended after the actual assessment content.
         Preserve its forced page break plus the shared light/dark file-surface tokens here so
         the support message stays the true final page without drifting away from export theming. */
      .support-page {
        position: relative;
        margin-top: 14px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 18px 18px 16px;
        background:
          linear-gradient(${dark ? "180deg, rgba(4, 13, 27, 0.9), rgba(5, 16, 31, 0.72)" : "180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.52)"}),
          radial-gradient(${dark ? "circle at top right, rgba(103, 232, 216, 0.12), transparent 32%" : "circle at top right, rgba(15, 118, 110, 0.08), transparent 30%"}),
          radial-gradient(${dark ? "circle at bottom left, rgba(56, 189, 248, 0.08), transparent 34%" : "circle at bottom left, rgba(15, 118, 110, 0.06), transparent 28%"});
        box-shadow:
          inset 0 0 0 1px var(--line-strong),
          ${dark ? "0 24px 54px rgba(1, 4, 14, 0.28)" : "0 20px 42px rgba(15, 23, 42, 0.1)"};
        break-before: page;
        page-break-before: always;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .support-page::before,
      .support-page::after {
        content: "";
        position: absolute;
        inset: auto;
        border-radius: 999px;
        pointer-events: none;
        opacity: ${dark ? "0.8" : "1"};
      }

      .support-page::before {
        top: -58px;
        left: -36px;
        width: 166px;
        height: 166px;
        background: ${dark ? "radial-gradient(circle, rgba(103, 232, 216, 0.14), transparent 68%)" : "radial-gradient(circle, rgba(15, 118, 110, 0.12), transparent 66%)"};
      }

      .support-page::after {
        right: -30px;
        bottom: -54px;
        width: 180px;
        height: 180px;
        background: ${dark ? "radial-gradient(circle, rgba(56, 189, 248, 0.12), transparent 70%)" : "radial-gradient(circle, rgba(242, 198, 106, 0.16), transparent 72%)"};
      }

      .support-page-inner {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 12px;
      }

      .support-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(248px, 0.92fr);
        gap: 12px;
        align-items: start;
      }

      .support-main,
      .support-side {
        display: grid;
        gap: 12px;
      }

      .support-eyebrow {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .support-title {
        margin: 8px 0 0;
        font-size: 28px;
        line-height: 1.14;
      }

      .support-subtitle {
        margin: 8px 0 0;
        max-width: 34rem;
        font-size: 14px;
        line-height: 1.72;
        color: var(--muted);
      }

      .support-chip-row,
      .support-cost-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .support-chip-row {
        margin-top: 12px;
      }

      .support-cost-grid {
        margin-top: 11px;
      }

      .support-chip {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 6px 11px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: ${dark
          ? "linear-gradient(180deg, rgba(8, 18, 35, 0.92), rgba(4, 11, 24, 0.8))"
          : "rgba(255, 255, 255, 0.72)"};
        font-size: 11.3px;
        font-weight: 700;
        line-height: 1.4;
        color: var(--ink);
      }

      .support-chip--cost {
        background: ${dark ? "rgba(45, 212, 191, 0.12)" : "rgba(16, 185, 129, 0.09)"};
        color: ${dark ? "#defdf6" : "#0f766e"};
      }

      .support-card {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px 13px;
        background: ${dark
          ? "linear-gradient(180deg, rgba(7, 18, 35, 0.8), rgba(4, 11, 24, 0.64))"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.44))"};
        box-shadow:
          inset 0 0 0 1px var(--line-strong),
          ${dark ? "0 16px 32px rgba(1, 4, 14, 0.16)" : "0 12px 24px rgba(15, 23, 42, 0.06)"};
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .support-card h3 {
        margin: 0;
        font-size: 15px;
        line-height: 1.4;
      }

      .support-card p {
        margin: 8px 0 0;
        font-size: 12.4px;
        line-height: 1.7;
        color: var(--muted);
      }

      .support-card--lead p {
        margin-top: 0;
        font-size: 13.3px;
        line-height: 1.8;
        color: var(--ink);
        font-weight: 600;
      }

      .support-impact-list {
        display: grid;
        gap: 8px;
        margin-top: 11px;
      }

      .support-impact-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 8px 10px;
        background: ${dark ? "rgba(7, 18, 35, 0.74)" : "rgba(255, 255, 255, 0.58)"};
      }

      .support-impact-bullet {
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        line-height: 1.5;
      }

      .support-impact-item p {
        margin: 0;
        color: var(--ink);
        font-size: 12.1px;
        line-height: 1.62;
        font-weight: 600;
      }

      /* Keep the support contact paths explicit on the final page so the exported file itself
         remains self-sufficient: QR, Contact page path, and direct link all stay visible even
         after the student shares or prints the PDF away from the live app shell. */
      .support-contact-grid {
        display: grid;
        grid-template-columns: 102px minmax(0, 1fr);
        gap: 10px;
        margin-top: 12px;
        align-items: stretch;
      }

      .support-qr-panel {
        display: grid;
        align-content: start;
        justify-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 10px 8px;
        background: ${dark ? "rgba(4, 13, 27, 0.88)" : "rgba(255, 255, 255, 0.76)"};
        text-align: center;
      }

      .support-qr-label {
        font-size: 9.8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .support-qr-card {
        display: grid;
        place-items: center;
        width: 76px;
        height: 76px;
        padding: 4px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: ${dark
          ? "linear-gradient(180deg, rgba(8, 18, 35, 0.96), rgba(4, 11, 24, 0.86))"
          : "var(--surface-strong)"};
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
      }

      .support-qr-card img {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        background: white;
        padding: 4px;
      }

      .support-contact-stack {
        display: grid;
        gap: 8px;
      }

      .support-contact-card {
        display: block;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 10px 12px;
        background: ${dark ? "rgba(7, 18, 35, 0.78)" : "rgba(255, 255, 255, 0.62)"};
        color: inherit;
        text-decoration: none;
      }

      .support-contact-label {
        display: block;
        font-size: 9.8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .support-contact-value {
        display: block;
        margin-top: 5px;
        font-size: 12.8px;
        line-height: 1.55;
        color: var(--ink);
        font-weight: 700;
        word-break: break-word;
      }

      .support-personal-note {
        margin-top: 11px !important;
        font-size: 12px !important;
      }

      /* The closing line is the final emotional note on the exported file.
         Keep it concise and visually separated so the support page feels intentional and premium,
         not like an appendix or a dense postscript bolted onto the end. */
      .support-closing {
        position: relative;
        z-index: 1;
        margin: 2px 0 0;
        padding-top: 10px;
        border-top: 1px solid var(--line);
        font-size: 13px;
        line-height: 1.76;
        color: var(--ink);
        font-weight: 600;
      }

      /* The footer bar is now one shared system for signature copy and page numbering.
         Keep both pieces inside this same surface so exported PDFs do not regress back into
         detached stacked strips that feel separate from the rest of the file chrome. */
      .screen-footer,
      .print-footer {
        align-items: center;
        gap: 12px;
        border: 1px solid ${dark ? "rgba(94, 234, 212, 0.18)" : "rgba(15, 118, 110, 0.14)"};
        border-radius: 16px;
        padding: 8px 11px;
        background:
          linear-gradient(${dark
            ? "180deg, rgba(4, 13, 27, 0.97), rgba(3, 10, 22, 0.92)"
            : "180deg, rgba(255, 255, 255, 0.88), rgba(246, 251, 249, 0.8)"}),
          radial-gradient(${dark
            ? "circle at left center, rgba(94, 234, 212, 0.08), transparent 34%"
            : "circle at left center, rgba(15, 118, 110, 0.05), transparent 34%"});
        box-shadow:
          inset 0 0 0 1px var(--line-strong),
          ${dark ? "0 12px 28px rgba(1, 4, 14, 0.18)" : "0 10px 22px rgba(15, 23, 42, 0.06)"};
        direction: ltr;
      }

      .screen-footer {
        display: flex;
        margin-top: 16px;
      }

      /* This slot reserves the page-number column inside the unified footer bar.
         Keep its width and divider aligned with the paged-media counter below so printed numbers
         read as part of the same footer system instead of drifting back into a detached strip. */
      .footer-page {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        padding-right: 12px;
        border-right: 1px solid ${dark ? "rgba(148, 163, 184, 0.24)" : "rgba(15, 23, 42, 0.12)"};
        color: ${dark ? "#dcfff9" : "#0f766e"};
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        flex: none;
      }

      .signature-copy {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        text-align: right;
        direction: rtl;
      }

      .signature-label {
        display: block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .signature-text {
        margin: 4px 0 0;
        font-size: 11px;
        line-height: 1.45;
        color: var(--ink);
        font-weight: ${dark ? "500" : "400"};
      }

      .print-hint {
        margin-top: 14px;
        font-size: 11px;
        color: var(--muted);
      }

      @page {
        /* The page box owns the true full-page bleed in Chrome print output.
           Keep this foundation matched to the themed file background edge tone so exported PDFs
           never fall back to black or blank border bands around the designed sheet. */
        background: ${pageBackgroundFoundation};
        margin: ${pageMarginTop} ${pageMarginRight} ${pageMarginBottom} ${pageMarginLeft};
        ${
          pageNumberMode === "css"
            ? `/* Human-opened print surfaces still rely on Chrome's paged-media counter because the browser
                 owns those manual print pages outside the server PDF pipeline. Keep this bare left-aligned
                 number lightweight so it reads as the same footer system instead of a second pill. */
               @${pageBadgeMarginAtRule} {
                 content: counter(page);
                 font-family: "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Tahoma, Arial, sans-serif;
                 font-size: 11px;
                 font-weight: 800;
                 color: ${dark ? "#dcfff9" : "#0f766e"};
                 text-align: left;
                 vertical-align: middle;
                 padding: 0 0 2.1mm 12.2mm;
               }`
            : ""
        }
      }

      @media screen and (max-width: 760px) {
        /* Keep this fallback screen-only. Printed pages are narrow enough to match this breakpoint,
           and letting it apply during export would collapse the QR out of its corner anchor. */
        .cover-shell {
          ${coverPaddingSide}: 0;
        }

        .hero-qr {
          position: static;
          width: auto;
          flex-direction: row;
          justify-content: flex-end;
          margin-bottom: 10px;
        }

        .support-grid,
        .support-contact-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .support-qr-panel {
          justify-items: start;
          text-align: right;
        }
      }

      @media (max-width: 620px) {
        .choice-list--paired {
          grid-template-columns: minmax(0, 1fr);
        }

        .question-card--first-page {
          min-height: auto;
        }
      }

      @media print {
        html,
        body {
          background: ${pageBackgroundFoundation};
        }

        body {
          padding: 0;
        }

        .screen-background,
        .screen-wash {
          display: none;
        }

        /* The @page foundation owns the outer edge strip, while this fixed layer owns the richer
           themed artwork inside the printed sheet. Keep both layers visually aligned, but do not
           move edge-gap ownership back here because Chrome will not paint page margins from it. */
        /* Dark printed pages still need an opaque inner artwork layer instead of a low-opacity
           image floating over white paper. Preserve that depth so the PDF keeps its midnight mood
           once the page-box foundation removes the old black edge bands. */
        .page-background-print {
          display: block;
          z-index: 0;
          top: calc(-1 * ${pageMarginTop});
          right: calc(-1 * ${pageMarginRight});
          bottom: calc(-1 * ${pageMarginBottom});
          left: calc(-1 * ${pageMarginLeft});
          opacity: ${dark ? "1" : "0.44"};
        }

        /* This chrome layer decorates the printed sheet above the page-box foundation.
           Keep the frame and fold anchored to the same artwork bounds so future spacing tweaks do
           not reintroduce visible edge gaps between the safe content area and the file background. */
        .page-chrome-print {
          display: block;
          position: fixed;
          top: calc(-1 * ${pageMarginTop});
          right: calc(-1 * ${pageMarginRight});
          bottom: calc(-1 * ${pageMarginBottom});
          left: calc(-1 * ${pageMarginLeft});
          z-index: 1;
          pointer-events: none;
        }

        .page-chrome-print .page-frame {
          position: absolute;
          inset: ${pageFrameInset};
          border-radius: 0;
        }

        .page-chrome-print .page-fold {
          position: absolute;
          top: 0;
          ${pageFoldSide}: 0;
          width: 24mm;
          height: 24mm;
        }

        /* The safe content area still belongs to the paged sheet, not the full-page foundation.
           Keep exported content inset here so the background can reach the edges cleanly without
           letting cards, QR, or footer copy drift into the trim-sensitive outer page band. */
        .sheet {
          box-shadow: none;
          border: none;
          border-radius: 0;
          max-width: none;
          padding: 0;
          background: transparent;
        }

        .sheet-frame,
        .sheet-fold,
        .screen-footer,
        .print-hint {
          display: none;
        }

        /* This forced page boundary is the print-only contract that keeps page one as
           cover-plus-two-questions and lets later sheets use the denser repeated card rhythm. */
        .first-page-shell--with-following {
          break-after: page;
          page-break-after: always;
        }

        .first-page-shell {
          gap: 7px;
        }

        .first-page-questions {
          min-height: 0;
          gap: 5px;
        }

        .question-card--first-page {
          min-height: 39mm;
        }

        .support-page {
          margin-top: 0;
          border-radius: 18px;
          padding: 15px 15px 13px;
        }

        .support-grid {
          gap: 10px;
        }

        .support-title {
          font-size: 24px;
        }

        .support-subtitle {
          font-size: 13.2px;
        }

        .support-card {
          border-radius: 14px;
          padding: 10px 11px;
        }

        .support-contact-grid {
          grid-template-columns: 94px minmax(0, 1fr);
          gap: 8px;
        }

        .support-qr-card {
          width: 72px;
          height: 72px;
        }

        .support-qr-card img {
          width: 60px;
          height: 60px;
        }

        .print-footer {
          display: flex;
          position: fixed;
          left: 7mm;
          right: 7mm;
          bottom: 3.5mm;
          z-index: 2;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-background" aria-hidden="true"></div>
    <div class="screen-wash" aria-hidden="true"></div>
    <div class="page-background-print" aria-hidden="true"></div>
    <div class="page-chrome-print" aria-hidden="true">
      <span class="page-frame"></span>
      <span class="page-fold"></span>
      <!-- This decorative seal repeats on every printed page through the shared print chrome.
           Keep it lower-left, theme-aware, and outside the footer/page-number safety zone. -->
      <span class="page-seal-print">
        <img src="${escapeHtml(sealAssetUrl)}" alt="" />
      </span>
    </div>
    <!-- Printed pages keep page numbering and Arabic signature copy inside one shared footer bar.
         Future agents should preserve this single-surface composition instead of re-splitting it. -->
    <footer class="print-footer">
      <span class="footer-page print-footer-page" aria-hidden="true"></span>
      <div class="signature-copy">
        <span class="signature-label">${escapeHtml(signature.label)}</span>
        <p class="signature-text">${escapeHtml(printFooterText)}</p>
      </div>
    </footer>
    <main class="sheet">
      <span class="sheet-frame" aria-hidden="true"></span>
      <span class="sheet-fold" aria-hidden="true"></span>

      <section class="first-page-shell ${followingQuestions.length > 0 ? "first-page-shell--with-following" : ""}">
        <section class="cover-shell">
          <div class="hero-qr">
            <span class="hero-qr-card">
              <img src="${escapeHtml(qrCodeDataUrl)}" alt="${escapeHtml(
                preview.locale === "ar" ? "رمز QR لمنصة زوتوبيا" : "QR code for Zootopia Club",
              )}" />
            </span>
          </div>

          <header class="cover-brand">
            <img class="brand-logo" src="${escapeHtml(preview.fileSurface.logoAssetUrl)}" alt="${escapeHtml(preview.fileSurface.platformName)}" />
            <div class="cover-copy">
              <span class="brand-eyebrow">${escapeHtml(preview.fileSurface.platformTagline)}</span>
              <span class="brand-name">${escapeHtml(preview.fileSurface.platformName)}</span>
              <span class="eyebrow">${escapeHtml(pdfEyebrow)}</span>
              <h1>${escapeHtml(preview.title)}</h1>
              <div class="summary-panel">
                <span class="summary-chip">${escapeHtml(summaryLabel)}</span>
                <p class="summary">${escapeHtml(preview.summary)}</p>
              </div>
            </div>
          </header>

          <section class="meta-ribbon">${metadata}</section>
        </section>

        ${
          firstPageQuestionCards
            ? `
              <section class="first-page-questions">
                ${firstPageQuestionCards}
              </section>
            `
            : ""
        }
      </section>

      ${
        followingQuestionCards
          ? `<section class="question-stack question-stack--following">${followingQuestionCards}</section>`
          : ""
      }

      <!-- This closing support page is intentionally appended after every real assessment page.
           Future agents should keep it as the final standalone sheet, preserve its Arabic-only
           hierarchy, and continue sourcing its copy/paths from the shared file-surface contract. -->
      <section class="support-page" dir="rtl" lang="ar">
        <div class="support-page-inner">
          <div class="support-grid">
            <div class="support-main">
              <header>
                <span class="support-eyebrow">${escapeHtml(supportPage.eyebrow)}</span>
                <h2 class="support-title">${escapeHtml(supportPage.title)}</h2>
                <p class="support-subtitle">${escapeHtml(supportPage.subtitle)}</p>
                <div class="support-chip-row">
                  ${supportHeroChips}
                </div>
              </header>

              <article class="support-card support-card--lead">
                <p>${escapeHtml(supportPage.emotionalNote)}</p>
              </article>

              <article class="support-card">
                <h3>${escapeHtml(supportPage.continuityTitle)}</h3>
                <p>${escapeHtml(supportPage.continuityBody)}</p>
              </article>

              <article class="support-card">
                <h3>${escapeHtml(supportPage.costTitle)}</h3>
                <div class="support-cost-grid">
                  ${supportCostItems}
                </div>
              </article>
            </div>

            <aside class="support-side">
              <article class="support-card">
                <h3>${escapeHtml(supportPage.impactTitle)}</h3>
                <div class="support-impact-list">
                  ${supportImpactItems}
                </div>
              </article>

              <article class="support-card">
                <h3>${escapeHtml(supportPage.contactTitle)}</h3>
                <p>${escapeHtml(supportPage.contactBody)}</p>
                <div class="support-contact-grid">
                  <div class="support-qr-panel">
                    <span class="support-qr-label">${escapeHtml(supportPage.qrLabel)}</span>
                    <span class="support-qr-card">
                      <img
                        src="${escapeHtml(qrCodeDataUrl)}"
                        alt="${escapeHtml("رمز QR للدعم والتواصل مع مطور المنصة")}"
                      />
                    </span>
                  </div>
                  <div class="support-contact-stack">
                    ${supportContactCards}
                  </div>
                </div>
                <p class="support-personal-note">${escapeHtml(supportPage.personalContactNote)}</p>
              </article>
            </aside>
          </div>

          <p class="support-closing">${escapeHtml(supportPage.closingLine)}</p>
        </div>
      </section>

      <footer class="screen-footer">
        <div class="signature-copy">
          <span class="signature-label">${escapeHtml(signature.label)}</span>
          <p class="signature-text">${escapeHtml(printFooterText)}</p>
        </div>
      </footer>

      <p class="print-hint">${escapeHtml(printHint)}</p>
    </main>
    ${
      autoPrint
        ? `<script>
      /* The print surface should auto-open the browser dialog only when a human intentionally
         visits the print view. Server-generated PDF rendering reuses the same HTML without this
         side effect so the backend can capture real PDF bytes deterministically. */
      window.addEventListener("load", () => {
        window.setTimeout(() => window.print(), 120);
      });
    </script>`
        : ""
    }
  </body>
</html>`;
}
