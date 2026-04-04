import "server-only";

import type {
  AssessmentPreviewThemeMode,
  AssessmentPreviewQuestionItem,
  NormalizedAssessmentPreview,
} from "@/lib/assessment-preview-model";
import {
  getProtectedSignatureCopy,
  PROTECTED_SIGNATURE_HEART,
  PROTECTED_SIGNATURE_LAPTOP,
} from "@/lib/branding/protected-signature";

/* The PDF route caches rendered print HTML artifacts, so this version tags the active
   print-first composition. Bump it whenever the exported layout changes materially, otherwise
   existing generations may keep reusing stale print HTML from owner-scoped artifact storage. */
export const ASSESSMENT_PRINT_LAYOUT_VERSION = "2026-04-04-compact-pdf-v6";

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
}) {
  return `
    <div class="choice-item">
      <span class="choice-marker">${escapeHtml(input.marker ? `${input.marker})` : "•")}</span>
      <span class="choice-text">${escapeHtml(input.text)}</span>
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

export function buildAssessmentPrintHtml(input: {
  preview: NormalizedAssessmentPreview;
  themeMode: AssessmentPreviewThemeMode;
  qrCodeDataUrl: string;
}) {
  const { preview, themeMode, qrCodeDataUrl } = input;
  const dark = themeMode === "dark";
  const signature = getProtectedSignatureCopy(preview.locale);
  const backgroundUrl = dark
    ? preview.fileSurface.backgroundDarkUrl
    : preview.fileSurface.backgroundLightUrl;
  const answerLabel = preview.locale === "ar" ? "الإجابة" : "Answer";
  const rationaleLabel = preview.locale === "ar" ? "التبرير" : "Rationale";
  const pdfEyebrow = preview.locale === "ar" ? "تصدير PDF" : "PDF export";
  const printHint = preview.locale === "ar"
    ? "استخدم نافذة الطباعة في المتصفح ثم اختر Save as PDF."
    : "Use your browser print dialog and choose Save as PDF.";
  const printFooterText = `${PROTECTED_SIGNATURE_LAPTOP} ${preview.fileSurface.footerText} ومن إبداع وأفكار ${PROTECTED_SIGNATURE_HEART}`;
  const questionHeaderJustify =
    preview.direction === "rtl" ? "flex-end" : "space-between";
  const qrInsetSide = "right";
  const coverPaddingSide = "padding-right";
  const pageFoldSide = preview.direction === "rtl" ? "left" : "right";
  const pageBadgeMarginAtRule = preview.direction === "rtl" ? "bottom-left" : "bottom-right";
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
        background: ${dark ? "#010611" : "#e2e8f0"};
        color: var(--ink);
        /* Assessment exports can now intentionally include tasteful emojis.
           Preserve emoji-capable font fallbacks here so browser Save-as-PDF keeps those glyphs
           visible instead of dropping them from the printed file surface. */
        font-family: "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Tahoma, Arial, sans-serif;
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
        margin: 8px 0 6px;
        max-width: 36rem;
        font-size: 24px;
        line-height: 1.14;
      }

      .summary {
        margin: 0;
        max-width: 38rem;
        font-size: 13px;
        line-height: 1.56;
        color: var(--muted);
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

      /* The question cards stay intentionally light and compact so the file background can
         breathe through while normal-length assessments still fit about three questions per page.
         Do not re-inflate this spacing unless readability genuinely regresses in print. */
      .question-card {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px 13px;
        background: ${dark
          ? "linear-gradient(180deg, rgba(8, 18, 35, 0.88), rgba(4, 11, 24, 0.78))"
          : "linear-gradient(180deg, var(--surface-soft), var(--surface-soft-2))"};
        box-shadow: inset 0 0 0 1px var(--line-strong);
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
        background: ${dark ? "rgba(7, 18, 35, 0.9)" : "var(--surface-strong)"};
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

      .choice-text {
        min-width: 0;
        flex: 1;
        font-weight: 600;
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
          ? "linear-gradient(180deg, rgba(6, 15, 30, 0.92), rgba(3, 10, 22, 0.86))"
          : "var(--surface-soft)"};
        padding: 9px 11px;
        margin-top: 8px;
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

      .screen-footer,
      .print-footer {
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid ${dark ? "rgba(94, 234, 212, 0.18)" : "rgba(15, 118, 110, 0.14)"};
        border-radius: 999px;
        padding: 8px 10px;
        background: ${dark ? "rgba(4, 13, 27, 0.96)" : "rgba(255, 255, 255, 0.82)"};
      }

      .screen-footer {
        display: flex;
        margin-top: 16px;
      }

      .signature-copy {
        min-width: 0;
        flex: 1;
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
        margin: 8mm 7mm 16mm;
        /* Real PDF page numbering must use the built-in paged-media page counter in the margin box.
           Future agents should keep counter(page) here, because non-standard counter names can
           fall back to 0 and break every exported page number at once. */
        @${pageBadgeMarginAtRule} {
          content: counter(page);
          font-family: "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Tahoma, Arial, sans-serif;
          font-size: 10px;
          font-weight: 800;
          color: ${dark ? "#dcfff9" : "#0f766e"};
          text-align: center;
          vertical-align: middle;
          padding: 1.5mm 2.2mm;
          border: 1px solid ${dark ? "rgba(103, 232, 216, 0.22)" : "rgba(15, 118, 110, 0.16)"};
          border-radius: 999px;
          background: ${dark ? "rgba(4, 13, 27, 0.97)" : "rgba(255, 255, 255, 0.92)"};
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
        body {
          background: white;
          padding: 0;
        }

        .screen-background,
        .screen-wash {
          display: none;
        }

        /* Dark printed pages need a real midnight foundation instead of a low-opacity image
           floating over white paper. Keep this print background opaque in dark mode, or the
           exported PDF drifts back toward the washed-out silver look this lane is avoiding. */
        .page-background-print {
          display: block;
          z-index: 0;
          inset: -6mm;
          opacity: ${dark ? "1" : "0.44"};
        }

        .page-chrome-print {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }

        .page-chrome-print .page-frame {
          position: fixed;
          inset: 4mm;
          border-radius: 0;
        }

        .page-chrome-print .page-fold {
          position: fixed;
          top: 0;
          ${pageFoldSide}: 0;
          width: 24mm;
          height: 24mm;
        }

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
    </div>
    <footer class="print-footer" dir="rtl">
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
              <p class="summary">${escapeHtml(preview.summary)}</p>
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

      <footer class="screen-footer" dir="rtl">
        <div class="signature-copy">
          <span class="signature-label">${escapeHtml(signature.label)}</span>
          <p class="signature-text">${escapeHtml(printFooterText)}</p>
        </div>
      </footer>

      <p class="print-hint">${escapeHtml(printHint)}</p>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.setTimeout(() => window.print(), 120);
      });
    </script>
  </body>
</html>`;
}
