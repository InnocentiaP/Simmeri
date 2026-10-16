import { prepareImageForUpload } from "@/lib/media/image-compress";
import {
  AI_IMAGE_MAX_EDGE,
  AI_IMAGE_MIME_TYPES,
  MAX_AI_IMAGE_BYTES,
  type AiImagePayload,
} from "./image-payload";

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked so large images don't overflow the call stack.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Browser-only: shrinks a screenshot/photo for AI reading (longest edge
// 1600px, re-encoded as JPEG, which also drops EXIF/location metadata) and
// encodes it for the server. Throws a user-facing Error when the file can't
// be used.
export async function fileToAiImagePayload(file: File): Promise<AiImagePayload> {
  const prepared = await prepareImageForUpload(file, {
    maxLongestEdge: AI_IMAGE_MAX_EDGE,
    quality: 0.8,
  });
  if (!(AI_IMAGE_MIME_TYPES as readonly string[]).includes(prepared.mimeType)) {
    throw new Error("Please use JPEG, PNG, or WebP images.");
  }
  const bytes = new Uint8Array(await prepared.blob.arrayBuffer());
  if (bytes.length > MAX_AI_IMAGE_BYTES) {
    throw new Error(
      `${file.name || "That image"} is too large even after resizing. Try a cropped screenshot.`,
    );
  }
  return {
    mimeType: prepared.mimeType as AiImagePayload["mimeType"],
    base64: bytesToBase64(bytes),
  };
}
