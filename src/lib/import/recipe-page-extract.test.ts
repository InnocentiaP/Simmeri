import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAiInputFromHtml,
  extractMicrodataDraft,
  extractRecipeFromHtml,
  findRecipeTextStart,
  readMetaContent,
} from "./recipe-page-extract.ts";
import { decodeHtmlEntities } from "./html-to-text.ts";

const PAGE_URL = "https://blog.example.com/recipes/nasi-goreng/";

function page(head: string, body: string): string {
  return `<!doctype html><html><head><title>Fallback title</title>${head}</head><body>${body}</body></html>`;
}

function jsonLd(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

describe("decodeHtmlEntities", () => {
  it("decodes numeric, hex, and common named entities", () => {
    assert.equal(
      decodeHtmlEntities("Mom&#8217;s &frac12; cup &amp; 180&deg;C &#x2014; done"),
      "Mom’s ½ cup & 180°C — done",
    );
  });

  it("leaves unknown entities untouched", () => {
    assert.equal(decodeHtmlEntities("&notreal; &#0;"), "&notreal; &#0;");
  });
});

describe("readMetaContent", () => {
  it("reads meta tags regardless of attribute order", () => {
    const html = `<meta content="https://cdn.example.com/a.jpg" property="og:image"><meta name="description" content="x">`;
    assert.equal(readMetaContent(html, "og:image"), "https://cdn.example.com/a.jpg");
  });
});

describe("extractRecipeFromHtml — JSON-LD", () => {
  const html = page(
    jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Nasi goreng" },
        {
          "@type": ["Recipe"],
          name: "Mom&#8217;s Nasi Goreng",
          description: "<p>Quick &amp; cozy.</p>",
          recipeYield: ["4", "4 servings"],
          prepTime: "PT10M",
          cookTime: "PT15M",
          image: [{ "@type": "ImageObject", url: "/wp-content/uploads/nasi.jpg" }],
          recipeIngredient: ["2 cups cooked rice", "3 cloves garlic, minced", "  "],
          recipeInstructions: [
            {
              "@type": "HowToSection",
              name: "Cook",
              itemListElement: [
                { "@type": "HowToStep", text: "Heat the oil &amp; fry the garlic." },
                { "@type": "HowToStep", name: "Add the rice." },
              ],
            },
          ],
        },
      ],
    }),
    "<p>Story…</p>",
  );

  const result = extractRecipeFromHtml(html, PAGE_URL);

  it("finds the Recipe node inside @graph and cleans every string", () => {
    assert.equal(result.method, "json_ld");
    assert.equal(result.complete, true);
    assert.equal(result.draft.title, "Mom’s Nasi Goreng");
    assert.equal(result.draft.description, "Quick & cozy.");
    assert.equal(result.draft.servings, 4);
    assert.equal(result.draft.prep_time_minutes, 10);
    assert.equal(result.draft.cook_time_minutes, 15);
  });

  it("drops blank ingredients and flattens sections, using name when a step has no text", () => {
    assert.equal(result.draft.ingredients.length, 2);
    assert.deepEqual(
      result.draft.steps.map((s) => s.instruction),
      ["Heat the oil & fry the garlic.", "Add the rice."],
    );
  });

  it("resolves a relative ImageObject url against the page", () => {
    assert.equal(result.imageUrl, "https://blog.example.com/wp-content/uploads/nasi.jpg");
  });

  it("splits a single HTML instruction block into steps", () => {
    const r = extractRecipeFromHtml(
      page(
        jsonLd({
          "@type": "Recipe",
          name: "Tea",
          recipeIngredient: ["1 tea bag"],
          recipeInstructions: "<ol><li>Boil water.</li><li>Steep 3 minutes.</li></ol>",
        }),
        "",
      ),
      PAGE_URL,
    );
    assert.deepEqual(
      r.draft.steps.map((s) => s.instruction),
      ["Boil water.", "Steep 3 minutes."],
    );
  });

  it("borrows missing steps from microdata on the same page", () => {
    const r = extractRecipeFromHtml(
      page(
        jsonLd({ "@type": "Recipe", name: "Soup", recipeIngredient: ["1 l stock"] }),
        `<div itemscope itemtype="https://schema.org/Recipe"><ol itemprop="recipeInstructions"><li>Simmer.</li><li>Serve.</li></ol></div>`,
      ),
      PAGE_URL,
    );
    assert.equal(r.complete, true);
    assert.deepEqual(
      r.draft.steps.map((s) => s.instruction),
      ["Simmer.", "Serve."],
    );
  });

  it("reports an incomplete structured recipe and keeps the node as an AI hint", () => {
    const r = extractRecipeFromHtml(
      page(jsonLd({ "@type": "Recipe", name: "Mystery" }), ""),
      PAGE_URL,
    );
    assert.equal(r.method, "json_ld");
    assert.equal(r.complete, false);
    assert.ok(r.recipeNode);
  });
});

