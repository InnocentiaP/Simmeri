import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  base64ByteLength,
  checkAiImagePayloads,
  isValidBase64,
  MAX_AI_IMAGES,
  sniffImageMimeType,
  type AiImagePayload,
} from "./image-payload.ts";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const GIF = Uint8Array.from([...Buffer.from("GIF89a"), 0, 0, 0, 0, 0, 0]);

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const decodeHead = (base64: string) => new Uint8Array(Buffer.from(base64.slice(0, 64), "base64"));

describe("sniffImageMimeType", () => {
  it("recognises JPEG, PNG, and WebP from their magic bytes", () => {
    assert.equal(sniffImageMimeType(JPEG), "image/jpeg");
    assert.equal(sniffImageMimeType(PNG), "image/png");
    assert.equal(sniffImageMimeType(WEBP), "image/webp");
  });

  it("rejects other formats and truncated input", () => {
    assert.equal(sniffImageMimeType(GIF), null);
    assert.equal(sniffImageMimeType(Uint8Array.from([0xff, 0xd8])), null);
  });
});

describe("base64 helpers", () => {
  it("computes decoded length including padding", () => {
    assert.equal(base64ByteLength(b64(Uint8Array.from([1]))), 1);
    assert.equal(base64ByteLength(b64(Uint8Array.from([1, 2]))), 2);
    assert.equal(base64ByteLength(b64(Uint8Array.from([1, 2, 3]))), 3);
  });

  it("validates base64 shape", () => {
    assert.equal(isValidBase64(b64(JPEG)), true);
    assert.equal(isValidBase64("not base64!"), false);
    assert.equal(isValidBase64(""), false);
  });
});

describe("checkAiImagePayloads", () => {
  const ok: AiImagePayload = { mimeType: "image/jpeg", base64: b64(JPEG) };

  it("accepts a valid batch", () => {
    assert.deepEqual(
      checkAiImagePayloads([ok, { mimeType: "image/png", base64: b64(PNG) }], decodeHead),
      { ok: true },
    );
  });

  it("rejects an empty batch and too many images", () => {
    assert.equal(checkAiImagePayloads([], decodeHead).ok, false);
    assert.equal(checkAiImagePayloads(Array(MAX_AI_IMAGES + 1).fill(ok), decodeHead).ok, false);
  });

  it("rejects content that doesn't match the declared type", () => {
    const disguised = { mimeType: "image/png", base64: b64(GIF) } as AiImagePayload;
    assert.equal(checkAiImagePayloads([disguised], decodeHead).ok, false);
    const mislabeled = { mimeType: "image/png", base64: b64(JPEG) } as AiImagePayload;
    assert.equal(checkAiImagePayloads([mislabeled], decodeHead).ok, false);
  });

  it("rejects unsupported declared types and broken base64", () => {
    assert.equal(
      checkAiImagePayloads(
        [{ mimeType: "image/gif", base64: b64(GIF) } as unknown as AiImagePayload],
        decodeHead,
      ).ok,
      false,
    );
    assert.equal(
      checkAiImagePayloads([{ mimeType: "image/jpeg", base64: "@@@" }], decodeHead).ok,
      false,
    );
  });

  it("enforces per-image and total size caps", () => {
    const big = new Uint8Array(1.6 * 1024 * 1024);
    big.set(JPEG);
    assert.equal(
      checkAiImagePayloads([{ mimeType: "image/jpeg", base64: b64(big) }], decodeHead).ok,
      false,
    );

    const medium = new Uint8Array(1.2 * 1024 * 1024);
    medium.set(JPEG);
    const m = { mimeType: "image/jpeg" as const, base64: b64(medium) };
    assert.equal(checkAiImagePayloads([m, m], decodeHead).ok, true);
    assert.equal(checkAiImagePayloads([m, m, m], decodeHead).ok, false);
  });
});
