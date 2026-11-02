import { describe, expect, it } from "vitest";
import {
  applyCompositionOperation,
  parseComposition,
  renderCompositionSvg,
} from "../../src/composition/model.js";
const base = () =>
  parseComposition({
    schemaVersion: 1,
    revision: 1,
    width: 800,
    height: 600,
    layers: [
      {
        id: "bg",
        type: "image",
        role: "background",
        path: "base.png",
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      },
      {
        id: "title",
        type: "text",
        role: "text",
        text: "Old",
        fontSize: 30,
        fontFamily: "Arial",
        fill: "#000000",
        x: 20,
        y: 20,
        width: 300,
        height: 50,
      },
    ],
  });
describe("managed composition", () => {
  it("changes only requested text and preserves raster and sibling references", () => {
    const old = base();
    const next = applyCompositionOperation(old, {
      operation: "update",
      expectedRevision: 1,
      layerId: "title",
      patch: { text: "New" },
    });
    expect(next.layers[0]).toEqual(old.layers[0]);
    expect(next.layers[1]).toMatchObject({ text: "New" });
    expect(old.layers[1]).toMatchObject({ text: "Old" });
    expect(next.revision).toBe(2);
  });
  it("rejects stale, identity changes, unknown patches and duplicate IDs", () => {
    expect(() =>
      applyCompositionOperation(base(), {
        operation: "delete",
        expectedRevision: 0,
        layerId: "title",
      }),
    ).toThrow(/revision/i);
    expect(() =>
      applyCompositionOperation(base(), {
        operation: "update",
        expectedRevision: 1,
        layerId: "title",
        patch: { id: "changed" },
      }),
    ).toThrow();
    expect(() =>
      applyCompositionOperation(base(), {
        operation: "update",
        expectedRevision: 1,
        layerId: "title",
        patch: { script: "evil" },
      }),
    ).toThrow();
    expect(() =>
      parseComposition({
        ...base(),
        layers: [base().layers[0], base().layers[0]],
      }),
    ).toThrow();
  });
  it("reorders only by a complete permutation and does not lose layers", () => {
    const next = applyCompositionOperation(base(), {
      operation: "reorder",
      expectedRevision: 1,
      order: ["title", "bg"],
    });
    expect(next.layers.map((l) => l.id)).toEqual(["title", "bg"]);
    expect(() =>
      applyCompositionOperation(base(), {
        operation: "reorder",
        expectedRevision: 1,
        order: ["title"],
      }),
    ).toThrow();
  });
  it("escapes text and rejects external/path traversal image references and unsafe colors", () => {
    const c = base();
    (c.layers[1] as any).text = "<script>alert(1)</script>";
    expect(renderCompositionSvg(c)).toContain("&lt;script&gt;");
    for (const path of [
      "../secret.png",
      "https://evil/image.png",
      "C:/secret.png",
      "a\\b.png",
    ])
      expect(() =>
        parseComposition({
          ...base(),
          layers: [{ ...base().layers[0], path }],
        }),
      ).toThrow();
    expect(() =>
      parseComposition({
        ...base(),
        layers: [{ ...base().layers[1], fill: "url(javascript:evil)" }],
      }),
    ).toThrow();
  });
});

describe("composition insertion and request contracts", () => {
  it("inserts at requested index and rejects invalid indexes", () => {
    const added = {
      id: "overlay",
      type: "shape",
      role: "shape",
      x: 0,
      y: 0,
      width: 30,
      height: 20,
      fill: "#ffffff",
    };
    const next = applyCompositionOperation(base(), {
      operation: "insert",
      expectedRevision: 1,
      layer: added,
      index: 1,
    } as any);
    expect(next.layers.map((l) => l.id)).toEqual(["bg", "overlay", "title"]);
    for (const index of [-1, 3, 0.5, "1"])
      expect(() =>
        applyCompositionOperation(base(), {
          operation: "insert",
          expectedRevision: 1,
          layer: added,
          index,
        } as any),
      ).toThrow();
  });
  it("rejects unknown operation fields and cross-operation inputs", () => {
    expect(() =>
      applyCompositionOperation(base(), {
        operation: "delete",
        expectedRevision: 1,
        layerId: "title",
        eraseAll: true,
      } as any),
    ).toThrow();
    expect(() =>
      applyCompositionOperation(base(), {
        operation: "update",
        expectedRevision: 1,
        layerId: "title",
        patch: { text: "new" },
        composition: {},
      }),
    ).toThrow();
  });
});
