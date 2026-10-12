# Peer mock interviews

Two users, one interviewing the other, connected peer to peer over WebRTC (D-078). The backend
never carries media: it holds the session, decides who may be in its room, relays signalling over
Socket.IO, keeps the shared code and the feedback, and runs the clock.

## The flow

1. **Host:** `POST /api/peer-sessions { role, problemId?, durationMinutes? }` returns the session and
   an `inviteToken`. The token is shown this once and stored only as its SHA-256. The web turns
   it into a link such as `/peer/join#<token>`; a URL fragment never reaches a server log.
2. **Guest:** `POST /api/peer-sessions/join { token }` takes the other role. A full session is a
   409; every bad invite is the same 404.
3. **Both:** `GET /api/peer-sessions/ice-servers`, then connect Socket.IO to `<backend origin>/peer`
   with `auth: { token: <JWT> }`, and emit `join { sessionId }`.
4. **When both are in the room the clock starts** (`started`). By convention the interviewer
   creates the offer, and the candidate answers. ICE candidates go both ways.
5. **Ending:** either side emits `end` (or `POST /api/peer-sessions/{id}/end`), or the server ends the
   session at `endsAt` (`ended { reason: "time_up" }`). Each side then may
   `POST /api/peer-sessions/{id}/feedback` once.

## Socket.IO protocol (`/peer`)

Client → server:

| event | payload | result |
|---|---|---|
| `join` | `{ sessionId }`, ack | `{ ok: true, session, presence }` or `{ ok: false, code: invalid \| not_found \| ended \| unavailable, error }` |
| `signal` | `{ type: "offer" \| "answer", sdp }` or `{ type: "candidate", candidate: RTCIceCandidateInit }` | relayed to the other participant only |
| `code` | `{ code, language }` (≤ 50,000 characters, one of the 7 languages) | relayed; the latest is saved (at most every 2 s) |
| `end` | ack | `{ ok, session }`; the room gets `ended` |
| `leave` | — | leaves the room; the other side gets `presence` |

Server → client: `presence { interviewer, candidate }`, `started { startedAt, endsAt }`,
`signal { from, data }`, `code { from, code, language }`, `ended { reason }`, and
`peer_error { code: invalid | rate_limited | not_joined, error }` for a dropped message.

A connection without a valid, unrevoked token fails with `connect_error`, whose `data.code` is
`session_invalid`. Signing out everywhere, or changing or resetting the password, disconnects every open
socket of that user (`disconnect` reason `io server disconnect`); reconnect with the new token.

Limits per socket: 60 signalling messages in a burst, then 20 per second; 20 code updates, then 10
per second. A message is at most 256 KB.

## Deploying

- **Nginx** must pass WebSocket upgrades on `/socket.io/`:
  `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`
- **Several backend instances** share rooms through the Redis adapter (`REDIS_URL`).
- **TURN.** STUN alone fails between peers behind symmetric NATs. Run coturn with
  `use-auth-secret` and the same `TURN_SECRET`, and set `TURN_URLS`. Credentials expire after
  `TURN_TTL_SECONDS`. Migration `021_peer_sessions.sql`.

## How it was verified

- Route tests (19), protocol tests, and Socket.IO integration tests (15) with real sockets. Seven
  deliberate breakages of the realtime layer were each caught. A cross-instance test runs two
  servers on one Redis.
- `cd backend && npx ts-node scripts/verify_peer.ts`: 29 live checks through the real API and sockets.
- **Two real browser tabs connected peer to peer** with `scripts/peer_harness/` (a data channel
  in both directions), using only our signalling and TURN credentials from our endpoint:
  - Without TURN they couldn't, on this machine: the app's embedded browser can't resolve
    WebRTC's mDNS-masked host addresses, and the router doesn't hairpin.
  - With a throwaway coturn they could, relay to relay.
  - A tampered credential got no relay at all.
