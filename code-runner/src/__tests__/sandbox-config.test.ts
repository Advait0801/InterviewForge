/**
 * The sandbox's security posture, asserted.
 *
 * These restrictions are invisible to functional tests -- user code runs
 * perfectly well as root with every capability -- so without this file, quietly
 * dropping a flag would pass CI. Each assertion names the attack it prevents.
 */
import { describe, it, expect } from "vitest";
import { buildContainerConfig } from "../runner";

const cfg = buildContainerConfig("interviewforge-python-sandbox:latest", ["sh", "-c", "true"]);
const host = cfg.HostConfig;

describe("sandbox container configuration", () => {
  it("does not run as root", () => {
    // Previously `User: "root"`, which made the other restrictions moot:
    // as root, user code could write to /etc/passwd inside the container.
    expect(cfg.User).toBe("runner");
    expect(cfg.User).not.toBe("root");
  });

  it("drops every Linux capability", () => {
    expect(host.CapDrop).toEqual(["ALL"]);
  });

  it("blocks privilege escalation via setuid binaries", () => {
    expect(host.SecurityOpt).toContain("no-new-privileges");
  });

  it("disables networking", () => {
    // Stops exfiltration and outbound abuse from submitted code.
    expect(cfg.NetworkDisabled).toBe(true);
  });

  it("caps process count so a fork bomb cannot exhaust the host", () => {
    expect(host.PidsLimit).toBeGreaterThan(0);
    expect(host.PidsLimit).toBeLessThanOrEqual(256);
  });

  it("caps CPU so a spin loop cannot starve the host", () => {
    expect(host.NanoCpus).toBeGreaterThan(0);
  });

  it("caps memory, with swap pinned to the same value", () => {
    // Equal values disable swap: otherwise the limit is trivially exceeded.
    expect(host.Memory).toBe(256 * 1024 * 1024);
    expect(host.MemorySwap).toBe(host.Memory);
  });

  describe("scratch mount", () => {
    const opts = host.Tmpfs["/tmp"];

    it("exists and is size-bounded", () => {
      expect(opts).toBeDefined();
      expect(opts).toMatch(/size=\d+/);
    });

    it("is explicitly executable", () => {
      // Docker mounts tmpfs noexec by default. Without `exec`, C and C++
      // compile successfully and then fail with "Permission denied" when the
      // resulting binary runs -- a hardening change that silently breaks half
      // the supported languages.
      expect(opts).toContain("exec");
      expect(opts).not.toContain("noexec");
    });

    it("forbids setuid and device nodes", () => {
      expect(opts).toContain("nosuid");
      expect(opts).toContain("nodev");
    });
  });

  it("points HOME at the writable mount", () => {
    // /home/runner is not writable by the runner user for scratch use; javac
    // and similar tools need a writable HOME.
    expect(cfg.Env).toContain("HOME=/tmp");
  });

  it("keeps the working directory where the code is uploaded", () => {
    expect(cfg.WorkingDir).toBe("/home/runner");
  });

  it("passes the image and command through unchanged", () => {
    const c = buildContainerConfig("some-image:tag", ["sh", "-c", "echo hi"]);
    expect(c.Image).toBe("some-image:tag");
    expect(c.Cmd).toEqual(["sh", "-c", "echo hi"]);
  });
});
