import { randomUUID } from "crypto";
import { withTransaction } from "../db";
import * as interviews from "../repositories/interviews.repository";
import type { NewMessage, TurnUpdate } from "../repositories/interviews.repository";
import {
  evaluateAnswer,
  generateFollowup,
  generateNextQuestion,
  generateReport,
  type StructuredQuestion,
} from "./ai.service";
import { DomainError, badRequest, notFound } from "./errors";
import {
  type Company,
  type InterviewStage,
  buildEvaluationSummary,
  getDefaultDifficulty,
  getNextStage,
  isValidInterviewStage,
  normalizeCompany,
  shouldAskFollowup,
} from "./interview-state.service";
import { userHasResume } from "./resumes.service";

/**
 * The interview loop: behavioral → coding → system_design → core_cs → report, with at
 * most one follow-up per stage. Model calls (ai.service) always happen before a
 * transaction opens, never inside one (D-057). AIServiceError propagates to the route.
 */

const sessionNotFound = () => notFound("Interview session not found");

function questionMetadata(company: string, stage: string, question: StructuredQuestion) {
  return {
    kind: "question",
    company,
    stage,
    reasoningFocus: question.reasoningFocus,
    expectedCompetencies: question.expectedCompetencies,
    context: question.context,
    resumeGrounded: question.resumeGrounded ?? false,
    groundedIn: question.groundedIn ?? null,
    resumeEvidence: question.resumeEvidence ?? [],
    retrievalConfidence: question.retrievalConfidence ?? null,
    liveIngestion: question.liveIngestion ?? null,
  };
}

export function listSessions(userId: string) {
  return interviews.listSessions(userId);
}

export async function startInterview(input: {
  userId: string;
  company: Company;
  difficulty?: string;
  useResume?: boolean;
}) {
  const startingStage: InterviewStage = "behavioral";
  const stageDifficulty = input.difficulty ?? getDefaultDifficulty(startingStage);

  // Default on: a user who uploaded a resume expects it to be used. `false`
  // opts out explicitly, for practising a company's generic loop.
  const wantsResume = input.useResume !== false;
  const resumeGrounded = wantsResume && (await userHasResume(input.userId));

  // Minted here rather than by the database default because the question is
  // generated before the row exists, and the live-fetch limiter needs a session
  // key to bound how much one interview can spend. Generating first and
  // inserting after is deliberate: a failed generation leaves no orphan row.
  const sessionId = randomUUID();

  const nextQuestion = await generateNextQuestion({
    company: input.company,
    stage: startingStage,
    difficulty: stageDifficulty,
    user_id: input.userId,
    resume_grounded: resumeGrounded,
    session_id: sessionId,
  });

  // One transaction (D-057): a session row without its opening question is a dead
  // interview the user can't answer.
  await withTransaction(async (tx) => {
    await interviews.insertSession(tx, {
      id: sessionId,
      userId: input.userId,
      company: input.company,
      stage: startingStage,
      resumeGrounded,
    });
    await interviews.insertMessage(tx, {
      sessionId,
      role: "assistant",
      stage: startingStage,
      content: nextQuestion.question,
      metadata: questionMetadata(input.company, startingStage, nextQuestion),
    });
  });

  return {
    session: {
      id: sessionId,
      company: input.company,
      currentStage: startingStage,
      status: "active",
      resumeGrounded: nextQuestion.resumeGrounded ?? false,
    },
    openingQuestion: nextQuestion,
  };
}

export async function getSession(sessionId: string, userId: string) {
  const session = await interviews.findSession(sessionId, userId);
  if (!session) throw sessionNotFound();
  const messages = await interviews.listMessages(sessionId);
  return { session, messages };
}

/**
 * The completed interview's report. Generated once and stored (D-056): a reload must not
 * cost another model call or record the scores again.
 */
export async function getReport(sessionId: string, userId: string) {
  const session = await interviews.findSession(sessionId, userId);
  if (!session) throw sessionNotFound();
  if (session.status !== "completed") throw badRequest("Interview is not yet completed");

  if (session.report_json) {
    return { sessionId, company: session.company, ...session.report_json };
  }

  const messages = await interviews.listMessages(sessionId);
  const conversation = messages.map((m) => `[${m.stage}] ${m.role}: ${m.content}`).join("\n\n");
  const report = await generateReport({ company: session.company, conversation });

  // Stored and scored in one transaction (D-057), so scores are never recorded without
  // the report or vice versa. The write is conditional, so of two concurrent first
  // loads only one stores the report and records scores; the other's UPDATE waits on
  // the row lock, then matches nothing.
  const stored = await withTransaction(async (tx) => {
    if (!(await interviews.claimReport(tx, sessionId, report))) return false;

    const stageScores = report.stageScores || {};
    for (const [stage, data] of Object.entries(stageScores)) {
      const score = typeof data.score === "string" ? parseInt(data.score, 10) : data.score;
      if (!isNaN(score)) {
        await interviews.insertStageScore(tx, userId, stage, score);
      }
    }

    if (report.overallScore) {
      await interviews.insertOverallScore(tx, userId, report.overallScore);
    }
    return true;
  });

  if (!stored) {
    // Lost that race: serve the copy that won, so every viewer sees one report.
    const winner = await interviews.findSession(sessionId, userId);
    const winning = winner?.report_json ?? report;
    return { sessionId, company: session.company, ...winning };
  }

  return { sessionId, company: session.company, ...report };
}

