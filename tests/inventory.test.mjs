import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inventory } from "../scripts/lib/inventory.mjs";
const fixture = readFileSync(
  new URL("./fixtures/representative.xml", import.meta.url),
  "utf8",
);
test("keeps published, draft, private and scheduled records separate", () => {
  const report = inventory(fixture);
  assert.equal(report.total, 6);
  assert.deepEqual(report.byStatus, {
    publish: 2,
    draft: 1,
    private: 1,
    future: 1,
    inherit: 1,
  });
  assert.equal(report.items.find((x) => x.id === "2").status, "draft");
  assert.ok(!JSON.stringify(report).includes("DRAFT BODY SECRET"));
});
test("preserves Japanese URL encoding, slash, timezone values and media references", () => {
  const post = inventory(fixture).items[0];
  assert.equal(
    post.url,
    "https://example.invalid/%E6%97%A5%E6%9C%AC%E8%AA%9E/",
  );
  assert.equal(post.slug, "日本語");
  assert.equal(post.dateGmt, "2026-10-01 00:00:00");
  assert.equal(post.dateLocal, "2026-10-01 09:00:00");
  assert.ok(
    post.media.includes(
      "https://example.invalid/wp-content/uploads/example.png",
    ),
  );
  assert.ok(post.flags.includes("shortcode"));
  assert.ok(post.flags.includes("html-script"));
  assert.ok(post.flags.includes("gutenberg"));
  assert.ok(post.flags.includes("embedded-content"));
});
test("flags duplicates rather than merging or silently normalizing URLs", () => {
  const report = inventory(
    fixture.replace("<wp:post_id>2</wp:post_id>", "<wp:post_id>1</wp:post_id>"),
  );
  assert.ok(report.issues.some((x) => x.code === "duplicate-id"));
});
test("rejects invalid XML, DTDs and non-WXR input", () => {
  for (const xml of [
    "<rss>",
    "<html/>",
    '<!DOCTYPE rss [<!ENTITY ex SYSTEM "file:///etc/passwd">]><rss/>',
  ]) {
    assert.throws(() => inventory(xml));
  }
});
test("supports namespace aliases used by XML exporters", () => {
  assert.equal(
    inventory(fixture.replaceAll("wp:", "w:").replace("xmlns:wp=", "xmlns:w="))
      .total,
    6,
  );
});
