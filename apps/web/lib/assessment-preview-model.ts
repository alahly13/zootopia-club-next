import type {
  AssessmentGenerationStatus,
  AssessmentQuestionType,
  Locale,
} from "@zootopia/shared-types";

export type AssessmentPreviewThemeMode = "light" | "dark";

export interface AssessmentPreviewMetadataItem {
  label: string;
  value: string;
}

export interface AssessmentPreviewChoiceItem {
  marker: string | null;
  text: string;
  displayText: string;
}

export interface AssessmentPreviewQuestionItem {
  id: string;
  index: number;
  questionType: AssessmentQuestionType | null;
  typeLabel: string | null;
  question: string;
  stem: string;
  choices: AssessmentPreviewChoiceItem[];
  choiceLayout: "stack" | "grid-2x2";
  supplementalLines: string[];
  answer: string;
  answerDisplay: string;
  rationale: string | null;
  tags: string[];
}

export interface AssessmentPreviewFileSurface {
  platformName: string;
  platformTagline: string;
  logoAssetUrl: string;
  qrTargetUrl: string;
  footerText: string;
  backgroundLightUrl: string;
  backgroundDarkUrl: string;
}

export interface AssessmentPreviewExportRoutes {
  resultApi: string;
  json: string;
  markdown: string;
  docx: string;
  pdf: string;
}

export interface NormalizedAssessmentPreview {
  id: string;
  title: string;
  summary: string;
  locale: Locale;
  direction: "ltr" | "rtl";
  status: AssessmentGenerationStatus;
  statusLabel: string;
  modeLabel: string;
  modelLabel: string;
  providerLabel: string;
  difficultyLabel: string;
  languageLabel: string;
  inputModeLabel: string;
  questionCountLabel: string;
  sourceDocumentLabel: string | null;
  generatedAtLabel: string;
  expiresAtLabel: string;
  metadata: AssessmentPreviewMetadataItem[];
  questions: AssessmentPreviewQuestionItem[];
  fileSurface: AssessmentPreviewFileSurface;
  plainTextExport: string;
  markdownExport: string;
  previewRoute: string;
  resultRoute: string;
  exportRoutes: AssessmentPreviewExportRoutes;
}