/**
 * Evaluate an answer, then either ask the stage's follow-up, advance to the next stage
 * with a new question, or complete the interview.
 */
export async function submitAnswer(sessionId: string, userId: string, answer: string) {
  const session = await interviews.findSession(sessionId, userId);
  if (!session) throw sessionNotFound();
  if (!isValidInterviewStage(session.current_stage)) {
    throw new DomainError(500, "Interview session is in an invalid stage");
  }
  if (session.status !== "active") throw badRequest("Interview session is not active");

  const latestQuestion = await interviews.findLatestQuestion(sessionId, session.current_stage);
  if (!latestQuestion) throw badRequest("No active interview question found");

  const normalizedCompany = normalizeCompany(session.company);
  if (!normalizedCompany) throw new DomainError(500, "Interview session has an invalid company");

  const stage = session.current_stage;
  const evaluation = await evaluateAnswer({
    company: normalizedCompany,
    stage,
    question: latestQuestion.content,
    answer,
    context: String(latestQuestion.metadata_json.context ?? ""),
  });

  const answerMessage: NewMessage = {
    sessionId,
    role: "candidate",
    stage,
    content: answer,
    metadata: { kind: "answer" },
  };
  const evaluationMessage: NewMessage = {
    sessionId,
    role: "system",
    stage,
    content: buildEvaluationSummary(evaluation),
    metadata: { kind: "evaluation", ...evaluation },
  };

  /**
   * Record the turn: every model call is done by now, so this is quick. One
   * transaction (D-057) so a failure part-way can't leave an answer with no
   * evaluation, or a stage advanced with no question. It starts by claiming the
   * turn, so a double submit records once and the second gets a 409 instead of
   * advancing the interview twice.
   */
  const commitTurn = (update: TurnUpdate, messages: NewMessage[]) =>
    withTransaction(async (tx) => {
      const claimed = await interviews.claimTurn(
        tx,
        { id: sessionId, stage, turnCount: session.stage_turn_count },
        update
      );
      if (!claimed) throw new DomainError(409, "This question was already answered. Refresh to continue.");
      for (const message of messages) await interviews.insertMessage(tx, message);
    });

  if (shouldAskFollowup(session.stage_turn_count) && evaluation.shouldAskFollowup) {
    const followup = await generateFollowup({
      company: normalizedCompany,
      stage,
      question: latestQuestion.content,
      answer,
      evaluation,
    });

    await commitTurn({ set: "stage_turn_count = stage_turn_count + 1", params: [] }, [
      answerMessage,
      evaluationMessage,
      {
        sessionId,
        role: "assistant",
        stage,
        content: followup.question,
        metadata: { kind: "followup", focus: followup.focus, reason: followup.reason },
      },
    ]);

    return { action: "followup", sessionId, stage, evaluation, nextQuestion: followup };
  }

  const nextStage = getNextStage(stage);
  if (nextStage === "report") {
    await commitTurn(
      { set: "current_stage = 'report', status = 'completed', stage_turn_count = 0", params: [] },
      [answerMessage, evaluationMessage]
    );
    return { action: "completed", sessionId, evaluation };
  }

  const nextQuestion = await generateNextQuestion({
    company: normalizedCompany,
    stage: nextStage,
    difficulty: getDefaultDifficulty(nextStage),
    previousAnswer: answer,
    user_id: userId,
    // The session's own flag, not a fresh lookup: a resume deleted mid-
    // interview must stop grounding, and `resume_grounded` with no chunks
    // degrades to an ordinary question on the AI service side.
    resume_grounded: session.resume_grounded === true,
    session_id: sessionId,
  });

  await commitTurn({ set: "current_stage = $4, stage_turn_count = 0", params: [nextStage] }, [
    answerMessage,
    evaluationMessage,
    {
      sessionId,
      role: "assistant",
      stage: nextStage,
      content: nextQuestion.question,
      metadata: questionMetadata(session.company, nextStage, nextQuestion),
    },
  ]);

  return {
    action: "advance_stage",
    sessionId,
    previousStage: stage,
    currentStage: nextStage,
    evaluation,
    nextQuestion,
  };
}
