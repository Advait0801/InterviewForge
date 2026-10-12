import { Router, type Response } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { DomainError } from "../services/errors";
import {
  NOTES_MAX,
  createSession,
  endSession,
  getSession,
  iceServers,
  joinSession,
  listSessions,
  submitFeedback,
} from "../services/peer.service";
import { notifySessionEnded } from "../realtime/peer.events";
import { UUID_REGEX, sendDomainError, sendInternalError } from "./http";

/** Peer mock interviews (D-078): sessions, invites, feedback. The live part is realtime/peer.socket.ts. */
const router = Router();
const ROLES = ["interviewer", "candidate"];

function fail(res: Response, label: string, err: unknown) {
  if (err instanceof DomainError) return sendDomainError(res, err);
  return sendInternalError(res, label, err);
}

const idParam = (req: AuthRequest) => (typeof req.params.id === "string" ? req.params.id : req.params.id?.[0]);

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({ sessions: await listSessions(req.user!.id) });
  } catch (err) {
    return fail(res, "List peer sessions error", err);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { role, problemId, durationMinutes } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof role !== "string" || !ROLES.includes(role)) {
    return res.status(400).json({ error: "role must be interviewer or candidate" });
  }
  if (problemId !== undefined && problemId !== null && (typeof problemId !== "string" || !UUID_REGEX.test(problemId))) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || (durationMinutes as number) < 15 || (durationMinutes as number) > 90)) {
    return res.status(400).json({ error: "durationMinutes must be an integer from 15 to 90" });
  }
  try {
    const created = await createSession(req.user!.id, {
      role: role as "interviewer" | "candidate",
      problemId: (problemId as string | null | undefined) ?? null,
      durationMinutes: durationMinutes as number | undefined,
    });
    return res.status(201).json(created);
  } catch (err) {
    return fail(res, "Create peer session error", err);
  }
});

router.get("/ice-servers", requireAuth, (req: AuthRequest, res) => res.json(iceServers(req.user!.id)));

router.post("/join", requireAuth, async (req: AuthRequest, res) => {
  const { token } = (req.body ?? {}) as { token?: unknown };
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "token is required" });
  try {
    return res.json({ session: await joinSession(req.user!.id, token) });
  } catch (err) {
    return fail(res, "Join peer session error", err);
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = idParam(req);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session id" });
  try {
    return res.json({ session: await getSession(id, req.user!.id) });
  } catch (err) {
    return fail(res, "Get peer session error", err);
  }
});

router.post("/:id/end", requireAuth, async (req: AuthRequest, res) => {
  const id = idParam(req);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session id" });
  try {
    const { session, changed } = await endSession(id, req.user!.id);
    // Ended over HTTP (no socket, say): the room still hears about it.
    if (changed) notifySessionEnded(id, session.endedReason ?? "ended_by_participant");
    return res.json({ session });
  } catch (err) {
    return fail(res, "End peer session error", err);
  }
});

router.post("/:id/feedback", requireAuth, async (req: AuthRequest, res) => {
  const id = idParam(req);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session id" });
  const { ratings, notes } = (req.body ?? {}) as { ratings?: unknown; notes?: unknown };
  if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) {
    return res.status(400).json({ error: "ratings must be an object" });
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > NOTES_MAX)) {
    return res.status(400).json({ error: `notes must be a string of at most ${NOTES_MAX} characters` });
  }
  try {
    return res.json({ session: await submitFeedback(id, req.user!.id, { ratings: ratings as Record<string, unknown>, notes: notes as string | undefined }) });
  } catch (err) {
    return fail(res, "Peer feedback error", err);
  }
});

export default router;
