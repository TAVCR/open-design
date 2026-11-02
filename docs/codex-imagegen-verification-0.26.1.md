# Local Codex 0.26.1-codex.1 verification

Verified on Windows x64 on 2026-11-01 (Costa Rica).

Official stable tag `open-design-v0.26.1` is pinned to
`ac476788b7393f491df7d511c1c3b2d43b35e0fb`. Its production image catalog still
aliases `codex-gpt-image-2` to Cloud, so the conditional native-imagegen fork
upgrade remains applicable. The new tree starts from that exact tag and
reapplies only the known fork delta, preserving new upstream video catalogue
selection and launch telemetry rather than restoring retired behavior.

## Source validation

Node 24.21.0 and pnpm 10.33.2. Frozen install, repository guard and workspace
typecheck passed. Final test TypeScript checks also passed after adapting two
inherited test fixtures for Windows. The new tests normalize CRLF/path separators
and create a cmd shim for the simulated Qwen executable; they do not weaken the
behavior assertions or depend on a real Qwen account. The initial platform
fixture failures were resolved and their scopes rerun successfully.

281 distinct selected tests passed: daemon native media/catalog/prompts 148,
web 56, desktop identity/updater 8, packaged 24, Windows identity 15, and
new skill discovery/continuity 30. Full monorepo suites were not run.

The updater-helper integration conflict was resolved by retaining the fork's
policy module and removing the obsolete local helper, while keeping the new
upstream launch telemetry. Official updates and global invite claims remain
disabled for this custom identity. Layered composition policy and the persistent
console-Node workaround are preserved; no automatic image regeneration rule was
introduced.

## Build, install and real runtime

The final portable NSIS build and launcher payload completed with exit 0. A
second build after the source corrections ensured the final package/cache keys
refer to the settled source. Installation completed with exit 0, replacing only
the existing codex namespace installation. The previous 0.26.0 installer and
configuration remain in the private maintenance backup.

- Installer size: 443,216,209 bytes.
- Installer SHA-256:
  `90010DD7FE717BE40B7F1B03066CF1EA5EEE1C20440755902B89238F1D26B7BE`.
- Installed executable version: `0.26.1-codex.1`.
- Normal installed shortcut/entry and cold restart: visible, correct version,
  official updater disabled.
- Desktop/Start menu opening wrappers reapplied.
- Fresh actual registered MCP before/after restart: 22 tools; project, skill
  and plugin catalogue reads succeeded. No fixed listener port was introduced.
- Windows console Node executed the installed media CLI help: 111 output lines,
  exit 0. The documented GUI-PowerShell workaround remains in user instructions.

No active run was present immediately before stopping the old headless owner.
Idle MCP clients were closed before replacement to release executable locks.
SQLite online backups passed integrity checks for all four digital databases.
All 26 preexisting project IDs and all 9,637 project files remain present with
identical SHA-256 hashes. Persistent instructions and unrelated Codex TOML
settings remain unchanged. One new diagnostic project was added.

The installed renderer's normal media API generated a real image using the
default native Codex subscription provider:

- Diagnostic project: `codex-upgrade0261-smoke`.
- Duration: 20,490 ms; status done; provider codex.
- Provider error null; no stub/fallback.
- PNG signature verified, 1254 × 1254, 1,045,612 bytes.
- SHA-256:
  `055ABB8C588D6DD775DD365FD5139B4E7D3303EF91A67DA85439FAA51E3F7584`.

The native backend model version is not independently identified by the tool.
No paid API fallback was used. Upstream Skill Discovery, Home, sharing, BYOK,
workspace MCP and Motion changes are included. Cloud sharing, billing and every
video export path were not exercised by this maintenance run.
