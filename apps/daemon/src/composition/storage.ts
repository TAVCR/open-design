import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import {
  applyCompositionOperation,
  parseComposition,
  renderCompositionSvg,
  type Composition,
  type CompositionOperation,
} from "./model.js";
const marker = '<script type="application/json" id="local-codex-composition">';
const queues = new Map<string, Promise<unknown>>();
export async function readCompositionMaster(
  file: string,
): Promise<Composition | null> {
  let html: string;
  try {
    if ((await stat(file)).size > 8 * 1024 * 1024)
      throw new Error("Composition master byte budget exceeded");
    html = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const start = html.indexOf(marker),
    end = html.indexOf("</script>", start + marker.length);
  if (start < 0 || end < 0)
    throw new Error("Existing composition.html is not a managed composition");
  return parseComposition(JSON.parse(html.slice(start + marker.length, end)));
}
/** A single atomic HTML master contains both the editable scene and its rendered SVG. */
export function compositionMasterHtml(composition: Composition): string {
  const json = JSON.stringify(composition).replace(/</gu, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Local Codex composition</title></head><body style="margin:0">${renderCompositionSvg(composition, (p) => p.split("/").map(encodeURIComponent).join("/"))}${marker}${json}</script></body></html>`;
}
export async function writeCompositionMaster(
  file: string,
  request: CompositionOperation,
  validateAssets: (next: Composition) => Promise<void>,
): Promise<Composition> {
  const previous = queues.get(file) ?? Promise.resolve();
  const work = previous
    .catch(() => {})
    .then(async () => {
      const current = await readCompositionMaster(file);
      const before = await readFile(file).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      const next = applyCompositionOperation(current, request);
      await validateAssets(next);
      const after = await readFile(file).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      const hash = (b: Buffer | null) =>
        b ? createHash("sha256").update(b).digest("hex") : null;
      if (hash(before) !== hash(after))
        throw new Error(
          "Composition revision conflict; master changed during asset validation",
        );
      const tmp = file + "." + randomUUID() + ".tmp";
      try {
        await writeFile(tmp, compositionMasterHtml(next), { flag: "wx" });
        await rename(tmp, file);
      } finally {
        await unlink(tmp).catch(() => {});
      }
      return next;
    });
  queues.set(file, work);
  try {
    return await work;
  } finally {
    if (queues.get(file) === work) queues.delete(file);
  }
}
