import assert from "node:assert/strict";
const origin = process.env.POC_URL || "http://127.0.0.1:4321";
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
  "Local HTTP test only",
);
const cases = [
  ["/", 200, "日本語検証記事"],
  ["/posts/日本語/", 200, "日本語の本文"],
  ["/pages/about/", 200, "合成データ"],
  ["/category/tech/", 200, "日本語検証記事"],
  ["/category/cloud/", 200, "子カテゴリーの検証記事"],
  ["/category/missing/", 404, "見つかりません"],
  ["/tag/example/", 200, "日本語検証記事"],
  ["/posts/draft-only/", 404, "見つかりません"],
  ["/posts/missing/", 404, "見つかりません"],
  ["/rss.xml", 200, "<rss"],
  ["/robots.txt", 200, "Disallow: /"],
];
for (const [path, status, text] of cases) {
  const response = await fetch(new URL(path, origin));
  const body = await response.text();
  assert.equal(response.status, status, path);
  assert.ok(body.includes(text), `${path}: missing expected content`);
  assert.ok(!body.includes("DRAFT_ONLY_SECRET"), `${path}: draft leak`);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store",
    path,
  );
  assert.ok(response.headers.get("x-robots-tag")?.includes("noindex"), path);
  console.log(
    `PASS ${path}: ${status}, content, draft boundary, no-store/noindex`,
  );
}
const admin = await fetch(new URL("/_emdash/admin/", origin));
assert.equal(admin.status, 200);
assert.match(await admin.text(), /EmDash|emdash/);
console.log("PASS standard admin/setup is reachable (no account created)");
const article = await (await fetch(new URL("/posts/日本語/", origin))).text();
const expectedCanonical = new URL("/posts/日本語", origin).href;
assert.ok(
  article.includes(`rel="canonical" href="${expectedCanonical}"`),
  "article canonical uses the local origin and no trailing slash",
);
const sitemap = await (
  await fetch(new URL("/sitemap-posts.xml", origin))
).text();
assert.ok(
  sitemap.includes(`<loc>${expectedCanonical}</loc>`),
  "canonical matches standard sitemap",
);
assert.ok(!sitemap.includes("draft-only"), "sitemap excludes drafts");
const category = await (await fetch(new URL("/category/tech/", origin))).text();
assert.match(category, /<h1[^>]*>技術<\/h1>/, "taxonomy has a visible heading");
const child = await (await fetch(new URL("/category/cloud/", origin))).text();
assert.match(
  child,
  /<h1[^>]*>クラウド<\/h1>/,
  "child taxonomy has its own heading",
);
console.log("PASS canonical/sitemap agreement and taxonomy heading");
