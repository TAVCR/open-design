import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMcpToolCall, TOOL_DEFS } from "../src/mcp.js";
import { _resetMcpWorkspaceContextCacheForTests } from "../src/mcp-workspace-context.js";

afterEach(() => {
  vi.unstubAllGlobals();
  _resetMcpWorkspaceContextCacheForTests();
});
function fixture() {
  const requests: { url: string; init?: RequestInit | undefined }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/api/workspace/directory"))
        return Response.json({ items: [], activeWorkspaceId: null });
      if (String(url).endsWith("/api/projects"))
        return Response.json({
          projects: [{ id: "project-layer-test", name: "Layers" }],
        });
      return Response.json({ revision: 2, layers: [] });
    }),
  );
  return requests;
}
describe("managed composition MCP", () => {
  it("advertises composition and explicit media lifecycle tools", () => {
    const names = TOOL_DEFS.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "composition",
        "generate_image",
        "list_media_tasks",
        "get_media_task",
        "wait_media_task",
      ]),
    );
  });
  it("resolves the project and reads the actual composition", async () => {
    const requests = fixture();
    const result = await handleMcpToolCall(
      "http://127.0.0.1:19341",
      "composition",
      { project: "Layers", operation: "get" },
    );
    expect(result.isError).not.toBe(true);
    expect(requests.at(-1)?.url).toBe(
      "http://127.0.0.1:19341/api/projects/project-layer-test/composition",
    );
  });
  it("posts a bounded partial mutation instead of writing arbitrary project files", async () => {
    const requests = fixture();
    const inputs = {
      expectedRevision: 1,
      layerId: "title",
      patch: { text: "Nuevo título" },
    };
    const result = await handleMcpToolCall(
      "http://127.0.0.1:19342",
      "composition",
      { project: "Layers", operation: "update", inputs },
    );
    expect(result.isError).not.toBe(true);
    const last = requests.at(-1)!;
    expect(last.init?.method).toBe("POST");
    expect(JSON.parse(String(last.init?.body))).toEqual({
      ...inputs,
      operation: "update",
    });
  });
  it("rejects absent revisions without sending a mutation", async () => {
    const requests = fixture();
    const result = await handleMcpToolCall(
      "http://127.0.0.1:19343",
      "composition",
      { project: "Layers", operation: "delete", inputs: { layerId: "title" } },
    );
    expect(result.isError).toBe(true);
    expect(requests.some((r) => r.init?.method === "POST")).toBe(false);
  });
  it("rejects unsupported operations without contacting a mutation endpoint", async () => {
    const requests = fixture();
    const result = await handleMcpToolCall(
      "http://127.0.0.1:19344",
      "composition",
      { project: "Layers", operation: "replace_everything", inputs: {} },
    );
    expect(result.isError).toBe(true);
    expect(requests.some((r) => r.init?.method === "POST")).toBe(false);
  });
  it("encodes image inspection paths as query parameters", async () => {
    const requests = fixture();
    const result = await handleMcpToolCall(
      "http://127.0.0.1:19345",
      "composition",
      {
        project: "Layers",
        operation: "inspect_asset",
        inputs: { path: "assets/cover & photo.png" },
      },
    );
    expect(result.isError).not.toBe(true);
    expect(new URL(requests.at(-1)!.url).searchParams.get("path")).toBe(
      "assets/cover & photo.png",
    );
  });
});
