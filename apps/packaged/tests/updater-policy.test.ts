import { readFileSync } from "node:fs";
import { join } from "node:path";

import { releaseChannelFromVersion } from "@open-design/release";
import { describe, expect, it } from "vitest";

import { applyPackagedUpdaterEnv, isCodexPackagedBuild } from "../src/updater-policy.js";

describe("packaged fork updater policy", () => {
  it.each([
    { appVersion: "0.24.1-codex.1", namespace: "codex" },
    { appVersion: "0.24.1-codex.1", namespace: "default" },
    { appVersion: "0.24.1", namespace: "codex" },
  ])("disables automatic and manual updates for the fork: %j", (identity) => {
    const env: NodeJS.ProcessEnv = {
      OD_UPDATE_ENABLED: "1",
      OD_UPDATE_AUTO_CHECK: "1",
      OD_UPDATE_AUTO_DOWNLOAD: "1",
      OD_UPDATE_AUTO_OPEN: "1",
      OD_UPDATE_CHANNEL: "stable",
    };
    applyPackagedUpdaterEnv({ ...identity, updateMetadataUrl: null }, env);
    expect(isCodexPackagedBuild(identity)).toBe(true);

    expect(env.OD_UPDATE_ENABLED).toBe("0");
    expect(env.OD_UPDATE_AUTO_CHECK).toBe("0");
    expect(env.OD_UPDATE_AUTO_DOWNLOAD).toBe("0");
    expect(env.OD_UPDATE_AUTO_OPEN).toBe("0");
  });

  it("keeps official package behavior and existing metadata overrides", () => {
    const env: NodeJS.ProcessEnv = { OD_UPDATE_ENABLED: "1", OD_UPDATE_METADATA_URL: "https://fixture.test/feed" };
    applyPackagedUpdaterEnv({ appVersion: "0.24.1", namespace: "release-stable-win", updateMetadataUrl: "https://baked.test/feed" }, env);
    expect(env).toEqual({ OD_UPDATE_ENABLED: "1", OD_UPDATE_METADATA_URL: "https://fixture.test/feed" });

    const cleanEnv: NodeJS.ProcessEnv = {};
    applyPackagedUpdaterEnv({ appVersion: "0.24.1-beta.1", namespace: "release-beta-win", updateMetadataUrl: "https://baked.test/feed" }, cleanEnv);
    expect(cleanEnv).toEqual({ OD_UPDATE_METADATA_URL: "https://baked.test/feed" });
  });

  it("uses the codex release channel rather than silently inferring stable", () => {
    expect(releaseChannelFromVersion("0.24.1-codex.1")).toBe("codex");
  });

  it("applies the policy before creating the desktop updater", () => {
    const main = readFileSync(join(import.meta.dirname, "../src/index.ts"), "utf8");
    expect(main).toContain("applyPackagedUpdaterEnv(activeConfig)");
    expect(main).toContain("registerInviteProtocolClient: !isCodexPackagedBuild(activeConfig)");
    expect(main.indexOf("applyPackagedUpdaterEnv(activeConfig)")).toBeLessThan(main.indexOf("const launchDesktop ="));
  });
});
