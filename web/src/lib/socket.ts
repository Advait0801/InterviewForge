/** Socket.IO connects to the backend origin (same host as API, without `/api`). */
export function getSocketOrigin(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  try {
    return new URL(api).origin;
  } catch {
    return "http://localhost:4000";
  }
}
