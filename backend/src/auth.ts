import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = "7d";

/** Shortest secret accepted. HS256 is only as strong as its key; 32 bytes matches the hash. */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * The value this module used to fall back to when JWT_SECRET was unset. It is public
 * in git history, so a deployment that still uses it has forgeable tokens.
 */
const PUBLISHED_DEFAULT_SECRET = "dev-secret-change-me";

/**
 * Validate the signing secret, throwing rather than falling back.
 *
 * There used to be a silent default here, which meant a deployment that forgot the
 * env var came up healthy and accepted tokens anyone could mint for any userId.
 * Failing at boot is the only safe behaviour, so index.ts calls this before listening.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Refusing to start with no signing secret.");
  }
  if (secret === PUBLISHED_DEFAULT_SECRET) {
    throw new Error("JWT_SECRET is the old published default. Generate a new one.");
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${secret.length}).`
    );
  }
  return secret;
}

// Resolved lazily so importing this module (e.g. from a unit test) never throws;
// the server still fails fast because index.ts resolves it at startup.
let cachedSecret: string | undefined;
function jwtSecret(): string {
  return (cachedSecret ??= resolveJwtSecret());
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  userId: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
}