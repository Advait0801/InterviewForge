import type http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createConnection, redisUrl } from "../redis";
import { registerPeerNamespace } from "./peer.socket";

/**
 * Socket.IO (F-06 closed by D-078). The default namespace keeps its anonymous `hello` (the
 * web's SocketBridge); /peer carries peer interviews and requires a signed-in user.
 *
 * With REDIS_URL set, rooms, emits and fetchSockets go through the Redis adapter, so the two
 * participants of a session can be connected to different backend instances. Without it the
 * adapter is in-memory, which is right for one instance and for unit tests.
 */

/** Signalling is small; the largest message is the shared code (50,000 characters). */
export const MAX_MESSAGE_BYTES = 256 * 1024;

export function attachRealtime(
  server: http.Server,
  options: { frontendUrl: string; url?: string | null; adapterKey?: string }
): { io: Server; close: () => Promise<void> } {
  const io = new Server(server, {
    cors: { origin: options.frontendUrl, methods: ["GET", "POST"] },
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
  });

  const url = options.url === undefined ? redisUrl() : options.url;
  const connections = url ? [createConnection({}, url), createConnection({}, url)] : [];
  // The key namespaces the pub/sub channels; tests use their own so they never meet a live server.
  if (connections.length) io.adapter(createAdapter(connections[0], connections[1], { key: options.adapterKey ?? "socket.io" }));

  io.on("connection", (socket) => {
    socket.emit("hello", { message: "InterviewForge realtime channel ready" });
  });
  const peer = registerPeerNamespace(io);

  return {
    io,
    close: async () => {
      await peer.stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.all(connections.map((c) => c.quit().catch(() => undefined)));
    },
  };
}
