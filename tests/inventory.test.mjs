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
test("identifies password protection without retaining the password or changing status", () => {
  for (const password of ["synthetic-password", " ", ""]) {
    for (const position of ["before", "after"]) {
      const field = `<wp:post_password>${password}</wp:post_password>`;
      const xml =
        position === "before"
          ? fixture.replace("<content:encoded>", `${field}<content:encoded>`)
          : fixture.replace("</content:encoded>", `</content:encoded>${field}`);
      const report = inventory(xml);
      assert.equal(report.items[0].passwordProtected, password.length > 0);
      assert.equal(report.items[0].status, "publish");
      assert.equal(report.byStatus.publish, 2);
      assert.equal(
        report.issues.some(
          (issue) => issue.code === "password-protected" && issue.id === "1",
        ),
        password.length > 0,
      );
      assert.ok(report.items[0].flags.includes("html-script"));
      assert.ok(!JSON.stringify(report).includes("synthetic-password"));
    }
  }
  assert.equal(inventory(fixture).items[0].passwordProtected, false);
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
test("rejects malformed WXR structure instead of silently losing items or status", () => {
  for (const xml of [
    fixture.replace(
      "</content:encoded>",
      "</content:encoded><content:encoded>benign replacement</content:encoded>",
    ),
    fixture.replace(
      "</content:encoded>",
      "</content:encoded><wp:post_password>synthetic-password</wp:post_password><wp:post_password/>",
    ),
    fixture.replace(
      "<wp:status>draft</wp:status>",
      "<wp:status>draft</wp:status><wp:status>publish</wp:status>",
    ),
    fixture.replace(
      "<wp:post_id>2</wp:post_id>",
      "<item><title>nested</title></item><wp:post_id>2</wp:post_id>",
    ),
    '<rss xmlns:wp="http://wordpress.org/export/1.2/"><wp:wxr_version>1.2</wp:wxr_version></rss>',
  ])
    assert.throws(() => inventory(xml), /WXR|Duplicate|Nested/);
});
test("counts unexpected prototype-like values without losing records", () => {
  const report = inventory(
    fixture
      .replace(
        "<wp:status>draft</wp:status>",
        "<wp:status>__proto__</wp:status>",
      )
      .replace(
        "<wp:post_type>page</wp:post_type>",
        "<wp:post_type>constructor</wp:post_type>",
      ),
  );
  assert.equal(report.byStatus.__proto__, 1);
  assert.equal(report.byType.constructor, 1);
  assert.ok(report.issues.some((issue) => issue.code === "unknown-status"));
});
