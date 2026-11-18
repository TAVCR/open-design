import { randomUUID } from "node:crypto";

const project = {
  type: "string",
  description: "Project id or name. Defaults to active project.",
};
const taskId = {
  type: "string",
  minLength: 1,
  description: "Task id returned by image generation or project task history.",
};
const since = {
  type: "integer",
  minimum: 0,
  description: "Progress cursor from nextSince. Preserve it across waits.",
};
export const MEDIA_TOOL_DEFS = [
  {
    name: "generate_image",
    annotations: {
      title: "Generate image",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description:
      "Generate one raster asset using the native Codex subscription. Returns taskId immediately; inspect or wait for it. Outputs a new unique PNG, preserving existing originals. Never retry an ambiguous submission automatically; list tasks first. Use editable composition operations for text/layout changes. Transparency is not guaranteed by this provider interface.",
    inputSchema: {
      type: "object",
      properties: {
        project,
        prompt: {
          type: "string",
          minLength: 1,
          maxLength: 20000,
          description:
            "Requested raster asset contents; keep editable text and layout in the composition.",
        },
        aspect: {
          type: "string",
          maxLength: 40,
          description: "Requested image aspect ratio.",
        },
        quality: {
          type: "string",
          maxLength: 40,
          description:
            "Requested provider quality; native provider capabilities determine support.",
        },
        images: {
          type: "array",
          maxItems: 8,
          description:
            "Existing project-relative reference images to edit or use as visual references.",
          items: {
            type: "string",
            minLength: 1,
            description: "Existing project-relative reference image path.",
          },
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "list_media_tasks",
    annotations: {
      title: "List media tasks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    description:
      "List project media tasks, including persisted terminal tasks. Inspect before repeating a generation whose submission result was lost. File references are confirmed by the daemon.",
    inputSchema: {
      type: "object",
      properties: { project },
      additionalProperties: false,
    },
  },
  {
    name: "get_media_task",
    annotations: {
      title: "Get media task",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    description:
      "Read a project media task and its progress immediately. Restores persisted tasks after daemon restart. A running task is not a failed generation.",
    inputSchema: {
      type: "object",
      properties: { project, taskId, since },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "wait_media_task",
    annotations: {
      title: "Wait for media task",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    description:
      "Wait at most 25 seconds for project media progress. Continue with nextSince while queued/running. A timeout leaves the task pending; never regenerate merely because a wait has no new progress. Terminal states are done, failed, interrupted.",
    inputSchema: {
      type: "object",
      properties: {
        project,
        taskId,
        since,
        timeoutMs: {
          type: "integer",
          minimum: 0,
          maximum: 25000,
          description:
            "Maximum wait duration in milliseconds; a timeout is not a generation failure.",
        },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
];
export const MEDIA_TOOL_NAMES = new Set(
  MEDIA_TOOL_DEFS.map((tool) => tool.name),
);

function boundedInteger(
  value: unknown,
  fallback: number,
  name: string,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new Error(`${name} must be an integer from 0 to ${max}`);
  return value;
}
function text(value: unknown, name: string, max = 20000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(
      `${name} is required and must be at most ${max} characters`,
    );
  return value.trim();
}
function referencePath(value: unknown): string {
  const path = text(value, "reference image path", 1000);
  if (
    path.includes("\\") ||
    path.startsWith("/") ||
    path.includes(":") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    /[\x00-\x1f]/.test(path)
  )
    throw new Error("Reference image must be a safe project-relative path");
  return path;
}
async function request(
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    url,
    body === undefined
      ? { headers }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok)
    throw new Error(
      `Media request failed (${response.status}): ${await response.text()}`,
    );
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Media daemon returned an invalid response");
  return payload as Record<string, unknown>;
}

/** Project identity and workspace authority are resolved by the owning MCP boundary. */
export async function handleMediaMcpTool(
  baseUrl: string,
  name: string,
  args: Record<string, unknown>,
  projectId: string,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const allowed =
    name === "generate_image"
      ? ["project", "prompt", "aspect", "quality", "images"]
      : name === "list_media_tasks"
        ? ["project"]
        : name === "wait_media_task"
          ? ["project", "taskId", "since", "timeoutMs"]
          : ["project", "taskId", "since"];
  for (const key of Object.keys(args))
    if (!allowed.includes(key))
      throw new Error(`Unsupported media argument: ${key}`);
  const projectBase = `${baseUrl}/api/projects/${encodeURIComponent(projectId)}`;
  if (name === "generate_image") {
    const prompt = text(args.prompt, "prompt");
    if (args.model !== undefined || args.output !== undefined)
      throw new Error(
        "Model and output overrides are not supported; native subscription and new originals are required",
      );
    const body: Record<string, unknown> = {
      surface: "image",
      model: "codex-gpt-image-2",
      prompt,
      output: `mcp-image-${randomUUID()}.png`,
    };
    for (const key of ["aspect", "quality"])
      if (args[key] !== undefined) body[key] = text(args[key], key, 40);
    if (args.images !== undefined) {
      if (!Array.isArray(args.images) || args.images.length > 8)
        throw new Error(
          "images must be an array with at most 8 project references",
        );
      body.images = args.images.map(referencePath);
    }
    return await request(`${projectBase}/media/generate`, headers, body);
  }
  if (!MEDIA_TOOL_NAMES.has(name)) throw new Error("Unknown media tool");
  const cursor = boundedInteger(
    args.since,
    0,
    "since",
    Number.MAX_SAFE_INTEGER,
  );
  const timeoutMs =
    name === "wait_media_task"
      ? boundedInteger(args.timeoutMs, 25000, "timeoutMs", 25000)
      : 0;
  const id =
    name === "list_media_tasks" ? null : text(args.taskId, "taskId", 200);
  const listing = await request(
    `${projectBase}/media/tasks?includeDone=true`,
    headers,
  );
  if (name === "list_media_tasks") return listing;
  // Prove project ownership before addressing the globally keyed wait endpoint.
  if (
    !Array.isArray(listing.tasks) ||
    !listing.tasks.some(
      (task) =>
        task &&
        typeof task === "object" &&
        (task as Record<string, unknown>).taskId === id,
    )
  )
    throw new Error("Media task not found in the authorized project");
  // getLiveMediaTask inside the daemon hydrates SQLite state if the in-memory task
  // disappeared, so this also returns complete persisted progress after restart.
  return await request(
    `${baseUrl}/api/media/tasks/${encodeURIComponent(id!)}/wait`,
    headers,
    { since: cursor, timeoutMs },
  );
}
