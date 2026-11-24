import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMediaMcpTool, MEDIA_TOOL_DEFS } from "../src/mcp-media.js";

const base = "http://127.0.0.1:43100";
const headers = { "x-od-workspace-id": "workspace" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());
describe("MCP image task lifecycle", () => {
  it("exposes four bounded tools", () =>
    expect(MEDIA_TOOL_DEFS.map((t) => t.name)).toEqual([
      "generate_image",
      "list_media_tasks",
      "get_media_task",
      "wait_media_task",
    ]));
  it("creates unique native image outputs and preserves workspace authority", async () => {
    const fetcher = vi.fn(async () =>
      json({ taskId: "task", status: "queued" }, 202),
    );
    vi.stubGlobal("fetch", fetcher);
    await handleMediaMcpTool(
      base,
      "generate_image",
      { prompt: "Clean scenery" },
      "project",
      headers,
    );
    await handleMediaMcpTool(
      base,
      "generate_image",
      { prompt: "Clean scenery" },
      "project",
      headers,
    );
    const request = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(request[1].body));
    expect(request[0]).toBe(`${base}/api/projects/project/media/generate`);
    expect(request[1].headers).toMatchObject(headers);
    expect(body).toMatchObject({
      surface: "image",
      model: "codex-gpt-image-2",
      prompt: "Clean scenery",
    });
    expect(body.output).toMatch(/^mcp-image-[a-f0-9-]+\.png$/);
    expect(body.output).not.toBe(
      JSON.parse(
        String(
          (fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body,
        ),
      ).output,
    );
  });
  it("rejects missing prompt, explicit fallback, arbitrary output and traversal before dispatch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const args of [
      {},
      { prompt: "x", model: "other" },
      { prompt: "x", output: "master.png" },
      { prompt: "x", images: ["../secret.png"] },
    ]) {
      await expect(
        handleMediaMcpTool(base, "generate_image", args, "project", headers),
      ).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses a task not present in the authorized project", async () => {
    const fetcher = vi.fn(async () => json({ tasks: [] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      handleMediaMcpTool(
        base,
        "wait_media_task",
        { taskId: "foreign" },
        "project",
        headers,
      ),
    ).rejects.toThrow("not found");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("gets complete persisted progress through a zero-time snapshot", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("/tasks?")
        ? json({ tasks: [{ taskId: "restored", status: "done" }] })
        : json({
            taskId: "restored",
            status: "done",
            progress: ["a", "b"],
            nextSince: 2,
            file: { name: "image.png" },
          }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await handleMediaMcpTool(
      base,
      "get_media_task",
      { taskId: "restored", since: 1 },
      "project",
      headers,
    );
    expect(result).toMatchObject({
      status: "done",
      nextSince: 2,
      file: { name: "image.png" },
    });
    expect(
      JSON.parse(
        String(
          (fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body,
        ),
      ),
    ).toEqual({ since: 1, timeoutMs: 0 });
  });
  it("bounds wait to 25 seconds and leaves running status intact", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("/tasks?")
        ? json({ tasks: [{ taskId: "task", status: "running" }] })
        : json({
            taskId: "task",
            status: "running",
            progress: [],
            nextSince: 3,
          }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await handleMediaMcpTool(
        base,
        "wait_media_task",
        { taskId: "task", since: 3, timeoutMs: 25000 },
        "project",
        headers,
      ),
    ).toMatchObject({ status: "running" });
    expect(
      JSON.parse(
        String(
          (fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body,
        ),
      ),
    ).toEqual({ since: 3, timeoutMs: 25000 });
    await expect(
      handleMediaMcpTool(
        base,
        "wait_media_task",
        { taskId: "task", timeoutMs: 25001 },
        "project",
        headers,
      ),
    ).rejects.toThrow();
  });
  it("does not retry ambiguous generation failures", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("connection lost");
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      handleMediaMcpTool(
        base,
        "generate_image",
        { prompt: "x" },
        "project",
        headers,
      ),
    ).rejects.toThrow("connection lost");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves provider errors rather than inventing successful files", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: "native provider unavailable" }, 503),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      handleMediaMcpTool(
        base,
        "generate_image",
        { prompt: "x" },
        "project",
        headers,
      ),
    ).rejects.toThrow("native provider unavailable");
  });
});
