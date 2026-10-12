import type { Namespace } from "socket.io";

/**
 * The peer namespace, for code outside it that needs to tell a room something (a session
 * ended over HTTP). Unset in route tests and before the server starts: then it's a no-op,
 * since nobody can be in a room yet.
 */
let peer: Namespace | null = null;

export const sessionRoom = (sessionId: string) => `peer:${sessionId}`;
export const userRoom = (userId: string) => `user:${userId}`;

export function setPeerNamespace(nsp: Namespace | null): void {
  peer = nsp;
}

export function notifySessionEnded(sessionId: string, reason: string): void {
  peer?.to(sessionRoom(sessionId)).emit("ended", { reason });
}

/**
 * Drop every live connection of a user whose tokens were just revoked (sign out everywhere,
 * a password change or reset bump token_version, D-055). New connections are refused by the
 * handshake check; this closes the ones already open, on every instance (Redis adapter).
 */
export function disconnectUser(userId: string): void {
  peer?.in(userRoom(userId)).disconnectSockets(true);
}
