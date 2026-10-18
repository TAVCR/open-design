# Open Design Codex — Gustavo's fork

This fork restores an explicit subscription-backed image provider on the
`open-design-v0.25.0` baseline. Source: <https://github.com/TAVCR/open-design>.

## Generate images

1. Install a recent Codex CLI with native `image_generation` support.
2. Run `codex login` and sign in with the ChatGPT account that has image access.
3. In Open Design Codex, choose **gpt-image-2 (Codex)** in the image
   model picker. The same route is available to external agents through the
   existing `od media generate --model codex-gpt-image-2` command.

The dispatcher starts a dedicated Codex CLI invocation, imports the image from
that invocation's exact thread directory, and preserves its original file.
It accepts the `ig_`, `call_`, and current `exec-` output names. The native tool
chooses its actual image backend; the catalog label is not proof of the backend
version. Subscription limits and account access still apply.
The Cloud-only `--quality` and `--resolution` controls are not supported by this
provider. Describe desired quality and size in the prompt; the native tool's
actual output dimensions are not guaranteed by those requests.

An error on this route stays an error. It never silently charges a Vela or
OpenAI API account. Cloud and API providers remain explicit alternatives.

Existing projects that explicitly select `codex-gpt-image-2` keep that route.
Projects that already saved `vela/gpt-image-2` remain Cloud projects; change the
picker to Codex if that is the intended provider. The fork does not infer a
previous selection from an already-migrated ID.

Optional daemon environment overrides:

- `OD_CODEX_IMAGEGEN_MODEL`: the text model orchestrating the native image tool.
- `OD_CODEX_IMAGEGEN_TIMEOUT_MS`: bounded execution timeout.
- `CODEX_HOME` and `CODEX_BIN`: existing Codex integration inputs.

## Build the Windows installer

Use Node 24 and the pinned pnpm version. From the repository checkout:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm tools-pack win build --namespace codex --app-version 0.25.0-codex.1 --to nsis --portable
```

The package is **Open Design Codex**, with its own Windows uninstall entry and
namespace. Packaged data isolation follows the root `AGENTS.md` daemon data
directory contract. The official installation and its projects are preserved.
The fork's packaged updater is disabled even when inherited environment
variables enable it; install future custom builds manually.

The custom build does not claim the official `opendesign://` invite protocol.
An existing Codex MCP registration for the official app continues to target
that app until it is deliberately replaced with a registration from the fork.

## Verification

The implementation includes catalog, dispatcher, output-import, authentication,
selection-preservation, and package-isolation regression coverage. The historical 0.24.1 fork live check
on Codex CLI 0.159.2 produced a real PNG with an `exec-` filename. See the
[0.25.0 verification report](codex-imagegen-verification-0.25.0.md) for the exact commands and results; source-level tests alone
do not establish that an installer works on another computer.
