export const MAX_LONGEST_EDGE = 2000;
export const MAX_RAW_BYTES = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export interface Dimensions {
  width: number;
  height: number;
}

// Pure — computes output dimensions that keep the longest edge at or under
// maxLongestEdge while preserving aspect ratio. Never upscales an image
// that's already within the limit. Safe to unit test without any browser API.
export function computeResizedDimensions(
  input: Dimensions,
  maxLongestEdge: number = MAX_LONGEST_EDGE,
): Dimensions {
  const { width, height } = input;
  if (width <= 0 || height <= 0) return { width, height };

  const longest = Math.max(width, height);
  if (longest <= maxLongestEdge) return { width, height };

  const scale = maxLongestEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isAcceptedMimeType(mimeType: string): mimeType is AcceptedMimeType {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isWithinRawSizeLimit(byteSize: number, maxBytes: number = MAX_RAW_BYTES): boolean {
  return byteSize <= maxBytes;
}

export class ImagePrepError extends Error {
  code: "unsupported_type" | "too_large";
  constructor(code: "unsupported_type" | "too_large", message: string) {
    super(message);
    this.code = code;
  }
}

export interface PreparedImage {
  blob: Blob;
  mimeType: string;
}

// Browser-only (Canvas/createImageBitmap): validates the file, then resizes
// and re-encodes it via Canvas. Falls back to uploading the original file if
// Canvas encoding fails for any reason, but the MIME/size checks above are
// enforced first and always apply — the fallback never bypasses them.
// Never produces or stores base64 image data; the result is always a Blob
// destined for Storage, not Postgres.
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!isAcceptedMimeType(file.type)) {
    throw new ImagePrepError("unsupported_type", "Please choose a JPEG, PNG, or WebP image.");
  }
  if (!isWithinRawSizeLimit(file.size)) {
    throw new ImagePrepError("too_large", "That image is larger than 8 MB. Please choose a smaller file.");
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = computeResizedDimensions({
        width: bitmap.width,
        height: bitmap.height,
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
      );
      if (!blob) throw new Error("Canvas encoding failed");

      return { blob, mimeType: "image/jpeg" };
    } finally {
      bitmap.close();
    }
  } catch {
    return {
      blob: file,
      mimeType: file.type,
    };
  }
}
