import { createHash, randomBytes } from "node:crypto";
import * as interviews from "../repositories/interviews.repository";
import * as links from "../repositories/share-links.repository";
import { DomainError, notFound } from "./errors";
import { buildReplay } from "./replay";

/**
 * Interview replay and public share links (D-071). A link is a bearer token: 32 random bytes,
 * base64url. Only its SHA-256 is stored, so the token is shown to its owner once, at creation.
 * Opening a link serves only what's already stored -- the transcript and the stored report --
 * through the replay allowlist (replay.ts); it never generates anything, so a public page can't
 * spend model calls.
 */

export const MAX_ACTIVE_LINKS = 5;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const sessionNotFound = () => notFound("Interview session not found");
/** One answer for an unknown, malformed, revoked or expired link, so none can be told apart. */
const linkNotFound = () => notFound("This link doesn't exist or is no longer shared");

const link = (r: links.ShareLinkRow) => ({
  id: r.id,
  tokenHint: r.token_hint,
  displayName: r.display_name,
  expiresAt: r.expires_at,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
  createdAt: r.created_at,
});

/** The owner's replay: exactly what a share link of it would show. */
export async function getReplay(sessionId: string, userId: string) {
  const session = await interviews.findSession(sessionId, userId);
  if (!session) throw sessionNotFound();
  return buildReplay(session, await interviews.listMessages(sessionId));
}

export async function createShareLink(
  sessionId: string,
  userId: string,
  options: { displayName: string | null; expiresInDays: number | null }
) {
  const session = await interviews.findSession(sessionId, userId);
  if (!session) throw sessionNotFound();
  // A link serves the stored report and never generates one, so there has to be one.
  if (session.status !== "completed" || !session.report_json) {
    throw new DomainError(409, "Finish the interview and open its report before sharing it", { code: "report_not_ready" });
  }
  if ((await links.listActiveLinks(sessionId, userId)).length >= MAX_ACTIVE_LINKS) {
    throw new DomainError(409, `An interview can have at most ${MAX_ACTIVE_LINKS} active links; revoke one first`, { code: "too_many_links" });
  }
  const token = randomBytes(32).toString("base64url");
  const row = await links.insertLink({
    sessionId,
    userId,
    tokenHash: hashToken(token),
    tokenHint: token.slice(-4),
    displayName: options.displayName,
    expiresInDays: options.expiresInDays,
  });
  return {
    link: link(row),
    // Shown once; only its hash is kept.
    token,
    // A résumé-grounded interview's questions can mention the résumé; the client says so.
    resumeGrounded: session.resume_grounded,
  };
}

export async function listShareLinks(sessionId: string, userId: string) {
  if (!(await interviews.findSession(sessionId, userId))) throw sessionNotFound();
  return { links: (await links.listActiveLinks(sessionId, userId)).map(link) };
}

export async function revokeShareLink(sessionId: string, linkId: string, userId: string): Promise<void> {
  if (!(await links.revokeLink(linkId, sessionId, userId))) throw notFound("Share link not found");
}

/** The public view behind a link. No session, no user: everything comes from the token. */
export async function openSharedInterview(token: string) {
  if (!TOKEN.test(token)) throw linkNotFound();
  const shared = await links.openLink(hashToken(token));
  if (!shared) throw linkNotFound();
  const replay = buildReplay(shared, await links.listSharedMessages(shared.session_id));
  return { candidate: shared.display_name, ...replay };
}
