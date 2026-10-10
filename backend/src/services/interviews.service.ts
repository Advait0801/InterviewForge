import { randomUUID } from "crypto";
import { withTransaction } from "../db";
import * as interviews from "../repositories/interviews.repository";
import type { NewMessage, TurnUpdate } from "../repositories/interviews.repository";
import {
  agentTurn,
  checkChallenge,
  evaluateAnswer,
  generateFollowup,
  generateHint,
  generateNextQuestion,
  generateReport,
  streamFollowup,
  streamNextQuestion,
  type AgentDecision,
  type ChallengeResult,
  type Persona,
  type StructuredEvaluation,
  type StructuredFollowup,
  type StructuredQuestion,
} from "./ai.service";
import { DomainError, badRequest, notFound } from "./errors";
import {
  type Company,
  type InterviewStage,
  buildEvaluationSummary,
  getDefaultDifficulty,
  getNextStage,
  INTERVIEW_STAGES,
  isValidInterviewStage,
  normalizeCompany,
  shouldAskFollowup,
} from "./interview-state.service";
import { userHasResume } from "./resumes.service";
import { type Usage, usageSoFar, withUsage } from "./llm-usage";

/**
 * The interview loop: behavioral → coding → system_design → core_cs → report, with at
 * most one follow-up per stage. Model calls (ai.service) always happen before a
 * transaction opens, never inside one (D-057). AIServiceError propagates to the route.
 *
 * Starting an interview and answering a turn can also run streamed (D-065): given a
 * `TurnStream`, they report progress through it and generate the question with the
 * ai-service's stream endpoints. What they record, and when, is identical either way:
 * the turn commits in one transaction once the whole question exists. If the client
 * leaves first, `signal` aborts the model calls and nothing is written.
 */

/** Progress a streamed turn reports before its result; the route sends each as an event. */
export type InterviewStreamEvent =
  | { type: "evaluation"; evaluation: StructuredEvaluation }
  | { type: "question"; kind: "question" | "followup"; stage: InterviewStage }
  | { type: "delta"; text: string };

export type TurnStream = {
  signal: AbortSignal;
  /** Resolves once the event is on its way to the client (backpressure). */
  emit: (event: InterviewStreamEvent) => Promise<void>;
};

type NextQuestionInput = Parameters<typeof generateNextQuestion>[0];
type FollowupInput = Parameters<typeof generateFollowup>[0];

async function askQuestion(input: NextQuestionInput, stream?: TurnStream): Promise<StructuredQuestion> {
  if (!stream) return generateNextQuestion(input);
  await stream.emit({ type: "question", kind: "question", stage: input.stage });
  return streamNextQuestion(input, {
    signal: stream.signal,
    onDelta: (text) => stream.emit({ type: "delta", text }),
  });
}

async function askFollowup(input: FollowupInput, stream?: TurnStream): Promise<StructuredFollowup> {
  if (!stream) return generateFollowup(input);
  await stream.emit({ type: "question", kind: "followup", stage: input.stage });
  return streamFollowup(input, {
    signal: stream.signal,
    onDelta: (text) => stream.emit({ type: "delta", text }),
  });
}

const sessionNotFound = () => notFound("Interview session not found");

export const PERSONAS = ["neutral", "friendly", "terse", "adversarial"] as const;

export function isPersona(value: unknown): value is Persona {
  return typeof value === "string" && (PERSONAS as readonly string[]).includes(value);
}

/** Stored values predate the CHECK constraint only in tests; anything else reads as neutral. */
const sessionPersona = (session: { persona?: string }): Persona =>
  isPersona(session.persona) ? session.persona : "neutral";

/**
 * The hint ladder (D-066): up to MAX_HINTS per question, each unlocked by time stuck on the
 * question (since it was asked, or since the previous hint), each costing HINT_PENALTY off
 * that answer's score, never below 1.
 */
export const MAX_HINTS = 3;
export const HINT_PENALTY = 1;
const hintUnlockMs = () => Number(process.env.HINT_UNLOCK_SECONDS ?? 30) * 1000;

/** The evaluation as recorded: the model's score less the hint penalty, with both kept. */
export function applyHintPenalty(evaluation: StructuredEvaluation, hintsUsed: number) {
  if (hintsUsed <= 0) return evaluation;
  const hintPenalty = Math.min(hintsUsed * HINT_PENALTY, evaluation.score - 1);
  return { ...evaluation, score: evaluation.score - hintPenalty, rawScore: evaluation.score, hintsUsed, hintPenalty };
}

