import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVideoDisplayName,
  checkVideoUpload,
  detectSocialPlatform,
  isGeminiFileName,
  isVideoOwnedBy,
  MAX_VIDEO_BYTES,
  parseYouTubeUrl,
} from "./video-source.ts";

const ID = "dQw4w9WgXcQ";
const CANONICAL = `https://www.youtube.com/watch?v=${ID}`;

describe("parseYouTubeUrl", () => {
  it("normalises every common YouTube link shape", () => {
    for (const link of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `  https://www.youtube.com/live/${ID}  `,
    ]) {
      assert.equal(parseYouTubeUrl(link), CANONICAL, link);
    }
  });

  it("rejects non-YouTube hosts, lookalikes, and malformed ids", () => {
    for (const link of [
      "https://vimeo.com/123",
      `https://youtube.com.evil.example/watch?v=${ID}`,
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/channel/UC123",
      `javascript:alert('${ID}')`,
      "not a url",
    ]) {
      assert.equal(parseYouTubeUrl(link), null, link);
    }
  });
});

describe("detectSocialPlatform", () => {
  it("recognises social links", () => {
    assert.equal(detectSocialPlatform("https://www.instagram.com/reel/abc/"), "Instagram");
    assert.equal(detectSocialPlatform("https://vm.tiktok.com/xyz/"), "TikTok");
    assert.equal(detectSocialPlatform("https://www.tiktok.com/@chef/video/1"), "TikTok");
    assert.equal(detectSocialPlatform("https://fb.watch/abc"), "Facebook");
    assert.equal(detectSocialPlatform("https://x.com/chef/status/1"), "X");
  });

  it("ignores ordinary sites", () => {
    assert.equal(detectSocialPlatform("https://cookieandkate.com/recipe"), null);
    assert.equal(detectSocialPlatform("https://notinstagram.com/x"), null);
  });
});

describe("checkVideoUpload", () => {
  const ok = { mimeType: "video/mp4", sizeBytes: 10_000_000, durationSeconds: 90 };

  it("accepts a normal recipe clip, including unknown duration", () => {
    assert.deepEqual(checkVideoUpload(ok), { ok: true });
    assert.deepEqual(checkVideoUpload({ ...ok, durationSeconds: null }), { ok: true });
  });

  it("rejects unsupported types, empty or oversized files, and long videos", () => {
    assert.equal(checkVideoUpload({ ...ok, mimeType: "video/x-matroska" }).ok, false);
    assert.equal(checkVideoUpload({ ...ok, sizeBytes: 0 }).ok, false);
    assert.equal(checkVideoUpload({ ...ok, sizeBytes: MAX_VIDEO_BYTES + 1 }).ok, false);
    assert.equal(checkVideoUpload({ ...ok, durationSeconds: 16 * 60 }).ok, false);
  });
});

describe("video ownership tag", () => {
  const user = "4f6c1d2e-0000-4000-8000-000000000001";

  it("round-trips the owner", () => {
    assert.equal(isVideoOwnedBy(buildVideoDisplayName(user, "n1"), user), true);
  });

  it("rejects other users, other formats, and missing names", () => {
    assert.equal(isVideoOwnedBy(buildVideoDisplayName(user, "n1"), "someone-else"), false);
    assert.equal(isVideoOwnedBy(`simmeri-video:${user}:`, user), false);
    assert.equal(isVideoOwnedBy(`other:${user}:n1`, user), false);
    assert.equal(isVideoOwnedBy(undefined, user), false);
  });
});

describe("isGeminiFileName", () => {
  it("accepts file resource names only", () => {
    assert.equal(isGeminiFileName("files/fuc0hf8t7xm8"), true);
    assert.equal(isGeminiFileName("files/../models"), false);
    assert.equal(isGeminiFileName("models/gemini"), false);
    assert.equal(isGeminiFileName("files/abc?key=1"), false);
  });
});
