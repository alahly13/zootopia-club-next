import "server-only";

import type { AssessmentGeneration, AssessmentQuestionType, Locale } from "@zootopia/shared-types";

import type {
  AssessmentPreviewCompositionBadge,
  AssessmentPreviewQuestionItem,
  NormalizedAssessmentPreview,
} from "@/lib/assessment-preview-model";
import {
  ASSESSMENT_FILE_FOOTER_TEXT,
  buildAssessmentFileSurface,
} from "@/lib/assessment-file-branding";
import {
  annotateAssessmentCorrectChoices,
  countFillBlanks,
  deriveAssessmentQuestionDisplay,
  extractMatchingPairs,
  formatAssessmentAnswerDisplay,
  resolveTrueFalseAnswerValue,
  splitMultipleResponseAnswers,
} from "@/lib/assessment-question-display";
import {
  buildAssessmentDocxExportRoute,
  buildAssessmentFastPdfExportRoute,
  buildAssessmentJsonExportRoute,
  buildAssessmentMarkdownExportRoute,
  buildAssessmentProPdfExportRoute,
  buildAssessmentResultApiRoute,
} from "@/lib/assessment-routes";
import type { AppMessages } from "@/lib/messages";

function formatDateLabel(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDifficultyLabel(value: AssessmentGeneration["meta"]["difficulty"], messages: AppMessages) {
  switch (value) {
    case "easy":
      return messages.difficultyEasy;
    case "hard":
      return messages.difficultyHard;
    default:
      return messages.difficultyMedium;
  }
}

function getLanguageLabel(value: Locale, messages: AppMessages) {
  return value === "ar" ? messages.localeArabic : messages.localeEnglish;
}

function getModeLabel(value: AssessmentGeneration["meta"]["mode"], messages: AppMessages) {
  return value === "exam_generation"
    ? messages.assessmentModeExamGeneration
    : messages.assessmentModeQuestionGeneration;
}

function getProviderLabel(value: AssessmentGeneration["meta"]["provider"], messages: AppMessages) {
  return value === "qwen" ? messages.modelProviderQwen : messages.modelProviderGoogle;
}

function getQuestionTypeLabel(value: AssessmentQuestionType, messages: AppMessages) {
  switch (value) {
    case "true_false":
      return messages.assessmentTypeTrueFalse;
    case "essay":
      return messages.assessmentTypeEssay;
    case "fill_blanks":
      return messages.assessmentTypeFillBlanks;
    case "short_answer":
      return messages.assessmentTypeShortAnswer;
    case "matching":
      return messages.assessmentTypeMatching;
    case "multiple_response":
      return messages.assessmentTypeMultipleResponse;
    default:
      return messages.assessmentTypeMcq;
  }
}

function getInputModeLabel(value: AssessmentGeneration["meta"]["inputMode"], messages: AppMessages) {
  switch (value) {
    case "pdf-file":
      return messages.assessmentInputModePdf;
    case "text-context":
      return messages.assessmentInputModeTextContext;
    default:
      return messages.assessmentInputModePromptOnly;
  }
}

function getStatusLabel(value: AssessmentGeneration["status"], messages: AppMessages) {
  return value === "expired"
    ? messages.assessmentStatusExpired
    : messages.documentStatusReady;
}

function buildPreviewQuestionItem(input: {
  question: AssessmentGeneration["questions"][number];
  index: number;
  messages: AppMessages;
}): AssessmentPreviewQuestionItem {
  const { question, index, messages } = input;

  // Preview, result, Markdown, DOCX, and PDF surfaces must all consume the same interpreted
  // question hierarchy so inline provider-formatted MCQ choices never drift back into the stem.
  const display = deriveAssessmentQuestionDisplay(question.question);
  const choices = annotateAssessmentCorrectChoices({
    answerText: question.answer,
    choices: display.choices,
  });

  return {
    id: question.id,
    index,
    questionType: question.type ?? null,
    typeLabel: question.type ? getQuestionTypeLabel(question.type, messages) : null,
    question: question.question,
    stem: display.stem,
    /* Preview/result/PDF question cards now share one server-authored correct-choice flag.
       Preserve this normalized field so the premium highlight stays consistent across every
       detached file surface instead of each renderer re-parsing answer text on its own. */
    choices,
    choiceLayout: display.choiceLayout,
    supplementalLines: display.supplementalLines,
    answer: question.answer,
    answerDisplay: formatAssessmentAnswerDisplay({
      answerText: question.answer,
      questionType: question.type,
      choices: display.choices,
    }),
    rationale: question.rationale ?? null,
    tags: question.tags ?? [],
  };
}

function buildPlainTextExport(input: {
  generation: AssessmentGeneration;
  messages: AppMessages;
  questions: AssessmentPreviewQuestionItem[];
}) {
  const { generation, messages, questions } = input;
  const lines = [
    generation.title,
    generation.meta.summary,
    "",
    `${messages.assessmentQuestionCount}: ${generation.meta.questionCount}`,
    `${messages.assessmentModeLabel}: ${getModeLabel(generation.meta.mode, messages)}`,
    `${messages.assessmentDifficulty}: ${getDifficultyLabel(generation.meta.difficulty, messages)}`,
    `${messages.assessmentLanguage}: ${getLanguageLabel(generation.meta.language, messages)}`,
    `${messages.assessmentModelLabel}: ${generation.meta.modelLabel}`,
    `${messages.assessmentInputModeLabel}: ${getInputModeLabel(generation.meta.inputMode, messages)}`,
  ];

  if (generation.meta.sourceDocument?.fileName) {
    lines.push(`${messages.assessmentSourceDocument}: ${generation.meta.sourceDocument.fileName}`);
  }

  lines.push("");

  for (const question of questions) {
    lines.push(`${question.index + 1}. ${question.stem}`);
    if (question.choices.length > 0) {
      lines.push(...question.choices.map((choice) => `   ${choice.displayText}`));
    }
    if (question.supplementalLines.length > 0) {
      lines.push(...question.supplementalLines.map((line) => `   ${line}`));
    }
    if (question.typeLabel) {
      lines.push(`   ${messages.assessmentQuestionTypesLabel}: ${question.typeLabel}`);
    }
    lines.push(`   ${messages.assessmentAnswerLabel}: ${question.answerDisplay}`);
    if (question.rationale) {
      lines.push(`   ${messages.assessmentRationaleLabel}: ${question.rationale}`);
    }
    if (question.tags?.length) {
      lines.push(`   ${messages.assessmentTagsLabel}: ${question.tags.join(", ")}`);
    }
    lines.push("");
  }

  return lines.filter((line): line is string => line != null).join("\n").trim();
}

function buildMarkdownExport(input: {
  generation: AssessmentGeneration;
  messages: AppMessages;
  questions: AssessmentPreviewQuestionItem[];
  footerText: string;
}) {
  const { generation, messages, questions, footerText } = input;
  const lines = [
    `# ${generation.title}`,
    "",
    generation.meta.summary,
    "",
    `- ${messages.assessmentQuestionCount}: ${generation.meta.questionCount}`,
    `- ${messages.assessmentModeLabel}: ${getModeLabel(generation.meta.mode, messages)}`,
    `- ${messages.assessmentDifficulty}: ${getDifficultyLabel(generation.meta.difficulty, messages)}`,
    `- ${messages.assessmentLanguage}: ${getLanguageLabel(generation.meta.language, messages)}`,
    `- ${messages.assessmentModelLabel}: ${generation.meta.modelLabel}`,
    `- ${messages.assessmentInputModeLabel}: ${getInputModeLabel(generation.meta.inputMode, messages)}`,
  ];

  if (generation.meta.sourceDocument?.fileName) {
    lines.push(`- ${messages.assessmentSourceDocument}: ${generation.meta.sourceDocument.fileName}`);
  }

  lines.push("", "## Questions", "");

  for (const question of questions) {
    lines.push(`### ${question.index + 1}. ${question.stem.replace(/\n+/g, " ")}`);
    lines.push("");
    if (question.choices.length > 0) {
      lines.push(...question.choices.map((choice) => `- ${choice.displayText}`));
      lines.push("");
    }
    if (question.supplementalLines.length > 0) {
      lines.push(...question.supplementalLines);
      lines.push("");
    }
    if (question.typeLabel) {
      lines.push(`- ${messages.assessmentQuestionTypesLabel}: ${question.typeLabel}`);
    }
    lines.push(`- ${messages.assessmentAnswerLabel}: ${question.answerDisplay}`);
    if (question.rationale) {
      lines.push(`- ${messages.assessmentRationaleLabel}: ${question.rationale}`);
    }
    if (question.tags?.length) {
      lines.push(`- ${messages.assessmentTagsLabel}: ${question.tags.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("---", "", `> ${footerText}`);

  return lines.join("\n").trim();
}

export function buildAssessmentPreview(input: {
  generation: AssessmentGeneration;
  locale: Locale;
  messages: AppMessages;
}): NormalizedAssessmentPreview {
  const { generation, locale, messages } = input;
  const generatedAtLabel = formatDateLabel(generation.createdAt, locale);
  const expiresAtLabel = formatDateLabel(generation.expiresAt, locale);
  const fileSurface = buildAssessmentFileSurface({
    platformName: messages.appName,
    platformTagline: messages.tagline,
  });
  const questions = generation.questions.map((question, index) =>
    buildPreviewQuestionItem({
      question,
      index,
      messages,
    }),
  );

  return {
    id: generation.id,
    title: generation.title,
    summary: generation.meta.summary,
    locale,
    direction: directionForLocale(locale),
    status: generation.status,
    statusLabel: getStatusLabel(generation.status, messages),
    modeLabel: getModeLabel(generation.meta.mode, messages),
    modelLabel: generation.meta.modelLabel,
    providerLabel: getProviderLabel(generation.meta.provider, messages),
    difficultyLabel: getDifficultyLabel(generation.meta.difficulty, messages),
    languageLabel: getLanguageLabel(generation.meta.language, messages),
    inputModeLabel: getInputModeLabel(generation.meta.inputMode, messages),
    questionCountLabel: `${generation.meta.questionCount} ${messages.assessmentQuestionsLabel}`,
    sourceDocumentLabel: generation.meta.sourceDocument?.fileName ?? null,
    generatedAtLabel,
    expiresAtLabel,
    metadata: [
      {
        label: messages.assessmentModeLabel,
        value: getModeLabel(generation.meta.mode, messages),
      },
      {
        label: messages.assessmentDifficulty,
        value: getDifficultyLabel(generation.meta.difficulty, messages),
      },
      {
        label: messages.assessmentLanguage,
        value: getLanguageLabel(generation.meta.language, messages),
      },
      {
        label: messages.assessmentModelLabel,
        value: generation.meta.modelLabel,
      },
      {
        label: messages.assessmentInputModeLabel,
        value: getInputModeLabel(generation.meta.inputMode, messages),
      },
      {
        label: messages.assessmentExpiresLabel,
        value: expiresAtLabel,
      },
    ],
    questions,
    fileSurface,
    plainTextExport: buildPlainTextExport({
      generation,
      messages,
      questions,
    }),
    markdownExport: buildMarkdownExport({
      generation,
      messages,
      questions,
      /* Markdown exports should reuse the same branded footer line as DOCX/PDF/file previews
         so extracted artifacts stay consistent even though Markdown has no visual card layout. */
      footerText: fileSurface.footerText || ASSESSMENT_FILE_FOOTER_TEXT,
    }),
    previewRoute: generation.previewRoute,
    resultRoute: generation.resultRoute,
    exportRoutes: {
      resultApi: buildAssessmentResultApiRoute(generation.id),
      json: buildAssessmentJsonExportRoute(generation.id),
      markdown: buildAssessmentMarkdownExportRoute(generation.id),
      docx: buildAssessmentDocxExportRoute(generation.id),
      /* Preview/result surfaces now receive explicit Pro vs Fast export routes so the premium
         Puppeteer lane can evolve independently without the lightweight browser-print lane
         hiding behind one overloaded route contract. */
      proPdf: buildAssessmentProPdfExportRoute(generation.id),
      fastPdf: buildAssessmentFastPdfExportRoute(generation.id),
    },
  };
}