describe("extractRecipeFromHtml — image choice", () => {
  it("prefers the widest image over a leading thumbnail", () => {
    const r = extractRecipeFromHtml(
      page(
        jsonLd({
          "@type": "Recipe",
          name: "Guac",
          image: [
            "https://cdn.example.com/guac-225x225.jpg",
            "https://cdn.example.com/guac-1200x800.jpg",
            "https://cdn.example.com/guac-500x500.jpg",
          ],
        }),
        "",
      ),
      PAGE_URL,
    );
    assert.equal(r.imageUrl, "https://cdn.example.com/guac-1200x800.jpg");
  });

  it("uses a declared ImageObject width", () => {
    const r = extractRecipeFromHtml(
      page(
        jsonLd({
          "@type": "Recipe",
          name: "Guac",
          image: [
            { "@type": "ImageObject", url: "https://cdn.example.com/a.jpg", width: 300 },
            { "@type": "ImageObject", url: "https://cdn.example.com/b.jpg", width: "1600" },
          ],
        }),
        "",
      ),
      PAGE_URL,
    );
    assert.equal(r.imageUrl, "https://cdn.example.com/b.jpg");
  });
});

describe("extractRecipeFromHtml — microdata and fallbacks", () => {
  it("reads a microdata-only recipe", () => {
    const html = page(
      `<meta property="og:image" content="https://cdn.example.com/pie.jpg">`,
      `<div itemscope itemtype="http://schema.org/Recipe">
         <h1 itemprop="name">Apple &amp; Pear Pie</h1>
         <meta itemprop="recipeYield" content="8 slices">
         <ul><li itemprop="recipeIngredient">2 apples</li><li itemprop="ingredients">1 pear</li></ul>
         <div itemprop="recipeInstructions"><p>Slice the fruit.</p><p>Bake 40 minutes.</p></div>
       </div>`,
    );
    const r = extractRecipeFromHtml(html, PAGE_URL);
    assert.equal(r.method, "microdata");
    assert.equal(r.complete, true);
    assert.equal(r.draft.title, "Apple & Pear Pie");
    assert.equal(r.draft.servings, 8);
    assert.equal(r.draft.ingredients.length, 2);
    assert.deepEqual(
      r.draft.steps.map((s) => s.instruction),
      ["Slice the fruit.", "Bake 40 minutes."],
    );
    assert.equal(r.imageUrl, "https://cdn.example.com/pie.jpg");
  });

  it("ignores itemprop markup without a Recipe itemtype", () => {
    assert.equal(extractMicrodataDraft(`<span itemprop="ingredients">salt</span>`), null);
  });

  it("returns method none with the page title and og:image when nothing is structured", () => {
    const r = extractRecipeFromHtml(
      page(
        `<meta property="og:title" content="Grandma's Soup"><meta property="og:image" content="/soup.png">`,
        "<p>Hi</p>",
      ),
      PAGE_URL,
    );
    assert.equal(r.method, "none");
    assert.equal(r.complete, false);
    assert.equal(r.draft.title, "Grandma's Soup");
    assert.equal(r.imageUrl, "https://blog.example.com/soup.png");
  });

  it("rejects non-http image urls", () => {
    const r = extractRecipeFromHtml(
      page(`<meta property="og:image" content="javascript:alert(1)">`, ""),
      PAGE_URL,
    );
    assert.equal(r.imageUrl, null);
  });
});

describe("findRecipeTextStart", () => {
  it("skips a story that merely mentions ingredients and lands on the real list", () => {
    const story =
      "I love simple ingredients. ".repeat(20) + "Long story about my trip. ".repeat(200);
    const recipe =
      "Ingredients 2 cups rice 3 cloves garlic 1 tbsp soy sauce 2 sdm kecap manis Instructions Fry.";
    const text = story + recipe;
    const start = findRecipeTextStart(text);
    assert.ok(text.slice(start).includes("2 cups rice"));
    assert.ok(start > story.length - 700, "should start near the recipe, not the story");
  });

  it("recognises Indonesian headings", () => {
    const text =
      "Cerita panjang. ".repeat(100) +
      "Bahan-bahan: 2 siung bawang putih, 1 sdt garam, 200 gram ayam";
    assert.ok(text.slice(findRecipeTextStart(text)).includes("2 siung"));
  });

  it("falls back to the start when there is no plausible ingredient section", () => {
    assert.equal(findRecipeTextStart("Just a story with no list at all."), 0);
  });
});

describe("buildAiInputFromHtml", () => {
  it("starts at a recipe-card plugin container and includes the page title", () => {
    const html = page(
      `<meta property="og:title" content="Best Brownies">`,
      `<article><p>${"Story. ".repeat(3000)}</p>
       <div class="wprm-recipe-container wprm-recipe-template-x"><h2>Brownies</h2><ul><li>200 g chocolate</li></ul></div></article>`,
    );
    const { text, truncated } = buildAiInputFromHtml(html, 2000);
    assert.ok(text.startsWith("Page title: Best Brownies"));
    assert.ok(text.includes("200 g chocolate"));
    assert.ok(!text.includes("Story. Story."));
    assert.equal(truncated, false);
  });

  it("includes partial structured data as a hint and reports truncation", () => {
    const html = page(
      "",
      `<p>Ingredients 1 cup flour 2 eggs 1 tsp salt ${"more text ".repeat(2000)}</p>`,
    );
    const { text, truncated } = buildAiInputFromHtml(html, 1500, {
      "@type": "Recipe",
      name: "Bread",
    });
    assert.ok(text.includes("Structured recipe data found on the page"));
    assert.ok(text.includes("1 cup flour"));
    assert.ok(text.length <= 1500);
    assert.equal(truncated, true);
  });
});
