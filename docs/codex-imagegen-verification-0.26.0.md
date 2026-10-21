# Local Codex 0.26.0-codex.1 verification

Verified on Windows x64 on 2026-10-21 (America/Costa_Rica).

Official tag `open-design-v0.26.0` resolves to
`bfee093942f8578c8b6ec7f26862e96f81026a89`. Its production catalog still aliases
`codex-gpt-image-2` to the Cloud provider and has no native Codex dispatcher.
The conditional fork upgrade therefore applies.

The official supplied installer matched the published SHA-256:
`4C0697A53177753072593B44133F44CCA76421A102A4DA1B4229D5E643569B00`.
The fork starts from the exact new tag and reapplies only the existing custom
delta, rather than retaining unrelated files from the previous release.
The prompt snapshot was regenerated: only the two Codex scenario character
counts changed (+604 each), reflecting the preserved media policy.

## Validation

Node 24.21.0 and pnpm 10.33.2:

- Frozen dependency installation and workspace postinstall: passed.
- Repository guard and workspace typecheck: passed.
- Focused daemon media and prompt tests: 147 passed.
- Focused web media/Home/New Project tests: 56 passed.
- Desktop updater/protocol tests: 8 passed.
- Packaged paths/title/updater tests: 24 passed.
- Windows installer identity tests: 15 passed.
- Total: 250 focused tests; the full repository suites were not run.
- Portable NSIS build and launcher payload: exit 0.
- Installation: exit 0, installed version `0.26.0-codex.1`.

Installer: 443,027,606 bytes; SHA-256
`3AB251565139DA15F8D856E936E83D2DF04C9B1B20C3EB616704B412C913B4F6`.

## Preservation and runtime

No active runs or media tasks were present before stopping the old headless
owner. Idle MCP client processes held the executable open; they were closed
to let the Windows installer finish. No running generation was interrupted.
The previous installer and configuration were retained outside Git. SQLite
online backups of four databases all passed integrity checks.

All 21 existing project IDs and all 871 project files survived unchanged by
SHA-256, including after cold restart. One diagnostic project was added.
Other Codex configuration remained semantically identical.
The installed resources contain 169 skills, 115 design templates and 152 design
systems. All 65 files across six motion example directories match source.
Presence and byte parity do not establish that every advertised feature works.

Both tools-pack start and a cold launch through the normal installed entry
point succeeded, with a visible window and official updater disabled. Desktop
and Start menu maintenance wrappers were reapplied. Fresh clients using the
actual registered MCP connected after both launches, listed 22 tools, and read
projects, skills and plugins. The existing discovery profile needed no change.

## Real native image smoke

The installed application's authenticated renderer used its standard media
API with default `codex-gpt-image-2`, subscription authentication, no API key:

- Diagnostic project: `codex-upgrade026-smoke`.
- Status `done` in 23,386 ms; provider `codex`.
- `providerError: null`, `usedStubFallback: false`, `intentionalStub: false`.
- PNG signature verified; 1,045,847 bytes; 1254 × 1254 pixels.
- SHA-256: `F27C6BFCA8FE85EAB40BF50A2128C92C5641AD7D460D303F56FB958E8ACF61FD`.

The tool did not identify the actual backend image model, so the requested
catalog model label is not proof of the backend model version.

Upstream release notes describe Motion Design, browser review links,
contextual comments, revision feedback, custom BYOK model names and preview
fixes. These features were preserved from the release; this maintenance did
not exercise cloud sharing, comment sync, billing, or every video export path.
