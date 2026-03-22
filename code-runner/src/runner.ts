import Docker from "dockerode";
import { PROBLEM_META, ProblemMeta } from "./problem-meta";
import { parseTestInput, compareOutputs } from "./input-parser";
import { generateCode } from "./harness-gen";

export type { TestCase, SupportedLanguage, RunRequest, RunResult } from "./types";
import type { TestCase, SupportedLanguage, RunRequest, RunResult } from "./types";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const TIMEOUT_MS = 15_000;
const MEMORY_LIMIT = 256 * 1024 * 1024;

const LANGUAGE_IMAGES: Record<SupportedLanguage, string> = {
  python3: "interviewforge-python-sandbox:latest",
  c: "interviewforge-c-sandbox:latest",
  cpp: "interviewforge-cpp-sandbox:latest",
  java: "interviewforge-java-sandbox:latest",
};

function getCmd(lang: SupportedLanguage): string[] {
  switch (lang) {
    case "python3":
      return ["sh", "-c", "python3 -u /home/runner/run.py < /home/runner/input.txt 2>&1"];
    case "cpp":
      return [
        "sh",
        "-c",
        "g++ -std=c++17 -O2 -o /tmp/sol /home/runner/solution.cpp 2>&1 && /tmp/sol < /home/runner/input.txt 2>&1",
      ];
    case "java":
      return [
        "sh",
        "-c",
        "cp /home/runner/Main.java /tmp/ && cd /tmp && javac Main.java 2>&1 && java -cp /tmp Main < /home/runner/input.txt 2>&1",
      ];
    case "c":
      return [
        "sh",
        "-c",
        "gcc -O2 -o /tmp/sol /home/runner/solution.c -lm 2>&1 && /tmp/sol < /home/runner/input.txt 2>&1",
      ];
  }
}

export async function runCode(req: RunRequest): Promise<RunResult> {
  const meta = req.slug ? PROBLEM_META[req.slug] : undefined;

  if (!meta) {
    return {
      passed: false,
      results: req.testCases.map(() => ({
        passed: false,
        error: `No metadata for slug "${req.slug}". Ensure starter_templates covers this problem.`,
      })),
    };
  }

  const { code: combinedCode, filename } = generateCode(
    req.language,
    req.code,
    meta
  );

  const inputContent =
    req.language === "python3"
      ? buildJsonInput(req.testCases, meta)
      : buildLinePerArgInput(req.testCases, meta);

  const tarBuffer = createTarBuffer([
    { name: filename, content: combinedCode },
    { name: "input.txt", content: inputContent },
  ]);

  const image = LANGUAGE_IMAGES[req.language];
  let container: Docker.Container | null = null;

  try {
    container = await docker.createContainer({
      Image: image,
      Cmd: getCmd(req.language),
      User: "root",
      WorkingDir: "/home/runner",
      NetworkDisabled: true,
      HostConfig: {
        Memory: MEMORY_LIMIT,
        MemorySwap: MEMORY_LIMIT,
      },
    });

    await container.putArchive(tarBuffer, { path: "/home/runner" });

    const startTime = Date.now();
    await container.start();

    const waitResult = await Promise.race([
      container.wait() as Promise<{ StatusCode: number }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TLE")), TIMEOUT_MS)
      ),
    ]);

    const runtimeMs = Date.now() - startTime;
    const rawOutput = await readContainerLogs(container);

    const lines = rawOutput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (waitResult.StatusCode !== 0 && lines.length === 0) {
      return {
        passed: false,
        results: req.testCases.map(() => ({
          passed: false,
          error: rawOutput.substring(0, 500) || "Runtime Error (non-zero exit)",
        })),
        runtimeMs,
      };
    }

    const results = req.testCases.map((tc, idx) => {
      const actualLine = idx < lines.length ? lines[idx] : "";

      try {
        const parsed = JSON.parse(actualLine);
        if (parsed && typeof parsed === "object" && parsed.__error) {
          return {
            passed: false,
            actualOutput: "",
            error: String(parsed.__error),
          };
        }
      } catch {
        /* not a JSON error */
      }

      const passed = compareOutputs(actualLine, tc.expectedOutput, meta.unorderedOutput);
      return { passed, actualOutput: actualLine };
    });

    return {
      passed: results.every((r) => r.passed),
      results,
      runtimeMs,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "TLE") {
      if (container) {
        try {
          await container.kill();
        } catch {
          /* already stopped */
        }
      }
      return {
        passed: false,
        results: req.testCases.map(() => ({
          passed: false,
          error: "Time Limit Exceeded",
        })),
        runtimeMs: TIMEOUT_MS,
      };
    }

    const msg = err instanceof Error ? err.message : "Unknown execution error";
    return {
      passed: false,
      results: req.testCases.map(() => ({ passed: false, error: msg })),
    };
  } finally {
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        /* ok */
      }
    }
  }
}

