# MCP layered workflow implementation plan

> For agentic workers: use subagent-driven-development for independent domain tasks; root integrates and verifies the installed applications.

Goal: implement approved Mejora-MCP-capas-diseno-v1.md without changing existing user projects.
Architecture: daemon-owned managed composition with atomic revision writes and renderer; reuse print scene objects and immutable resources; MCP proxies existing media lifecycle with workspace authorization.
Tech stack: TypeScript, Express, Vitest, existing pdf-lib and MCP SDK, Node24/pnpm10.33.2.

Global constraints: retain subscription Codex generation, no silent fallback, no user asset overwrite, no automatic migration, preserve ICC and PDF validation limits. Increment fork revision on existing 0.26.1 baseline. Never touch dirty original print checkout.

## Tasks
- [ ] Digital domain: tests for text edit preserving sibling references, revision conflict, order, safe SVG and path traversal. Implement composition schema/store/renderer + authenticated routes + server registration. Run focused tests.
- [ ] Media MCP: tests for generated UUID output, native default, project ownership, pending and terminal tasks, persisted restart recovery, cursor bounds. Export MEDIA_TOOL_DEFS and handleMediaMcpTool; reuse media routes with proper workspace headers. Run focused tests.
- [ ] Print domain: tests for object mutations and revision conflict; no geometry or profile side effects. Implement layers endpoint and authorized resource import using existing decode/storage. Run focused tests.
- [ ] Root integration: write failing MCP tests for discovery, workspace propagation, composition operation dispatch, print dispatch and validation errors. Add focused mcp-composition module and dispatch shared tools from mcp.ts; port common source/test changes to print worktree.
- [ ] Validate: focused domain and existing MCP regressions, pnpm guard, pnpm typecheck both trees. Self-review changed APIs and security boundaries. Commit source only after passing checks.
- [ ] Package: backup coherent databases and files before builds overwrite artifacts, build 0.26.1-codex.2 and 0.26.1-print.2 using tools-pack. Check active operations immediately before stopping; stage if busy.
- [ ] Verify installations: normal launch + fresh stdio MCP; create diagnostic composition, insert/edit/order/reopen, compare unchanged resource hashes, decode transparent PNG, native ImageGen diagnostic, print layer revision conflict and review PDF. Record precise evidence and limitations; push authorized fork branches without force.

Integration interfaces: media handleMediaMcpTool(baseUrl,name,args,projectId,headers) returns JSON payload; composition tool calls project-scoped /composition routes; print_document operations layers/mutate_layer/import_project_resource reuse /api/print. All writes require expectedRevision, except initial create. Tool mutations never automatic retry.

Self-review: each approved section mapped above; arbitrary old HTML remains untouched, managed preview derives from same revision as model, persisted task results are authoritative after restart. Public resources contain no credentials. No external providers introduced.
