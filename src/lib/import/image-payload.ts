// Validation for images sent to AI recipe extraction (screenshots, photos
// of cookbook pages, handwritten cards). Pure and shared by client and
// server: the client uses the limits to prepare images, the server re-checks
// everything because client input is never trusted.

export const AI_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AiImageMimeType = (typeof AI_IMAGE_MIME_TYPES)[number];

export interface AiImagePayload {
  mimeType: AiImageMimeType;
  base64: string;
}

export const MAX_AI_IMAGES = 5;
// Images are resized in the browser to this longest edge before upload —
// plenty for reading text in a screenshot, small enough to send several.
export const AI_IMAGE_MAX_EDGE = 1600;
// Per-image and total decoded-size caps. The total stays under the ~4.5 MB
// request-body limit of serverless hosting once base64 overhead is added.
export const MAX_AI_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const MAX_AI_IMAGES_TOTAL_BYTES = 3 * 1024 * 1024;

// Decoded byte length of a base64 string without decoding it.
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export function isValidBase64(base64: string): boolean {
  return base64.length > 0 && base64.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64);
}

// Identifies an image from its first bytes (magic numbers), so a file's
// declared type can be checked against its real content.
export function sniffImageMimeType(bytes: Uint8Array): AiImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ImagePayloadCheck = { ok: true } | { ok: false; message: string };

// Server-side gate for a batch of images: count, encoding, size, and that
// each image's bytes really are the declared type. `decodeHead` returns the
// first bytes of a base64 string (injected so this stays environment-free).
export function checkAiImagePayloads(
  images: readonly AiImagePayload[],
  decodeHead: (base64: string) => Uint8Array,
): ImagePayloadCheck {
  if (images.length === 0) return { ok: false, message: "Add at least one image." };
  if (images.length > MAX_AI_IMAGES) {
    return { ok: false, message: `You can add up to ${MAX_AI_IMAGES} images at a time.` };
  }
  let total = 0;
  for (const image of images) {
    if (!(AI_IMAGE_MIME_TYPES as readonly string[]).includes(image.mimeType)) {
      return { ok: false, message: "Please use JPEG, PNG, or WebP images." };
    }
    if (!isValidBase64(image.base64)) {
      return { ok: false, message: "One of the images couldn't be read. Try adding it again." };
    }
    const size = base64ByteLength(image.base64);
    if (size > MAX_AI_IMAGE_BYTES) {
      return { ok: false, message: "One of the images is too large. Try a smaller screenshot." };
    }
    total += size;
    if (sniffImageMimeType(decodeHead(image.base64)) !== image.mimeType) {
      return { ok: false, message: "One of the files isn't a valid image." };
    }
  }
  if (total > MAX_AI_IMAGES_TOTAL_BYTES) {
    return {
      ok: false,
      message: "Those images are too large together. Try fewer or smaller ones.",
    };
  }
  return { ok: true };
}
