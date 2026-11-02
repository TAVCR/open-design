# Open Design Codex 0.24.1-codex.1 — verification

Verified on Windows x64 on 2026-10-08. Fork:
<https://github.com/TAVCR/open-design>, branch `codex/restore-imagegen`.
Implementation commit: `c83fd5d57`, based on `open-design-v0.24.1`.

## Source checks

- `pnpm guard`: passed.
- `pnpm typecheck`: passed across the workspace, including source and test types.
- Focused provider/configuration/dispatch tests: 59 passed.
- Catalog, web model selection, Home/New Project, daemon media policy,
  contracts prompt parity and prompt snapshots: scoped suites passed.
- Packaging, namespace identity, updater disablement and protocol registration:
  scoped suites passed (161 passed, 2 skipped in the packaging validation run).
- Final source review: no blocking findings. The native provider's unsupported
  Cloud quality/resolution flags are documented in the setup guide.

These were relevant scoped suites, not a claim that every repository test ran.

## Built and installed artifact

The supported `tools-pack` control plane built the NSIS installer successfully:

```powershell
node tools/pack/bin/tools-pack.mjs win build --dir K:/od-fork --namespace codex --app-version 0.24.1-codex.1 --to nsis --portable --json
```

Build environment: Node 24.19.0, pnpm 10.33.2, Electron 41.3.0 and NSIS 3.04.
The local build needed Corepack shims on PATH, direct invocation of the same
control-plane entry to avoid an inherited npm allow-scripts conflict, extraction
of the downloaded Windows signing helper cache without its unused macOS
symlinks, and the existing NSIS directory on PATH. These were local build
environment repairs; they did not alter application behavior.

- Artifact: `out/win/namespaces/codex/builder/Open Design-codex-setup.exe`
  under the build root.
- Size: 439,169,989 bytes.
- SHA-256:
  `04F9D36C978AE1D28CC20CA21DB6BA21096668DD69064AAB70EE9503E820A537`.
- Installed and started with `tools-pack win install` / `tools-pack win start`
  using the same root, namespace, version and portable arguments.
- Installed Windows entry and shortcut: **Open Design Codex**.
- Cold stop/start: passed; installed source, visible window, version
  `0.24.1-codex.1`, channel `codex`, updater enabled/supported both false.
- Official stable payload remained present. The fork's data and runtime use
  a separate namespace. A development daemon in `codex-smoke` and the installed
  `codex` runtime operated concurrently with separate project directories.

`tools-pack` pins its managed validation installation to the build root's data
and runtime directories. The distributable portable installer does not require
the source checkout or that local build root on another computer.

## Real native image generation

Codex CLI 0.159.2 was already authenticated with a ChatGPT subscription.

1. A direct native image-generation probe produced a real PNG using the current
   `exec-` filename convention. This caught and corrected a compatibility gap
   in importing modern CLI output filenames.
2. The development daemon's `od media generate --model codex-gpt-image-2`
   path produced a 1,031,257-byte PNG, with `providerId: codex`, no provider
   error and no stub fallback.
3. The **installed application**, through its authenticated renderer and normal
   project/media API, generated `codex-installed-smoke.png` in **28,018 ms**:
   970,060 bytes, MIME `image/png`, status `done`, `providerId: codex`,
   `providerError: null`, `usedStubFallback: false`, `intentionalStub: false`.
   The diagnostic project remains available as **Verificación Codex imagegen**.

No Cloud/API fallback supplied these results. The native tool chooses its image
backend. `codex-gpt-image-2` is the requested route/catalog identity; this check
does **not** independently establish the exact backend model version. ChatGPT
subscription limits and native image-generation availability still apply.

## MCP integration

The installed fork's existing `/api/mcp/install/codex` integration successfully
replaced the `open-design` registration with the fork executable, bundled
daemon CLI and isolated data directory. A local configuration backup was kept
outside Git. Valid TOML and semantic equality of every other setting were
verified after registration.

A fresh stdio MCP client initialized successfully, listed **22 tools**, and
read `codex-installed-smoke` from the installed fork's project directory.
The server reports protocol package version `0.2.0`; this is separate from the
desktop release version. Restart an already-running Codex desktop session to
load the new registration into its tool inventory.

Raw build/runtime logs and probe outputs are retained locally under `.tmp/`.
Authentication files, user configuration, private workspace data and binary
build artifacts are not committed to the public fork.
