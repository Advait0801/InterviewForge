import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The layering from Phase 1 (D-061): routes handle HTTP, services hold the rules,
 * repositories hold the SQL. These checks keep SQL from drifting back up.
 */
const SRC = join(__dirname, "..");
const SQL = /\b(SELECT\s+[\w*(]|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/;

const sources = (dir: string) =>
  readdirSync(join(SRC, dir))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ file: `${dir}/${f}`, text: readFileSync(join(SRC, dir, f), "utf8") }));

describe("layering", () => {
  it.each(sources("routes"))("$file has no SQL and no database import", ({ text }) => {
    expect(text).not.toMatch(SQL);
    expect(text).not.toMatch(/from "\.\.\/db"/);
  });

  it.each(sources("services"))("$file has no SQL", ({ text }) => {
    expect(text).not.toMatch(SQL);
  });

  it.each(sources("repositories"))("$file doesn't reach up into routes or services", ({ text }) => {
    expect(text).not.toMatch(/from "\.\.\/routes\//);
    expect(text).not.toMatch(/from "\.\.\/services\/(?!test-cases")/);
  });
});
