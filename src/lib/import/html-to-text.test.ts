import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripHtmlToReadableText } from "./html-to-text.ts";

describe("stripHtmlToReadableText", () => {
  it("strips script blocks entirely", () => {
    const html = "<p>Hello</p><script>alert('x')</script><p>World</p>";
    const result = stripHtmlToReadableText(html, 1000);
    assert.equal(result.text.includes("alert"), false);
    assert.equal(result.text, "Hello World");
  });

  it("strips style blocks entirely", () => {
    const html = "<style>.a{color:red}</style><p>Content</p>";
    const result = stripHtmlToReadableText(html, 1000);
    assert.equal(result.text, "Content");
  });

  it("strips nav, header, and footer blocks entirely", () => {
    const html =
      "<header>Site Header</header><nav>Home | About</nav><main>Real recipe content</main><footer>Copyright 2026</footer>";
    const result = stripHtmlToReadableText(html, 1000);
    assert.equal(result.text, "Real recipe content");
  });

  it("strips remaining tags and collapses whitespace", () => {
    const html = "<div>\n  <p>Line one</p>\n  <p>Line   two</p>\n</div>";
    const result = stripHtmlToReadableText(html, 1000);
    assert.equal(result.text, "Line one Line two");
  });

  it("decodes common HTML entities", () => {
    const html = "<p>Salt &amp; Pepper &mdash; 1&nbsp;cup</p>".replace("&mdash;", "-");
    const result = stripHtmlToReadableText(html, 1000);
    assert.equal(result.text, "Salt & Pepper - 1 cup");
  });

  it("reports truncated:false when under the character cap", () => {
    const result = stripHtmlToReadableText("<p>short</p>", 1000);
    assert.equal(result.truncated, false);
    assert.equal(result.text, "short");
  });

  it("truncates at maxChars and reports truncated:true", () => {
    const longText = "word ".repeat(500);
    const result = stripHtmlToReadableText(`<p>${longText}</p>`, 100);
    assert.equal(result.truncated, true);
    assert.equal(result.text.length, 100);
  });
});
