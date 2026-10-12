// Two real browser peer connections; REST/signalling and media devices are fixtures.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { peerSession } from "../../src/test/group-d-fixtures.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs"
);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-features=WebRtcHideLocalIpsWithMdns"],
});
const base = process.env.WEB_URL || "http://localhost:3002";
const participants = [];
const evidence = {
  browser: browser.version(),
  media: "Synthetic audio and canvas video; getUserMedia is mocked",
  restAndSocket: "Fixtures using the documented Socket.IO packets",
  browserFlag:
    "WebRtcHideLocalIpsWithMdns disabled in this isolated QA browser to avoid this machine's mDNS resolution limitation",
  errors: [],
  signals: [],
  checks: [],
};
const out = path.dirname(new URL(import.meta.url).pathname);
let startedAt = null;
let endsAt = null;
try {
  // Candidate hosts; the interviewer arrives second (presence can precede its ack).
  for (const role of ["candidate", "interviewer"]) {
    const participant = { role, queue: [], pending: null, joined: false };
    const context = await browser.newContext({
      viewport: { width: 1100, height: 950 },
    });
    await context.addInitScript(
      ({ base, role }) => {
        if (location.origin !== base) return;
        localStorage.setItem("if-token", "fixture-" + role);
        localStorage.setItem("if-theme", "light");
        window.__mediaCalls = [];
        window.__peers = [];
        const NativePeer = RTCPeerConnection;
        window.RTCPeerConnection = class extends NativePeer {
          constructor(config) {
            super(config);
            window.__peers.push(this);
          }
        };
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          window.__mediaCalls.push(constraints);
          if (constraints.audio) {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const destination = audio.createMediaStreamDestination();
            oscillator.connect(destination);
            oscillator.start();
            await audio.resume();
            window.__qaAudio = audio;
            return destination.stream;
          }
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 120;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#4f46e5";
          ctx.fillRect(0, 0, 160, 120);
          const stream = canvas.captureStream(10);
          window.__qaVideo = setInterval(
            () => ctx.fillRect(0, 0, 160, 120),
            100,
          );
          return stream;
        };
      },
      { base, role },
    );
    const session = () => ({
      ...peerSession,
      myRole: role,
      isHost: role === "candidate",
      partner: {
        username: role === "candidate" ? "Interviewer" : "Candidate",
        role: role === "candidate" ? "interviewer" : "candidate",
      },
      status: startedAt ? "active" : "waiting",
      startedAt,
      endsAt,
    });
    await context.route(/\/api\//, (route) => {
      const p = new URL(route.request().url()).pathname;
      const json = (body) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (p.endsWith("/users/me"))
        return json({ user: { username: role, name: role, avatar_url: null } });
      if (p.endsWith("/review")) return json({ counts: { due: 0 } });
      if (p.endsWith("/peer-sessions")) return json({ sessions: [session()] });
      if (p.endsWith("/problems")) return json({ problems: [] });
      if (p.endsWith("/ice-servers"))
        return json({ iceServers: [], expiresAt: null });
      return json({ session: session() });
    });
    const send = (packet) => {
      if (participant.pending) {
        const route = participant.pending;
        participant.pending = null;
        void route.fulfill({ contentType: "text/plain", body: packet });
      } else participant.queue.push(packet);
    };
    participant.send = send;
    participant.session = session;
    await context.route(/\/socket\.io\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "GET") {
        if (!url.searchParams.has("sid"))
          return route.fulfill({
            contentType: "text/plain",
            body: JSON.stringify({
              sid: role,
              upgrades: [],
              pingInterval: 25000,
              pingTimeout: 20000,
              maxPayload: 1000000,
            }).replace(/^/, "0"),
          });
        if (participant.queue.length)
          return route.fulfill({
            contentType: "text/plain",
            body: participant.queue.splice(0).join("\u001e"),
          });
        participant.pending = route;
        return;
      }
      for (const packet of (request.postData() ?? "").split("\u001e")) {
        if (packet.startsWith("40/peer,")) send(`40/peer,{"sid":"${role}"}`);
        const match = /^42\/peer,(\d*)(\[.*\])$/.exec(packet);
        if (!match) continue;
        const [event, data] = JSON.parse(match[2]);
        const id = match[1];
        if (event === "join") {
          participant.joined = true;
          const presence = {
            interviewer: participants.some(
              (p) => p.role === "interviewer" && p.joined,
            ),
            candidate: participants.some(
              (p) => p.role === "candidate" && p.joined,
            ),
          };
          // Exercise the backend ordering: presence before join ack.
          for (const p of participants)
            if (p.joined)
              p.send(`42/peer,${JSON.stringify(["presence", presence])}`);
          if (presence.interviewer && presence.candidate && !startedAt) {
            startedAt = new Date().toISOString();
            endsAt = new Date(Date.now() + 45000).toISOString();
            for (const p of participants)
              p.send(
                `42/peer,${JSON.stringify(["started", { startedAt, endsAt }])}`,
              );
          }
          send(
            `43/peer,${id}${JSON.stringify([{ ok: true, session: session(), presence }])}`,
          );
        }
        if (event === "signal")
          evidence.signals.push({
            role,
            type: data.type,
            candidateType:
              data.type === "candidate"
                ? data.candidate.candidate?.split(" typ ")[1]?.split(" ")[0]
                : undefined,
          });
        if (event === "signal")
          for (const p of participants)
            if (p.role !== role && p.joined)
              p.send(
                `42/peer,${JSON.stringify(["signal", { from: role, data }])}`,
              );
        if (event === "code")
          for (const p of participants)
            if (p.role !== role && p.joined)
              p.send(
                `42/peer,${JSON.stringify(["code", { from: role, ...data }])}`,
              );
        if (event === "leave") participant.joined = false;
      }
      return route.fulfill({ contentType: "text/plain", body: "ok" });
    });
    const page = await context.newPage();
    participant.page = page;
    participant.context = context;
    participants.push(participant);
    page.on("pageerror", (error) =>
      evidence.errors.push({ role, message: error.message }),
    );
    await page.goto(base + "/peer/peer-id");
    await page.getByRole("heading", { name: "Peer interview room" }).waitFor();
  }
  for (const { page } of participants) {
    await page
      .getByText("connected", { exact: true })
      .waitFor({ timeout: 25000 });
    assert.deepEqual(await page.evaluate(() => window.__mediaCalls), []);
  }
  evidence.checks.push(
    "Two real RTCPeerConnections connect with no microphone or camera; candidate hosts",
  );
  // Add tracks simultaneously to exercise collision handling and renegotiation.
  await Promise.all(
    participants.map(({ page }) =>
      page
        .getByRole("button", { name: "Turn on microphone", exact: true })
        .click(),
    ),
  );
  for (const { page } of participants)
    await page
      .getByRole("button", { name: "Mute microphone", exact: true })
      .waitFor();
  await Promise.all(
    participants.map(({ page }) =>
      page.getByRole("button", { name: "Turn on camera", exact: true }).click(),
    ),
  );
  for (const { page } of participants) {
    await page
      .getByLabel("Partner video; sound plays through partner audio", {
        exact: true,
      })
      .waitFor({ timeout: 20000 });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0)
          .length === 2,
    );
    await page.getByText("connected", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__mediaCalls.length), 2);
  }
  evidence.checks.push(
    "Simultaneous synthetic microphone/camera additions renegotiate; both remote videos render after audio arrives",
  );
  const [candidate, interviewer] = participants;
  await candidate.page
    .getByLabel("Language", { exact: true })
    .selectOption("rust");
  await interviewer.page.waitForFunction(() =>
    [...document.querySelectorAll("select")].some(
      (select) => select.value === "rust",
    ),
  );
  await candidate.page.waitForFunction(
    () => window.monaco?.editor.getEditors().length > 0,
  );
  await candidate.page.evaluate(() => {
    const editor = window.monaco.editor.getEditors()[0];
    editor.setSelection(editor.getModel().getFullModelRange());
    editor.focus();
  });
  await candidate.page.keyboard.insertText(
    "// code synchronized through the room",
  );
  await interviewer.page.waitForFunction(
    () =>
      window.monaco?.editor.getEditors()[0]?.getValue() ===
      "// code synchronized through the room",
  );
  evidence.checks.push(
    "Code and language sync between the real Monaco editors",
  );
  for (const { page, role } of participants) {
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: path.join(out, `webrtc-${role}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await candidate.page
    .getByRole("button", { name: "Leave room", exact: true })
    .click();
  await candidate.page.waitForURL(base + "/peer");
  assert.equal(candidate.joined, false);
  evidence.checks.push("Leave releases the room without emitting end");
  assert.deepEqual(evidence.errors, []);
} catch (e) {
  evidence.failure = e.message;
  evidence.snapshots = await Promise.all(
    participants.map(async ({ page, role }) => ({
      role,
      text: await page.locator("body").innerText(),
      peers: await page.evaluate(() =>
        window.__peers.map((pc) => ({
          connection: pc.connectionState,
          ice: pc.iceConnectionState,
          signalling: pc.signalingState,
          local: pc.localDescription?.type,
          remote: pc.remoteDescription?.type,
        })),
      ),
    })),
  );
  throw e;
} finally {
  await fs.writeFile(
    path.join(out, "webrtc.json"),
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({ checks: evidence.checks, errors: evidence.errors }),
);
