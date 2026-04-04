export const ASSESSMENT_FILE_FIRST_PAGE_QUESTION_TARGET = 2;
export const ASSESSMENT_FILE_FOLLOWING_PAGE_QUESTION_TARGET = 3;
const ASSESSMENT_FILE_PAGE_COMPLEXITY_BUDGET = 3600;

function chunkItems<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function partitionAssessmentFileQuestions<T>(questions: readonly T[]) {
  /* Detached preview/result pages and the shared print renderer must follow the same page-slot
     contract: page one targets two questions, and later question pages target three. Keep that
     chunking rule centralized here so future layout refinements do not desynchronize the React
     file surface from the Fast/Pro export HTML foundation. */
  const firstPageQuestions = questions.slice(0, ASSESSMENT_FILE_FIRST_PAGE_QUESTION_TARGET);
  const followingQuestions = questions.slice(ASSESSMENT_FILE_FIRST_PAGE_QUESTION_TARGET);

  return {
    firstPageQuestions,
    followingQuestionPages: chunkItems(
      followingQuestions,
      ASSESSMENT_FILE_FOLLOWING_PAGE_QUESTION_TARGET,
    ),
  };
}

type AssessmentFileQuestionLike = {
  stem: string;
  choices: Array<{ text: string }>;
  supplementalLines: string[];
  answerDisplay: string;
  rationale: string | null;
  tags: string[];
};

function estimateQuestionComplexity(question: AssessmentFileQuestionLike) {
  return (
    question.stem.length +
    question.choices.reduce((sum, choice) => sum + choice.text.length, 0) +
    question.supplementalLines.reduce((sum, line) => sum + line.length, 0) +
    question.answerDisplay.length +
    (question.rationale?.length ?? 0) +
    question.tags.reduce((sum, tag) => sum + tag.length, 0)
  );
}

function buildQuestionPageChunks<T extends AssessmentFileQuestionLike>(
  questions: readonly T[],
  targetCount: number,
) {
  const chunks: Array<{
    questions: T[];
    usesOverflowFallback: boolean;
  }> = [];
  let index = 0;

  while (index < questions.length) {
    const remaining = questions.length - index;
    const targetSlice = questions.slice(index, index + Math.min(targetCount, remaining));
    const targetComplexity = targetSlice.reduce(
      (sum, question) => sum + estimateQuestionComplexity(question),
      0,
    );

    if (targetSlice.length === targetCount && targetComplexity > ASSESSMENT_FILE_PAGE_COMPLEXITY_BUDGET) {
      const fallbackSlice = questions.slice(index, index + targetCount - 1);
      chunks.push({
        questions: [...fallbackSlice],
        usesOverflowFallback: true,
      });
      index += fallbackSlice.length;
      continue;
    }

    chunks.push({
      questions: [...targetSlice],
      usesOverflowFallback: false,
    });
    index += targetSlice.length;
  }

  return chunks;
}

export function buildAssessmentFileQuestionPages<T extends AssessmentFileQuestionLike>(
  questions: readonly T[],
) {
  const { firstPageQuestions, followingQuestionPages } = partitionAssessmentFileQuestions(questions);

  return [
    {
      questions: [...firstPageQuestions],
      usesOverflowFallback: false,
    },
    ...buildQuestionPageChunks(
      followingQuestionPages.flat(),
      ASSESSMENT_FILE_FOLLOWING_PAGE_QUESTION_TARGET,
    ),
  ].filter((page) => page.questions.length > 0);
}