/** Grounded challenge (D-066) runs only when enabled: it changes the follow-up UI B shows. */
const challengeEnabled = () => process.env.INTERVIEW_CHALLENGE_ENABLED === "true";

/**
 * Agentic interviewer (D-067). In `agent` mode an agent picks the next move after each
 * answer; these rules are the backend's, enforced whatever it says. `fixed` is the original
 * loop, and stays the default until the interview UI shows agent moves (UI B).
 */
export const MODES = ["fixed", "agent"] as const;
export type Mode = (typeof MODES)[number];
export const MAX_STAGE_QUESTIONS = 3;
const defaultMode = (): Mode => (process.env.INTERVIEW_MODE === "agent" ? "agent" : "fixed");
/** Estimated model spend per interview past which the agent is no longer consulted. */
const costCapUsd = () => Number(process.env.INTERVIEW_COST_CAP_USD ?? 0.02);

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** Charge an operation's model calls to its session; never fails the operation. */
async function charge(sessionId: string, usage: Usage) {
  try {
    await interviews.addUsage(sessionId, usage.calls, usage.costUsd);
  } catch (err) {
    console.warn(JSON.stringify({ level: "warn", event: "usage_not_recorded", sessionId, ...usage, message: String(err) }));
  }
}

/** What the agent decided, or why it wasn't asked; attached to agent-mode outcomes. */
type AgentNote = {
  decided: "probe" | "pivot" | "advance" | "finish" | "fallback" | "not_consulted";
  rationale: string;
  steps: number;
  searches: number;
};

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

export async function startInterview(
  input: {
    userId: string;
    company: Company;
    difficulty?: string;
    useResume?: boolean;
    persona?: Persona;
    mode?: Mode;
  },
  stream?: TurnStream
) {
  // Minted here rather than by the database default because the question is
  // generated before the row exists, and the live-fetch limiter needs a session
  // key to bound how much one interview can spend. Generating first and
  // inserting after is deliberate: a failed generation leaves no orphan row (its
  // spend then has no session to be charged to, and is only logged by the ai-service).
  const sessionId = randomUUID();
  return withUsage(() => openInterview(sessionId, input, stream), (usage) => charge(sessionId, usage));
}

