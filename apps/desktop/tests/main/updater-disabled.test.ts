import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { SIDECAR_SOURCES } from "@open-design/sidecar-proto";
import { describe, expect, it, vi } from "vitest";

import { createDesktopUpdater } from "../../src/main/updater.js";

describe("disabled packaged updater", () => {
  it("reports disabled and blocks all update actions even with an official feed override", async () => {
    const downloadRoot = join(tmpdir(), `od-disabled-updater-${randomUUID()}`);
    const fetch = vi.fn<typeof globalThis.fetch>();
    const openPath = vi.fn(async () => "");
    const updater = createDesktopUpdater({
      currentVersion: "0.24.1-codex.1",
      namespace: "codex",
      downloadRoot,
      platform: "win32",
      source: SIDECAR_SOURCES.PACKAGED,
      env: {
        OD_UPDATE_ENABLED: "0",
        OD_UPDATE_AUTO_CHECK: "0",
        OD_UPDATE_AUTO_DOWNLOAD: "0",
        OD_UPDATE_AUTO_OPEN: "0",
        OD_UPDATE_CHANNEL: "stable",
        OD_UPDATE_METADATA_URL: "https://releases.open-design.ai/stable/latest/metadata.json",
      },
    }, { fetch, openPath, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });

    expect(updater.shouldAutoCheck()).toBe(false);
    for (const action of [() => updater.status(), () => updater.checkForUpdates(), () => updater.downloadUpdate(), () => updater.installUpdate()]) {
      const snapshot = await action();
      expect(snapshot).toMatchObject({ enabled: false, supported: false, state: "idle" });
      expect(snapshot.capabilities.canApplyInPlace).toBe(false);
      expect(snapshot.capabilities.canOpenInstaller).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
    expect(existsSync(downloadRoot)).toBe(false);
  });
});
