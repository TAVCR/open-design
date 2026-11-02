import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  registerCompositionRoutes,
  type RegisterCompositionRoutesDeps,
} from "../../src/routes/composition.js";
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function fixture(imported = false) {
  const root = await mkdtemp(join(tmpdir(), "composition-route-"));
  await mkdir(join(root, "p"));
  const external = join(root, "external");
  await mkdir(external);
  const app = express();
  app.use(express.json());
  let allowed = true;
  registerCompositionRoutes(app, {
    db: {},
    paths: { PROJECTS_DIR: root },
    http: {
      isLocalSameOrigin: () => true,
      resolvedPortRef: { current: 0 },
      sendApiError: (res: any, status: number, code: string, message: string) =>
        res.status(status).json({ code, error: message }),
    },
    projectStore: {
      getProject: (_db: unknown, id: string) =>
        id === "p"
          ? { id, metadata: imported ? { baseDir: external } : {} }
          : null,
    },
    authorizeProjectRequest: async (_req: unknown, res: express.Response) => {
      if (!allowed) res.status(403).json({ error: "denied" });
      return allowed;
    },
  } as unknown as RegisterCompositionRoutesDeps);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("missing address");
  cleanups.push(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  });
  return {
    root,
    external,
    url: `http://127.0.0.1:${addr.port}/api/projects/p/composition`,
    deny: () => {
      allowed = false;
    },
  };
}
describe("composition project routes", () => {
  it("opts in without changing arbitrary projects, preserves image bytes, and returns a real HTML master", async () => {
    const f = await fixture();
    expect(await (await fetch(f.url)).json()).toMatchObject({ managed: false });
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAaX2RaAAAAAASUVORK5CYII=",
      "base64",
    );
    await writeFile(join(f.root, "p", "bg.png"), image);
    const response = await fetch(f.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "create",
        expectedRevision: null,
        composition: {
          width: 200,
          height: 100,
          layers: [
            {
              id: "bg",
              type: "image",
              role: "background",
              path: "bg.png",
              x: 0,
              y: 0,
              width: 200,
              height: 100,
            },
          ],
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      entryFile: "composition.html",
      composition: { revision: 1 },
    });
    expect(
      await readFile(join(f.root, "p", "composition.html"), "utf8"),
    ).toContain('href="bg.png"');
    expect(await readFile(join(f.root, "p", "bg.png"))).toEqual(image);
    expect(
      (await fetch(f.url + "/preview")).headers.get("content-type"),
    ).toContain("image/svg+xml");
    expect(
      await (await fetch(f.url + "/assets?path=bg.png")).json(),
    ).toMatchObject({ hasTransparentPixels: true });
  });
  it("denies read, mutation and inspect without project authority", async () => {
    const f = await fixture();
    f.deny();
    for (const [path, method] of [
      ["", "GET"],
      ["/preview", "GET"],
      ["/assets?path=bg.png", "GET"],
      ["", "POST"],
    ] as const)
      expect(
        (
          await fetch(f.url + path, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(method === "POST" ? { body: "{}" } : {}),
          })
        ).status,
      ).toBe(403);
  });
  it("rejects missing assets without creating the master", async () => {
    const f = await fixture();
    const response = await fetch(f.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "create",
        expectedRevision: null,
        composition: {
          width: 200,
          height: 100,
          layers: [
            {
              id: "bg",
              type: "image",
              role: "background",
              path: "missing.png",
              x: 0,
              y: 0,
              width: 200,
              height: 100,
            },
          ],
        },
      }),
    });
    expect(response.status).toBe(400);
    expect(await (await fetch(f.url)).json()).toMatchObject({ managed: false });
  });
});

describe("imported composition root", () => {
  it("uses the authorized imported baseDir and never the managed-project fallback", async () => {
    const f = await fixture(true);
    const create = await fetch(f.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "create",
        expectedRevision: null,
        composition: { width: 10, height: 10, layers: [] },
      }),
    });
    expect(create.status).toBe(200);
    expect(
      await readFile(join(f.external, "composition.html"), "utf8"),
    ).toContain("local-codex-composition");
    await expect(
      readFile(join(f.root, "p", "composition.html")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    const before = await readFile(join(f.external, "composition.html"), "utf8");
    expect((await fetch(f.url)).status).toBe(200);
    expect(await readFile(join(f.external, "composition.html"), "utf8")).toBe(
      before,
    );
    expect((await fetch(f.url + "/assets?path=../outside.png")).status).toBe(
      400,
    );
  });
});
