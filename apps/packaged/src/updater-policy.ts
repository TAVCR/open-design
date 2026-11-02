import { releaseChannelFromVersion } from "@open-design/release";

type PackagedUpdaterIdentity = {
  appVersion: string | null;
  namespace: string;
  updateMetadataUrl: string | null;
};

export function isCodexPackagedBuild(config: Pick<PackagedUpdaterIdentity, "appVersion" | "namespace">): boolean {
  return config.namespace === "codex" || releaseChannelFromVersion(config.appVersion) === "codex";
}

/** The Codex fork is installed separately and must only be upgraded manually.
 * Enforce this in the packaged carrier so an inherited updater opt-in cannot
 * replace the custom build. Desktop's canonical disabled state also gates
 * manual check, download, and install actions.
 */
export function applyPackagedUpdaterEnv(
  config: PackagedUpdaterIdentity,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (isCodexPackagedBuild(config)) {
    env.OD_UPDATE_ENABLED = "0";
    env.OD_UPDATE_AUTO_CHECK = "0";
    env.OD_UPDATE_AUTO_DOWNLOAD = "0";
    env.OD_UPDATE_AUTO_OPEN = "0";
    return;
  }

  if (config.updateMetadataUrl == null) return;
  if (env.OD_UPDATE_METADATA_URL != null && env.OD_UPDATE_METADATA_URL.length > 0) return;
  env.OD_UPDATE_METADATA_URL = config.updateMetadataUrl;
}
