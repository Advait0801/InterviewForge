import crypto from "crypto";

export function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