async function openInterview(
  sessionId: string,
  input: Parameters<typeof startInterview>[0],
  stream?: TurnStream
) {
  const persona = input.persona ?? "neutral";
  const mode = input.mode ?? defaultMode();
  const startingStage: InterviewStage = "behavioral";
  const stageDifficulty = input.difficulty ?? getDefaultDifficulty(startingStage);

  // Default on: a user who uploaded a resume expects it to be used. `false`
  // opts out explicitly, for practising a company's generic loop.
  const wantsResume = input.useResume !== false;
  const resumeGrounded = wantsResume && (await userHasResume(input.userId));

  const nextQuestion = await askQuestion(
    {
      company: input.company,
      stage: startingStage,
      difficulty: stageDifficulty,
      user_id: input.userId,
      resume_grounded: resumeGrounded,
      session_id: sessionId,
      persona,
    },
    stream
  );

  // One transaction (D-057): a session row without its opening question is a dead
  // interview the user can't answer.
  await withTransaction(async (tx) => {
    await interviews.insertSession(tx, {
      id: sessionId,
      userId: input.userId,
      company: input.company,
      stage: startingStage,
      resumeGrounded,
      persona,
      mode,
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
      persona,
      mode,
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
  return withUsage(() => buildReport(sessionId, userId), (usage) => charge(sessionId, usage));
}

async function buildReport(sessionId: string, userId: string) {
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
 * Load and check the turn an answer responds to. Separate from `answerTurn` so a streamed
 * answer can report these failures as ordinary HTTP errors before its stream opens.
 */
export async function loadTurn(sessionId: string, userId: string) {
  const session = await interviews.findSession(sessionId, userId);
  if (!session) throw sessionNotFound();
  if (!isValidInterviewStage(session.current_stage)) {
    throw new DomainError(500, "Interview session is in an invalid stage");
  }
  if (session.status !== "active") throw badRequest("Interview session is not active");

  const latestQuestion = await interviews.findLatestQuestion(sessionId, session.current_stage);
  if (!latestQuestion) throw badRequest("No active interview question found");

  const company = normalizeCompany(session.company);
  if (!company) throw new DomainError(500, "Interview session has an invalid company");

  return { session, stage: session.current_stage, latestQuestion, company };
}

export type Turn = Awaited<ReturnType<typeof loadTurn>>;

/**
 * Evaluate an answer, then either ask the stage's follow-up, advance to the next stage
 * with a new question, or complete the interview.
 */
export async function submitAnswer(sessionId: string, userId: string, answer: string) {
  return answerTurn(await loadTurn(sessionId, userId), userId, answer);
}

export async function answerTurn(turn: Turn, userId: string, answer: string, stream?: TurnStream) {
  return withUsage(() => runTurn(turn, userId, answer, stream), (usage) => charge(turn.session.id, usage));
}

async function runTurn(turn: Turn, userId: string, answer: string, stream?: TurnStream) {
  const { session, stage, latestQuestion, company: normalizedCompany } = turn;
  const sessionId = session.id;
  const persona = sessionPersona(session);
  const context = String(latestQuestion.metadata_json.context ?? "");
  const hintsBefore = (await interviews.listHintsSince(sessionId, stage, latestQuestion.created_at)).length;

  // The challenge check needs only the question, answer and context, so it runs alongside
  // the evaluation and adds no latency. It's only worth running when the stage's one
  // follow-up is still unused. A failed check falls back to the normal flow.
  const wantsChallenge = challengeEnabled() && shouldAskFollowup(session.stage_turn_count) && context.trim() !== "";
  const [rawEvaluation, challenge] = await Promise.all([
    evaluateAnswer(
      { company: normalizedCompany, stage, question: latestQuestion.content, answer, context },
      stream?.signal
    ),
    wantsChallenge
      ? checkChallenge(
          { company: normalizedCompany, stage, question: latestQuestion.content, answer, context, persona },
          stream?.signal
        ).catch((err): ChallengeResult | null => {
          if (stream?.signal.aborted) throw err;
          console.warn(JSON.stringify({ level: "warn", event: "challenge_check_failed", message: String(err) }));
          return null;
        })
      : Promise.resolve(null),
  ]);
  const evaluation = applyHintPenalty(rawEvaluation, hintsBefore);
  await stream?.emit({ type: "evaluation", evaluation });

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
      // The claim holds the session row, which a hint also locks: a hint given while this
      // answer was graded is either counted above or rejected here, never missed.
      const hintsNow = (await interviews.listHintsSince(sessionId, stage, latestQuestion.created_at, tx)).length;
      if (hintsNow !== hintsBefore) {
        throw new DomainError(409, "A hint was given while this answer was being graded. Send the answer again.");
      }
      for (const message of messages) await interviews.insertMessage(tx, message);
    });

  const nextStage = getNextStage(stage);
  const agentMode = session.mode === "agent";
  const questionsAsked = session.stage_turn_count + 1;
  const roomInStage = questionsAsked < (agentMode ? MAX_STAGE_QUESTIONS : 2);

  // The move. A verified challenge always wins (it's the stage's most useful follow-up). In
  // agent mode the agent proposes; otherwise, or when it can't, the fixed rule decides.
  let move: "challenge" | "followup" | "probe" | "pivot" | "advance" = "advance";
  let decision: AgentDecision | null = null;
  let agent: AgentNote | undefined;
  if (challenge?.challenged && roomInStage) {
    move = "challenge";
  } else if (agentMode) {
    ({ decision, note: agent } = await consultAgent());
    if (decision?.action === "probe" || decision?.action === "pivot") move = decision.action;
    else if (decision?.action === "advance" || decision?.action === "finish") move = "advance";
    else move = shouldAskFollowup(session.stage_turn_count) && evaluation.shouldAskFollowup ? "followup" : "advance";
  } else if (shouldAskFollowup(session.stage_turn_count) && evaluation.shouldAskFollowup) {
    move = "followup";
  }
  const withAgent = <T extends object>(outcome: T) => (agent ? { ...outcome, agent } : outcome);

  async function consultAgent(): Promise<{ decision: AgentDecision | null; note: AgentNote }> {
    const skip = (rationale: string): { decision: null; note: AgentNote } => ({
      decision: null,
      note: { decided: "not_consulted", rationale, steps: 0, searches: 0 },
    });
    if (!roomInStage) return skip("only one move is allowed");
    const spent = Number(session.llm_cost_usd ?? 0) + usageSoFar().costUsd;
    if (spent >= costCapUsd()) return skip(`cost cap reached ($${spent.toFixed(4)} of $${costCapUsd()})`);

    const stageMessages = (await interviews.listMessages(sessionId)).filter((m) => m.stage === stage);
    // No second probe unless the last one helped: if the answer before this one in the stage
    // scored as well or better, probing again is unlikely to change the picture. The agent
    // was told this and ignored it in simulation (D-067), so it's a rule, not advice.
    const earlierScores = stageMessages
      .filter((m) => m.metadata_json.kind === "evaluation")
      .map((m) => Number(m.metadata_json.score));
    const previous = earlierScores[earlierScores.length - 1];
    const probeStalled = previous !== undefined && !(evaluation.score > previous);
    const allowed: AgentTurnRequestAction[] = [];
    if (!probeStalled) allowed.push("probe");
    allowed.push("pivot", nextStage === "report" ? "finish" : "advance");

    try {
      const result = await agentTurn(
        {
          company: normalizedCompany,
          stage,
          stage_position: `${INTERVIEW_STAGES.indexOf(stage) + 1} of ${INTERVIEW_STAGES.length}`,
          allowed_actions: allowed,
          questions_left: MAX_STAGE_QUESTIONS - questionsAsked,
          question: latestQuestion.content,
          answer,
          evaluation,
          stage_transcript: stageMessages.map((m) => ({ role: m.role, content: m.content })),
          persona,
        },
        stream?.signal
      );
      // Enforced again here: the agent's word is a proposal.
      const valid = result.action !== "fallback" && (allowed as string[]).includes(result.action);
      const searches = result.trace.filter((t) => t.tool === "search_context").length;
      return {
        decision: valid ? result : null,
        note: {
          decided: valid ? (result.action as AgentNote["decided"]) : "fallback",
          rationale: result.rationale,
          steps: result.steps,
          searches,
        },
      };
    } catch (err) {
      if (stream?.signal.aborted) throw err;
      console.warn(JSON.stringify({ level: "warn", event: "agent_turn_failed", sessionId, message: String(err) }));
      return { decision: null, note: { decided: "fallback", rationale: "the agent call failed", steps: 0, searches: 0 } };
    }
  }

  if (move !== "advance") {
    // Same stage, one more question: a challenge, the fixed flow's follow-up, or the
    // agent's probe or pivot. The latter two arrive whole, so each is sent as one delta.
    const sendWhole = async (kind: "question" | "followup", text: string) => {
      await stream?.emit({ type: "question", kind, stage });
      await stream?.emit({ type: "delta", text });
    };
    let content: string;
    let metadata: Record<string, unknown>;
    let nextQuestion: StructuredFollowup & { challenge?: { claim: string; evidence: string } };
    if (move === "challenge") {
      await sendWhole("followup", challenge!.question);
      nextQuestion = {
        question: challenge!.question,
        focus: "contradiction with the reference material",
        reason: challenge!.reason,
        challenge: { claim: challenge!.claim, evidence: challenge!.evidence },
      };
      metadata = { kind: "followup", focus: nextQuestion.focus, reason: nextQuestion.reason, challenge: nextQuestion.challenge };
    } else if (move === "followup") {
      nextQuestion = await askFollowup(
        { company: normalizedCompany, stage, question: latestQuestion.content, answer, evaluation, persona },
        stream
      );
      metadata = { kind: "followup", focus: nextQuestion.focus, reason: nextQuestion.reason };
    } else {
      const d = decision!;
      nextQuestion = { question: d.question, focus: d.focus, reason: d.rationale };
      if (move === "probe") {
        await sendWhole("followup", d.question);
        metadata = { kind: "followup", focus: d.focus, reason: d.rationale, agent };
      } else {
        // A pivot is a new question: stored as one, with the context the agent searched, so
        // hints and the challenge check are grounded like any other question.
        await sendWhole("question", d.question);
        metadata = {
          kind: "question",
          company: session.company,
          stage,
          reasoningFocus: d.focus,
          expectedCompetencies: [],
          context: d.context,
          resumeGrounded: false,
          groundedIn: null,
          resumeEvidence: [],
          retrievalConfidence: null,
          liveIngestion: null,
          agent,
        };
      }
    }
    content = nextQuestion.question;

    await commitTurn({ set: "stage_turn_count = stage_turn_count + 1", params: [] }, [
      answerMessage,
      evaluationMessage,
      { sessionId, role: "assistant", stage, content, metadata },
    ]);

    return withAgent({
      action: move === "pivot" ? "pivot" : "followup",
      sessionId,
      stage,
      evaluation,
      nextQuestion,
    });
  }

  if (nextStage === "report") {
    await commitTurn(
      { set: "current_stage = 'report', status = 'completed', stage_turn_count = 0", params: [] },
      [answerMessage, evaluationMessage]
    );
    return withAgent({ action: "completed", sessionId, evaluation });
  }

  const nextQuestion = await askQuestion(
    {
      company: normalizedCompany,
      stage: nextStage,
      difficulty: getDefaultDifficulty(nextStage),
      user_id: userId,
      // The session's own flag, not a fresh lookup: a resume deleted mid-
      // interview must stop grounding, and `resume_grounded` with no chunks
      // degrades to an ordinary question on the AI service side.
      resume_grounded: session.resume_grounded === true,
      session_id: sessionId,
      persona,
    },
    stream
  );

  await commitTurn({ set: "current_stage = $4, stage_turn_count = 0", params: [nextStage] }, [
    answerMessage,
    evaluationMessage,
    {
      sessionId,
      role: "assistant",
      stage: nextStage,
      content: nextQuestion.question,
      metadata: { ...questionMetadata(session.company, nextStage, nextQuestion), ...(agent ? { agent } : {}) },
    },
  ]);

  return withAgent({
    action: "advance_stage",
    sessionId,
    previousStage: stage,
    currentStage: nextStage,
    evaluation,
    nextQuestion,
  });
}

type AgentTurnRequestAction = "probe" | "pivot" | "advance" | "finish";

/**
 * The next rung of the hint ladder for the question being answered (D-066). Refused with
 * 409 when the ladder is used up or the next rung hasn't unlocked yet (`availableAt`).
 * The hint is generated outside the transaction (D-057), then recorded only if the turn
 * and the hint count are still what they were: a concurrent hint or answer gets a 409.
 */
export async function requestHint(sessionId: string, userId: string, draft?: string) {
  return withUsage(() => giveHint(sessionId, userId, draft), (usage) => charge(sessionId, usage));
}

async function giveHint(sessionId: string, userId: string, draft?: string) {
  const { session, stage, latestQuestion, company } = await loadTurn(sessionId, userId);
  const hints = await interviews.listHintsSince(sessionId, stage, latestQuestion.created_at);
  if (hints.length >= MAX_HINTS) {
    throw new DomainError(409, "No hints left for this question.", { code: "hints_exhausted" });
  }

  const since = new Date((hints[hints.length - 1] ?? latestQuestion).created_at).getTime();
  const availableAt = since + hintUnlockMs();
  if (Date.now() < availableAt) {
    throw new DomainError(409, "Give it a little longer before the next hint.", {
      code: "hint_locked",
      availableAt: new Date(availableAt).toISOString(),
    });
  }

  const level = hints.length + 1;
  const { hint } = await generateHint({
    company,
    stage,
    question: latestQuestion.content,
    context: String(latestQuestion.metadata_json.context ?? ""),
    level,
    previous_hints: hints.map((h) => h.content),
    draft: draft?.trim() || undefined,
    persona: sessionPersona(session),
  });

  await withTransaction(async (tx) => {
    const now = await interviews.lockSessionTurn(tx, sessionId);
    if (
      !now ||
      now.status !== "active" ||
      now.current_stage !== stage ||
      now.stage_turn_count !== session.stage_turn_count
    ) {
      throw new DomainError(409, "This question was already answered. Refresh to continue.");
    }
    const count = (await interviews.listHintsSince(sessionId, stage, latestQuestion.created_at, tx)).length;
    if (count !== hints.length) throw new DomainError(409, "A hint was just given. Refresh to see it.");
    await interviews.insertMessage(tx, {
      sessionId,
      role: "assistant",
      stage,
      content: hint,
      metadata: { kind: "hint", level, penalty: HINT_PENALTY },
    });
  });

  return {
    sessionId,
    stage,
    level,
    hint,
    hintsUsed: level,
    hintsRemaining: MAX_HINTS - level,
    penalty: level * HINT_PENALTY,
    nextAvailableAt: level < MAX_HINTS ? new Date(Date.now() + hintUnlockMs()).toISOString() : null,
  };
}
