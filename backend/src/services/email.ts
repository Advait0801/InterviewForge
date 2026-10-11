/**
 * Account email: verification and password reset (D-072, closes F-07).
 *
 * Two modes, chosen by EMAIL_PROVIDER:
 * - `log` (the default, and what local dev uses even when a key is present): the email is
 *   printed to the backend log, link included, exactly as before.
 * - `resend`: sent through Resend's HTTP API with native fetch. RESEND_API_KEY is required,
 *   or the backend refuses to start (resolveEmailConfig, called from index.ts) -- a
 *   deployment that silently fell back to logging would leave every user unable to reset a
 *   password.
 *
 * Sending never decides an auth response. Callers hand the email to `deliverInBackground`
 * and answer at once: a provider outage doesn't fail sign-up, and forgot-password takes the
 * same time whether or not the account exists. The key never appears in a log or an error.
 */

export type Email = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  readonly provider: "log" | "resend";
  send(email: Email): Promise<void>;
}

export class EmailConfigError extends Error {}
/** The provider refused or couldn't be reached. Carries no request details, so no key. */
export class EmailDeliveryError extends Error {}

export type EmailConfig = { provider: "log" } | { provider: "resend"; apiKey: string; from: string };

const DEFAULT_FROM = "InterviewForge <onboarding@resend.dev>";
const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export function resolveEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const provider = (env.EMAIL_PROVIDER ?? "log").trim().toLowerCase() || "log";
  if (provider === "log") return { provider: "log" };
  if (provider !== "resend") throw new EmailConfigError(`EMAIL_PROVIDER must be log or resend (got "${provider}").`);
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailConfigError("EMAIL_PROVIDER is resend but RESEND_API_KEY is not set. Refusing to start.");
  if (!apiKey.startsWith("re_")) throw new EmailConfigError("RESEND_API_KEY doesn't look like a Resend key (they start with re_).");
  return { provider: "resend", apiKey, from: env.EMAIL_FROM?.trim() || DEFAULT_FROM };
}

/** user@example.com -> u***@example.com, for logs. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at > 0 ? `${address[0]}***${address.slice(at)}` : "***";
}

export class LogMailer implements Mailer {
  readonly provider = "log" as const;
  async send(email: Email): Promise<void> {
    console.log(`[email:log] To ${email.to} -- ${email.subject}\n${email.text}`);
  }
}

export class ResendMailer implements Mailer {
  readonly provider = "resend" as const;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly url = RESEND_URL,
    private readonly timeoutMs = SEND_TIMEOUT_MS
  ) {}

  async send(email: Email): Promise<void> {
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const why = (err as Error)?.name === "TimeoutError" ? "timed out" : "unreachable";
      throw new EmailDeliveryError(`Email provider ${why}`);
    }
    if (!response.ok) {
      // Resend's error body names the problem (a bad domain, a rate limit) and never echoes
      // the key; keep a short piece of it for the log.
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      throw new EmailDeliveryError(`Email provider returned ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const sent = (await response.json().catch(() => ({}))) as { id?: string };
    console.log(`[email:resend] Sent "${email.subject}" to ${maskAddress(email.to)}${sent.id ? ` (id ${sent.id})` : ""}`);
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (!mailer) {
    const config = resolveEmailConfig();
    mailer = config.provider === "resend" ? new ResendMailer(config.apiKey, config.from) : new LogMailer();
  }
  return mailer;
}

/** Tests swap in a recording mailer; null restores the configured one. */
export function setMailer(m: Mailer | null): void {
  mailer = m;
}

const pending = new Set<Promise<void>>();

/**
 * Send without making the caller wait, and never throw: the outcome is logged. The response
 * a user gets is the same whether the send works, fails or hangs.
 */
export function deliverInBackground(email: Email, label: string): void {
  const p = getMailer()
    .send(email)
    .catch((err) => console.error(`[email] ${label} to ${maskAddress(email.to)} failed: ${(err as Error).message}`))
    .finally(() => pending.delete(p));
  pending.add(p);
}

/** For tests and shutdown: wait for every background send to finish. */
export async function settleEmails(): Promise<void> {
  await Promise.all([...pending]);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, body: string, action: string, link: string, footer: string): string {
  const url = escapeHtml(link);
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
<tr><td>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px">${escapeHtml(body)}</p>
<p style="margin:0 0 20px"><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:15px">${escapeHtml(action)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#555;margin:0 0 8px">Or open this link: <a href="${url}" style="color:#2563eb;word-break:break-all">${url}</a></p>
<p style="font-size:13px;line-height:1.5;color:#555;margin:0">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;
}

export function verificationEmail(to: string, username: string, link: string): Email {
  const body = `Hi ${username}, confirm this is your email address to finish setting up your InterviewForge account.`;
  const footer = "The link works for 7 days. If you didn't sign up, you can ignore this email.";
  return {
    to,
    subject: "Confirm your email for InterviewForge",
    text: `${body}\n\n${link}\n\n${footer}\n`,
    html: layout("Confirm your email", body, "Confirm email", link, footer),
  };
}

export function resetEmail(to: string, link: string): Email {
  const body = "Someone asked to reset the password for your InterviewForge account. If it was you, choose a new one.";
  const footer = "The link works for 1 hour. If you didn't ask for this, ignore this email; your password stays the same.";
  return {
    to,
    subject: "Reset your InterviewForge password",
    text: `${body}\n\n${link}\n\n${footer}\n`,
    html: layout("Reset your password", body, "Choose a new password", link, footer),
  };
}
