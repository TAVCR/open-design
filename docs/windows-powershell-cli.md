# Windows PowerShell CLI output recovery

Verified on 2026-10-21 in the installed 0.26.0-codex.1 application.

Direct PowerShell invocation of the GUI Electron executable used as OD_NODE_BIN
returned zero captured output lines and no populated exit status for the CLI's
`media generate --help`. Running the identical packaged CLI script with the
installed console Node 24.21.0 returned 76 lines and exit 0.

In the reported project, task a187fa5a-98cd-499d-9aa8-d3f9d2f4794a actually
completed in 28,128 ms through provider codex without a provider error. The
agent's command returned empty output earlier, then marked production blocked
and reported the generic support message before the PNG arrived. The existing
`estudio-nocturno-base.png` is 2,330,829 bytes. No regeneration was necessary.

The installed user instructions in both forks now direct Windows agent tool
shells to execute OD_BIN with the verified console Node at
`C:/Program Files/nodejs/node.exe` when OD_NODE_BIN names the GUI carrier. Preserve
all existing project/auth environment; never log token values. Discover and
verify a compatible console runtime if that host-specific path becomes absent.
This is a host-level instruction workaround, not a rebuilt runtime resolver.

Empty CLI output must trigger task/file inspection, not an invented provider
failure or a duplicate generation. Follow queued/running task IDs and cursors
to a terminal result. Reuse verified generated files. This mitigation does not
change providers, billing, the user request, or existing project approval state.

The unrelated cloud billing 403 warnings in the daemon log did not prevent
this successful native Codex task; they are not evidence of its failure.