function buildJsonInput(testCases: TestCase[], meta: ProblemMeta): string {
  const lines = testCases.map((tc) => {
    const parsed = parseTestInput(tc.input, meta);

    if (parsed.isDesign) {
      return JSON.stringify({
        design: true,
        className: meta.className,
        ops: parsed.ops,
        args: parsed.opArgs,
      });
    }

    return JSON.stringify({
      fn: meta.methodName,
      args: parsed.args,
      arg_types: parsed.argTypes,
      return_type: meta.returnType,
      className: meta.className,
      param_names: (meta.params || []).map((p) => p.name),
    });
  });
  return lines.join("\n") + "\n";
}

/**
 * Line-per-arg format for compiled languages (C++/Java/C).
 * Each arg on its own line, `---` separates test cases.
 */
function buildLinePerArgInput(testCases: TestCase[], meta: ProblemMeta): string {
  const blocks: string[] = [];

  for (const tc of testCases) {
    const parsed = parseTestInput(tc.input, meta);

    if (parsed.isDesign) {
      blocks.push(JSON.stringify(parsed.ops));
      blocks.push(JSON.stringify(parsed.opArgs));
    } else {
      const args = parsed.args || [];
      for (const arg of args) {
        blocks.push(JSON.stringify(arg));
      }
    }
    blocks.push("---");
  }

  return blocks.join("\n") + "\n";
}

async function readContainerLogs(container: Docker.Container): Promise<string> {
  const logBuffer = (await container.logs({
    stdout: true,
    stderr: true,
    follow: false,
  })) as Buffer;

  if (typeof logBuffer === "string") return logBuffer;

  return demuxDockerLogs(logBuffer);
}

/**
 * Docker multiplexed log output has 8-byte headers per frame:
 * byte 0: stream type (1=stdout, 2=stderr)
 * bytes 4-7: payload size (big-endian u32)
 * followed by the payload.
 */
function demuxDockerLogs(buf: Buffer): string {
  const chunks: string[] = [];
  let offset = 0;

  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (size === 0) continue;
    const end = Math.min(offset + size, buf.length);
    chunks.push(buf.subarray(offset, end).toString("utf-8"));
    offset = end;
  }

  if (offset < buf.length) {
    chunks.push(buf.subarray(offset).toString("utf-8"));
  }

  return chunks.join("");
}

/**
 * Create a minimal tar archive buffer from a list of files.
 * Suitable for container.putArchive().
 */
function createTarBuffer(
  files: Array<{ name: string; content: string }>
): Buffer {
  const blocks: Buffer[] = [];

  for (const file of files) {
    const contentBuf = Buffer.from(file.content, "utf-8");
    const header = Buffer.alloc(512, 0);

    // Name (0..100)
    header.write(file.name, 0, Math.min(file.name.length, 100), "utf-8");

    // Mode (100..108): 0644
    writeOctal(header, 100, 8, 0o644);

    // UID (108..116): 0
    writeOctal(header, 108, 8, 0);

    // GID (116..124): 0
    writeOctal(header, 116, 8, 0);

    // Size (124..136)
    writeOctal(header, 124, 12, contentBuf.length);

    // Mtime (136..148)
    writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));

    // Checksum placeholder — spaces (148..156)
    header.fill(0x20, 148, 156);

    // Type flag (156): '0' = regular file
    header[156] = 0x30;

    // Magic (257..265): "ustar\0" + version "00"
    header.write("ustar\0", 257, 6, "utf-8");
    header.write("00", 263, 2, "utf-8");

    // Compute checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    writeOctal(header, 148, 7, checksum);
    header[155] = 0x20; // trailing space

    blocks.push(header);
    blocks.push(contentBuf);

    const remainder = contentBuf.length % 512;
    if (remainder > 0) {
      blocks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  // End-of-archive marker: two zero blocks
  blocks.push(Buffer.alloc(1024, 0));

  return Buffer.concat(blocks);
}

function writeOctal(
  buf: Buffer,
  offset: number,
  size: number,
  value: number
): void {
  const str = value.toString(8).padStart(size - 1, "0");
  buf.write(str + "\0", offset, size, "utf-8");
}
