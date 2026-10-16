import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOEmbedUrl,
  captionFromOEmbed,
  captionMayHoldRecipe,
  extractFirstUrl,
  parseSocialPostUrl,
} from "./social-link.ts";

describe("parseSocialPostUrl", () => {
  it("normalises X and Twitter post links", () => {
    for (const link of [
      "https://x.com/chef_ana/status/1790000000000000000",
      "https://twitter.com/chef_ana/status/1790000000000000000?s=20",
      "https://mobile.twitter.com/chef_ana/status/1790000000000000000/photo/1",
    ]) {
      assert.deepEqual(parseSocialPostUrl(link), {
        platform: "X",
        url: "https://x.com/chef_ana/status/1790000000000000000",
      });
    }
  });

  it("normalises TikTok video links and keeps short share links", () => {
    assert.deepEqual(
      parseSocialPostUrl(
        "https://www.tiktok.com/@kriziaalexa/video/7496365824303729975?is_from_webapp=1&sender_device=pc",
      ),
      { platform: "TikTok", url: "https://www.tiktok.com/@kriziaalexa/video/7496365824303729975" },
    );
    assert.deepEqual(parseSocialPostUrl("https://vm.tiktok.com/ZMabc123/"), {
      platform: "TikTok",
      url: "https://vm.tiktok.com/ZMabc123/",
    });
  });

  it("rejects profiles, other sites, and lookalike hosts", () => {
    for (const link of [
      "https://x.com/chef_ana",
      "https://www.tiktok.com/@kriziaalexa",
      "https://www.instagram.com/reel/abc/",
      "https://x.com.evil.example/a/status/123456",
      "not a url",
    ]) {
      assert.equal(parseSocialPostUrl(link), null, link);
    }
  });
});

describe("buildOEmbedUrl", () => {
  it("targets each platform's official oEmbed endpoint", () => {
    assert.equal(
      buildOEmbedUrl({ platform: "X", url: "https://x.com/a/status/123456" }),
      "https://publish.twitter.com/oembed?url=https%3A%2F%2Fx.com%2Fa%2Fstatus%2F123456&omit_script=1&dnt=true",
    );
    assert.ok(
      buildOEmbedUrl({
        platform: "TikTok",
        url: "https://www.tiktok.com/@a/video/123456",
      }).startsWith("https://www.tiktok.com/oembed?url="),
    );
  });
});

describe("captionFromOEmbed", () => {
  it("reads an X post from its blockquote html without the attribution line", () => {
    const caption = captionFromOEmbed("X", {
      author_name: "Ana",
      html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Garlic noodles:<br>200 g noodles<br>4 cloves garlic &amp; butter</p>&mdash; Ana (@chef_ana) <a href="https://x.com/chef_ana/status/1">May 1, 2026</a></blockquote>',
    });
    assert.deepEqual(caption, {
      text: "Garlic noodles: 200 g noodles 4 cloves garlic & butter",
      author: "Ana",
      thumbnailUrl: null,
    });
  });

  it("reads a TikTok caption and thumbnail", () => {
    const caption = captionFromOEmbed("TikTok", {
      title: "Easy mochi 🍡 Ingredients: 100g glutinous rice flour...",
      author_name: "kriziaalexa",
      thumbnail_url: "https://p16-sign.tiktokcdn.com/thumb.jpeg",
    });
    assert.equal(caption?.author, "kriziaalexa");
    assert.equal(caption?.thumbnailUrl, "https://p16-sign.tiktokcdn.com/thumb.jpeg");
    assert.ok(caption?.text.startsWith("Easy mochi"));
  });

  it("returns null for empty or malformed responses", () => {
    assert.equal(captionFromOEmbed("X", { html: "" }), null);
    assert.equal(captionFromOEmbed("TikTok", { title: "  " }), null);
    assert.equal(captionFromOEmbed("TikTok", "nope"), null);
  });
});

describe("captionMayHoldRecipe", () => {
  it("rejects captions too short to hold a recipe", () => {
    assert.equal(captionMayHoldRecipe("so good 😋 #food"), false);
    assert.equal(
      captionMayHoldRecipe(
        "Ingredients: 2 eggs, 1 cup milk, 1 cup flour. Whisk, rest 10 min, fry.",
      ),
      true,
    );
  });
});

describe("extractFirstUrl", () => {
  it("finds the link in shared text and trims trailing punctuation", () => {
    assert.equal(
      extractFirstUrl("Check out this recipe! https://vm.tiktok.com/ZMabc123/."),
      "https://vm.tiktok.com/ZMabc123/",
    );
    assert.equal(extractFirstUrl("no link here"), null);
  });
});
