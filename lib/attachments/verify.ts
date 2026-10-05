import "server-only";
import sharp from "sharp";
import { SLIDE_LONG_EDGE, SNIFF_BYTES, sniffAcceptedMime, type SlideMime } from "./limits";

/**
 * Pixel cap for decoding a stored slide: SLIDE_LONG_EDGE on both edges, plus
 * the 1 px of rounding slack the size check allows.
 */
export const MAX_SLIDE_PIXELS = (SLIDE_LONG_EDGE + 1) * (SLIDE_LONG_EDGE + 1);

export type SlideDeclaration = { mime: SlideMime; w: number; h: number };

/**
 * Is `input` really a slide of the declared format and size?
 *
 * The bucket pins an upload's Content-Type LABEL, never its bytes, and a
 * presigned POST stays usable for a while after finalize. So whatever sits
 * under a slide key is checked again before anything decodes its pixels:
 *  1. magic bytes first, in plain JS, so libvips never picks another loader
 *     (sharp sniffs the real format and would happily render an SVG, whose
 *     filter chains can take seconds while staying under any pixel cap);
 *  2. then the header (cheap, no pixel decode) must agree on format and on
 *     the declared width/height (±1 px).
 */
export async function isDeclaredSlide(input: Uint8Array, declared: SlideDeclaration): Promise<boolean> {
  if (sniffAcceptedMime(input.subarray(0, SNIFF_BYTES)) !== declared.mime) return false;
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_SLIDE_PIXELS }).metadata();
  } catch {
    return false;
  }
  const format = declared.mime === "image/jpeg" ? "jpeg" : "webp";
  return (
    meta.format === format &&
    Math.abs((meta.width ?? 0) - declared.w) <= 1 &&
    Math.abs((meta.height ?? 0) - declared.h) <= 1
  );
}
