import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { PNG } from "pdf-lib/cjs/utils/png.js";
/** Decode bounded raster input; a declared alpha channel is not evidence of transparency. */
export async function inspectCompositionAsset(
  bytes: Uint8Array,
): Promise<{
  format: "PNG" | "JPEG";
  width: number;
  height: number;
  sha256: string;
  bytes: number;
  hasAlphaChannel: boolean;
  hasTransparentPixels: boolean;
}> {
  if (bytes.length < 8 || bytes.length > 32 * 1024 * 1024)
    throw new Error("Raster must be 8 bytes–32 MiB");
  const b = Buffer.from(bytes);
  let width: number,
    height: number,
    hasAlphaChannel = false,
    hasTransparentPixels = false,
    format: "PNG" | "JPEG";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (b.length < 33) throw new Error("Truncated PNG");
    const w = b.readUInt32BE(16),
      h = b.readUInt32BE(20);
    if (w < 1 || h < 1 || w * h > 16_777_216)
      throw new Error("PNG pixel budget exceeded");
    const png = PNG.load(bytes);
    format = "PNG";
    width = png.width;
    height = png.height;
    hasAlphaChannel =
      png.type === "GreyscaleWithAlpha" || png.type === "TruecolourWithAlpha";
    hasTransparentPixels = png.alphaChannel?.some((a) => a < 255) ?? false;
  } else {
    if (b[0] !== 255 || b[1] !== 216)
      throw new Error("Only PNG and JPEG are supported");
    const doc = await PDFDocument.create();
    const img = await doc.embedJpg(bytes);
    format = "JPEG";
    width = img.width;
    height = img.height;
    if (width * height > 16_777_216)
      throw new Error("JPEG pixel budget exceeded");
  }
  return {
    format,
    width,
    height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    hasAlphaChannel,
    hasTransparentPixels,
  };
}
