# Open Design Codex 0.25.0-codex.1 — upgrade verification

Verified on Windows x64 on 2026-10-17.

## Conditional upgrade decision

The user requested this upgrade **only if official 0.25.0 still prevented
subscription-backed native Codex image generation**. That condition was met:
the official daemon and web catalogs still map `codex-gpt-image-2` to
`vela/gpt-image-2`, and its dispatcher does not implement a Codex image provider.

- Official release: <https://github.com/nexu-io/open-design/releases/tag/open-design-v0.25.0>.
- Official tag commit: `de6d2c072a18dfef80ecad4a455b31f0d5aca090`.
- The supplied Windows installer matched the published GitHub asset digest:
  `2A916DE71015F55445AA2982F189ECC927B74C1CB8A0B48D6B10878172EFC7A8`.

The release was merged into `codex/restore-imagegen` in `3e8b0b207`.
`71aac95e5` updates an upstream Vela regression to test an explicitly selected
Cloud model, preserving this fork's native Codex route. Outside the known fork
delta and that necessary test adjustment, the source matches the official tag.
Independent source review and scoped review of the test adjustment found no
actionable upgrade regressions.

## Source validation

Node 24.19.0 and pnpm 10.33.2 were used.

| Check | Result |
|---|---|
| Frozen dependency installation and workspace postinstall builds | Passed |
| `pnpm guard` | Passed |
| `pnpm typecheck` across the workspace | Passed |
| Daemon Codex/media catalogs/prompt scopes | 117 passed |
| Daemon explicit Vela routing scope | 28 passed |
| Web catalogs/Home/New Project scopes | 56 passed |
| Desktop updater/protocol scopes | 8 passed |
| Packaged paths/title/updater scopes | 24 passed |
| Windows packaging identity scope | 15 passed |

The affected scopes above total **248 passed tests**. This is not a claim that
the full repository suite ran. Two additional unchanged upstream
`win-custom-installer` fixture tests fail on Windows with `spawn UNKNOWN`:
their fake `makensis.exe` is a POSIX shell script. The real NSIS build and
installation below succeeded. An initial broader media run was interrupted;
the affected scopes and corrected Vela regression were subsequently rerun.

## Package and installation

```powershell
node tools/pack/bin/tools-pack.mjs win build --dir K:/od-fork --namespace codex --app-version 0.25.0-codex.1 --to nsis --portable --json
```

The build completed with exit code 0, including the NSIS installer and launcher
payload artifact. The existing local NSIS directory and Corepack shims were
on PATH, as in the prior build.

- Artifact: `out/win/namespaces/codex/builder/Open Design-codex-setup.exe`
  under the build root.
- Size: **442,760,803 bytes**.
- SHA-256:
  `FA7737B0849FD6F82E2DD6E2FA33E6D3633AADA906BB6960CCF05F92192D62B8`.
- Upgraded with `tools-pack win install`, then started with `tools-pack win start`.
- Windows installed entry: **Open Design Codex 0.25.0-codex.1**.
- A subsequent cold stop/start passed: running, visible window, correct version,
  and official updater disabled.
- The normal installed user entry point was also checked, with the visible
  window remaining available alongside a fresh MCP connection.
- Namespace and installation identity remain `codex`; no official invite
  protocol registration was added.

## User data preservation

The previous installer and private configuration were retained outside Git.
The authoritative data backup uses SQLite's online backup API because a
background MCP connection can reopen a daemon during a file copy. All three
database backups returned `integrity_check: ok`.

After upgrade:

- All **18 previous project database IDs** remain present.
- All **861 files across the 19 previous project directories** are present with
  identical SHA-256 hashes.
- One new diagnostic project was added for this verification.
- Other Codex configuration settings are semantically unchanged.

## Installed application checks

The installed resource tree includes **169 skills, 115 design templates and
152 design systems**. All five new Motion examples are included; their 62 files
match the source byte for byte: Motion Future, Product Promo, Showreel, UI Morph
and Visual Lesson.

The installed application's authenticated renderer and normal project/media API
generated `codex-upgrade025-smoke.png` through the default
`codex-gpt-image-2` route:

- Status `done` in **25,026 ms**.
- Provider `codex`, subscription authentication, no API key supplied to the
  image provider.
- `providerError: null`, `usedStubFallback: false`, `intentionalStub: false`.
- Real PNG signature verified; **1,058,910 bytes**, **1254 × 1254** pixels.
- SHA-256:
  `E1CCB0D1F9727DECDE12AA3BE60023AEB79DD5E00EFE0A0F0503FC1023480F61`.
- Diagnostic project: **Verificación Codex 0.25.0**.

The native tool chooses its actual image backend. The requested model label
does not independently establish the exact backend model version. Subscription
limits still apply; native generation does not support the Cloud-only quality
and resolution controls documented in the setup guide.

## MCP

The old registration pointed to a previous sidecar connection. It was refreshed
through the installed app's `/api/mcp/install/codex` integration, with the prior
configuration backed up. A preexisting MCP session could still launch a headless
owner during a controlled restart, conflicting with the test harness's desktop.
The installed user's normal entry point was subsequently verified successfully.

The local registration now uses the daemon CLI's existing managed-discovery
contract to find runtime and headless owners. Endpoint lists were generated by
the project's canonical `buildManagedMcpDiscovery` helper for the same `codex`
namespace, for packaged and tools-pack sources; no port was hardcoded. This is
a local registration adjustment, not a change to the upstream Windows outer's
platform policy or an assertion that it implements macOS window promotion.
Fresh stdio clients connected both to the headless owner and to the visible
installed application. Every unrelated Codex setting was preserved.

A fresh MCP stdio client connected, listed **22 tools**, read **169 skills and
465 visible plugin entries**, and read the diagnostic project. Visible plugin
entries and shipped plugin-resource counts are different catalog measures.
Restart an existing Codex desktop session to load the refreshed registration.
Reinstalling the MCP through an unmodified Windows one-click registration can
replace this local discovery profile with a single-mode registration.

Raw build logs and verification outputs remain locally under `.tmp/`. Private
backups and binary installers are outside the public Git repository.
