import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readCompositionMaster,
  writeCompositionMaster,
} from "../../src/composition/storage.js";
import { inspectCompositionAsset } from "../../src/composition/assets.js";
const composition = {
  width: 200,
  height: 100,
  layers: [
    {
      id: "title",
      type: "text",
      role: "text",
      text: "</script><script>alert(1)</script>",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fontSize: 20,
      fontFamily: "Arial",
      fill: "#ffffff",
    },
  ],
};
describe("composition persistence and assets", () => {
  it("single atomic master renders and parses, and rejects stale concurrent revisions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "composition-"));
    const file = join(dir, "composition.html");
    try {
      await writeCompositionMaster(
        file,
        { operation: "create", expectedRevision: null, composition },
        async () => {},
      );
      expect((await readCompositionMaster(file))?.layers[0]?.text).toContain(
        "</script>",
      );
      expect(await readFile(file, "utf8")).not.toContain("<script>alert");
      const edits = await Promise.allSettled([
        writeCompositionMaster(
          file,
          {
            operation: "update",
            expectedRevision: 1,
            layerId: "title",
            patch: { text: "one" },
          },
          async () => {},
        ),
        writeCompositionMaster(
          file,
          {
            operation: "update",
            expectedRevision: 1,
            layerId: "title",
            patch: { text: "two" },
          },
          async () => {},
        ),
      ]);
      expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await readCompositionMaster(file))?.revision).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("does not replace an unrelated existing master", async () => {
    const dir = await mkdtemp(join(tmpdir(), "composition-"));
    const file = join(dir, "composition.html");
    try {
      await writeFile(file, "<h1>user</h1>");
      await expect(
        writeCompositionMaster(
          file,
          { operation: "create", expectedRevision: null, composition },
          async () => {},
        ),
      ).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe("<h1>user</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("decodes actual transparent PNG pixels instead of trusting filename", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAaX2RaAAAAAASUVORK5CYII=",
      "base64",
    );
    expect(await inspectCompositionAsset(png)).toMatchObject({
      format: "PNG",
      width: 1,
      height: 1,
      hasAlphaChannel: true,
      hasTransparentPixels: true,
    });
    const opaque = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(await inspectCompositionAsset(opaque)).toMatchObject({
      hasAlphaChannel: true,
      hasTransparentPixels: false,
    });
    await expect(
      inspectCompositionAsset(Buffer.from("not png")),
    ).rejects.toThrow();
  });
});
