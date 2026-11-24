/** Opt-in digital scene. The JSON master, never a flattened preview, owns editability. */
export interface Layer {
  id: string;
  type: "image" | "text" | "shape";
  role: "background" | "text" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  hidden?: boolean;
  path?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  radius?: number;
}
export interface Composition {
  schemaVersion: 1;
  revision: number;
  width: number;
  height: number;
  layers: Layer[];
}
export interface CompositionOperation {
  operation: string;
  expectedRevision: unknown;
  composition?: unknown;
  layer?: unknown;
  layerId?: unknown;
  patch?: unknown;
  order?: unknown;
  index?: unknown;
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Expected object");
  return v as Record<string, unknown>;
};
function keys(v: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new Error("Unknown field");
}
function number(v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error("Invalid finite measurement");
  return v;
}
function text(v: unknown, max: number): string {
  if (typeof v !== "string" || v.length > max)
    throw new Error("Invalid string");
  return v;
}
export function compositionAssetPath(v: unknown): string {
  const s = text(v, 500);
  if (
    !s ||
    s.includes("\\") ||
    s.includes(":") ||
    s.startsWith("/") ||
    s.split("/").some((p) => !p || p === "." || p === "..") ||
    /[\x00-\x1f?#]/u.test(s) ||
    !/\.(png|jpe?g)$/iu.test(s)
  )
    throw new Error("Image must reference a PNG/JPEG inside this project");
  return s;
}
function layer(v: unknown): Layer {
  const o = object(v);
  keys(o, [
    "id",
    "type",
    "role",
    "x",
    "y",
    "width",
    "height",
    "opacity",
    "hidden",
    "path",
    "text",
    "fontSize",
    "fontFamily",
    "fill",
    "radius",
  ]);
  if (!/^[a-zA-Z0-9_-]{1,100}$/u.test(text(o.id, 100)))
    throw new Error("Invalid layer id");
  if (
    !["image", "text", "shape"].includes(String(o.type)) ||
    !["background", "text", "image", "shape"].includes(String(o.role))
  )
    throw new Error("Invalid layer type/role");
  if (o.role !== "background" && o.role !== o.type)
    throw new Error("Layer role does not match type");
  for (const key of ["x", "y"]) number(o[key], -100000, 100000);
  for (const key of ["width", "height"]) number(o[key], 0.001, 100000);
  if (o.opacity !== undefined) number(o.opacity, 0, 1);
  if (o.hidden !== undefined && typeof o.hidden !== "boolean")
    throw new Error("Invalid hidden flag");
  if (o.type === "image") {
    compositionAssetPath(o.path);
    if (
      ["text", "fontSize", "fontFamily", "fill", "radius"].some(
        (k) => o[k] !== undefined,
      )
    )
      throw new Error("Unexpected image field");
  } else {
    if (o.path !== undefined) throw new Error("Unexpected image path");
    if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(text(o.fill, 9)))
      throw new Error("Expected hex color");
    if (o.type === "text") {
      text(o.text, 100000);
      number(o.fontSize, 0.1, 10000);
      text(o.fontFamily, 200);
      if (o.radius !== undefined) throw new Error("Unexpected text field");
    } else {
      if (["text", "fontSize", "fontFamily"].some((k) => o[k] !== undefined))
        throw new Error("Unexpected shape field");
      if (o.radius !== undefined) number(o.radius, 0, 100000);
    }
  }
  return structuredClone(o) as unknown as Layer;
}
export function parseComposition(v: unknown): Composition {
  const o = object(v);
  keys(o, ["schemaVersion", "revision", "width", "height", "layers"]);
  if (
    o.schemaVersion !== 1 ||
    !Number.isSafeInteger(o.revision) ||
    Number(o.revision) < 1
  )
    throw new Error("Invalid composition version/revision");
  number(o.width, 1, 100000);
  number(o.height, 1, 100000);
  if (!Array.isArray(o.layers) || o.layers.length > 1000)
    throw new Error("Invalid layer budget");
  const layers = o.layers.map(layer);
  if (new Set(layers.map((l) => l.id)).size !== layers.length)
    throw new Error("Duplicate layer id");
  if (JSON.stringify({ ...o, layers }).length > 2 * 1024 * 1024)
    throw new Error("Composition text budget exceeded");
  return { ...o, layers } as unknown as Composition;
}
export function applyCompositionOperation(
  current: Composition | null,
  request: CompositionOperation,
): Composition {
  const allowed: Record<string, string[]> = {
    create: ["composition"],
    insert: ["layer", "index"],
    update: ["layerId", "patch"],
    delete: ["layerId"],
    reorder: ["order"],
  };
  const fields = allowed[request.operation];
  if (!fields) throw new Error("Unknown composition operation");
  keys(object(request), ["operation", "expectedRevision", ...fields]);
  if ((current?.revision ?? null) !== request.expectedRevision)
    throw new Error("Composition revision conflict; reopen before saving");
  if (request.operation === "create") {
    if (current) throw new Error("Composition already exists");
    const c = object(request.composition);
    return parseComposition({ ...c, schemaVersion: 1, revision: 1 });
  }
  if (!current) throw new Error("Project has no managed composition");
  const next = structuredClone(current);
  const at = next.layers.findIndex((l) => l.id === request.layerId);
  switch (request.operation) {
    case "insert":
      {
        const index = request.index ?? next.layers.length;
        if (
          typeof index !== "number" ||
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index > next.layers.length
        )
          throw new Error("Invalid insertion index");
        next.layers.splice(index, 0, layer(request.layer));
      }
      break;
    case "update":
      if (at < 0) throw new Error("Layer not found");
      {
        const patch = object(request.patch);
        if (["id", "type", "role"].some((k) => k in patch))
          throw new Error("Cannot change layer identity/type/role");
        next.layers[at] = layer({ ...next.layers[at], ...patch });
      }
      break;
    case "delete":
      if (at < 0) throw new Error("Layer not found");
      next.layers.splice(at, 1);
      break;
    case "reorder": {
      const order = request.order;
      if (
        !Array.isArray(order) ||
        order.length !== next.layers.length ||
        new Set(order).size !== order.length ||
        order.some((id) => !next.layers.some((l) => l.id === id))
      )
        throw new Error("Order must be a full permutation");
      next.layers = order.map((id) => next.layers.find((l) => l.id === id)!);
      break;
    }
    default:
      throw new Error("Unknown composition operation");
  }
  next.revision++;
  return parseComposition(next);
}
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/gu,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderCompositionSvg(
  input: Composition,
  assetUrl: (path: string) => string = (p) => p,
): string {
  const c = parseComposition(input);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}">${c.layers
    .filter((l) => !l.hidden)
    .map((l) => {
      const common = `data-layer-id="${l.id}" opacity="${l.opacity ?? 1}"`;
      if (l.type === "image")
        return `<image ${common} x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" href="${escape(assetUrl(l.path!))}" preserveAspectRatio="xMidYMid slice"/>`;
      if (l.type === "shape")
        return `<rect ${common} x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" rx="${l.radius ?? 0}" fill="${l.fill}"/>`;
      return `<text ${common} x="${l.x}" y="${l.y + l.fontSize!}" font-size="${l.fontSize}" font-family="${escape(l.fontFamily)}" fill="${l.fill}" xml:space="preserve">${escape(l.text)}</text>`;
    })
    .join("")}</svg>`;
}
