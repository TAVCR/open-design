import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpDaemonTarget, handleMcpToolCall } from "../src/mcp.js";
import { _resetMcpWorkspaceContextCacheForTests } from "../src/mcp-workspace-context.js";

afterEach(() => {
  vi.unstubAllGlobals();
  _resetMcpWorkspaceContextCacheForTests();
});
const authority = {
  "x-od-workspace-id": "workspace-media",
  "x-od-workspace-member-id": "member-media",
};
let serial = 19960;
function fixture() {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const base = `http://127.0.0.1:${serial++}`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/api/workspace/directory"))
        return Response.json({
          items: [
            {
              workspaceId: "workspace-media",
              workspaceMemberId: "member-media",
              workspaceType: "personal",
              memberStatus: "active",
              lifecycleState: "active",
            },
          ],
          activeWorkspaceId: "workspace-media",
        });
      if (String(url).endsWith("/projects"))
        return Response.json({
          projects: [{ id: "project-media", name: "Media" }],
        });
      if (String(url).includes("/media/tasks?"))
        return Response.json({
          tasks: [{ taskId: "task-media", status: "running" }],
        });
      return Response.json({
        taskId: "task-media",
        status: "running",
        nextSince: 0,
        progress: [],
      });
    }),
  );
  return { base, calls };
}
describe("public media MCP integration", () => {
  for (const name of [
    "generate_image",
    "list_media_tasks",
    "get_media_task",
    "wait_media_task",
  ]) {
    it(`propagates resolved workspace to ${name} without entering Bearer tool-token lane`, async () => {
      const { base, calls } = fixture();
      const result = await handleMcpToolCall(base, name, {
        project: "Media",
        ...(name === "generate_image"
          ? { prompt: "clean scenery" }
          : name === "list_media_tasks"
            ? {}
            : { taskId: "task-media" }),
      });
      expect(result.isError).not.toBe(true);
      const requests = calls.filter((c) => c.url.includes("/media/"));
      expect(requests.length).toBeGreaterThan(0);
      for (const call of requests) {
        expect(call.init?.headers).toMatchObject(authority);
        expect(new Headers(call.init?.headers).has("authorization")).toBe(
          false,
        );
      }
    });
  }
  for (const name of ["generate_image", "composition"]) {
    it(`does not replay ${name} after daemon replacement`, async () => {
      const resolveDaemonUrl = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce("http://127.0.0.1:61901")
        .mockResolvedValueOnce("http://127.0.0.1:61902");
      const call = vi.fn(async (url: string) => ({
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `cannot reach the OpenDesign daemon at ${url}.`,
          },
        ],
      }));
      const target = createMcpDaemonTarget({
        daemonUrl: "http://127.0.0.1:61900",
        resolveDaemonUrl,
      });
      const result = await target.call(name, {}, call);
      expect(result.isError).toBe(true);
      expect(call).toHaveBeenCalledTimes(1);
      expect(result.content[0]?.text).toContain(
        "may or may not have been applied",
      );
    });
  }
});
