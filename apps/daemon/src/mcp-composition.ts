/** MCP adapter for the daemon-owned managed composition; never edits arbitrary HTML. */
export const COMPOSITION_TOOL_DEF = {
  name: "composition",
  description:
    "Manage an opt-in editable digital composition. Get/create, insert/update/delete/reorder individual layers, or inspect an image asset. Use inputs for operation fields. Every mutation requires expectedRevision (null for create); conflicts require rereading. Text/geometry edits preserve raster resources and never call ImageGen. Existing arbitrary HTML or flattened artwork is not automatically converted. The returned preview is rendered from the same master.",
  annotations: {
    title: "Editable composition",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      project: {
        type: "string",
        description: "Project ID or name; use an explicit project.",
      },
      operation: {
        type: "string",
        description: "Read, inspect or mutate a managed composition.",
        enum: [
          "get",
          "create",
          "insert",
          "update",
          "delete",
          "reorder",
          "inspect_asset",
        ],
      },
      inputs: {
        type: "object",
        description:
          "create: {expectedRevision:null,composition:{width,height,layers}}. Layers: {id,type:image|text|shape,role:background|text|image|shape,x,y,width,height,opacity?,hidden?}; image requires path (project PNG/JPEG); text requires text,fontSize,fontFamily,fill; shape requires fill and optional radius. Colors are hex #RRGGBB or #RRGGBBAA. Layer order is back-to-front. insert: {expectedRevision,layer,index?}. update: {expectedRevision,layerId,patch}. delete: {expectedRevision,layerId}. reorder: {expectedRevision,order:[layerIds]}. inspect_asset: {path}.",
      },
    },
    required: ["project", "operation"],
    additionalProperties: false,
  },
};

export async function handleCompositionMcpTool(
  baseUrl: string,
  args: Record<string, unknown>,
  projectId: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const operation = args.operation;
  const allowed = [
    "get",
    "create",
    "insert",
    "update",
    "delete",
    "reorder",
    "inspect_asset",
  ];
  if (typeof operation !== "string" || !allowed.includes(operation))
    throw new Error("Unknown composition operation");
  const inputs = args.inputs === undefined ? {} : args.inputs;
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs))
    throw new Error("inputs must be an object");
  const fields = inputs as Record<string, unknown>;
  const base = `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/composition`;
  let url = base;
  let init: RequestInit = { headers };
  if (operation === "inspect_asset") {
    if (typeof fields.path !== "string" || !fields.path.trim())
      throw new Error("Image path is required");
    url += `/assets?${new URLSearchParams({ path: fields.path })}`;
  } else if (operation !== "get") {
    if (
      operation === "create"
        ? fields.expectedRevision !== null
        : !Number.isSafeInteger(fields.expectedRevision) ||
          Number(fields.expectedRevision) < 1
    )
      throw new Error(
        "expectedRevision is required; use null for create and the current revision for edits",
      );
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ ...fields, operation }),
    };
  }
  const response = await fetch(url, init);
  if (!response.ok)
    throw new Error(`Composition ${response.status}: ${await response.text()}`);
  return await response.json();
}
