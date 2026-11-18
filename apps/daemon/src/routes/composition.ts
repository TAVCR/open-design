import type { Express, Request, Response } from "express";
import { readFile } from "node:fs/promises";
import type { RouteDeps } from "../server-context.js";
import type { AuthorizeProjectRequest } from "../collab/project-request-authority.js";
import {
  resolveProjectFilePath,
  resolveProjectWritePath,
} from "../projects.js";
import {
  compositionAssetPath,
  renderCompositionSvg,
  type CompositionOperation,
} from "../composition/model.js";
import {
  readCompositionMaster,
  writeCompositionMaster,
} from "../composition/storage.js";
import { inspectCompositionAsset } from "../composition/assets.js";
export interface RegisterCompositionRoutesDeps extends RouteDeps<
  "db" | "http" | "paths" | "projectStore"
> {
  authorizeProjectRequest: AuthorizeProjectRequest;
}
export function registerCompositionRoutes(
  app: Express,
  ctx: RegisterCompositionRoutesDeps,
): void {
  const base = "/api/projects/:id/composition";
  async function gate(req: Request, res: Response, write = false) {
    if (!ctx.http.isLocalSameOrigin(req, ctx.http.resolvedPortRef.current)) {
      ctx.http.sendApiError(
        res,
        403,
        "FORBIDDEN",
        "Cross-origin request rejected",
      );
      return null;
    }
    const id = String(req.params.id);
    const project = ctx.projectStore.getProject(ctx.db, id);
    if (!project || project.metadata?.teamMirrorRevokedAt) {
      ctx.http.sendApiError(res, 404, "PROJECT_NOT_FOUND", "project not found");
      return null;
    }
    if (
      !(await ctx.authorizeProjectRequest(
        req,
        res,
        id,
        write
          ? { mode: "write", capability: "writeFiles" }
          : { mode: "read", allowNavigationQuery: true },
      ))
    )
      return null;
    return { id, project };
  }
  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Composition operation failed";
        ctx.http.sendApiError(
          res,
          /revision conflict/i.test(message) ? 409 : 400,
          "COMPOSITION_ERROR",
          message,
        );
      }
    };
  const result = (id: string, composition: unknown) => ({
    managed: composition !== null,
    composition,
    entryFile: composition ? "composition.html" : null,
    previewUrl: composition
      ? `/api/projects/${encodeURIComponent(id)}/raw/composition.html`
      : null,
  });
  app.get(
    base,
    wrap(async (req, res) => {
      const g = await gate(req, res);
      if (!g) return;
      const file = await resolveProjectWritePath(
        ctx.paths.PROJECTS_DIR,
        g.id,
        "composition.html",
        g.project.metadata,
      );
      res.json(result(g.id, await readCompositionMaster(file)));
    }),
  );
  app.post(
    base,
    wrap(async (req, res) => {
      const g = await gate(req, res, true);
      if (!g) return;
      const file = await resolveProjectWritePath(
        ctx.paths.PROJECTS_DIR,
        g.id,
        "composition.html",
        g.project.metadata,
      );
      const composition = await writeCompositionMaster(
        file,
        req.body as CompositionOperation,
        async (next) => {
          for (const path of new Set(
            next.layers.filter((l) => l.type === "image").map((l) => l.path!),
          )) {
            const asset = await resolveProjectFilePath(
              ctx.paths.PROJECTS_DIR,
              g.id,
              path,
              g.project.metadata,
            );
            if (asset.size > 32 * 1024 * 1024)
              throw new Error("Image byte budget exceeded");
            await inspectCompositionAsset(await readFile(asset.filePath));
          }
        },
      );
      res.json(result(g.id, composition));
    }),
  );
  app.get(
    base + "/assets",
    wrap(async (req, res) => {
      const g = await gate(req, res);
      if (!g) return;
      const path = compositionAssetPath(req.query.path);
      const asset = await resolveProjectFilePath(
        ctx.paths.PROJECTS_DIR,
        g.id,
        path,
        g.project.metadata,
      );
      if (asset.size > 32 * 1024 * 1024)
        throw new Error("Image byte budget exceeded");
      res.json({
        path,
        ...(await inspectCompositionAsset(await readFile(asset.filePath))),
      });
    }),
  );
  app.get(
    base + "/preview",
    wrap(async (req, res) => {
      const g = await gate(req, res);
      if (!g) return;
      const file = await resolveProjectWritePath(
        ctx.paths.PROJECTS_DIR,
        g.id,
        "composition.html",
        g.project.metadata,
      );
      const composition = await readCompositionMaster(file);
      if (!composition) {
        ctx.http.sendApiError(
          res,
          404,
          "COMPOSITION_NOT_FOUND",
          "Project has no managed composition",
        );
        return;
      }
      res
        .type("image/svg+xml")
        .send(
          renderCompositionSvg(
            composition,
            (p) =>
              `/api/projects/${encodeURIComponent(g.id)}/raw/${p.split("/").map(encodeURIComponent).join("/")}`,
          ),
        );
    }),
  );
}
